import type { FastifyRequest, FastifyReply } from "fastify";

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
  try {
    await (req as unknown as { jwtVerify: () => Promise<unknown> }).jwtVerify();
    const payload = ((req as unknown as { user?: Record<string, unknown> }).user ?? {}) as { sub?: string };
    if (!payload.sub) {
      reply.code(401).send({ error: { code: "unauthorized", message: "Token missing subject" } });
      return;
    }
    req.merchantId = payload.sub;
  } catch {
    reply.code(401).send({ error: { code: "unauthorized", message: "Invalid or missing token" } });
  }
};
