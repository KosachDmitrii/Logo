import en, { type Dict, type MessageKey } from "./locales/en";
import ru from "./locales/ru";
import he from "./locales/he";
import de from "./locales/de";
import fr from "./locales/fr";
import es from "./locales/es";

export type AppLocale = "en" | "ru" | "he" | "de" | "fr" | "es";
export type { MessageKey };

export const APP_LOCALES: AppLocale[] = ["en", "ru", "he", "de", "fr", "es"];

const DICTS: Record<AppLocale, Dict> = { en, ru, he, de, fr, es };

export function normalizeAppLocale(value: unknown): AppLocale {
  return APP_LOCALES.includes(value as AppLocale) ? (value as AppLocale) : "en";
}

export function detectBrowserLocale(): AppLocale {
  if (typeof navigator === "undefined") return "en";
  const raw = (navigator.languages?.[0] || navigator.language || "en")
    .slice(0, 2)
    .toLowerCase();
  return normalizeAppLocale(raw);
}

export function isRtlLocale(locale: AppLocale): boolean {
  return locale === "he";
}

export function t(
  locale: AppLocale,
  key: MessageKey | string,
  vars?: Record<string, string | number>,
): string {
  const template =
    DICTS[locale]?.[key as MessageKey] ??
    DICTS.en[key as MessageKey] ??
    key;
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

/** Prefer pretty aliases, else any IANA zone → last segment as city. */
export function cityFromTimeZone(timeZone: string): string | null {
  const tz = timeZone.trim();
  if (!tz || tz === "UTC" || tz.startsWith("Etc/")) return null;

  const aliases: Record<string, string> = {
    Jerusalem: "Tel Aviv",
    Tel_Aviv: "Tel Aviv",
    Kiev: "Kyiv",
    Kyiv: "Kyiv",
    Ho_Chi_Minh: "Ho Chi Minh City",
    Argentina_Buenos_Aires: "Buenos Aires",
    Sao_Paulo: "São Paulo",
    Mexico_City: "Mexico City",
    New_York: "New York",
    Los_Angeles: "Los Angeles",
    Hong_Kong: "Hong Kong",
  };

  const segments = tz.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const raw = segments[segments.length - 1] ?? "";
  if (!raw || /^(UTC|GMT|UCT|Universal|Zulu)$/i.test(raw)) return null;

  const aliasKey =
    segments.length >= 3
      ? `${segments[segments.length - 2]}_${raw}`
      : raw;
  if (aliases[aliasKey]) return aliases[aliasKey];
  if (aliases[raw]) return aliases[raw];

  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function studioPlaceStamp(
  origin = "Tel Aviv",
  now = new Date(),
): string {
  const year = now.getFullYear();
  let timeZone = "UTC";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    timeZone = "UTC";
  }
  const local = cityFromTimeZone(timeZone);
  if (local && local !== origin) {
    return `${origin} ↔ ${local} / ${year}`;
  }
  return `${origin} / ${year}`;
}

export function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";
}
