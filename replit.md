# RubAI — AI Goal Coach

A mobile (Expo) AI-driven execution coach. Users describe ANY goal (custom or one of five templates: IELTS prep, programming, fitness, financial improvement, buying a car). RubAI then generates a tailored intake form, synthesises a structured `UserProfile`, builds a multi-phase roadmap, produces a fresh daily plan, and chats as an adaptive coach.

The app supports MULTIPLE concurrent goals. The number of active goals is gated by a server-controlled subscription tier returned with every authed request:
- **Free** — 1 goal
- **Pro** — 5 goals
- **Premium** — 25 goals

Tier is set server-side (`users.tier` column) — there's no in-app upgrade flow yet (no Stripe / RevenueCat). The Account screen displays the current tier read-only.

## Architecture

Monorepo (pnpm) with three artifacts:

- `artifacts/mobile` — Expo React Native app (the user-facing product). Server is the source of truth; per-user AsyncStorage snapshot acts as a fast-paint cache only.
- `artifacts/api-server` — Express server providing AI endpoints under `/api/atlas/*` (auth-required) and per-user cloud state at `/api/me/*`. Calls OpenAI via `@workspace/integrations-openai-ai-server` (model `gpt-5.4` with `json_schema` structured outputs). Uses Clerk for auth and Drizzle/Postgres for persistence.
- `artifacts/mockup-sandbox` — sandbox for design exploration (registered but unused in this product).

API contract lives in `lib/api-spec/openapi.yaml`; running `pnpm --filter @workspace/api-spec run codegen` regenerates:
- `lib/api-client-react/src/generated/api.ts` — typed React Query hooks and TS types
- `lib/api-zod/src/generated/api.ts` — Zod schemas used by the server for validation

## API endpoints (all under `/api/atlas`)

- `POST /intake-questions` — given `goalType` + `goalTitle`, generates a tailored 5–8 question form.
- `POST /intake-submit` — given the answered questions, synthesises a structured `UserProfile`.
- `POST /roadmap` — given a `UserProfile`, returns a multi-phase `Roadmap` with milestones, strategy, and risk analysis.
- `POST /daily-plan` — given the profile + roadmap + behavioural snapshot, returns today's 3–5 tasks tuned to recent behaviour and the active phase.
- `POST /coach` — free-form coach chat with full plan + behavioural context.
- `POST /adapt` — runs the adaptive engine: returns `easier | same | harder` plus concrete adjustments.
- `POST /behavioral-profile` — builds or evolves the cumulative `BehavioralProfile` (summary, consistency, workload tolerance, motivation trend, focus/learning style, peak hours, failure patterns, strengths, recommended adjustments) from recent task history + reflections + the previous profile. Returns `{ profile, aiInsight }`.

The `daily-plan` and `coach` requests both accept an optional `learnedProfile: BehavioralProfile` field; when present, it is summarised into the system prompt so the AI plans/responds in line with the user's learned patterns (respect peak hours, honour workload tolerance, avoid known failure patterns).

The legacy `POST /onboarding-chat` endpoint is retained for backwards compatibility but no longer used by the app.

## Mobile app structure

Routes (expo-router):
- `app/_layout.tsx` — providers (QueryClient, AtlasProvider, KeyboardProvider, GestureHandler, SafeArea), font loading, splash control. Sets the API base URL via `setBaseUrl`.
- `app/index.tsx` — boot router; routes to `/welcome`, `/intake`, `/generating`, or `/(tabs)` based on `pendingDraft.stage` and whether any goals exist.
- `app/welcome.tsx` — first-run goal entry: free-text custom goal OR one of 5 templates.
- `app/new-goal.tsx` — same picker, used for adding additional goals when on Pro/Premium.
- `app/intake.tsx` — renders the AI-generated intake form. Calls `intake-questions` then `intake-submit`.
- `app/generating.tsx` — animated roadmap loader. Calls `createGoal(profile)` (which returns the new `Goal`) then `setRoadmapForGoal(newGoal.id, roadmap)`. Recovers the synthesised profile from `pendingDraft.synthesizedProfile` if route params are missing.
- `app/(tabs)` — main app: **5 tabs** — Today / Roadmap / Coach / Goals / Account. Native tabs on iOS via `expo-router/unstable-native-tabs` when liquid glass is available; classic blurred tabs otherwise.

