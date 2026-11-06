import { resolveLocale } from "./locales";
import type { Messages } from "./messages";

const loaders = {
  "ja": () => import("./locales/ja"),
  "de": () => import("./locales/de"),
  "ru": () => import("./locales/ru"),
  "uk": () => import("./locales/uk"),
  "en": () => import("./locales/en"),
  "zh-Hans": () => import("./locales/zh-Hans"),
  "fr": () => import("./locales/fr"),
  "ko": () => import("./locales/ko"),
  "he": () => import("./locales/he"),
  "es": () => import("./locales/es"),
  "ar": () => import("./locales/ar"),
  "zh-Hant": () => import("./locales/zh-Hant"),
};

/** Opt-in async entry; bundlers create one cacheable chunk per locale. */
export async function loadMessages(locale: string): Promise<Messages> {
  return (await loaders[resolveLocale(locale)]()).default;
}
