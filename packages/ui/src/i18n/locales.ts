/** Matches elide/project/docs/src/i18n/locales.ts. Expanded locales are opt-in too. */
export const primaryLocales = ["en", "es", "de", "fr", "ru", "uk", "ar"] as const;
export const secondaryLocales = ["zh-Hans", "zh-Hant", "ja", "ko", "he"] as const;
export const supportedLocales = [...primaryLocales, ...secondaryLocales] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export type Direction = "ltr" | "rtl";

export const localeInfo = {
  en: { name: "English", direction: "ltr" },
  es: { name: "Español", direction: "ltr" },
  de: { name: "Deutsch", direction: "ltr" },
  fr: { name: "Français", direction: "ltr" },
  ru: { name: "Русский", direction: "ltr" },
  uk: { name: "Українська", direction: "ltr" },
  ar: { name: "العربية", direction: "rtl" },
  "zh-Hans": { name: "简体中文", direction: "ltr" },
  "zh-Hant": { name: "繁體中文", direction: "ltr" },
  ja: { name: "日本語", direction: "ltr" },
  ko: { name: "한국어", direction: "ltr" },
  he: { name: "עברית", direction: "rtl" },
} as const satisfies Record<SupportedLocale, { name: string; direction: Direction }>;

/** Resolve BCP 47 tags, preserving Chinese script before region fallback. No browser globals. */
export function resolveLocale(tag: string): SupportedLocale {
  try {
    const locale = new Intl.Locale(tag);
    if (locale.language === "zh") {
      return locale.maximize().script === "Hant" ? "zh-Hant" : "zh-Hans";
    }
    return supportedLocales.includes(locale.language as SupportedLocale)
      ? locale.language as SupportedLocale : "en";
  } catch { return "en"; }
}