State lives in `providers/AtlasProvider.tsx` and is persisted to AsyncStorage with the `atlas:v2:` prefix. The provider keeps a list of `Goal`s plus an `activeGoalId`; tab screens read from `active*` accessors (`activeRoadmap`, `activeProfile`, `activeDailyPlan`, etc.). When the active goal changes, all tab screens automatically reflect the new context.

The provider uses **refs** (`goalsRef`, `activeIdRef`, `subscriptionRef`) alongside React state so chained async callbacks always see the latest values — this prevents stale-closure bugs when, e.g., creating a goal and immediately attaching a roadmap.

The `BehavioralSnapshot` (streak, completion rate, recent completed/missed task titles) is computed per-active-goal from local task history.

### Reflections + behavioural profile (Phase 1)

Each `Goal` carries two extra fields persisted in AsyncStorage:
- `reflections: ReflectionEntry[]` — capped at the last 50 entries (`taskId`, `taskTitle`, `date`, `completed`, optional `reasonTag` and free-text `note`, `reflectedAt`).
- `behavioralProfile: BehavioralProfile | null` — the cumulative learned profile, evolved over time.

`TaskCard` exposes a "Reflect" pill (also accessible via long-press) that opens `ReflectionSheet`, a modal with reason chips (Easy / Just right / Tough / No time / Distracted / Blocked / etc.) plus an optional note field. Submission calls `recordActiveReflection(entry)` on the provider, which both appends the reflection and mirrors `reasonTag` / `note` onto the matching `TaskHistoryEntry`. Submission then fires a background `useAtlasBehavioralProfile` mutation and stores the returned profile via `setActiveBehavioralProfile`.

The Account tab shows an Insights section: profile summary, trait grid (consistency / workload tolerance / motivation trend / focus style), peak hours, strengths, watch-outs, and the last three reflections. A "Refresh insights" button calls the same endpoint manually and surfaces `aiInsight` as a small banner.

`Goal`s stored before this layer are backfilled at load time via `ensureGoalShape()` so the new fields are always defined.

### Adaptive roadmap (Phase 2)

The roadmap evolves over time so it stays accurate to how the user actually executes — it's not regenerated from scratch.

`Goal` carries two more fields, also backfilled by `ensureGoalShape()`:
- `roadmapEvolutions: RoadmapEvolutionEntry[]` — most-recent-first log of evolutions, capped at 10. Each entry holds `evolvedAt`, `trigger` (`manual` | `auto`), `changeSummary`, `rationale`, and `phaseChanges`.
- `lastEvolvedAt: string | null` — drives both the auto-trigger throttle and the "Last evolved …" label in the UI.

The provider exposes `applyRoadmapEvolution(goalId, roadmap, entry)`, `activeRoadmapEvolutions`, and `activeLastEvolvedAt`. All API + threshold logic lives in the `useEvolveRoadmap()` hook (`hooks/useEvolveRoadmap.ts`):
- `evolve(trigger)` — always fires the request, applies the result, logs the entry. When the AI returns `hasChanged=false` the existing roadmap is kept but the entry is still recorded so the user sees we checked. The goal id and source roadmap are pinned at request-start, so a mid-flight goal switch can't land an evolution on the wrong goal.
- `maybeAutoEvolve()` — fires only when there's a roadmap, a learned profile, ≥3 reflections since `lastEvolvedAt` (or ≥3 total if never evolved), and ≥3 days have passed.
- A module-level `inFlightByGoal` map dedupes by goal id across hook instances, so a manual tap during an in-flight auto evolve coalesces into the same request rather than firing a second one.

