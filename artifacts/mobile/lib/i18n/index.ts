import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import az from "./locales/az.json";
import ru from "./locales/ru.json";
import tr from "./locales/tr.json";
import zh from "./locales/zh.json";
import ar from "./locales/ar.json";
import es from "./locales/es.json";
import pt from "./locales/pt.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";

/**
 * Maps the human-readable language names stored in `account.preferredLanguage`
 * (see `lib/languageLocales.ts`) to the short i18next language codes used as
 * resource keys here.
 *
 * English has no resource bundle on purpose: every `t(key, "English default")`
 * call carries its English copy inline as the defaultValue, so English is the
 * in-code source of truth and the fallback for any missing translation.
 */
export const LANGUAGE_TO_CODE: Record<string, string> = {
  English: "en",
  Azərbaycan: "az",
  Русский: "ru",
  Türkçe: "tr",
  中文: "zh",
  العربية: "ar",
  Español: "es",
  Português: "pt",
  Deutsch: "de",
  Français: "fr",
};

export function codeForLanguage(language: string | undefined | null): string {
  if (!language) return "en";
  return LANGUAGE_TO_CODE[language] ?? "en";
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    // i18next v4 JSON format is required for React Native (Hermes Intl).
    compatibilityJSON: "v4",
    lng: "en",
    fallbackLng: "en",
    resources: {
      az: { translation: az },
      ru: { translation: ru },
      tr: { translation: tr },
      zh: { translation: zh },
      ar: { translation: ar },
      es: { translation: es },
      pt: { translation: pt },
      de: { translation: de },
      fr: { translation: fr },
    },
    interpolation: {
      // React already escapes output, so disable i18next's own escaping.
      escapeValue: false,
    },
    returnNull: false,
    returnEmptyString: false,
  });
}

/**
 * Switch the active UI language from a stored display name. Safe to call on
 * every render — i18next no-ops when the language is unchanged.
 */
export function setAppLanguage(language: string | undefined | null): void {
  const code = codeForLanguage(language);
  if (i18n.language !== code) {
    void i18n.changeLanguage(code);
  }
}

export default i18n;
