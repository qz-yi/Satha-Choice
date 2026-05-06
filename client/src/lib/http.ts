/**
 * Centralised HTTP client for SATHA.
 *
 * Strategy:
 *  - Browser (satha-iq.com): use EMPTY base → same-origin requests
 *    (nginx proxies /api/* → port 5000 automatically, no CORS needed)
 *  - Capacitor APK: use VITE_API_URL (absolute https://satha-iq.com)
 *    because the WebView origin is capacitor://localhost (cross-origin)
 */

import { Capacitor } from "@capacitor/core";

// ── Base URL resolution ───────────────────────────────────────────────────

function resolveBaseUrl(): string {
  // للاندرويد والايفون: نستخدم process.env حصراً
  if (Capacitor.isNativePlatform()) {
    const url = import.meta.env.VITE_API_URL || "https://satha-iq.com";
    
    if (!url) {
      console.warn("[HTTP] Native platform detected but URL is not set.");
    }
    return url.replace(/\/$/, "");
  }

  // للويب: نتركها فارغة ليعمل الـ Proxy
  return "";
}
  

export const API_BASE = resolveBaseUrl();

// ── JSON guard ────────────────────────────────────────────────────────────

function assertJson(res: Response, body: string): void {
  const ct = res.headers.get("content-type") ?? "";
  const looksHtml =
    body.trimStart().startsWith("<") || body.trimStart().startsWith("<!") ;

  if (looksHtml) {
    console.error(
      `[HTTP] Server returned HTML instead of JSON!\n` +
        `  Status : ${res.status}\n` +
        `  URL    : ${res.url}\n` +
        `  CT     : ${ct}\n` +
        `  Body   : ${body.slice(0, 300)}`
    );
    throw new Error(
      `خطأ في الاتصال بالسيرفر (${res.status}): السيرفر أرجع صفحة HTML بدلاً من JSON. ` +
        `تأكد من الاتصال بالإنترنت وأن السيرفر يعمل.`
    );
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────

export interface HttpOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function apiFetch(
  path: string,
  options: HttpOptions = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const { body, headers: extraHeaders, ...rest } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(extraHeaders as Record<string, string>),
  };

  const init: RequestInit = {
    ...rest,
    headers,
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  console.log(`[HTTP] ${options.method ?? "GET"} ${url}`);

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (networkErr) {
    console.error("[HTTP] Network error:", networkErr, "→ URL was:", url);
    throw new Error(
      `تعذّر الاتصال بالسيرفر. تحقق من اتصالك بالإنترنت. (${url})`
    );
  }

  const raw = await res.clone().text();

  console.log(
    `[HTTP] ← ${res.status} ${res.url} | CT: ${res.headers.get("content-type")} | Body: ${raw.slice(0, 200)}`
  );

  if (raw.trimStart().startsWith("<")) {
    assertJson(res, raw); // throws with clear Arabic message
  }

  return res;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: "GET" });
  const raw = await res.text();
  assertJson(res, raw);
  return JSON.parse(raw) as T;
}

export async function apiPost<T = unknown>(
  path: string,
  data: unknown
): Promise<T> {
  const res = await apiFetch(path, { method: "POST", body: data });
  const raw = await res.text();
  assertJson(res, raw);
  return JSON.parse(raw) as T;
}
