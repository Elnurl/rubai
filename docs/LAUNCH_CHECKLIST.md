# Launch checklist

Track progress toward App Store + Play Store release. Update checkboxes as you complete each item.

## Phase A — Local dev (you are here)

- [ ] `pnpm install` succeeds on Windows
- [ ] Docker Postgres running (`pnpm db:up`)
- [ ] `.env` filled with Supabase, OpenAI, RevenueCat keys
- [ ] `pnpm dev:api` → server listens on :5000
- [ ] `pnpm dev:mobile` → app loads in Expo Go / simulator
- [ ] End-to-end: sign up → goal → roadmap → today tasks → coach chat

## Phase B — Accounts & compliance

### Apple (iOS)

- [ ] Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
- [ ] Create App ID: `com.rubai.mobile` (matches `app.json`)
- [ ] App Store Connect app record
- [ ] Privacy Policy URL (host on rubai.app or similar)
- [ ] Terms of Service URL
- [ ] App Privacy questionnaire (data linked to user: goals, reflections, AI chat)

### Google (Android)

- [ ] [Google Play Console](https://play.google.com/console) account ($25 one-time)
- [ ] Create app with package `com.rubai.mobile`
- [ ] Data safety form
- [ ] Privacy policy URL

### Shared

- [ ] Supabase production project (Email + Google providers, redirect URLs)
- [ ] RevenueCat products linked to store subscriptions
- [ ] Support email: `support@rubai.app` (already referenced in app)

## Phase C — Host the API (pick one)

Recommended for first launch: **Railway** or **Render** (simple, managed Postgres option).

| Step | Railway example |
|------|-----------------|
| 1 | Create project at [railway.app](https://railway.app) |
| 2 | Add **PostgreSQL** plugin → copy `DATABASE_URL` |
| 3 | Add **GitHub repo** service for `artifacts/api-server` |
| 4 | Set all env vars from `.env.example` |
| 5 | Set start command: `node dist/index.mjs` after build |
| 6 | Note public URL → `https://rubai-api.up.railway.app` |

Then set in EAS secrets:

```
EXPO_PUBLIC_API_URL=https://your-api-domain
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_JWT_SECRET=...
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=...
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=...
```

**I can help you write the Railway/Render deploy config when you're ready.**

## Phase D — EAS builds

You have an Expo account ✓

```powershell
cd artifacts/mobile
npx eas-cli login
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform android --profile preview
```

- [ ] `EXPO_TOKEN` in GitHub Actions (for OTA updates — already wired)
- [ ] EAS secrets for production keys
- [ ] TestFlight internal testing (iOS)
- [ ] Play internal testing track (Android)

## Phase E — Store submission

- [ ] App screenshots (6.7" iPhone + Android phone)
- [ ] App description — lead with **"AI life execution system"**
- [ ] Keywords / categories: Productivity, Health & Fitness, Education
- [ ] Age rating questionnaire
- [ ] Review notes for Apple (demo account credentials)

## Phase F — Production hardening

- [ ] `REVENUECAT_WEBHOOK_SECRET` set on server
- [ ] GitHub Actions `API_BASE_URL` secret for webhook health cron
- [ ] Error monitoring (Sentry — optional)
- [ ] Rate limits verified under load
- [ ] OTA rollback tested (`scripts/eas-rollback.sh`)

## Phase G — Code cleanup (post-launch or parallel)

- [ ] Rename internal Atlas → rubai in code (keep `/api/atlas` routes)
- [ ] Split `coach.tsx`, `AtlasProvider.tsx`, `atlas.ts` into modules
- [ ] Add integration tests for sync, coach stream, tier gating
- [ ] Remove `@replit/connectors-sdk` if Google Calendar server sync not needed
- [ ] Migrate `replit.md` → `docs/ARCHITECTURE.md`

## Calendar for v1

**Ship with native device calendar only** — already implemented via `expo-calendar`:

- User picks a calendar on their phone
- rubai reads today's events (with permission) for AI planning
- rubai writes daily tasks to that calendar (opt-in)

No Google OAuth or Replit connector required for launch.

## Your current status

| Item | Status |
|------|--------|
| Supabase Auth | Create project — paste URL, anon key, JWT secret in `.env` |
| OpenAI | ✓ Have key |
| Expo / EAS | ✓ Have account |
| RevenueCat | ⚠ Have project — verify entitlements match code |
| Postgres | ⬜ Set up via `pnpm db:up` or Neon |
| Apple Developer | ⬜ Not yet |
| Google Play | ⬜ Not yet |
| API hosting | ⬜ Next after local dev works |

## Next action

1. Run through [LOCAL_SETUP.md](./LOCAL_SETUP.md) steps 1–8
2. Paste any errors here — I'll fix them
3. Share RevenueCat entitlement/offering names for verification
4. When local works, we pick Railway vs Render and deploy API
