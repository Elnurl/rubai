# RubAI — AI Goal Coach

## Overview

RubAI is a mobile (Expo) AI-driven execution coach designed to help users achieve any goal. It allows users to define custom goals or select from templates like IELTS prep, programming, fitness, financial improvement, or buying a car. For each goal, RubAI generates a tailored intake form, synthesizes a `UserProfile`, builds a multi-phase roadmap, creates a daily plan, and acts as an adaptive coach. The application supports multiple concurrent goals, with the number of active goals tiered by subscription (Free: 1, Pro: 5, Premium: 25).

## User Preferences

The user prefers an iterative development approach. They want the agent to ask before making major changes and to provide detailed explanations for proposed modifications. The agent should prioritize stability and avoid breaking existing functionalities. The user also prefers clear and concise communication, focusing on actionable steps.

## System Architecture

The project is structured as a monorepo using pnpm, comprising three main artifacts: a mobile Expo React Native app, an Express API server, and a mockup sandbox. The mobile app (`artifacts/mobile`) acts as the user-facing product, relying on the server as the source of truth and using AsyncStorage for caching. The API server (`artifacts/api-server`) provides AI-driven endpoints and manages per-user cloud state, utilizing OpenAI (model `gpt-5.4` with `json_schema` structured outputs), Clerk for authentication, and Drizzle/Postgres for persistence. The API contract is defined in `lib/api-spec/openapi.yaml`, with codegen generating typed React Query hooks and Zod schemas.

Key API endpoints (`/api/atlas/*`) include:
- `POST /intake-questions`: Generates tailored intake forms.
- `POST /intake-submit`: Synthesizes a `UserProfile` from answered questions.
- `POST /roadmap`: Returns a multi-phase `Roadmap` with milestones and risk analysis.
- `POST /daily-plan`: Generates daily tasks based on user profile, roadmap, and behavioral snapshot.
- `POST /coach`: Provides free-form AI coaching with contextual awareness.
- `POST /adapt`: Runs an adaptive engine to suggest adjustments (`easier | same | harder`).
- `POST /behavioral-profile`: Builds or evolves a cumulative `BehavioralProfile`.

The mobile app's architecture is based on `expo-router` for navigation, managing routes for welcome, intake, goal generation, and a main tab-based interface (Today, Roadmap, Coach, Goals, Account). State management is handled by `AtlasProvider.tsx`, persisting data to AsyncStorage and using refs to prevent stale closure issues. The app incorporates features like reflections for task feedback, an evolving roadmap that adapts to user behavior, and a context-aware coach with memory.

UI/UX decisions focus on a warm cream, emerald, and amber palette, using Inter for typography. Iconography is handled via `@expo/vector-icons` and SF Symbols.

Cloud sync is implemented with the server as the source of truth. On sign-in, the mobile app fetches state from `/api/me/state`, performing an initial migration of legacy local data if necessary. Mutations are optimistic and coalesced, with a conflict resolution mechanism for `409` responses, where the client re-syncs with the server's latest state. Subscription gating is enforced both in the UI and server-side to limit active goals based on the user's tier. Authentication is managed by Clerk, supporting email+password and SSO, with custom branded auth screens handling various flows like sign-in, sign-up, verification, and password reset.

## External Dependencies

- **OpenAI:** Used for AI-driven features like intake form generation, roadmap creation, daily planning, and coaching.
- **Clerk:** Provides authentication and user management services.
- **PostgreSQL (via Drizzle ORM):** Database for persisting user data, including `users` (Clerk user ID, email, tier) and `user_state` (app state, goals, active goal ID, account preferences, pending draft).
- **Expo:** Framework for building the React Native mobile application.
- **pnpm:** Package manager for the monorepo.
- **Express:** Web application framework for the API server.
- **React Native:** Framework for mobile application development.
- **React Query:** For data fetching, caching, and synchronization in the React Native app.
- **`@expo/vector-icons` & SF Symbols:** For iconography in the mobile app.
- **Replit Secrets:** Used for managing sensitive environment variables like `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, and `SESSION_SECRET`.