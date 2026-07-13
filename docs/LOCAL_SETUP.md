# Local development setup

This guide gets rubai running on your machine (Windows, macOS, or Linux) without Replit.

## 1. Install tools

| Tool | Why | Install |
|------|-----|---------|
| **Node.js 20+** | Runtime | [nodejs.org](https://nodejs.org) — you have v22 ✓ |
| **pnpm** | Monorepo package manager | `npm install -g pnpm` |
| **Docker Desktop** | Local Postgres + pgvector | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Git** | Version control | Already have the repo ✓ |

Optional for device testing:

- **Expo Go** app on your phone (App Store / Play Store)
- **Android Studio** or **Xcode** for simulators

## 2. Supabase Auth

Create a free project at [supabase.com](https://supabase.com):

1. **Settings → API** → copy:
   - Project URL → `EXPO_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
   - `anon` `public` key → `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`
   - JWT Secret → `SUPABASE_JWT_SECRET` (API server verifies mobile tokens with this)
2. **Authentication → Providers** → enable Email (and Google when ready)
3. **Authentication → URL configuration** → add redirect: `mobile://auth/callback`

App data still lives in your own Postgres (`DATABASE_URL`). Supabase is used for **auth only**.

## 3. Postgres (database)

rubai needs **PostgreSQL with the pgvector extension** (for AI memory / RAG).

### Recommended for beginners: local Docker

```powershell
pnpm db:up
```

This starts Postgres on `localhost:5432` with:

- User: `rubai`
- Password: `rubai_dev_password`
- Database: `rubai`

Connection string (already in `.env.example`):

```
DATABASE_URL=postgresql://rubai:rubai_dev_password@localhost:5432/rubai
```

Migrations run automatically when the API server starts.

### Alternative: cloud Postgres (no Docker)

Good free-tier options:

| Provider | Notes |
|----------|-------|
| [Neon](https://neon.tech) | Serverless Postgres; enable pgvector in SQL: `CREATE EXTENSION vector;` |
| [Supabase](https://supabase.com) | Postgres + dashboard; pgvector available |
| [Railway](https://railway.app) | Simple deploy later; can host DB + API together |

Use the connection string they give you as `DATABASE_URL`.

## 4. OpenAI

You said you have an API key. Add to `.env`:

```env
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
```

Both keys can be the same value. The first pair powers chat/completions; `OPENAI_API_KEY` powers embeddings (RAG).

Optional: add `ANTHROPIC_API_KEY` for automatic failover if OpenAI is down.

## 5. RevenueCat (subscriptions)

You have a project but may need to verify setup. In [app.revenuecat.com](https://app.revenuecat.com):

### Mobile app keys (public)

Project → **API keys** → copy the **Test Store** public key:

```env
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_...
```

For production builds later, also set iOS/Android production keys.

### Server secret (V2)

Project → **API keys** → **Secret API keys** → create/copy V2 secret:

```env
REVENUECAT_V2_SECRET_KEY=sk_...
```

### Entitlements & offerings

Must match what the code expects:

| Code constant | RevenueCat name |
|---------------|-----------------|
| `pro` | Entitlement `pro`, Offering `pro` |
| `premium` | Entitlement `premium`, Offering `premium` |

Products: create monthly subscriptions in App Store Connect / Play Console later; link them in RevenueCat.

### Webhook (production only)

When API is hosted, set webhook URL to:

```
https://YOUR_API_DOMAIN/api/webhooks/revenuecat
```

And set `REVENUECAT_WEBHOOK_SECRET` to the same value on server + GitHub Actions.

**Send me your RevenueCat dashboard screenshots or entitlement/offering names** and I can verify they match the code.

## 6. Configure `.env`

```powershell
copy .env.example .env
```

Fill every value. Minimum to boot locally:

- `DATABASE_URL`
- `SESSION_SECRET` (any long random string)
- `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_JWT_SECRET`
- `AI_INTEGRATIONS_OPENAI_*` + `OPENAI_API_KEY`
- `REVENUECAT_V2_SECRET_KEY`
- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`

## 7. Run

```powershell
pnpm install
pnpm db:up
```

**Terminal 1 — API:**

```powershell
pnpm dev:api
```

Wait for `Server listening` on port 5000.

**Terminal 2 — Mobile:**

```powershell
pnpm dev:mobile
```

Scan the QR code with Expo Go, or press `i` / `a` for simulator.

### Physical phone tip

`localhost` on your phone means the phone itself, not your PC. Find your PC's LAN IP:

```powershell
ipconfig
# Look for IPv4 Address, e.g. 192.168.1.10
```

Set in `.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:5000
```

Restart `pnpm dev:mobile`. Phone and PC must be on the same Wi‑Fi.

### Android emulator

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000
```

## 8. Verify it works

1. API health: open `http://localhost:5000/api/healthz` → `{ "status": "ok" }` or similar
2. App opens → sign up / sign in via Supabase Auth
3. Create a goal → intake → roadmap generates
4. Today tab shows tasks

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `pnpm` not found | `npm install -g pnpm` |
| `sh` not recognized | Fixed — use `pnpm install` with updated preinstall script |
| API won't start — missing env | Check terminal error for which var is missing |
| Migration / pgvector error | Use `pgvector/pgvector` image (`pnpm db:up`) or `CREATE EXTENSION vector` on cloud DB |
| Auth / API fails on phone | Set `EXPO_PUBLIC_API_URL` to LAN IP, not localhost |
| RevenueCat alert on launch | Set `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` in `.env` |

## What we removed from Replit

- `REPLIT_DEV_DOMAIN`, `REPLIT_EXPO_DEV_DOMAIN` — replaced by `EXPO_PUBLIC_API_URL`
- `fuser` port killing — replaced by `scripts/kill-port.mjs` (works on Windows)
- Replit Secrets — use local `.env` (never commit it)

Google Calendar via Replit connector is **not needed** for launch — native device calendar covers your use case.
