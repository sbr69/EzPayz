// Real API client for the local gateway (http://localhost:3000).
const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

export async function apiFetch<T = unknown>(path: string, opts?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts?.headers as Record<string, string>) ?? {}),
  };
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export { API_URL };
