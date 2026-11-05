import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";
import { MerchantRepository } from "../../db/repositories/merchant";

export async function merchantRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/merchants/me — the authenticated merchant's own record (tenant root).
  app.get("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    const repo = new MerchantRepository(prisma, req.merchantId!);
    const merchant = await repo.me();
    if (!merchant) {
      return reply.code(404).send({ error: { code: "not_found", message: "Merchant not found" } });
    }
    // Never expose the password hash.
    const { passwordHash, ...safe } = merchant;
    return reply.send({ merchant: safe });
  });
}
