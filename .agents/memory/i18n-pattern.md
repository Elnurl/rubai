---
name: i18n pattern (mobile)
description: Full i18n setup for artifacts/mobile — conventions, pitfalls, tooling, and translation workflow.
---

## Setup
- Packages: `i18next` + `react-i18next` in artifacts/mobile
- Init: `lib/i18n/index.ts` — 9 locale JSON bundles (az/ru/tr/zh/ar/es/pt/de/fr); English is in-code via defaultValue, NOT a JSON bundle. `returnEmptyString: false` so empty translations fall back to inline English default safely.
- Language sync: `I18nLanguageSync` component in `app/_layout.tsx` inside `AtlasProvider` calls `setAppLanguage(account.preferredLanguage)` in a useEffect. First render uses "en" default — acceptable because auth-gated screens show loading state before any i18n strings render.

## Convention
- In React components: `import { useTranslation } from "react-i18next"` + `const { t } = useTranslation()` in EVERY component that renders strings (including sub-components in the same file).
- Wrap strings: `t("namespace.key", "English default text")`. English text is the inline default; no en.json needed at runtime.
- Interpolation: `t("ns.key", "Hello {{name}}", { name })` — keep {{placeholders}} verbatim, never translate inside {{ }}.
- Module-level code (outside React): `import i18n from "@/lib/i18n"` + `i18n.t("ns.key", "default")`.

## CRITICAL PITFALL: Module-level i18n.t() arrays
`const LABELS = [i18n.t("ns.a","A"), i18n.t("ns.b","B")]` is initialized ONCE at module load time with the active language. When `changeLanguage()` is called later, React components re-render but the array remains in the old language.
**Fix:** Move such arrays inside the component as `useMemo(() => [t("ns.a","A"), t("ns.b","B")], [t])`.
For interval/closure references to the array's length, use a `useRef` that is updated each render: `const lastIdxRef = useRef(arr.length-1); lastIdxRef.current = arr.length-1;`.
Affected patterns found and fixed: COLD_START_SUGGESTIONS (coach.tsx), PLACEHOLDERS (welcome.tsx), STEPS (generating.tsx), DAY_LABELS (FocusPulseCard.tsx), COMPLETED_TAGS/SKIPPED_TAGS (ReflectionSheet.tsx).
Module-level FUNCTIONS that call i18n.t() are fine — they re-evaluate each call.

## Locale files
- Location: `lib/i18n/locales/{az,ru,tr,zh,ar,es,pt,de,fr}.json`
- Format: nested JSON keyed by dot-separated namespace.key (i18next default keySeparator ".").
- 749 keys across all namespaces. Each namespace = camelCase file basename (e.g. "coach", "reflectionSheet", "accountTab").

## Key extraction tooling
- `artifacts/mobile/scripts/i18n-extract.cjs`: TS-AST extractor (uses `typescript` package). Scans app/, components/, lib/ (excludes lib/i18n/). Writes `lib/i18n/locales/en.json` as the translation source. Run: `node scripts/i18n-extract.cjs` from `artifacts/mobile`.
- For adding new strings: add t("ns.newKey","English text") in code, run extractor to get updated en.json, then have translation agents read en.json and update each locale JSON.

## Why English is not a JSON bundle
Avoids double-maintenance: the English text lives as the defaultValue in code, so adding a new string doesn't require editing en.json first. en.json is only generated for translation reference.
