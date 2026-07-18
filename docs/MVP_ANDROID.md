# MVP: real Android app (no daily Metro)

Development build needs Metro every day. For MVP demos and “real app” use, ship a **preview APK** that runs alone, plus a **hosted API**.

## What changes

| | Development build | MVP preview APK |
|--|-------------------|-----------------|
| App | rubai + Metro | Standalone rubai APK |
| Daily | `pnpm dev:api` + `pnpm dev:android` | Just open the app |
| API | PC LAN `http://192.168.x.x:5000` | Public HTTPS (Railway) |
| Rebuild | Only when native code changes | Same |

**Never** put a LAN/`192.168.*` URL into a preview APK. The phone cannot reach your PC when you leave home Wi‑Fi (or when Metro is off).

---

## One-command build (recommended)

From repo root, with `.env` already containing Railway + Supabase:

```powershell
pnpm build:android:preview
```

This automatically:

1. Runs **preflight** (`pnpm verify:mvp`)
2. Rejects LAN / `http://` API URLs
3. Checks Railway `/api/healthz`
4. Syncs EAS `preview` env from your `.env`
5. Starts the EAS Android APK build

When the build finishes: install the new APK, delete any old install if needed, open rubai — **no Metro, no PC**.

---

## Manual checks

### 1. Hosted API (Railway)

```
https://workspaceapi-server-production-d044.up.railway.app/api/healthz
→ {"status":"ok"}
```

Railway must also have: `DATABASE_URL`, Supabase keys, `OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_*`.

### 2. Local `.env` (for preflight sync)

```
EXPO_PUBLIC_API_URL=https://workspaceapi-server-production-d044.up.railway.app
EXPO_PUBLIC_SUPABASE_URL=https://….supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_...
```

### 3. Supabase redirect URLs

Authentication → URL Configuration:

- Site URL: `mobile://auth/callback`
- Redirect URLs: `mobile://auth/callback`, `exp+rubai://auth/callback`

### 4. Preflight only (no build)

```powershell
pnpm verify:mvp
```

---

## After install — smoke test

1. Open APK on mobile data (not only home Wi‑Fi)
2. No red “Couldn't reach the cloud” banner
3. Sign in → open Coach → send “hi” → reply streams
4. Today tab shows today’s tasks (or generates a plan)

If AI still fails after cloud sync works → check OpenAI billing/quota on Railway keys.

---

## Development vs preview (don’t mix)

| Goal | Command |
|------|---------|
| Code + hot reload | `pnpm dev:android` (uses LAN API on purpose) |
| Real standalone app | `pnpm build:android:preview` |

Same Android package (`com.rubai.mobile`) shares storage. New preview builds overwrite a stale LAN API cache on boot.

---

## Later (Play Store)

```powershell
cd artifacts\mobile
pnpm exec eas build --platform android --profile production
```

See `docs/LAUNCH_CHECKLIST.md`.

## Checklist

- [ ] Railway `/api/healthz` OK
- [ ] `.env` has HTTPS `EXPO_PUBLIC_API_URL` (not `192.168.*`)
- [ ] `pnpm verify:mvp` passes
- [ ] `pnpm build:android:preview` finishes
- [ ] New APK installed; smoke test on mobile data
- [ ] Coach + daily tasks work without PC
