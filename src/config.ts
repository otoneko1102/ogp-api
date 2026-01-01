export const SUPPORTED_LANGS = ["en", "ja"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

// Default language for fetching (can be changed here)
export const DEFAULT_LANG: Lang = "ja";

export const isSupportedLang = (lang?: string): lang is Lang =>
  !!lang && (SUPPORTED_LANGS as readonly string[]).includes(lang);
