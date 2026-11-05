import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/client";

declare module "fastify" {
  interface FastifyInstance {
    idempotency: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Idempotency preHandler for write routes (payment/refund/renewal creation).
 * Requires an Idempotency-Key header scoped per merchant. On replay, returns the
 * original resource reference (no duplicate resource created). The route itself
 * creates the IdempotencyRecord after it successfully creates the resource.
 * PRD §5.6, §17.6, FLOW §6.5.
 */
export const idempotency = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const merchantId = req.merchantId;
  if (!merchantId) return; // auth preHandler runs first; if missing it already replied 401.
  const key = (req.headers["idempotency-key"] as string | undefined)?.trim();
  if (!key) {
    reply.code(400).send({ error: { code: "missing_idempotency_key", message: "Idempotency-Key header is required" } });
    return;
  }
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { merchantId_key: { merchantId, key } },
  });
  if (existing) {
    reply.code(200).send({
      idempotentReplay: true,
      resourceType: existing.resourceType,
      resourceId: existing.resourceId,
    });
  }
  // Else: proceed. The route is responsible for recording the idempotency key
  // alongside the resource it creates.
};

/** Records an idempotency key → resource mapping after a successful write. */
export async function recordIdempotency(
  merchantId: string,
  key: string,
  resourceType: string,
  resourceId: string,
  requestBodyHash?: string
): Promise<void> {
  await prisma.idempotencyRecord.create({
    data: { merchantId, key, resourceType, resourceId, requestBodyHash: requestBodyHash ?? "" },
  }).catch(() => {
    // Unique-constraint violation means a concurrent request already recorded it; safe to ignore.
  });
}
