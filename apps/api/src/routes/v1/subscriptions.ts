import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { recordOnChainSubscription } from "../../services/subscription";

const createSchema = z.object({
  onChainSubscriptionId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  planId: z.string().min(1),
  payerWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/subscriptions — record a mirror of an on-chain subscription (customer activated it via their wallet).
  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const merchant = await prisma.merchant.findUnique({ where: { id: req.merchantId! } });
    if (!merchant?.payoutWallet) {
      return reply.code(400).send({ error: { code: "no_payout_wallet", message: "Merchant has no payout wallet" } });
    }
    try {
      const sub = await recordOnChainSubscription({
        merchantId: req.merchantId!,
        merchantPayoutWallet: merchant.payoutWallet,
        planId: parsed.data.planId,
        onChainSubscriptionId: parsed.data.onChainSubscriptionId,
        payerWallet: parsed.data.payerWallet,
      });
      return reply.code(201).send({ id: sub.id, status: sub.status, nextBillingAt: sub.nextBillingAt });
    } catch (e) {
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode) return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
      throw e;
    }
  });

  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const subs = await prisma.subscription.findMany({
      where: { merchantId: req.merchantId! },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { subscriptions: subs };
  });

  app.get("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const sub = await prisma.subscription.findFirst({
      where: { id, merchantId: req.merchantId! },
      include: { attempts: { orderBy: { scheduledFor: "desc" }, take: 10 }, billingHistory: { orderBy: { at: "desc" }, take: 10 } },
    });
    if (!sub) return reply.code(404).send({ error: { code: "not_found", message: "Subscription not found" } });
    return { subscription: sub };
  });

  // POST /v1/subscriptions/:id/cancel — records the cancel intent (customer must submit on-chain cancel()).
  app.post("/:id/cancel", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const res = await prisma.subscription.updateMany({
      where: { id, merchantId: req.merchantId!, status: { in: ["active", "past_due", "paused"] } },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    if (res.count === 0) return reply.code(404).send({ error: { code: "not_found", message: "Active subscription not found" } });
    return reply.send({ cancelled: true, note: "Customer must also submit on-chain cancel() to block future charges + revoke allowance via approve(0)." });
  });
}
