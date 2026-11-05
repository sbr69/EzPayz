import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * clientSecret — a short-lived (15 min) signed token returned when a payment intent
 * or subscription checkout session is created. The browser widget uses this instead
 * of the merchant's secret API key. PRD §17.3, §17.6, FLOW §5.3.
 *
 * Implementation: a compact HS256 JWT (header.payload.signature), signed with the
 * gateway's JWT_SECRET. No database storage required — verification is by signature
 * + expiry. A leaked clientSecret expires in minutes and is scoped to one session.
 */

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes

export interface ClientSecretPayload {
  paymentIntentId: string;
  checkoutSlug: string;
  merchantId: string;
  exp: number; // unix seconds
}

export function generateClientSecret(
  payload: { paymentIntentId: string; checkoutSlug: string; merchantId: string },
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const data = `${HEADER}.${body}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `cs_${data}.${sig}`;
}

export function verifyClientSecret(token: string, secret: string): ClientSecretPayload | null {
  if (!token || !token.startsWith("cs_")) return null;
  const data = token.slice(3); // strip "cs_" prefix
  const parts = data.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  // Timing-safe comparison to prevent signature oracle attacks.
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ClientSecretPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expired
    return payload;
  } catch {
    return null;
  }
}
