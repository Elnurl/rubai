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

Cloud sync operates with the server as the source of truth, utilizing optimistic mutations, coalescing, and conflict resolution. Subscription gating is enforced both client and server-side. Authentication is managed by Clerk, with custom branded screens for various flows. `AuthGate` ensures proper routing for signed-out users, new users creating goals, and existing users with goals, also enforcing legal acceptance (GDPR) before product access, requiring users to accept Privacy Policy and Terms of Service. Push notifications are implemented via Expo Push, with server-side scheduling for morning nudges. Calendar synchronization allows users to connect native calendars for context and to write planned tasks to their calendars, governed by explicit, granular consent settings.

## External Dependencies

- **OpenAI:** Used for AI model interactions (gpt-5.4, gpt-4o for vision, Whisper for transcription).
- **Clerk:** Authentication and user management.
- **PostgreSQL (via Drizzle ORM):** Database for `users` and `user_state`.
- **Expo:** React Native framework, including `expo-router`, `expo-notifications`, `expo-device`, `expo-audio`, `expo-speech`, `expo-image-picker`, and `expo-calendar`.
- **pnpm:** Monorepo package manager.
- **Express:** API server framework.
- **React Native:** Mobile application development.
- **React Query:** Data fetching, caching, and synchronization.
- **`@expo/vector-icons` & SF Symbols:** Iconography.
- **Replit Secrets:** Environment variable management (`DATABASE_URL`, `CLERK_SECRET_KEY`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `SESSION_SECRET`).