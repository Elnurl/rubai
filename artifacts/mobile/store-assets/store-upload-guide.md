# Store Asset Upload Guide

All screenshot files and the Google Play feature graphic are ready in:
`artifacts/mobile/store-assets/screenshots/`

---

## Files Ready to Upload

### Apple App Store

| File | Size | Slot in App Store Connect |
|---|---|---|
| `ios-67-shot1-dashboard.png` | 1290 × 2796 px | 6.7" — Screenshot 1 |
| `ios-67-shot2-roadmap.png` | 1290 × 2796 px | 6.7" — Screenshot 2 |
| `ios-67-shot3-coach.png` | 1290 × 2796 px | 6.7" — Screenshot 3 |
| `ios-67-shot4-voice.png` | 1290 × 2796 px | 6.7" — Screenshot 4 |
| `ios-67-shot5-intake.png` | 1290 × 2796 px | 6.7" — Screenshot 5 |
| `ios-67-shot6-reflection.png` | 1290 × 2796 px | 6.7" — Screenshot 6 |
| `ios-55-shot1-dashboard.png` | 1242 × 2208 px | 5.5" — Screenshot 1 |
| `ios-55-shot2-roadmap.png` | 1242 × 2208 px | 5.5" — Screenshot 2 |
| `ios-55-shot3-coach.png` | 1242 × 2208 px | 5.5" — Screenshot 3 |

### Google Play

| File | Size | Slot in Play Console |
|---|---|---|
| `feature-graphic-1024x500.png` | 1024 × 500 px | Feature Graphic |
| `gplay-shot1-dashboard.png` | 1080 × 1920 px | Phone Screenshot 1 |
| `gplay-shot2-coach.png` | 1080 × 1920 px | Phone Screenshot 2 |

---

## Apple App Store Connect — Upload Steps

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com)
2. Go to **My Apps** → select rubai
3. Click the **iOS App** tab, then choose the version you're preparing
4. Scroll to **App Previews and Screenshots**
5. Under **6.7-inch iPhone Display**, click **+** and upload all 6 `ios-67-*.png` files
6. Under **5.5-inch iPhone Display**, click **+** and upload all 3 `ios-55-*.png` files
7. Drag to reorder screenshots in the desired sequence (Shot 1 = Dashboard first)
8. Fill in the remaining metadata from `listing.md`:
   - App Name: `rubai - AI Goal Coach`
   - Subtitle: `Your personal execution coach`
   - Keywords: `goal,coach,AI,habit,planner,productivity,roadmap,daily plan,execution,accountability`
   - Description: copy the full description block from `listing.md`
   - Support URL: the `/api/privacy` URL from `listing.md`
9. Set **Privacy Policy URL** in the **App Privacy** section
10. Complete the **App Privacy** data questionnaire using the table in `specs.md`
11. Save and click **Add for Review** when ready

---

## Google Play Console — Upload Steps

1. Sign in to [Google Play Console](https://play.google.com/console)
2. Go to your app → **Store presence** → **Main store listing**
3. Scroll to **Graphics**
4. Upload `feature-graphic-1024x500.png` in the **Feature graphic** slot
5. Upload `gplay-shot1-dashboard.png` and `gplay-shot2-coach.png` under **Phone screenshots**
6. Fill in the store listing fields from `listing.md`:
   - Short description: `AI coach that turns any goal into a daily action plan. Free to start.`
   - Full description: copy the Google Play full description block from `listing.md`
   - Category: Productivity
7. Set **Privacy Policy URL** in the **Store presence** → **Store settings** section
8. Complete the **Content rating** questionnaire (see `content-rating.md`)
9. Complete the **Data safety** section using the same data table from `specs.md`
10. Save and submit for review

---

## Notes

- The screenshot files are AI-generated marketing mockups at the correct store dimensions. They can be replaced with real simulator captures later — the store accepts either.
- The overlay headline text on every screenshot is confirmed correct.
- Once you attach a custom domain in Replit Deployments, update the privacy policy and support URLs in both dashboards.
