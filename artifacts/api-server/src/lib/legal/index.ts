// Single source of truth for legal documents and their versions.
// Bump the version string of a document whenever its substantive content
// changes — clients re-prompt when the user's accepted version no longer
// matches the current one.
import { privacyPolicy } from "./privacyPolicy";
import { termsOfService } from "./termsOfService";

export const SUPPORTED_LOCALES = ["en", "az", "ru", "ar", "zh", "es"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const FALLBACK_LOCALE: Locale = "en";

export const DOCUMENT_TYPES = ["privacy_policy", "terms_of_service"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_VERSIONS: Record<DocumentType, string> = {
  privacy_policy: "1.0.0",
  terms_of_service: "1.0.0",
};

export type LocalizedDocument = {
  title: string;
  body: string;
};

const DOCUMENTS: Record<DocumentType, Record<Locale, LocalizedDocument>> = {
  privacy_policy: privacyPolicy,
  terms_of_service: termsOfService,
};

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function getDocument(
  type: DocumentType,
  locale: Locale,
): LocalizedDocument {
  return DOCUMENTS[type][locale] ?? DOCUMENTS[type][FALLBACK_LOCALE];
}

// English is the authoritative legal text. Other locales are convenience
// translations and should display a notice to that effect — generated here
// so server and clients agree on the wording.
export function authoritativeNotice(locale: Locale): string | null {
  if (locale === FALLBACK_LOCALE) return null;
  const map: Record<Exclude<Locale, "en">, string> = {
    az: "Bu tərcümə yalnız asanlıq üçün təqdim edilir. Hüquqi etibarlı versiya İngilis dilindədir.",
    ru: "Этот перевод предоставлен только для удобства. Юридически обязывающей является английская версия.",
    ar: "هذه الترجمة مقدمة للراحة فقط. النسخة الإنجليزية هي النسخة الملزمة قانونًا.",
    zh: "此翻译仅供参考。具有法律约束力的版本为英文版本。",
    es: "Esta traducción se ofrece por conveniencia. La versión jurídicamente vinculante es la inglesa.",
  };
  return map[locale as Exclude<Locale, "en">];
}
