# rubai — AI Goal Coach

## Overview

rubai is an AI-driven mobile (Expo) execution coach designed to help users achieve any goal. It offers tailored intake forms, synthesizes `UserProfile`s, builds multi-phase roadmaps, generates daily plans, and provides adaptive coaching. The app supports multiple concurrent goals, with the number gated by a server-controlled subscription tier (Free, Pro, Premium). The business vision is to provide a comprehensive, personalized coaching experience that adapts to user behavior and progress, making goal attainment more accessible and efficient.

## User Preferences

The user prefers an iterative development process, with a focus on delivering functional features incrementally. They want the agent to prioritize clear, concise communication and detailed explanations when necessary. The user also expects the agent to ask for confirmation before making any major architectural changes or introducing new dependencies.

## System Architecture

rubai is a monorepo (pnpm) with three main artifacts: `artifacts/mobile` (Expo React Native app), `artifacts/api-server` (Express server), and `artifacts/mockup-sandbox`. The server is the source of truth, using Clerk for authentication and Drizzle/Postgres for persistence. It integrates with OpenAI's `gpt-5.4` model for AI functionalities.

**UI/UX Decisions:**
- The mobile app uses a warm cream, emerald, and amber palette with Inter typography.
- Iconography is handled via `@expo/vector-icons` and SF Symbols.
- The main navigation is tab-based (Today, Roadmap, Coach, Goals, Account).
- State management in the mobile app utilizes `AtlasProvider` with AsyncStorage persistence for fast-paint caching.

**Technical Implementations:**
- **API Contract:** Defined in `lib/api-spec/openapi.yaml`, generating typed React Query hooks and Zod schemas.
- **Goal Management:** Supports `createGoal`, `setRoadmapForGoal`, and manages `Goal` objects with associated `reflections`, `behavioralProfile`, `roadmapEvolutions`, and `coachMemory`.
- **Behavioral Profiling:** The `BehavioralProfile` is evolved from task history and reflections, influencing daily plans and coach interactions.
- **Adaptive Roadmap:** Roadmaps evolve dynamically based on user progress and `BehavioralProfile`, with mechanisms for both manual and auto-evolution.
- **Context-aware Coach:** The coach maintains `coachMemory` (summary and facts) and grounds replies in current user context (goal, roadmap, daily plan, behavior, reflections, evolutions, learned profile).
- **Cloud Sync:** Utilizes Clerk for authentication. User state is synchronized with the server (`/api/me/state`) using an optimistic concurrency model with versioning to prevent data overwrites.
- **Plan Management:** `PUT /api/me/tier` lets the signed-in user switch tier (free/pro/premium). The server validates the tier and refuses downgrades that would leave the account over the new limit (returns 409). Mobile screen at `/plans` (modal) lists all tiers and calls this endpoint via `updateSubscription` in `AtlasProvider`. Tier changes are recorded as `subscription.tier_changed` events in `analytics_events`. No payment validation is wired today — production should replace or guard this endpoint with RevenueCat/Stripe webhooks that also write a row to the `subscriptions` table.
- **Subscription Gating:** Features are gated based on `users.tier` from the server, enforced both in the UI and server-side.

**Feature Specifications:**
- **Intake:** Generates tailored intake forms and synthesizes `UserProfile`s.
- **Roadmap Generation:** Produces multi-phase roadmaps with milestones and risk analysis.
- **Daily Planning:** Delivers 3-5 tasks daily, tuned to user behavior.
- **Coaching:** Provides free-form chat with full contextual awareness.
- **Adaptation Engine:** Adjusts plans based on user performance (`easier | same | harder`).
- **Behavioral Profile:** Builds and evolves a cumulative profile of user habits and learning styles.

## External Dependencies

- **OpenAI:** Used for AI model interactions (`gpt-5.4`) for generating forms, roadmaps, daily plans, and coaching responses.
- **Clerk:** Provides authentication services, managing user sign-in/sign-up and session tokens.
- **PostgreSQL (via Drizzle):** Database for persisting user data, `users` and `user_state` tables.
- **Expo:** Framework for building the React Native mobile application.
- **React Query:** Used for data fetching and caching in the mobile app.
- **AsyncStorage:** Local storage for caching user data in the mobile app.
- **@expo/vector-icons & SF Symbols:** Iconography.
- **pnpm:** Monorepo package manager.
- **Express:** Web application framework for the API server.