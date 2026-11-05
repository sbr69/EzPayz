import type { FastifyRequest, FastifyReply } from "fastify";
import { resolveApiKey } from "../services/apiKey";

// Augment Fastify with the authenticate decorator + merchantId on the request.
// `jwt` is declared here so `app.jwt.sign(...)` typechecks without the @fastify/jwt
// type provider; `req.jwtVerify()` / `req.user` are accessed via casts below (the
// @fastify/jwt type provider isn't configured, so they aren't on the default type).
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    merchantId?: string;
  }
}

/**
 * JWT preHandler: verifies the Bearer token + attaches merchantId (from the JWT `sub`)
 * to the request. On failure, replies 401. PRD §8.1, §17.6, §23.1.
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
    return;
  }
  reply.code(401).send({ error: { code: "unauthorized", message: "Invalid token or API key" } });
};
