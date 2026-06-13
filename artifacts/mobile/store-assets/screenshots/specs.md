# rubai — Screenshot Specifications & Shot List

## Required Sizes

### Apple App Store

| Device | Dimensions | Required? | Notes |
|---|---|---|---|
| 6.7" iPhone (iPhone 15 Pro Max / 16 Plus) | 1290 × 2796 px | **Yes** | Primary phone size Apple uses for search |
| 5.5" iPhone (iPhone 8 Plus) | 1242 × 2208 px | **Yes** | Required for older device support |
| 12.9" iPad Pro (6th gen) | 2048 × 2732 px | Only if `supportsTablet: true` | Currently disabled in app.json; skip for now |

Minimum **3 screenshots** required per size; up to **10** allowed. Apple uses the 6.7" set for App Store search cards.

### Google Play

| Asset | Dimensions | Required? | Notes |
|---|---|---|---|
| Phone screenshots | 1080 × 1920 px (min 320px, max 3840px) | **Yes — min 2** | Portrait preferred |
| Feature Graphic | 1024 × 500 px | **Yes** | Banner shown at top of Play listing |
| Tablet (7") | 1080 × 1920 px | Optional | Skip for now |
| Tablet (10") | 1920 × 1200 px | Optional | Skip for now |

---

## Shot List (6 screenshots, ordered)

Use this same sequence for both iPhone 6.7" and Google Play phone screenshots. Add a headline overlay bar at the top or bottom of each shot.

### Shot 1 — Home / Goal Dashboard
**Screen:** `app/(tabs)/index.tsx` (today's plan / dashboard)  
**State to show:** At least one active goal card visible, daily plan with 3–4 tasks, progress ring showing partial completion.  
**Headline overlay:** `"Your AI coach. Always ready."`  
**Subtext overlay:** `"Daily plans built around your real schedule."`

### Shot 2 — Roadmap View
**Screen:** `app/(tabs)/roadmap.tsx` or similar roadmap detail screen  
**State to show:** A multi-phase roadmap expanded, showing Phase 1 complete and Phase 2 in progress with milestones.  
**Headline overlay:** `"From goal to roadmap in minutes."`  
**Subtext overlay:** `"Structured phases. Clear milestones. No guesswork."`

### Shot 3 — Coach Chat
**Screen:** `app/(tabs)/coach.tsx` — coach conversation  
**State to show:** A few chat bubbles — user message (text) and coach reply with an action suggestion card below.  
**Headline overlay:** `"A coach that actually listens."`  
**Subtext overlay:** `"Context-aware advice, every single day."`

### Shot 4 — Voice Input
**Screen:** Coach screen with voice recording UI active  
**State to show:** The microphone button active / waveform showing, a transcribed message appearing.  
**Headline overlay:** `"Hands-free check-ins."`  
**Subtext overlay:** `"Just talk — rubai handles the rest."`

### Shot 5 — Intake / Goal Creation
**Screen:** Onboarding intake questionnaire  
**State to show:** A visually clean intake question with the progress bar at ~50%, e.g. "What does success look like for you in 90 days?"  
**Headline overlay:** `"Set a goal. Get a plan."`  
**Subtext overlay:** `"rubai asks the right questions so your plan actually fits."`

### Shot 6 — Daily Plan & Reflections
**Screen:** Daily plan task list with a reflection prompt visible  
**State to show:** 3 tasks — one checked off, one in progress, one pending — and a reflection card at the bottom.  
**Headline overlay:** `"Check in. Reflect. Improve."`  
**Subtext overlay:** `"Small daily wins compound into big results."`

---

## Feature Graphic (Google Play — 1024 × 500 px)

Design guidance:
- Background: dark cream `#15140F` (matches app splash)
- App icon (large, centred-left): `assets/images/icon.png` scaled to ~220 × 220 px
- Right side: app name "rubai" in bold Inter, tagline "AI Goal Coach" in emerald `#10B981`
- Avoid placing critical content in the outer 10% (may be cropped on some devices)
- Do **not** use screenshots or device frames inside the feature graphic — Google prohibits it

---

## How to Capture Screenshots

### Option A — Expo Go / Development Build (fastest)
1. Run a development build on a physical iPhone 15 Pro Max or use the Xcode simulator set to "iPhone 15 Pro Max".
2. Navigate to each screen in the shot list above.
3. Set up the state manually (or use the seed data helper if one exists).
4. Take a screenshot: **Device**: Side button + Volume Up. **Simulator**: Cmd+S.
5. Export from Photos at full resolution.

### Option B — EAS Build + Simulator
1. Run `eas build --platform ios --profile preview` to get a simulator build.
2. Install in Xcode Simulator (iPhone 15 Pro Max, iOS 17+).
3. Follow the same capture steps above.

### Overlay / Design
Add headline overlays using Figma, Sketch, or Canva after capturing raw screenshots. Keep the overlay bar to the top or bottom 15% of the image so the app UI is clearly visible.

---

## Checklist

### Apple App Store — Assets Prepared (files in this folder, ready to upload)
- [x] 6 screenshot files at 1290 × 2796 px (6.7" iPhone): `ios-67-shot1-dashboard.png` through `ios-67-shot6-reflection.png`
- [x] 3 screenshot files at 1242 × 2208 px (5.5" iPhone): `ios-55-shot1-dashboard.png` through `ios-55-shot3-coach.png`
- [x] Headline overlays applied to all screenshots (text confirmed correct)

### Apple App Store — Requires Human Action (browser + Apple ID)
- [ ] Screenshots uploaded to App Store Connect → My Apps → [app] → iOS App → 6.7" Display and 5.5" Display
- [ ] App name, subtitle, description, keywords filled in App Store Connect (copy from `listing.md`)
- [ ] Privacy policy URL set in App Store Connect → App Privacy
- [ ] App Privacy data practice questionnaire completed (see table below)
- [ ] Content rating questionnaire completed (see `content-rating.md`)
- [ ] Sign in with Apple entitlement enabled ✓ (already in `app.json`)
- [ ] Support URL filled in

> **Note on screenshot fidelity:** Current files are AI-generated marketing mockups at the correct store pixel dimensions. They can be replaced with real Xcode simulator captures at any time — see `store-upload-guide.md` for instructions. Apple accepts either for initial submission.

### App Privacy (Apple — Data Practice Questions)
Navigate to: App Store Connect → your app → App Privacy

| Data type | Collected? | Linked to user? | Used for tracking? |
|---|---|---|---|
| Name | No | — | — |
| Email Address | Yes | Yes | No |
| User ID | Yes | Yes | No |
| Coarse Location | No | — | — |
| Precise Location | No | — | — |
| Search History | No | — | — |
| User Content (messages/text) | Yes | Yes | No |
| Audio Data | No* | — | — |
| Photos/Videos | No* | — | — |
| Identifiers (device ID) | Yes | No | No |
| Usage Data | Yes | Yes | No |
| Diagnostics | Yes | No | No |

*Audio and photos are processed in real time by OpenAI but not stored by rubai server-side beyond the request duration.

### Google Play — Assets Prepared (files in this folder, ready to upload)
- [x] Feature graphic file (1024 × 500 px): `feature-graphic-1024x500.png`
- [x] 2 phone screenshot files (1080 × 1920 px): `gplay-shot1-dashboard.png`, `gplay-shot2-coach.png`

### Google Play — Requires Human Action (browser + Google account)
- [ ] Feature graphic uploaded to Google Play Console → Store presence → Main store listing → Graphics
- [ ] Phone screenshots uploaded (min 2 required)
- [ ] Short description (≤80 chars) filled in (copy from `listing.md`)
- [ ] Full description filled in (copy from `listing.md`)
- [ ] Privacy policy URL set in Store listing
- [ ] Content rating questionnaire completed (see `content-rating.md`)
- [ ] Age group set (Everyone / 13+)
- [ ] Data safety section completed (analogous to Apple App Privacy table above)
