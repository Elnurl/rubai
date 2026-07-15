# MVP: real Android app (no daily Metro)

Development build needs Metro every day. For MVP demos and “real app” use, ship a **preview APK** that runs alone, plus a **hosted API**.

## What changes

| | Development build (now) | MVP preview (next) |
|--|-------------------------|--------------------|
| App | rubai APK + Metro | Standalone rubai APK |
| Daily | `pnpm dev:api` + `pnpm dev:android` | Just open the app |
| API | PC `localhost` / LAN IP | Public HTTPS URL |
| Rebuild APK | Only when native code/plugins change | Same |
| JS bugfix | Hot reload | New preview build **or** EAS Update (later) |

## Phase 1 — Host the API (required for real use)

Phone cannot reach your PC when you leave home Wi‑Fi. Deploy the API once.

### Option A: Railway (recommended)

1. Create project at [railway.app](https://railway.app)
2. Add **PostgreSQL** (enable pgvector: `CREATE EXTENSION IF NOT EXISTS vector;`)
3. Deploy from this repo — use root Dockerfile if present, or Railway Nixpacks with:
   - Root directory: repo root
   - Build: `pnpm install && pnpm --filter @workspace/api-server build`
   - Start: `pnpm --filter @workspace/api-server start`
4. Set env vars (copy from local `.env`, but use Railway `DATABASE_URL`):

```
PORT=5000
NODE_ENV=production
SESSION_SECRET=...long random...
DATABASE_URL=...from Railway Postgres...
SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# JWT secret optional if project uses ECC/JWKS
SUPABASE_JWT_SECRET=
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-proj-...
REVENUECAT_V2_SECRET_KEY=sk_...
REVENUECAT_WEBHOOK_SECRET=...
```

5. Public URL example: `https://rubai-api.up.railway.app`  
   Check: `https://YOUR_API/api/healthz` → `{"status":"ok"}`

### Option B: Keep PC API (home demo only)

Preview APK can still call `http://192.168.x.x:5000` on the same Wi‑Fi. Fine for a sofa demo; **not** a real MVP for others.

## Phase 2 — EAS env for preview

```powershell
cd c:\Users\Elnur\Desktop\rubai\artifacts\mobile

pnpm exec eas env:create preview --name EXPO_PUBLIC_API_URL --value "https://YOUR_API_DOMAIN" --visibility plaintext --force --non-interactive

pnpm exec eas env:create preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co" --visibility plaintext --force --non-interactive

pnpm exec eas env:create preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ...." --visibility plaintext --force --non-interactive

pnpm exec eas env:create preview --name EXPO_PUBLIC_REVENUECAT_TEST_API_KEY --value "test_...." --visibility plaintext --force --non-interactive
```

Supabase → Authentication → URL Configuration:

- Site URL: `mobile://auth/callback`
- Redirect URLs: `mobile://auth/callback`, `exp+rubai://auth/callback`

## Phase 3 — Build standalone APK (once)

From repo root:

```powershell
pnpm build:android:preview
```

Wait for EAS (free tier may queue). Install the APK on the phone.

**Open rubai — no Metro, no Expo Go, no QR.**

## Phase 4 — Daily after MVP

- Coding / debugging: still use **development** build + Metro when you need hot reload
- Showing / using the product: open the **preview** APK
- Rebuild preview only when:
  - native modules / `app.json` plugins change, or
  - you bump version for testers

## Later (Play Store)

```powershell
# production = AAB for Play Console
cd artifacts\mobile
pnpm exec eas build --platform android --profile production
```

Then Play Console → Internal testing. See `docs/LAUNCH_CHECKLIST.md` Phases B–E.

## Checklist

- [ ] API hosted + `/api/healthz` OK
- [ ] EAS `preview` env has `EXPO_PUBLIC_API_URL` = HTTPS API
- [ ] Supabase redirect URLs set
- [ ] `pnpm build:android:preview` finished + APK installed
- [ ] Sign up → goal → intake → roadmap works **without** PC Metro
