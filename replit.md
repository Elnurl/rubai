# rubai — AI Goal Coach

## Overview

rubai is a mobile AI-driven execution coach designed to help users achieve any goal. It allows users to define custom goals or select from templates, generating tailored intake forms, synthesizing a UserProfile, building multi-phase roadmaps, creating daily plans, and acting as an adaptive coach. The application supports multiple concurrent goals, with tiered access based on subscription level.

## User Preferences

The user prefers an iterative development approach. They want the agent to ask before making major changes and to provide detailed explanations for proposed modifications. The agent should prioritize stability and avoid breaking existing functionalities. The user also prefers clear and concise communication, focusing on actionable steps.

## System Architecture

The project is a monorepo built with pnpm, consisting of a mobile Expo React Native app, an Express API server, and a mockup sandbox. The mobile app (`artifacts/mobile`) is the user-facing product, caching data locally and relying on the API server (`artifacts/api-server`) as the source of truth for cloud state. The API server provides AI-driven endpoints using OpenAI (gpt-5.4/gpt-4o), Clerk for authentication, and Drizzle/Postgres for persistence. The API contract is defined in `lib/api-spec/openapi.yaml`, generating typed React Query hooks and Zod schemas.

Key API endpoints handle:
- Generating tailored intake forms and synthesizing `UserProfile`s.
- Creating multi-phase `Roadmap`s with risk analysis.
- Generating daily tasks (`DailyPlan`).
- Providing context-aware AI coaching, including voice input/output and image attachments via `gpt-4o` for vision turns.
- Transcribing audio via OpenAI Whisper.
- Adaptive engine for adjusting task difficulty.
- Building and evolving cumulative `BehavioralProfile`s.

The mobile app uses `expo-router` for navigation, state is managed by `AtlasProvider.tsx` with AsyncStorage for persistence, and features include task reflections, adaptive roadmaps, and a context-aware coach. UI/UX features a warm color palette (cream, emerald, amber) and Inter typography.

### AI Infrastructure (api-server)

