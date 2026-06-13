# rubai — Data Safety & Content Rating: Submission Guide

This single file contains every answer you need to fill in the data-practice and content-rating
forms on both stores. Work through it top to bottom. All field values are copy-paste ready.

---

## Part 1 — Apple App Store Connect: App Privacy

**Navigate to:** App Store Connect → My Apps → rubai - AI Goal Coach → App Privacy

Click "Get Started" and answer each category:

### Step 1 — Data types collected

Select **Yes, we collect data from this app**, then check these data types:

| Data type | Select? |
|---|---|
| Email Address | ✅ Yes |
| User ID | ✅ Yes |
| User Content | ✅ Yes |
| Identifiers (Device ID) | ✅ Yes |
| Usage Data | ✅ Yes |
| Diagnostics | ✅ Yes |
| Name | ❌ No |
| Location (coarse or precise) | ❌ No |
| Search History | ❌ No |
| Photos or Videos | ❌ No (processed in real time, not stored) |
| Audio Data | ❌ No (processed in real time, not stored) |
| Financial Info | ❌ No |
| Health & Fitness | ❌ No |
| Contacts | ❌ No |
| Browsing History | ❌ No |

### Step 2 — Per data-type answers

For each selected type, fill in the linked/tracking flags as follows:

| Data type | Linked to user? | Used for tracking? | Purpose |
|---|---|---|---|
| Email Address | **Yes** | No | App functionality, account management |
| User ID | **Yes** | No | App functionality, account management |
| User Content (goals, reflections, coach messages) | **Yes** | No | App functionality |
| Identifiers (Device ID) | No | No | Analytics, diagnostics |
| Usage Data | **Yes** | No | Analytics, app functionality |
| Diagnostics | No | No | App improvements |

### Step 3 — Tracking

**Does this app use data to track users?** → **No**

