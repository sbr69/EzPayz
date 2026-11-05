// Real API client for the local gateway (http://localhost:3000).
const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

/** Reads the JWT from localStorage — set by AuthPages.tsx on login/register. */
function getToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem("wcp_token") ?? undefined;
}

export async function apiFetch<T = unknown>(path: string, opts?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts?.headers as Record<string, string>) ?? {}),
  };
  // Auto-attach JWT from localStorage unless an explicit token was passed or
  // the caller already set an Authorization header.
  const token = opts?.token ?? getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export { API_URL };
