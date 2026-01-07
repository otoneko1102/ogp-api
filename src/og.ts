import { DOMParser } from "linkedom";
import { DEFAULT_LANG, isSupportedLang } from "./config.js";

export type OGData = {
  title: string;
  description: string;
  image: string | null;
  siteName: string;
  favicon: string;
  url: string;
  isFallback: boolean;
};

const TTL_MS = 30 * 60 * 1000;
const FALLBACK_TTL_MS =
  Number(process.env.OGP_FALLBACK_TTL_MS) || 1 * 60 * 1000;

type CacheEntry = {
  data: OGData;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<OGData>>();

const getMetaContent = (
  doc: any,
  property: string,
  attribute: "property" | "name" = "property",
): string | null => {
  const meta = doc.querySelector(
    `meta[${attribute}="${property}"]`,
  ) as HTMLMetaElement | null;
  return meta ? meta.getAttribute("content") : null;
};

const extractOGData = (html: string, url: string) => {
  const parser = new DOMParser();
  const doc: any = parser.parseFromString(html, "text/html");

  const urlObj = new URL(url);
  const domain = urlObj.hostname.replace(/^www\./, "");

  const title =
    getMetaContent(doc, "og:title") ||
    getMetaContent(doc, "twitter:title") ||
    doc.querySelector("title")?.textContent ||
    domain;

  const description =
    getMetaContent(doc, "og:description") ||
    getMetaContent(doc, "twitter:description") ||
    getMetaContent(doc, "description", "name") ||
    "";

  const image =
    getMetaContent(doc, "og:image") ||
    getMetaContent(doc, "twitter:image") ||
    null;

  const siteName = getMetaContent(doc, "og:site_name") || domain;

  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return { title, description, image, siteName, favicon };
};

const fetchWithTimeout = async (
  url: string,
  timeout = 3000,
  init: RequestInit = {},
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "force-cache" as RequestCache,
      signal: controller.signal,
      ...init,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const fetchWithRetry = async (
  url: string,
  maxRetries = 2,
  init?: RequestInit,
): Promise<string> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (i > 0) await new Promise((r) => setTimeout(r, i * 200));
      const response = await fetchWithTimeout(url, 3000, init);
      if (response.ok) return await response.text();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      continue;
    }
  }
  throw new Error("Max retries exceeded");
};

export const fetchOGData = async (
  url?: string | null,
  lang?: string,
  userAgent?: string | null,
): Promise<OGData | null> => {
  if (!url) return null;

  const langToUse = isSupportedLang(lang) ? lang : DEFAULT_LANG;
  const key = `${langToUse}:${url}`;

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (cached) cache.delete(key);

  if (inFlight.has(key)) return inFlight.get(key)!;

  const promise = (async () => {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, "");

    try {
      const acceptLanguage =
        langToUse === "ja" ? "ja-JP,ja;q=0.9" : "en-US,en;q=0.9";

      const headers = {
        "User-Agent":
          (userAgent && userAgent.trim()) ||
          process.env.OGP_USER_AGENT ||
          "Mozilla/5.0 (compatible; ogp-api/1.0)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": acceptLanguage,
      };

      let html: string | null = null;

      try {
        html = await fetchWithRetry(url, 2, { headers });
      } catch (e) {
        const fallback = process.env.OGP_FALLBACK_PROXY;
        if (fallback) {
          try {
            const proxyUrl = fallback.includes("{url}")
              ? fallback.replace("{url}", encodeURIComponent(url))
              : `${fallback}${encodeURIComponent(url)}`;
            html = await fetchWithRetry(proxyUrl, 2);
          } catch (e2) {
            // fallback also failed
          }
        }
      }

      if (html) {
        const dataPartial = extractOGData(html, url);
        const data: OGData = {
          ...dataPartial,
          url,
          isFallback: false,
        };

        if (data.image && !/^https?:\/\//i.test(data.image)) {
          try {
            data.image = new URL(data.image, url).href;
          } catch (e) {
            // ignore
          }
        }

        cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
        return data;
      }

      throw new Error("Failed to fetch target URL");
    } catch (error) {
      const fallbackData: OGData = {
        title: domain,
        description: url,
        image: null,
        siteName: domain,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        url,
        isFallback: true,
      };
      // Cache fallback results for a short period (configurable via OGP_FALLBACK_TTL_MS in ms)
      const fallbackTtl =
        Number(process.env.OGP_FALLBACK_TTL_MS) || FALLBACK_TTL_MS;
      cache.set(key, {
        data: fallbackData,
        expiresAt: Date.now() + fallbackTtl,
      });
      return fallbackData;
    }
  })();

  inFlight.set(key, promise);
  try {
    const res = await promise;
    return res;
  } finally {
    inFlight.delete(key);
  }
};

export default { fetchOGData };