Auto-trigger is self-driven by a `useEffect` inside the hook keyed on `(activeGoalId, activeReflections.length, activeBehavioralProfile?.updatedAt, activeLastEvolvedAt)` — that way it always sees the freshly-flushed state instead of a stale closure from inline `.then(...)` callers. Today mounts the hook so a reflection submit will trigger it once the new profile and reflection have settled into context. Manual trigger lives in the new `AdaptiveEngineCard` at the top of the Roadmap tab — it shows the latest `changeSummary`, an expandable per-phase change list with ADDED / REMOVED / MODIFIED badges and the rationale, plus an "Evolve roadmap now" button. Phases that the latest evolution flagged as added or modified render an "UPDATED" chip on `PhaseCard`.

The endpoint preserves progress: it keeps phase ids stable, only restructures upcoming phases, stays within ±2 weeks of the original total duration, and respects the learned profile's peak hours, workload tolerance and recommended adjustments.

### Context-aware coach with memory (Phase 3)

The coach grounds every reply in the user's current situation and remembers what matters across sessions instead of treating every chat as a blank slate.

`Goal` carries one more field, backfilled by `ensureGoalShape()`:
- `coachMemory: CoachMemory | null` — `{ summary, facts[], updatedAt }`. The summary is a rolling paragraph the coach replaces each turn it learns something; facts is an append-only list (deduped, capped at 20) of durable signals (injuries, schedule constraints, triggers).

The provider exposes `activeCoachMemory`, `setActiveCoachMemory(memory)`, `applyCoachMemoryUpdate({ summary, newFacts })` (merges with case-insensitive dedupe and a 20-fact cap), plus a memoized `activeCurrentPhase: CurrentPhaseSnapshot | null` selector that finds the phase whose `[startWeek, endWeek]` contains `activeCurrentWeek` and reports `weekIntoPhase`.

Server `/atlas/coach` (`artifacts/api-server/src/routes/atlas.ts`) is a strict `json_schema` call. `buildCoachContext()` assembles labelled blocks for GOAL, ROADMAP, CURRENT PHASE, TODAY, BEHAVIOUR, REFLECTIONS, EVOLUTIONS, LEARNED PROFILE, and COACH MEMORY. The system prompt forces the model to ground replies in those blocks, propose a `memoryUpdate` only when something durable was revealed, and emit 1–3 short context-specific `suggestedReplies`. Defensive clamps keep `suggestedReplies` ≤3 (each ≤80 chars), restrict `actionSuggestion.kind` to `evolve_roadmap | refresh_insights | reflect_on_task | none`, and bound `memoryUpdate.summary` (≤600 chars) and `newFacts` (≤5, each ≤140 chars).

Mobile coach UX (`app/(tabs)/coach.tsx`):
- Each request now ships `currentWeek`, `currentPhase`, last 5 reflections, last 2 evolutions, and `coachMemory`.
- After each turn the screen appends the assistant reply, calls `applyCoachMemoryUpdate` if the response includes one, and stores `suggestedReplies` + `actionSuggestion` in ephemeral state cleared on the next turn.
- A footer below the chat list renders an `ActionCard` (when `actionSuggestion.kind !== "none"`) and a row of suggested-reply chips. The CTA dispatches to `useEvolveRoadmap().evolve("manual")` for `evolve_roadmap`, navigates to `/account` for `refresh_insights`, or `/` for `reflect_on_task`.
- A collapsible "What RubAI remembers" banner sits at the top of the screen showing the rolling summary, expandable into facts pills + a "Forget everything" button that calls `setActiveCoachMemory(null)`.

### Storage migration

On first load, the provider reads any pre-existing `atlas:v1:*` keys (the legacy single-goal layout) and migrates them into the new `atlas:v2:goals` array as a single goal with active focus. A `migrated` flag is set so the migration only runs once.

### Subscription gating