- `lib/aiUsage.ts` — `trackedCreate` and `trackedStream` wrap every chat completion and record (model, tokens, latency, status) into `ai_usage` for cost monitoring; failures never block user-facing responses. On retryable OpenAI errors (429/408/5xx, connection/timeout, undici socket failures, fetch failures with nested cause) both helpers fail over to Anthropic Claude via `lib/aiFailover.ts` — non-streaming returns a synthetic OpenAI-shaped `ChatCompletion`; streaming falls back to a non-streaming Anthropic call and synthesises one full delta + final chunk so SSE consumers stay compatible. Failover is gated on `isAnthropicConfigured()` so a missing Anthropic env config degrades to "no failover" instead of a startup crash.
- `lib/aiFailover.ts` — pure conversion helpers: `isRetryableProviderError` (walks `err.cause` chain up to depth 5), `pickAnthropicModel` (maps OpenAI tiers to Claude sonnet/haiku via `ANTHROPIC_MODEL_*` envs), `toAnthropicParams` (lifts system messages, base64-decodes data-URL images, clamps `max_tokens` to 8192, converts `response_format: json_schema` into a forced single-tool `tool_use` so strict JSON output round-trips), and `fromAnthropicMessage` (rebuilds `ChatCompletion`-shaped output, JSON.stringifies tool_use input so existing `JSON.parse(choices[0].message.content)` callers keep working).
- `lib/integrations-anthropic-ai` — workspace package with a lazy `getAnthropic()` client (env vars only enforced on first use) and `isAnthropicConfigured()`.
- `lib/aiConfig.ts` — env-driven model selection (`MODEL_SMART`/`MODEL_FAST`/`MODEL_VISION`/`MODEL_MODERATION`, `ANTHROPIC_MODEL_SMART`/`FAST`/`VISION`), `pickCoachModel` (treats `undefined`/`"smart"` as smart per existing API contract; `"auto"` enables a length+turn heuristic; `"fast"` is honored), and `moderateOrThrow` which runs OpenAI moderation on coach input and returns 400 for flagged or oversized (>8000 char) text before any smart-model spend.
- `lib/replyTextExtractor.ts` — incremental JSON-string decoder used by `POST /atlas/coach/stream` to surface the `reply` field as tokens arrive (handles `\uXXXX` split across chunk boundaries, including surrogate pairs).
- `lib/dailyPlanCache.ts` — in-process LRU (24h TTL, 2000 entries, JSON-serialised on set/get to prevent shared-reference mutation, `CACHE_VERSION` salt for prompt/schema bumps) used by `POST /atlas/daily-plan` to deduplicate identical regenerations.
- **Strict structured-output handling (Phase 3 of 3 — DONE, all 11 sites covered):** every JSON-producing AI site uses OpenAI strict structured output. `lib/strictJson.ts` provides `parseAndValidate(content, refusal, validator)` (refusal/empty/parse/validation taxonomy, throws typed `StrictJsonError`) and `strictJsonCompletion(req, params, validator, opts?)` which wraps `trackedCreate`, retries ONCE on parse/validation failure with a stricter system addendum citing the prior validation error, and never retries refusals. **Phase 3 collapsed the dual hand-written `<name>Schema` JSON constants + loose `<name>Validator` Zod mirrors into a SINGLE Zod source of truth per call.** Each endpoint now defines one strict Zod validator (no `.optional()`, no `.passthrough()`; `.nullable()` for null-allowed fields; every property required) and passes it to `zodResponseFormat(validator, "name")` (from `openai/helpers/zod`) for the wire request AND to `strictJsonCompletion` for runtime validation, so the constraint sent to the model and the parser used afterwards can never drift. Validators live in `routes/atlas.ts` after the prompt helpers: `coachResponseValidator` (composed from `coachActionSuggestionValidator`/`coachMemoryUpdateValidator`/`coachProposedTaskValidator`/`coachProposedActionValidator` parts), `profileExtractorValidator` (shares `profileFieldsValidator` with `intakeProfileValidator`), `roadmapValidator` (with extracted `roadmapPhaseValidator`/`roadmapMilestoneValidator`; reused inside `roadmapEvolutionValidator.evolvedRoadmap`), `dailyPlanValidator` (with `dailyPlanTaskValidator`), `adaptValidator`, `generateTitleValidator`, `intakeQuestionsValidator` (with `intakeQuestionValidator`; original `minItems:6/maxItems:10` enforced via system prompt only to avoid relying on zod-to-json-schema preserving constraints under strict mode), `intakeProfileValidator`, `behavioralProfileValidator` (with `behavioralProfileFieldsValidator`), `roadmapEvolutionValidator` (with `roadmapPhaseChangeValidator`). All 11 sites covered: `/coach` (refusal→400), `/coach/stream` (uses `parseAndValidate` at end-of-stream — no mid-flight retry possible — degrades gracefully on validation failure since the user already saw the streamed `reply` text via `ReplyTextExtractor`; the final SSE event simply lacks structured action fields; surfaces a distinct error event for refusals via accumulated `delta.refusal`), `/onboarding-chat` extraction call (the conversational call stays as-is — it's not a structured-output call), `/roadmap`, `/daily-plan`, `/adapt`, `/intake-questions`, `/intake-submit`, `/behavioral-profile`, `/evolve-roadmap` — all surface `StrictJsonError` of `kind === "refusal"` as HTTP 400, other failures as 500. `/generate-title` is the one intentional exception: it uses `strictJsonCompletion` to get the free retry, but its outer catch swallows ANY error (including refusal) and falls back to the trimmed user input as the title so the create-goal flow never hard-blocks. **Net Phase 3 diff: atlas.ts -405 lines after deleting all 10 hand-written JSON schemas.** Two architect-flagged regressions fixed in the same migration: (1) `/coach/stream` now mirrors every emitted reply token into a `streamedReply` accumulator and, on end-of-stream parse/validation failure, injects it as the canonical `reply` so the persisted chat history matches what the user already saw on screen instead of being overwritten by `normalizeCoachOutput({})`'s generic "I'm here. Tell me a bit more…" fallback (only structured action/memory fields degrade to null in that path); (2) restored the original wire-schema bounds on `coachResponseValidator.suggestedReplies` (≤3 items, each ≤50 chars) and `intakeQuestionsValidator.questions` (6-10) so Phase 3 doesn't silently broaden the contract — these length/count constraints are preserved by zod-to-json-schema under OpenAI strict mode and `strictJsonCompletion`'s single retry handles the rare out-of-bound output.
- **RAG corpus (Phase 1 of 3 — foundation only):** the `embeddings` table (pgvector, 1536-dim, HNSW cosine index, unique on `(user_id, content_type, content_id)`) stores indexed chunks of user-generated text. `lib/embeddings.ts` (`embedTexts`/`embedOne`) batches OpenAI `text-embedding-3-small` calls (96 inputs/batch, 8000-char clamp) with per-batch `ai_usage` tracking; no Anthropic failover (Anthropic has no embeddings endpoint). `lib/embeddingsIndexer.ts` defensively walks `user_state.goals[]` JSONB and emits chunks for `learnedProfile` fields, `reflections`, `coachMemory` facts/summaries, `evolutions`, and `plan` tasks (each with a stable `contentId` like `goal:<goalId>:<type>:<key>`). `indexUserGoals` (1) prunes stale rows per content-type via `notInArray` so deletions propagate, (2) compares SHA-256 hashes (in `metadata.text_hash`) to skip unchanged chunks, (3) batch-embeds the rest, (4) upserts in a single transaction. `routes/me.ts` calls `indexUserGoalsAsync` fire-and-forget after every successful PUT `/me/state`. **Phase 2 (DONE):** `lib/ragRetrieval.ts` exposes `retrieveRelevantContext(req, userId, queryText, opts?)` — embeds the latest user turn via `embedOne`, runs an inline pgvector `<=>` cosine query scoped to `user_id`, top-K=6, drops matches with distance > 0.45, requires ≥2 hits before injection. Wired into both `/coach` and `/coach/stream` as a "RELEVANT MEMORY" block appended to `systemContext`. Hard 350ms latency budget via `Promise.race` so a slow embeddings endpoint or DB hiccup never stalls the coach turn; on timeout/failure we just skip injection (the existing `buildCoachContext` block always runs). **Phase 3 (DONE):** `users.embedding_fingerprint` TEXT column + `computeChunkFingerprint(chunks)` — versioned (`EMBEDDING_INDEX_VERSION`), order-stable SHA-256 over the precise `(contentType, contentId, sourceText)` triples that would actually be written. `indexUserGoals` short-circuits when the fingerprint is unchanged from the last successful pass (no chunk extraction, no DB read, no embed call), persists the fingerprint after a successful prune even when there are no chunks (so empty states stay short-circuited), and only stamps the fingerprint when every chunk that needed embedding actually got one (failed embedding batches retry next pass). Single big upsert transaction was replaced with per-batch transactions of `UPSERT_BATCH_SIZE=50` so a 200-chunk re-index commits four small transactions instead of one long-running lock.

Cloud sync operates with the server as the source of truth, utilizing optimistic mutations, coalescing, and conflict resolution. Subscription gating is enforced both client and server-side. Authentication is managed by Clerk, with custom branded screens for various flows. `AuthGate` ensures proper routing for signed-out users, new users creating goals, and existing users with goals, also enforcing legal acceptance (GDPR) before product access, requiring users to accept Privacy Policy and Terms of Service. Push notifications are implemented via Expo Push, with server-side scheduling for morning nudges. Calendar synchronization allows users to connect native calendars for context and to write planned tasks to their calendars, governed by explicit, granular consent settings.

### Workflow port-cleanup preamble

All three workspace `dev` scripts (`artifacts/mobile`, `artifacts/api-server`, `artifacts/mockup-sandbox`) prefix their command with `fuser -k -n tcp $PORT 2>/dev/null; sleep 1;` so that orphan processes from a previous run do not hold the port and force Expo's Metro bundler to prompt `Use port N+1 instead? (Y/n)` (which then blocks the workflow indefinitely on stdin). `lsof` is intentionally NOT used — it is not present in the Replit Nix environment and silently no-ops, which was the original cause of the Expo "preview Failed to fetch" bug.

## External Dependencies

- **OpenAI:** Used for AI model interactions (gpt-5.4, gpt-4o for vision, Whisper for transcription, omni-moderation for input safety). Model names and the moderation model are env-driven via `OPENAI_MODEL_SMART`, `OPENAI_MODEL_FAST`, `OPENAI_MODEL_VISION`, `OPENAI_MODEL_MODERATION` (see `artifacts/api-server/src/lib/aiConfig.ts`).
- **Anthropic Claude:** Failover provider (claude-sonnet-4-6, claude-haiku-4-5) wired via `lib/integrations-anthropic-ai`. Used automatically by `trackedCreate`/`trackedStream` only when OpenAI returns a retryable error.
- **pgvector 0.8.0:** PostgreSQL extension powering the RAG corpus. Single `embeddings` table; HNSW cosine index for similarity search.
- **Clerk:** Authentication and user management.
- **PostgreSQL (via Drizzle ORM):** Database for `users` and `user_state`.
- **Expo:** React Native framework, including `expo-router`, `expo-notifications`, `expo-device`, `expo-audio`, `expo-speech`, `expo-image-picker`, and `expo-calendar`.
- **pnpm:** Monorepo package manager.
- **Express:** API server framework.
- **React Native:** Mobile application development.
- **React Query:** Data fetching, caching, and synchronization.
- **`@expo/vector-icons` & SF Symbols:** Iconography. Local TTF copies (`assets/fonts/{Feather,Ionicons,MaterialIcons}.ttf`) are loaded explicitly in `app/_layout.tsx` via `useFonts` to bypass an Expo Go bundling quirk that otherwise produces tofu boxes. The custom Expo Go static deploy script (`artifacts/mobile/scripts/build.js`) writes every bundled asset to disk under its **hashed** filename `<name>.<hash>.<type>` (matching what Expo's runtime `AssetSourceResolver` requests) — writing the bare `<name>.<type>` made every icon font 404 in the deployed bundle and broke all icons app-wide.
- **Replit Secrets:** Environment variable management (`DATABASE_URL`, `CLERK_SECRET_KEY`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `SESSION_SECRET`).

## Webhook Health-Check Uptime Monitor

The `GET /api/webhooks/revenuecat/health` endpoint is checked every **5 minutes** by a GitHub Actions cron job (`.github/workflows/webhook-health-check.yml`). If the endpoint returns anything other than HTTP 200 with `{ ok: true, secretConfigured: true }`, the job fails and GitHub automatically emails the repository owner (and any watchers with "Failed workflows" notifications enabled).

> **`secretConfigured: false`** in the health response means the `REVENUECAT_WEBHOOK_SECRET` Replit secret is unset or empty. Without it the endpoint cannot validate incoming webhook signatures, so real RevenueCat purchase events would be accepted unauthenticated and silently processed (or, in production, rejected with 503). Set the secret in **Replit → Secrets** and redeploy.

### Required GitHub Secrets

Add these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `API_BASE_URL` | Your production API root, e.g. `https://your-replit-domain.replit.app` — no trailing slash, no `/api` suffix |
| `REVENUECAT_WEBHOOK_SECRET` | The same value stored in the `REVENUECAT_WEBHOOK_SECRET` Replit secret |
| `SLACK_WEBHOOK_URL` | Incoming Webhook URL for your on-call Slack channel — get it from **Slack → Apps → Incoming Webhooks**. When set, the workflow posts an alert immediately after a failed health check. If omitted, the step is skipped silently (GitHub's own failure email still fires). |
| `PAGERDUTY_INTEGRATION_KEY` | **Events API v2** integration key from your PagerDuty service (32-char hex string). Create it in **PagerDuty → Services → \<your service\> → Integrations → Add integration → Events API v2**. When set, the workflow triggers a `critical` incident with escalation on every health-check failure. If omitted, the step is skipped silently — opt-in, same pattern as `SLACK_WEBHOOK_URL`. |

### How it works

The workflow sends:
```
GET <API_BASE_URL>/api/webhooks/revenuecat/health
Authorization: <REVENUECAT_WEBHOOK_SECRET>
```

In production the endpoint validates the `Authorization` header using timing-safe comparison. A missing or wrong secret returns 401; an unconfigured server secret returns 503. Either causes the cron job to fail and GitHub to alert you.

### Triggering a manual check

Go to **GitHub → Actions → Webhook Health Check → Run workflow** to run it immediately without waiting for the next 5-minute tick.

### Disabling the monitor

Comment out or delete the `schedule:` block in `.github/workflows/webhook-health-check.yml`. The `workflow_dispatch:` trigger keeps the manual-run button available.

---

## OTA Rollback Runbook

If a bad JS bundle reaches users via EAS Update, you can roll it back in under a minute — no native rebuild or App Store review required.

### Quick rollback (one command)

```bash
# From the repo root — rolls back the production channel interactively:
./scripts/eas-rollback.sh

# Or via npm script from artifacts/mobile:
pnpm run eas:rollback:production
```

Running without a `<update-group-id>` argument lists the 10 most recent updates so you can identify the last known-good one, then re-run with that ID:

```bash
./scripts/eas-rollback.sh production <known-good-update-group-id>
```

### What the script does

Uses `eas update:republish` to re-point the target channel to an existing update group — no re-bundling, no store review. Devices pick up the rolled-back bundle on their next launch.

When called **without** an update-group-id the script lists the 10 most recent updates on that channel (read-only, no changes made) so you can identify the last known-good group ID. Pass that ID in a second call to execute the rollback.

### Channels

| npm script | Channel | When to use |
|---|---|---|
| `eas:rollback:production` | `production` | Hotfix a bad App Store / Play Store OTA |
| `eas:rollback:preview` | `preview` | Hotfix a bad TestFlight / internal-track OTA |
| `eas:rollback [channel]` | custom | Any other EAS channel |

### Prerequisites

- `EXPO_TOKEN` environment variable set (or `eas login` completed in the shell).
- `eas-cli` available via `npx` (no global install required).

### After the rollback

No manual re-enable step is needed. Once you have pushed a proper fix, the normal CI workflow (`eas-update.yml`) publishes a fresh update to the channel automatically.