import { en, type Messages } from "@/messages/en";

/**
 * Locale registry. The UI ships in English; adding a locale means adding a
 * messages file with the same shape and registering it here.
 */
const locales: Record<string, Messages> = { en };

export const SUPPORTED_LOCALES = Object.keys(locales);

export function getMessages(locale = "en"): Messages {
  return locales[locale] ?? en;
}

/** Convenience for the default locale. */
export const t = en;
