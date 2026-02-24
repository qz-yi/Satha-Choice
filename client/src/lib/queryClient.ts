import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_BASE } from "./http";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // If the server returned HTML instead of JSON, give a clearer error
    if (text.trimStart().startsWith("<")) {
      throw new Error(
        `خطأ في الاتصال (${res.status}): السيرفر أرجع HTML بدلاً من JSON. ` +
          `تأكد أن VITE_API_URL مضبوط بشكل صحيح.`
      );
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  path: string,
  data?: unknown
): Promise<Response> {
  // Always use absolute URL — critical for Capacitor APK
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      Accept: "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build absolute URL from the query key
    const path = queryKey.join("/") as string;
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);

    const raw = await res.text();
    if (raw.trimStart().startsWith("<")) {
      throw new Error(
        `السيرفر أرجع HTML بدلاً من JSON للمسار: ${url}`
      );
    }
    return JSON.parse(raw);
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
