# rubai — Content Rating Questionnaire

Fill in these answers when completing the content rating questionnaires on App Store Connect and Google Play Console.

---

## Apple App Store — Content Rating

Navigate to: App Store Connect → your app → App Information → Content Rights / Age Rating

### Questionnaire Answers

| Category | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Alcohol, Tobacco, or Drug Use or References | None |
| Simulated Gambling | None |
| Sexual Content or Nudity | None |
| Graphic Sexual Content and Nudity | None |
| Unrestricted Web Access | No |
| User Generated Content | **Yes** *(users enter goals, reflections, and chat messages)* |

### Resulting Age Rating
**4+** (the User Generated Content flag may prompt Apple to add a note; the app itself has no objectionable content)

---

## Google Play — Content Rating

Navigate to: Google Play Console → your app → Policy → App content → Content rating

### Rating Questionnaire (IARC / Google)

**Step 1 — Category**  
Select: **Productivity**

**Step 2 — Questions**

| Question | Answer |
|---|---|
| Does the app contain or display sexual content? | No |
| Does the app contain or display violence? | No |
| Does the app contain or promote hate speech? | No |
| Does the app contain, display, or promote gambling? | No |
| Does the app contain or promote drug or alcohol use? | No |
| Does the app allow users to interact or share content in real time? | **Yes** *(AI chat is real-time; no peer-to-peer user chat)* |
| Does the app include a social feature where users can find and/or interact with each other? | No |
| Does the app contain mature or crude humor? | No |
| Does the app contain scary or intense content appropriate only for older audiences? | No |
| Does the app simulate or depict gambling? | No |
| Does the app use a user's location in any way? | No |
| Does the app contain ads? | No |

### Resulting Rating
**Everyone (E)** — no objectionable content; rated for all ages.

### Age Restriction (Google Play)
Set **minimum age** to: **13** (to align with the GDPR / COPPA baseline; rubai's privacy policy states the app is not directed at children under 16, but Google's minimum selectable age for "Everyone" rated apps is 13 — add a note in the listing that users under 16 need parental consent per the Privacy Policy).

---

## Additional Notes

- **User-generated content (UGC) moderation:** rubai runs OpenAI `omni-moderation` on coach input text before processing (see `artifacts/api-server/src/lib/aiConfig.ts` → `moderateOrThrow`). This means the app actively moderates UGC, which is a positive signal for both Apple and Google reviewers.
- **Apple's "Sign in with Apple":** already enabled (`usesAppleSignIn: true` in `app.json`), which is required for any app that offers social login alternatives.
- **Camera / Microphone / Calendar permissions:** all have purpose strings defined in `app.json` and will be displayed to Apple reviewers automatically.