Enforced in two places (defence-in-depth):
- UI: `(tabs)/goals.tsx` and `welcome.tsx` / `new-goal.tsx` check `canAddMoreGoals` and disable the entry point when the limit is reached.
- Provider: `createGoal` throws a `GoalLimitError` if the current goal count already equals the tier limit.

### Cloud sync (Phase 4)

Auth — Clerk (`@clerk/expo`):
- `app/_layout.tsx` wraps the tree in `ClerkProvider` (with a SecureStore `tokenCache`) and `ClerkLoaded`. An `AuthGate` reads `useAuth().getToken()` and feeds it into the API client (`setAuthTokenGetter`) so every authed request carries `Authorization: Bearer <session JWT>`. Signed-out users are redirected to `/sign-in`; signed-in users sitting on `/(auth)` routes are redirected to `/`.
- Auth screens live in `app/(auth)/sign-in.tsx` and `sign-up.tsx` — branded Email+Password forms plus "Continue with Google" via `useOAuth({ strategy: "oauth_google" })` with `expo-auth-session` + `expo-web-browser`.
- The Clerk publishable key is forwarded into the Expo bundle as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (wired through `package.json` dev script and `build.js`).

Server (`artifacts/api-server`):
- `src/middleware/clerk.ts` runs Clerk's Express middleware, then `requireClerkAuth` ensures `req.auth.userId` exists. `clerkProxyMiddleware` upserts a row in `users` on every authed request (so the very first request from a brand-new Clerk user provisions a record with `tier: "free"`).
- `src/routes/me.ts` exposes:
  - `GET /api/me/state` — returns `{ version, tier, goals, activeGoalId, accountPrefs, pendingDraft }`. Auto-creates an empty `user_state` row at `version=0` when missing.
  - `PUT /api/me/state` — body includes `expectedVersion`. Mismatch returns **409** with the latest server snapshot in the body (typed as `MeStateConflictResponse`); success bumps the version and echoes the new state.
- `src/routes/atlas.ts` is now mounted behind `requireClerkAuth` so the AI endpoints can't be called anonymously.
- Schema (`src/db/schema.ts`): `users(id pk = clerk userId, email, tier)` and `user_state(user_id pk fk → users.id, version, goals jsonb, active_goal_id, account_prefs jsonb, pending_draft jsonb, updated_at)`. Migrations live under `artifacts/api-server/drizzle/`.

Mobile sync model (`artifacts/mobile/providers/AtlasProvider.tsx`):
- Server is source of truth. On sign-in, the provider:
  1. Fast-paints from a per-user cache snapshot (`atlas:cache:<clerkUserId>`) if present.
  2. GETs `/me/state`. If `version === 0 && goals.length === 0` AND `migrated:<clerkUserId>` is unset AND legacy `atlas:v2:goals` exists locally → PUTs the legacy data with `expectedVersion=0`, sets the migrated flag, then adopts the uploaded snapshot.
  3. Otherwise adopts the server snapshot directly and sets the migrated flag.
- Mutations are optimistic + coalesced: any local edit marks `pushDirty`; a single `pushInFlight` PUT runs at a time, and another push is auto-queued if more edits land mid-flight. Each successful PUT stores the new `version` and rewrites the per-user cache.
- 409 handling: when `ApiError.status === 409`, the provider drops the optimistic state, adopts `MeStateConflictResponse.latest`, and surfaces a one-shot "Synced from another device" banner on the Account tab (dismissible).
- Tier is server-controlled. `subscription` remains a derived view (`{ tier, limit }`) for back-compat with existing UI gating; `updateSubscription` is a no-op stub (real upgrades require a billing integration).
- Sign-out (`signOut()`): clears the per-user cache snapshot, calls Clerk `signOut()`, resets in-memory state. The `migrated:<clerkUserId>` flag is intentionally **kept** so re-signing in on the same device doesn't re-migrate already-synced legacy data.
- Account tab (`app/(tabs)/account.tsx`) shows the signed-in email (from `useUser()`), the read-only plan badge, the goals/limit usage, the sync banner, an Insights section, and a "Sign out" button.

