# Atlas — AI Goal Coach

A mobile (Expo) AI-driven execution coach. The user picks one of five life goals (IELTS preparation, learning programming, fitness, financial improvement, or buying a car), goes through a conversational onboarding with the Atlas AI, receives a fully personalized multi-phase roadmap, gets a fresh actionable daily plan, and chats with an adaptive coach that responds based on their actual behavior (streak, completion rate, missed/completed tasks).

## Architecture

Monorepo (pnpm) with three artifacts:

- `artifacts/mobile` — Expo React Native app (the user-facing product). All persistence is client-side via AsyncStorage; no database.
- `artifacts/api-server` — Express server providing AI endpoints under `/api/atlas/*`. Calls OpenAI via `@workspace/integrations-openai-ai-server` (model `gpt-5.4` with `json_schema` structured outputs).
- `artifacts/mockup-sandbox` — sandbox for design exploration (unused in this product but registered).

API contract is defined in `lib/api-spec/openapi.yaml`; running `pnpm --filter @workspace/api-spec run codegen` regenerates:
- `lib/api-client-react/src/generated/api.ts` — typed React Query hooks and TS types
- `lib/api-zod/src/generated/api.ts` — Zod schemas used by the server for validation

## API endpoints (all under `/api/atlas`)

- `POST /onboarding-chat` — runs the conversational profile-extraction. Server returns the next assistant message AND, once enough turns have happened, a structured `UserProfile` plus `isComplete: true`.
- `POST /roadmap` — given a `UserProfile`, returns a multi-phase `Roadmap` with milestones, strategy, and risk analysis.
- `POST /daily-plan` — given the profile + roadmap + behavioral snapshot, returns today's 3-5 actionable tasks tuned to the user's recent behavior and the active phase.
- `POST /coach` — free-form coach chat with full plan + behavioral context.
- `POST /adapt` — runs the adaptive engine: returns `easier | same | harder` plus concrete adjustments.

## Mobile app structure

Routes (expo-router):
- `app/_layout.tsx` — providers (QueryClient, AtlasProvider, KeyboardProvider, GestureHandler, SafeArea), font loading, splash control. Sets the API base URL via `setBaseUrl(\`https://${process.env.EXPO_PUBLIC_DOMAIN}\`)` so the bundled mobile client hits the proxied server.
- `app/index.tsx` — boot screen; routes to `/welcome` or `/(tabs)` based on stored profile + roadmap.
- `app/welcome.tsx` — goal-type picker.
- `app/onboarding.tsx` — chat onboarding driven by `useAtlasOnboardingChat`.
- `app/generating.tsx` — animated roadmap-generation loader; calls `useAtlasGenerateRoadmap`.
- `app/(tabs)` — main app: Today / Roadmap / Coach / Me. Native tabs on iOS via `expo-router/unstable-native-tabs` when liquid glass is available; classic blurred tabs otherwise.

State lives in `providers/AtlasProvider.tsx` and is persisted to AsyncStorage with the `atlas:v1:` prefix. The provider also computes a `BehavioralSnapshot` (streak, completion rate, recent completed/missed task titles) from local task history.

## Theme

Warm cream + emerald + amber palette; Inter for typography. `constants/colors.ts` defines `light` and `dark` palettes consumed via `hooks/useColors.ts`. No emojis anywhere; iconography via `@expo/vector-icons` and SF Symbols (iOS).

## Environment

- `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` — wired via the OpenAI integration; do not handle directly.
- `EXPO_PUBLIC_DOMAIN` — provided by Expo workflow; used by the mobile bundle to call the API.

## Key files

- `artifacts/api-server/src/routes/atlas.ts` — all five Atlas endpoints (structured outputs).
- `artifacts/api-server/src/routes/index.ts` — mounts the atlas router at `/atlas`.
- `lib/api-spec/openapi.yaml` — single source of truth for the API contract.
- `artifacts/mobile/providers/AtlasProvider.tsx` — global app state + persistence.
- `artifacts/mobile/constants/atlas.ts` — goal definitions (label, tagline, icon, openers).
- `artifacts/mobile/lib/storage.ts` — AsyncStorage helpers and storage keys.