*(rubai does not share data with third-party data brokers, does not target ads, and does not
combine data with third parties' data for tracking purposes.)*

### Step 4 — Submit

Click **Publish** to submit the App Privacy answers.

---

## Part 2 — Apple App Store Connect: Content Rating

**Navigate to:** App Store Connect → My Apps → rubai - AI Goal Coach → App Information → Age Rating

Click **Edit** next to Age Rating and fill in the questionnaire:

| Category | Answer |
|---|---|
| Cartoon or Fantasy Violence | **None** |
| Realistic Violence | **None** |
| Prolonged Graphic or Sadistic Realistic Violence | **None** |
| Profanity or Crude Humor | **None** |
| Mature/Suggestive Themes | **None** |
| Horror/Fear Themes | **None** |
| Medical/Treatment Information | **None** |
| Alcohol, Tobacco, or Drug Use or References | **None** |
| Simulated Gambling | **None** |
| Sexual Content or Nudity | **None** |
| Graphic Sexual Content and Nudity | **None** |
| Unrestricted Web Access | **No** |
| User Generated Content | **Yes** |

**Expected result:** Rating of **4+**

> The UGC flag may add a note like "Infrequent/Mild" — this is expected and acceptable.
> rubai runs OpenAI moderation on all user input before processing, which is a positive signal for
> Apple reviewers if they ask about moderation.

---

## Part 3 — Google Play Console: Data Safety Section

**Navigate to:** Google Play Console → Dashboard → rubai - AI Goal Coach → Policy →
App content → Data safety

Click **Start** and work through the wizard:

### Section 1 — Data collection and security

**Does your app collect or share any of the required user data types?** → **Yes**

**Is all of the user data collected by your app encrypted in transit?** → **Yes**

**Do you provide a way for users to request that their data is deleted?** → **Yes**
*(Users can delete their account from within the app, which deletes their server-side data.)*

### Section 2 — Data types collected

Check the following types (uncheck all others):

| Category | Data type | Collected? |
|---|---|---|
| Personal info | Email address | ✅ Yes |
| Personal info | User IDs | ✅ Yes |
| App activity | App interactions | ✅ Yes |
| App activity | Other user-generated content (goals, reflections, messages) | ✅ Yes |
| App info and performance | Crash logs | ✅ Yes |
| App info and performance | Diagnostics | ✅ Yes |
| Device or other IDs | Device or other IDs | ✅ Yes |
| Personal info | Name | ❌ No |
| Location | Approximate location | ❌ No |
| Location | Precise location | ❌ No |
| Photos and videos | Photos | ❌ No (processed in real time, not stored) |
| Audio files | Voice or sound recordings | ❌ No (processed in real time, not stored) |
| Financial info | All types | ❌ No |
| Health and fitness | All types | ❌ No |
| Messages | All types | ❌ No (AI coach turns are stored as user content, not as messages) |

### Section 3 — Data usage per type

For each collected type, answer the purpose and sharing questions:

| Data type | Shared with 3rd parties? | Required / Optional? | Purpose(s) |
|---|---|---|---|
| Email address | No | Required | App functionality, Account management |
| User IDs | No | Required | App functionality, Account management |
| App interactions | No | Required | Analytics, App functionality |
| User-generated content | No | Required | App functionality |
| Crash logs | No | Required | App functionality (crash reporting) |
| Diagnostics | No | Optional | Analytics |
| Device or other IDs | No | Required | Analytics |

> **Third-party processor note:** Data is processed by OpenAI (for AI features) and Clerk (for
> authentication). Both are data processors acting on your behalf under data processing agreements —
> this does not count as "sharing with third parties" for data safety purposes.

### Section 4 — Submit

Click **Save** then **Submit** to send the data safety section for review.

---

## Part 4 — Google Play Console: Content Rating

**Navigate to:** Google Play Console → Policy → App content → Content rating

Click **Start questionnaire** and fill in:

**Step 1 — App category:** Select **Utility** → **Productivity**

**Step 2 — Questions:**

| Question | Answer |
|---|---|
| Does the app contain or display sexual content? | **No** |
| Does the app contain or display violence? | **No** |
| Does the app contain or promote hate speech? | **No** |
| Does the app contain, display, or promote gambling? | **No** |
| Does the app contain or promote drug or alcohol use? | **No** |
| Does the app allow users to interact or share content in real time? | **Yes** *(AI chat is real-time; no peer-to-peer user chat)* |
| Does the app include a social feature where users can find and/or interact with each other? | **No** |
| Does the app contain mature or crude humor? | **No** |
| Does the app contain scary or intense content appropriate only for older audiences? | **No** |
| Does the app simulate or depict gambling? | **No** |
| Does the app use a user's location in any way? | **No** |
| Does the app contain ads? | **No** |

**Expected result:** Rating of **Everyone (E)**

Click **Submit** to apply the rating.

### Step 3 — Age Group (after rating is applied)

In the content rating section, set the **minimum age** to **13** years.

Add a note in the store listing description (already included in `listing.md`) that users under 16
require parental consent per the Privacy Policy.

---

## Part 5 — Final Checklist

Work through these in order to reach "Ready for submission" on both stores:

### Apple App Store Connect

- [ ] App Privacy submitted (Part 1 above) ← **do this first**, it's standalone
- [ ] Content rating questionnaire completed, age rating showing **4+** (Part 2)
- [ ] Screenshots uploaded: 6.7" set (6 shots) + 5.5" set (3 shots) — files in this folder
- [ ] App name, subtitle, description, keywords filled in (copy from `listing.md`)
- [ ] Privacy policy URL set: see `listing.md` for the URL
- [ ] Support URL set: see `listing.md` for the URL
- [ ] "Sign in with Apple" entitlement — already in `app.json`, no action needed
- [ ] What's New text filled in (copy from `listing.md` → "What's New" field)

### Google Play Console

- [ ] Data safety section submitted (Part 3 above) ← **do this first**, required before submission
- [ ] Content rating questionnaire completed, showing **Everyone (E)** (Part 4)
- [ ] Minimum age set to **13**
- [ ] Feature graphic uploaded (1024 × 500 px) — file: `feature-graphic-1024x500.png`
- [ ] Phone screenshots uploaded (min 2) — files: `gplay-shot1-dashboard.png`, `gplay-shot2-coach.png`
- [ ] Short description filled in (≤80 chars, copy from `listing.md`)
- [ ] Full description filled in (copy from `listing.md`)
- [ ] Privacy policy URL set (copy from `listing.md`)
- [ ] Category set to **Productivity**

---

## Notes for Reviewers

- **Audio / voice input:** rubai uses the microphone for voice check-ins. Audio is streamed to
  OpenAI Whisper for transcription and is not stored server-side beyond the request. This is why
  "Audio Data" is marked as not collected.
- **Photos:** Users can attach images to coach messages. Images are sent to OpenAI GPT-4o for
  vision analysis and are not stored server-side. This is why "Photos/Videos" is marked as not collected.
- **Content moderation:** rubai runs OpenAI `omni-moderation` on all user text input before
  processing. Flagged content returns a 400 error and is never processed by the AI coach.
- **Calendar access:** The app requests calendar read permission (to plan around meetings) and
  write permission (to create task events). Users grant this explicitly via the iOS/Android
  permission dialog, and the permission string is set in `app.json`.
