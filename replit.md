# RubAI — AI Goal Coach

A mobile (Expo) AI-driven execution coach. Users describe ANY goal (custom or one of five templates: IELTS prep, programming, fitness, financial improvement, buying a car). RubAI then generates a tailored intake form, synthesises a structured `UserProfile`, builds a multi-phase roadmap, produces a fresh daily plan, and chats as an adaptive coach.

The app supports MULTIPLE concurrent goals. The number of active goals is gated by a (demo) subscription tier:
- **Free** — 1 goal
- **Pro** — 5 goals
- **Premium** — 25 goals

The subscription is stored locally with no real payments — users can switch tiers freely from the Account tab.

## Architecture

Monorepo (pnpm) with three artifacts:

- `artifacts/mobile` — Expo React Native app (the user-facing product). All persistence is client-side via AsyncStorage; no database.
- `artifacts/api-server` — Express server providing AI endpoints under `/api/atlas/*`. Calls OpenAI via `@workspace/integrations-openai-ai-server` (model `gpt-5.4` with `json_schema` structured outputs).
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

## Theme

Warm cream + emerald + amber palette; Inter for typography. `constants/colors.ts` defines `light` and `dark` palettes consumed via `hooks/useColors.ts`. No emojis anywhere; iconography via `@expo/vector-icons` and SF Symbols (iOS).

## Environment

- `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` — wired via the OpenAI integration; do not handle directly.
- `EXPO_PUBLIC_DOMAIN` — provided by Expo workflow; used by the mobile bundle to call the API.

## Key files

- `artifacts/api-server/src/routes/atlas.ts` — all Atlas endpoints (structured outputs).
- `artifacts/api-server/src/routes/index.ts` — mounts the atlas router at `/atlas`.
- `lib/api-spec/openapi.yaml` — single source of truth for the API contract.
- `artifacts/mobile/providers/AtlasProvider.tsx` — multi-goal state + persistence + ref-based callbacks.
- `artifacts/mobile/types/atlas.ts` — `Goal`, `Subscription`, `IntakeDraft`, `TIER_INFO` and helpers.
- `artifacts/mobile/constants/atlas.ts` — goal-template metadata (label, tagline, icon, default titles).
- `artifacts/mobile/lib/storage.ts` — AsyncStorage helpers, v2 keys, and v1 migration reader.
- `artifacts/mobile/components/IntakeForm.tsx` — renders the AI-generated questions with validation.
- `artifacts/mobile/components/SubscriptionCard.tsx` — shows current tier, usage bar, and tier switcher.
- `artifacts/mobile/components/GoalListItem.tsx` — row in the Goals tab with active/switch/delete actions.
- `artifacts/mobile/components/ActiveGoalChip.tsx` — header chip showing which goal a tab is currently viewing.
- `artifacts/mobile/components/ReflectionSheet.tsx` — modal sheet for capturing a reflection (reason chips + note) on any task.
