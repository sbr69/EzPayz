/**
 * Gateway API client — wraps fetch with auth + error handling.
 * Used by all MCP tool handlers to call the gateway's REST API.
 *
 * Auth: reads GATEWAY_SECRET_KEY from env (the merchant's secret API key).
 * URL: reads GATEWAY_API_URL from env (defaults to http://localhost:3000).
 */

const DEFAULT_API_URL = "http://localhost:3000";

export function getApiKey(): string {
  const key = process.env.GATEWAY_SECRET_KEY ?? process.env.WHITECHAIN_SECRET_KEY;
  if (!key) {
    throw new Error(
      "GATEWAY_SECRET_KEY environment variable is not set. " +
      "Set it to your merchant secret API key (e.g. wcp_sec_...). " +
      "You can create one via POST /v1/api-keys or the dashboard onboarding."
    );
  }
  return key;
}

export function getApiUrl(): string {
  return process.env.GATEWAY_API_URL ?? DEFAULT_API_URL;
}

export interface GatewayError {
  statusCode: number;
  code: string;
  message: string;
}

export async function gatewayFetch<T = unknown>(path: string, opts?: {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
}): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getApiKey()}`,
  };
  if (opts?.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const res = await fetch(url, {
    method: opts?.method ?? "GET",
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = body as { error?: { code?: string; message?: string } };
    throw {
      statusCode: res.status,
      code: err?.error?.code ?? "request_failed",
      message: err?.error?.message ?? `HTTP ${res.status}`,
    } satisfies GatewayError;
  }

  return body as T;
}