Storage keys (per-user namespacing):
- `atlas:cache:<clerkUserId>` — JSON snapshot for fast-paint (cleared on sign-out).
- `atlas:migrated:<clerkUserId>` — boolean flag, kept across sign-outs.
- `atlas:v2:*` — legacy single-tenant keys; read-only after Phase 4 (consumed once by the migration path).

API client (`lib/api-client-react/src/index.ts`):
- `setAuthTokenGetter(fn)` is called from `AuthGate`; the generated fetch helper attaches `Authorization: Bearer <token>` when the getter resolves to a token.
- `ApiError` (exported) is thrown for non-2xx responses and exposes `status` + parsed `data` so the provider can switch on 409 vs other failures.

## Theme

Warm cream + emerald + amber palette; Inter for typography. `constants/colors.ts` defines `light` and `dark` palettes consumed via `hooks/useColors.ts`. No emojis anywhere; iconography via `@expo/vector-icons` and SF Symbols (iOS).

## Environment

- `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` — wired via the OpenAI integration; do not handle directly.
- `EXPO_PUBLIC_DOMAIN` — provided by Expo workflow; used by the mobile bundle to call the API.
- `CLERK_SECRET_KEY` (server) and `CLERK_PUBLISHABLE_KEY` (server, also forwarded to Expo as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`) — managed via Replit's Clerk integration. Never read or print these directly.
- `DATABASE_URL` — Replit Postgres for `users` + `user_state` tables.

## Key files

- `artifacts/api-server/src/routes/atlas.ts` — all Atlas endpoints (structured outputs), behind `requireClerkAuth`.
- `artifacts/api-server/src/routes/me.ts` — `GET`/`PUT /api/me/state` with optimistic-concurrency `expectedVersion`.
- `artifacts/api-server/src/middleware/clerk.ts` — Clerk Express middleware + `requireClerkAuth` + `clerkProxyMiddleware` (user upsert).
- `artifacts/api-server/src/db/schema.ts` — Drizzle schema for `users` + `user_state`.
- `artifacts/api-server/src/routes/index.ts` — mounts `/me` and the auth-protected `/atlas` router.
- `lib/api-spec/openapi.yaml` — single source of truth for the API contract.
- `lib/api-client-react/src/index.ts` — public surface (`setAuthTokenGetter`, `setBaseUrl`, `ApiError`, generated hooks).
- `artifacts/mobile/app/_layout.tsx` — ClerkProvider + AuthGate (token getter wiring + auth redirects).
- `artifacts/mobile/app/(auth)/sign-in.tsx`, `sign-up.tsx` — branded auth screens.
- `artifacts/mobile/providers/AtlasProvider.tsx` — API-backed multi-goal state, version-based optimistic sync, first-sign-in migration.
- `artifacts/mobile/types/atlas.ts` — `Goal`, `Subscription`, `IntakeDraft`, `TIER_INFO` and helpers.
- `artifacts/mobile/constants/atlas.ts` — goal-template metadata (label, tagline, icon, default titles).
- `artifacts/mobile/lib/storage.ts` — AsyncStorage helpers, v2 keys, and v1 migration reader.
- `artifacts/mobile/components/IntakeForm.tsx` — renders the AI-generated questions with validation.
- `artifacts/mobile/components/SubscriptionCard.tsx` — shows current tier, usage bar, and tier switcher.
- `artifacts/mobile/components/GoalListItem.tsx` — row in the Goals tab with active/switch/delete actions.
- `artifacts/mobile/components/ActiveGoalChip.tsx` — header chip showing which goal a tab is currently viewing.
- `artifacts/mobile/components/ReflectionSheet.tsx` — modal sheet for capturing a reflection (reason chips + note) on any task.

## Production architecture (plain language)

This is the simplest reliable shape for shipping RubAI. Everything runs on Replit so you have one bill, one dashboard, and one place to look when something breaks.

### Where each piece lives

- **Mobile app (Expo / React Native).** Built and distributed through Expo. In development it runs from the Replit dev server; for production you build native binaries with EAS and ship them to the App Store / Play Store. The compiled app talks to the backend over HTTPS — it does NOT need to be redeployed when you change the server.
- **Backend API (`artifacts/api-server`).** A small Express service. Recommended deployment: **Replit Autoscale Deployment**. It scales to zero when idle (cheap), wakes on traffic, and serves over HTTPS at your `*.replit.app` (or a custom) domain. The mobile app points to this URL via `EXPO_PUBLIC_DOMAIN`.
- **Database (Postgres).** Replit Postgres. The same `DATABASE_URL` is used in development and production — for production set it as a secret on the deployment so it points at a separate prod database. Drizzle manages the schema: run `pnpm --filter @workspace/db run push` to apply schema changes.
- **Auth (Clerk).** Hosted by Clerk; we never store passwords. The mobile app gets a session token from Clerk; the backend verifies that token on every request via `requireAuth`, then looks up (or auto-creates) the matching row in our `users` table.
- **AI (OpenAI).** Calls go through Replit's OpenAI integration. Keys live in Replit Secrets — they are never in code, never in git.

### Secrets

All secrets are managed in **Replit Secrets** (one set for development, a separate set on the deployment). Required:

- `DATABASE_URL` — Postgres connection string.
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` — from the Clerk integration.
- `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` — from the OpenAI integration.
- `SESSION_SECRET` — used for cookie signing.

Never read or print secret values from chat or logs.

### Database tables (one line each)

- `users` — one row per Clerk user. Stores `clerkUserId`, `email`, and `tier` (free / pro / etc).
- `user_state` — the entire app state for one user (goals, account, draft) as a single JSON blob, plus a `version` integer used for optimistic concurrency so two devices can't silently overwrite each other.
- `conversations` / `messages` — per-goal coach chat history, kept server-side so it persists across devices.
- `subscriptions` — *future-ready, not yet wired.* One row per paid subscription per user, with provider (`revenuecat` / `stripe`), product id, status, period end, store transaction id, and the raw webhook payload.
- `analytics_events` — lightweight product analytics (`user.signed_up`, future events). `payload` is JSONB so you can add fields without migrations.
- `ai_usage` — every AI call: which user, which route, which model, input/output tokens, latency, and ok/error status. This is your cost dashboard and your abuse early-warning system.

You can browse all of these in the Replit Database pane (development) or via `psql $DATABASE_URL` against the production instance.

### Operational guardrails already in place

- **Per-user rate limiting** on all `/atlas/*` AI endpoints (60 requests/minute/user). Stops runaway loops and abusive scripts before they generate a surprise OpenAI bill.
- **AI usage logging** writes a row to `ai_usage` for every OpenAI call. Failures to log are swallowed so they never break a user's request.
- **Optimistic concurrency** on `user_state` means a stale device gets a `409` and resyncs instead of clobbering newer data.
- **Pino structured logs** on every request (`req.log.info(...)` / `req.log.error(...)`). Visible in the Replit logs pane.

### When you're ready for payments

You do not need to migrate any existing data — the `subscriptions` table is already there. To switch payments on:

1. Pick a provider — **RevenueCat** (recommended for mobile) or **Stripe**.
2. Add the provider's webhook endpoint to the API server (e.g. `POST /api/webhooks/revenuecat`). On every webhook, upsert a row in `subscriptions` keyed by `(provider, store_transaction_id)`.
3. In `requireAuth` (or a small helper), read the latest active row for the user and resolve `users.tier` from it (e.g. active `pro_monthly` → tier `pro`).
4. The mobile app already reads the tier returned by the server and gates features accordingly — no client changes required for the basic flow.

Read `.local/skills/revenuecat/SKILL.md` (mobile in-app purchase) or `.local/skills/stripe/SKILL.md` (web checkout) when you start that work.
