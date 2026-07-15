# rubai

**AI life execution system** — a mobile app that turns long-term goals into daily action through adaptive roadmaps, task execution, reflections, and an AI coach that learns how you work.

## What it does

1. **Define a goal** — templates (IELTS, fitness, finance, etc.) or any custom target
2. **Adaptive intake** — AI asks the right questions and builds your profile
3. **Phased roadmap** — weeks, milestones, risks; evolves as you reflect
4. **Today** — AI-generated daily tasks with completion + reflection (text, voice, photo)
5. **Coach** — streaming chat with memory, calendar actions, proposed plan changes
6. **Subscriptions** — Free / Pro / Premium via RevenueCat + Clerk auth

## Monorepo layout

| Path | Purpose |
|------|---------|
| `artifacts/mobile` | Expo React Native app (iOS, Android, web) |
| `artifacts/api-server` | Express API + AI orchestration |
| `artifacts/admin-dashboard` | Internal support UI |
| `lib/api-spec` | OpenAPI contract |
| `lib/api-client-react` | Generated React Query hooks |
| `lib/db` | Drizzle ORM + Postgres migrations |

## Quick start (local)

**Prerequisites:** Node 20+, [pnpm](https://pnpm.io/installation), [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Postgres), accounts for [Clerk](https://clerk.com), [OpenAI](https://platform.openai.com), [RevenueCat](https://www.revenuecat.com), [Expo](https://expo.dev).

```powershell
# 1. Install pnpm (if needed)
npm install -g pnpm

# 2. Clone and install
cd rubai
pnpm install

# 3. Configure secrets
copy .env.example .env
# Edit .env — see docs/LOCAL_SETUP.md for each value

# 4. Start Postgres (includes pgvector for AI memory)
pnpm db:up

# 5. Terminal 1 — API server (port 5000)
pnpm dev:api

# 6. Terminal 2 — Expo dev server
pnpm dev:mobile
```

Full setup guide: **[docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)**  
**Android dev build (coding):** **[docs/DEV_BUILD_ANDROID.md](docs/DEV_BUILD_ANDROID.md)**  
**MVP / real APK (no daily Metro):** **[docs/MVP_ANDROID.md](docs/MVP_ANDROID.md)**  
Launch checklist: **[docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md)**

## Environment variables

Copy `.env.example` → `.env` at the repo root. Both `dev:api` and `dev:mobile` load it automatically.

Key vars:

- `DATABASE_URL` — Postgres connection string
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_JWT_SECRET` — auth
- `AI_INTEGRATIONS_OPENAI_API_KEY` — AI features
- `EXPO_PUBLIC_API_URL` — where the mobile app calls your API (use LAN IP on a physical phone)
- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` — subscriptions in dev

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:api` | Build + run API server |
| `pnpm dev:mobile` | Start Expo Go dev server (legacy — use `dev:android` instead) |
| `pnpm dev:android` | Metro for **development build** on phone |
| `pnpm build:android:dev` | Build **dev** APK on EAS (needs Metro daily) |
| `pnpm build:android:preview` | Build **standalone MVP** APK (no Metro) |
| `pnpm db:up` | Start local Postgres (Docker) |
| `pnpm db:down` | Stop Postgres |
| `pnpm build` | Typecheck + build all packages |
| `pnpm typecheck` | Typecheck only |

## Calendar

**v1 launch uses the phone's native calendar** (`expo-calendar`) — read today's events for AI context and write daily tasks to a calendar the user picks. Google Calendar server sync (legacy Replit connector) is optional and not required for launch.

## Internal naming

User-facing brand: **rubai**. Some internal code still uses the codename **Atlas** (`AtlasProvider`, `/api/atlas/*` routes). A gradual rename is planned; API paths stay `/atlas` until v2 to avoid breaking clients.

## Architecture details

See [replit.md](replit.md) for deep technical notes (AI pipeline, RAG, strict JSON, sync model). This file is being migrated to `docs/` as we move off Replit.

## License

MIT
