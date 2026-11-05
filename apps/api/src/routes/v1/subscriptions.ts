import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { recordOnChainSubscription } from "../../services/subscription";
import { createSubscriptionCheckout, getSubscriptionCheckoutSession } from "../../services/subscriptionCheckout";
import { getRelayerQueue } from "../../queues";
import { recordIdempotency } from "../../plugins/idempotency";
import { parsePagination, cursorPrismaArgs, paginate } from "../../utils/pagination";

const createSchema = z.object({
  onChainSubscriptionId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  planId: z.string().min(1),
  payerWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const checkoutSchema = z.object({
  planId: z.string().min(1),
});

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/subscriptions/checkout — create a hosted subscription checkout session.
  // Returns a clientSecret + checkoutSlug for the <WhitechainSubscriptionCheckout/> widget.
  // PRD §11.4.1, FLOW §10.2.1.
  app.post("/checkout", { preHandler: [app.authenticate, app.requireSecretKey, app.idempotency] }, async (req, reply) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    try {
      const result = await createSubscriptionCheckout({ merchantId: req.merchantId!, planId: parsed.data.planId });
      const key = (req.headers["idempotency-key"] as string).trim();
      await recordIdempotency(req.merchantId!, key, "subscription_checkout", result.sessionId);
      return reply.code(201).send(result);
    } catch (e) {
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode) return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
      throw e;
    }
  });

  // POST /v1/subscriptions — record a mirror of an on-chain subscription (customer activated it via their wallet).
  app.post("/", { preHandler: [app.authenticate, app.requireSecretKey, app.idempotency] }, async (req, reply) => {
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
      const key = (req.headers["idempotency-key"] as string).trim();
      await recordIdempotency(req.merchantId!, key, "subscription", sub.id);
      return reply.code(201).send({ id: sub.id, status: sub.status, nextBillingAt: sub.nextBillingAt });
    } catch (e) {
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode) return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
      throw e;
    }
  });

  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>);
    const subs = await prisma.subscription.findMany({
      where: { merchantId: req.merchantId! },
      ...cursorPrismaArgs({ limit, cursor }),
    });
    const result = paginate(subs, limit);
    return { subscriptions: result.data, hasMore: result.hasMore, nextCursor: result.nextCursor };
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
  app.post("/:id/cancel", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const res = await prisma.subscription.updateMany({
      where: { id, merchantId: req.merchantId!, status: { in: ["active", "past_due", "paused"] } },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    if (res.count === 0) return reply.code(404).send({ error: { code: "not_found", message: "Active subscription not found" } });
    return reply.send({ cancelled: true, note: "Customer must also submit on-chain cancel() to block future charges + revoke allowance via approve(0)." });
  });

  // POST /v1/subscriptions/:id/renew-now — manually enqueue a relayer renewal job (dev/admin trigger;
  // identical path to the scheduler). Useful for testing without waiting for the 60s poll.
  app.post("/:id/renew-now", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const sub = await prisma.subscription.findFirst({ where: { id, merchantId: req.merchantId! } });
    if (!sub) return reply.code(404).send({ error: { code: "not_found", message: "Subscription not found" } });
    if (sub.status !== "active") return reply.code(409).send({ error: { code: "invalid_state", message: "Subscription not active" } });
    if (!sub.onChainSubscriptionId) return reply.code(400).send({ error: { code: "no_onchain_id", message: "Subscription has no on-chain id" } });
    const intervalSec = sub.interval === "hourly" ? 3600 : sub.interval === "daily" ? 86400 : 2592000;
    const periodId = Math.floor(Date.now() / 1000 / intervalSec);
    await getRelayerQueue().add(
      "renew-subscription",
      {
        subscriptionDbId: sub.id,
        merchantId: sub.merchantId,
        onChainSubscriptionId: sub.onChainSubscriptionId,
        periodId,
        amount: sub.amount,
        customerId: sub.customerId,
      },
      { jobId: `${sub.id}-${periodId}` }
    );
    return reply.code(202).send({ renewQueued: true, periodId });
  });
}
