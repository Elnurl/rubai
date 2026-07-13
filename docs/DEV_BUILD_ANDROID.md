# Android development build (Supabase Auth + rubai)

Use a **development build** (real `rubai` APK) instead of Expo Go for reliable native modules and OAuth deep links on Android.

## Overview

| Step | Once | Daily |
|------|------|--------|
| Build & install dev APK | ~20 min (EAS cloud) | — |
| Run API | — | `pnpm dev:api` |
| Run Metro for dev client | — | `pnpm dev:android` |

## Prerequisites

- [Expo account](https://expo.dev)
- EAS CLI: `npm install -g eas-cli` then `eas login`
- Supabase project with Email auth enabled
- `.env` at repo root with Supabase + OpenAI keys

## EAS env (one-time)

```powershell
cd artifacts\mobile
pnpm exec eas env:create development --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co" --visibility plaintext
pnpm exec eas env:create development --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..." --visibility plaintext
pnpm exec eas env:create development --name EXPO_PUBLIC_REVENUECAT_TEST_API_KEY --value "test_YOUR_KEY" --visibility plaintext
```

## Build

```powershell
pnpm build:android:dev
```

Install the APK, then daily:

```powershell
pnpm db:up
pnpm dev:api
pnpm dev:android
```

Open the **rubai** app (not Expo Go). Emulator: `AssetManagerEmu` + `adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:5000 tcp:5000`.

## Auth redirect (Google)

In Supabase → Authentication → URL configuration, allow:

```
mobile://auth/callback
exp+rubai://auth/callback
```
