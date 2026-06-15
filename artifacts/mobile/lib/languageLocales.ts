export const LANGUAGES = [
  "English",
  "Azərbaycan",
  "Русский",
  "Türkçe",
  "中文",
  "العربية",
  "Español",
  "Português",
  "Deutsch",
  "Français",
];

export const LANG_LOCALE: Record<string, string> = {
  "English": "en-US",
  "Azərbaycan": "az-AZ",
  "Русский": "ru-RU",
  "Türkçe": "tr-TR",
  "中文": "zh-CN",
  "العربية": "ar-SA",
  "Español": "es-ES",
  "Português": "pt-BR",
  "Deutsch": "de-DE",
  "Français": "fr-FR",
};

export function formatTime(timeStr: string, language: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const d = new Date(2000, 0, 1, h, m);
  const locale = LANG_LOCALE[language] ?? "en-US";
  try {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return timeStr;
  }
}
