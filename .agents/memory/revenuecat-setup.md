---
name: RevenueCat Setup
description: RC Replit inteqrasiyası olmadan manual qurulum — V2 secret key lazımdır, test key write icazəsi vermir.
---

## Qayda
Replit RevenueCat connector-u reject edilsə, `REVENUECAT_V2_SECRET_KEY` (sk_ prefix) env var kimi saxla və `createClient` ilə birbaşa API çağır.

**Why:** RC integration olmadan `getUncachableRevenueCatClient()` mövcud deyil. Amma SDK birbaşa `Authorization: Bearer <sk_...>` ilə işləyir.

**How to apply:**
- `test_...` API key → yalnız client-side (Expo app) üçün
- `sk_...` V2 secret key → server-side / seed scripts üçün
- `createProject` işləmirsə, mövcud project-i tapmaq üçün `listProjects` çağır — key read-only ola bilər

## Mövcud RC Konfiqurasiya
- Project: "Horizon" (proja7163b71)
- Pro entitlement: "pro" | offering: "pro" | product: "rubai_pro_monthly" | $9.99/ay
- Premium entitlement: "premium" | offering: "premium" | product: "rubai_premium_monthly" | $19.99/ay
- Test store app: appb7dcec46c1
- iOS app: appd0f2307e02 (bundle: com.elnur11.rubai)
- Android app: app2bb65b8564 (package: com.elnur11.rubai)

## Env vars lazımdır (hamısı set olunub)
- EXPO_PUBLIC_REVENUECAT_TEST_API_KEY
- EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
- EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
- REVENUECAT_PROJECT_ID
- REVENUECAT_TEST_STORE_APP_ID / APPLE / GOOGLE
