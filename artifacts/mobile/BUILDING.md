# Building & Submitting rubai for App Store / Google Play

This guide covers the one-time setup and the commands to build and submit native binaries via EAS Build.

---

## Prerequisites

Before running any build:

- [ ] **Apple Developer Program** membership active (https://developer.apple.com)
- [ ] **Google Play Console** account active (https://play.google.com/console)
- [ ] **App Store Connect** app record created for bundle ID `com.rubai.mobile`
- [ ] **Google Play** app record created for package `com.rubai.mobile`
- [ ] **RevenueCat** products `rubai_pro_monthly` and `rubai_premium_monthly` configured in both stores and linked to entitlements `pro` and `premium`
- [ ] **EAS CLI** installed: `npm install -g eas-cli`
- [ ] Logged in to EAS: `eas login`

---

## Step 1 — Set EAS Secrets (one-time)

Production builds pick up secrets that are **not** in `eas.json` to avoid committing values to source. Set them once via:

```sh
# The production domain (without https://) — e.g. myapp.replit.app
eas secret:create --scope project --name EXPO_PUBLIC_DOMAIN --value "YOUR_PRODUCTION_DOMAIN" --profile production

# Supabase Auth (project URL + anon key)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co" --profile production
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..." --profile production

# RevenueCat iOS production public API key (appl_...)
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value "appl_..." --profile production

# RevenueCat Android production public API key (goog_...)
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value "goog_..." --profile production
```

Verify secrets are set:
```sh
eas secret:list
```

---

## Step 2 — Configure submit credentials

Edit `eas.json` → `submit.production.ios` with your Apple values:

| Field | Where to find it |
|-------|-----------------|
| `appleId` | Your Apple ID email (apple developer account) |
| `ascAppId` | App Store Connect → App → App Information → Apple ID (numeric) |
| `appleTeamId` | developer.apple.com → Membership → Team ID |

For Android, the `serviceAccountKeyPath` points to a Google Play service account JSON key file. Download it from Google Play Console → Setup → API access → Service accounts, then save it as `artifacts/mobile/google-service-account.json` (already gitignored).

---

## Step 3 — Link Apple credentials

```sh
cd artifacts/mobile
eas credentials
```

This walks through provisioning profiles and push notification certificates interactively.

---

## Step 4 — Build for iOS

```sh
cd artifacts/mobile
eas build --platform ios --profile production
```

This takes ~15–30 minutes. EAS manages code signing automatically if you use "managed" credentials. The build URL and a QR code are printed when it starts.

---

## Step 5 — Build for Android

```sh
cd artifacts/mobile
eas build --platform android --profile production
```

This produces a `.aab` (Android App Bundle) suitable for Play Store submission.

---

## Step 6 — Submit to App Store (TestFlight)

After the iOS build completes, submit it:

```sh
cd artifacts/mobile
eas submit --platform ios --profile production
```

The binary will appear in App Store Connect → TestFlight within a few minutes. You can then add testers from the TestFlight tab.

---

## Step 7 — Submit to Google Play (internal testing)

After the Android build completes:

```sh
cd artifacts/mobile
eas submit --platform android --profile production
```

The `.aab` is uploaded to the internal testing track. Open Google Play Console to promote it and add testers.

---

## Step 8 — End-to-end smoke test

Once installed from TestFlight or the internal track on a **real device**:

1. Sign in with your Supabase account (email or Google)
2. Create a new goal and complete intake
3. Verify the roadmap generates successfully
4. Open the Coach tab and send a message
5. Navigate to Plans → tap **Choose Pro**
6. Complete the in-app purchase through the native payment sheet
7. Confirm the app shows the Pro tier and the `/api/me/sync-tier` call updates the server

---

## Updating the build number

`appVersionSource: "remote"` in `eas.json` means EAS auto-increments the build number on each submission. To bump the **version string** (e.g. 1.0.0 → 1.1.0), edit `version` in `app.json` before building.
