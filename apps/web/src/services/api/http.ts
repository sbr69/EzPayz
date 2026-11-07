// API client — defaults to the deployed Render API, overridden by VITE_API_URL for local dev.
const API_URL = (import.meta.env.VITE_API_URL as string) || "https://ezpayz-api.onrender.com";

/** Reads the JWT from localStorage — set by AuthPages.tsx on login/register. */
function getToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem("wcp_token") ?? undefined;
}

/** Mutation callback — set by the adapter. Fires after any successful write (POST/PATCH/DELETE). */
let _onMutation: (() => void) | null = null;
export function setMutationCallback(cb: (() => void) | null): void { _onMutation = cb; }

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
  // Auto-generate Idempotency-Key for POST requests if not already set.
  // The gateway requires this header on all write endpoints — without it, the API
  // returns 400 missing_idempotency_key. This matches the SDK client's behavior.
  const method = (opts?.method ?? "GET").toUpperCase();
  if (method === "POST" && !headers["Idempotency-Key"]) {
    headers["Idempotency-Key"] = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  } catch (err) {
    // fetch only throws TypeError here for network-level failures: unreachable server,
    // blocked CORS, DNS, or an edge proxy cutting an idle connection.
    console.error("[apiFetch] network request failed:", err);
    const isLocalApi = /localhost|127\.0\.0\.1/.test(API_URL);
    throw new Error(
      isLocalApi
        ? `Could not reach the API at ${API_URL}. Start it locally with: pnpm --filter @ezpayz/api dev (plus the worker: pnpm --filter @ezpayz/api worker).`
        : `Could not reach the gateway API (${API_URL}). Free hosting sleeps when idle — the first request can take up to a minute. Wait a moment and try again.`,
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
  }
  // Notify the mutation callback on successful write operations (POST/PATCH/DELETE/PUT).
  if (method !== "GET" && _onMutation) _onMutation();
  return body as T;
}

export { API_URL };
