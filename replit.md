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
- **Strict structured-output handling (Phase 2 of 3 — all 11 sites covered):** every JSON-producing AI site uses `response_format: json_schema` with `strict: true` and `additionalProperties: false`. `lib/strictJson.ts` provides `parseAndValidate(content, refusal, validator)` (refusal/empty/parse/validation taxonomy, throws typed `StrictJsonError`) and `strictJsonCompletion(req, params, validator, opts?)` which wraps `trackedCreate`, retries ONCE on parse/validation failure with a stricter system addendum citing the prior validation error, and never retries refusals. Per-endpoint Zod validators (loose `passthrough` mirrors of each hand-written JSON schema, nested fields optional) live in `routes/atlas.ts` directly above the route handlers: `coachResponseValidator`, `profileExtractorValidator`, `roadmapValidator`, `dailyPlanValidator`, `adaptValidator`, `generateTitleValidator`, `intakeQuestionsValidator`, `intakeProfileValidator`, `behavioralProfileValidator`, `roadmapEvolutionValidator`. All 11 sites covered: `/coach` (refusal→400), `/coach/stream` (uses `parseAndValidate` at end-of-stream — no mid-flight retry possible — degrades gracefully on validation failure since the user already saw the streamed `reply` text via `ReplyTextExtractor`; the final SSE event simply lacks structured action fields; surfaces a distinct error event for refusals via accumulated `delta.refusal`), `/onboarding-chat` extraction call (the conversational call stays as-is — it's not a structured-output call), `/roadmap`, `/daily-plan`, `/adapt`, `/intake-questions`, `/intake-submit`, `/behavioral-profile`, `/evolve-roadmap` — all surface `StrictJsonError` of `kind === "refusal"` as HTTP 400, other failures as 500. `/generate-title` is the one intentional exception: it uses `strictJsonCompletion` to get the free retry, but its outer catch swallows ANY error (including refusal) and falls back to the trimmed user input as the title so the create-goal flow never hard-blocks. **Phase 3 (later):** replace hand-written JSON schemas with `zodToJsonSchema(validator)` so the runtime validator and the OpenAI-side strict schema have a single source of truth.
- **RAG corpus (Phase 1 of 3 — foundation only):** the `embeddings` table (pgvector, 1536-dim, HNSW cosine index, unique on `(user_id, content_type, content_id)`) stores indexed chunks of user-generated text. `lib/embeddings.ts` (`embedTexts`/`embedOne`) batches OpenAI `text-embedding-3-small` calls (96 inputs/batch, 8000-char clamp) with per-batch `ai_usage` tracking; no Anthropic failover (Anthropic has no embeddings endpoint). `lib/embeddingsIndexer.ts` defensively walks `user_state.goals[]` JSONB and emits chunks for `learnedProfile` fields, `reflections`, `coachMemory` facts/summaries, `evolutions`, and `plan` tasks (each with a stable `contentId` like `goal:<goalId>:<type>:<key>`). `indexUserGoals` (1) prunes stale rows per content-type via `notInArray` so deletions propagate, (2) compares SHA-256 hashes (in `metadata.text_hash`) to skip unchanged chunks, (3) batch-embeds the rest, (4) upserts in a single transaction. `routes/me.ts` calls `indexUserGoalsAsync` fire-and-forget after every successful PUT `/me/state`. **Retrieval into the coach prompt is Phase 2 (next session); per-user state-fingerprint early-out and incremental batch-streaming are Phase 3.**

Cloud sync operates with the server as the source of truth, utilizing optimistic mutations, coalescing, and conflict resolution. Subscription gating is enforced both client and server-side. Authentication is managed by Clerk, with custom branded screens for various flows. `AuthGate` ensures proper routing for signed-out users, new users creating goals, and existing users with goals, also enforcing legal acceptance (GDPR) before product access, requiring users to accept Privacy Policy and Terms of Service. Push notifications are implemented via Expo Push, with server-side scheduling for morning nudges. Calendar synchronization allows users to connect native calendars for context and to write planned tasks to their calendars, governed by explicit, granular consent settings.

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
- **`@expo/vector-icons` & SF Symbols:** Iconography.
- **Replit Secrets:** Environment variable management (`DATABASE_URL`, `CLERK_SECRET_KEY`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `SESSION_SECRET`).