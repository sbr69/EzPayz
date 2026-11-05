import type { FastifyRequest, FastifyReply } from "fastify";
import { resolveApiKey } from "../services/apiKey";

// Augment Fastify with the authenticate decorator + merchantId/apiKeyType on the request.
// `jwt` is declared here so `app.jwt.sign(...)` typechecks without the @fastify/jwt
// type provider; `req.jwtVerify()` / `req.user` are accessed via casts below (the
// @fastify/jwt type provider isn't configured, so they aren't on the default type).
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireSecretKey: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    merchantId?: string;
    apiKeyType?: "publishable" | "secret" | "jwt";
  }
}

/**
 * JWT preHandler: verifies the Bearer token + attaches merchantId (from the JWT `sub`)
 * to the request. On failure, replies 401. PRD §8.1, §17.6, §23.1.
 *
 * Accepts three credential types:
 * - JWT (dashboard) — full access, apiKeyType = "jwt"
 * - Secret key (sk_...) — full write access, apiKeyType = "secret"
 * - Publishable key (pk_...) — read-only scope, apiKeyType = "publishable"
 *
 * Write routes should additionally use `requireSecretKey` to block publishable keys.
 */
export const authenticate = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
  if (!token) {
    reply.code(401).send({ error: { code: "unauthorized", message: "Missing token or API key" } });
    return;
  }
  // Try JWT first (tokens have 3 dot-separated parts).
  if (token.split(".").length === 3) {
    try {
      await (req as unknown as { jwtVerify: () => Promise<unknown> }).jwtVerify();
      const payload = ((req as unknown as { user?: Record<string, unknown> }).user ?? {}) as { sub?: string };
      if (payload.sub) {
        req.merchantId = payload.sub;
        req.apiKeyType = "jwt";
        return;
      }
    } catch {
      // fall through to API key
    }
  }
  // Try API key (publishable or secret).
  const resolved = await resolveApiKey(token);
  if (resolved) {
    req.merchantId = resolved.merchantId;
    req.apiKeyType = resolved.keyType;
    return;
  }
  reply.code(401).send({ error: { code: "unauthorized", message: "Invalid token or API key" } });
};

/**
 * PreHandler that blocks publishable keys from write operations.
 * Must be used AFTER `authenticate`. Publishable keys are browser-safe and read-only
 * (PRD §17.6). Secret keys and JWTs (dashboard) have full write access.
 */
export const requireSecretKey = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  if (req.apiKeyType === "publishable") {
    reply.code(403).send({ error: { code: "forbidden", message: "Publishable keys cannot perform write operations. Use a secret key (server-side only)." } });
    return;
  }
};
