import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { createRefund, validateRefundAuthorization, type RefundAuth } from "../../services/refund";
import { getRelayerQueue } from "../../queues";
import { parseHumanAmount } from "../../utils/amount";

const createSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, "amount must be a decimal string like \"5.00\" (max 6 decimal places)"),
  reason: z.string().default(""),
});

const authorizeSchema = z.object({
  from: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  value: z.string().regex(/^\d+$/),
  validAfter: z.string().regex(/^\d+$/),
  validBefore: z.string().regex(/^\d+$/),
  nonce: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
});

export async function refundRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/refunds — create a refund (eligibility checked against the settled payment).
  app.post("/", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    try {
      const amountBaseUnits = parseHumanAmount(parsed.data.amount);
      const refund = await createRefund({ merchantId: req.merchantId!, paymentId: parsed.data.paymentId, amount: amountBaseUnits, reason: parsed.data.reason });
      return reply.code(201).send({ id: refund.id, status: refund.status, amount: refund.amount });
    } catch (e) {
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode) return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
      throw e;
    }
  });

  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const refunds = await prisma.refund.findMany({ where: { merchantId: req.merchantId! }, orderBy: { createdAt: "desc" }, take: 50 });
    return { refunds };
  });

  app.get("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const refund = await prisma.refund.findFirst({ where: { id, merchantId: req.merchantId! }, include: { timeline: true } });
    if (!refund) return reply.code(404).send({ error: { code: "not_found", message: "Refund not found" } });
    return { refund };
  });

  // POST /v1/refunds/:id/authorize — merchant submits the EIP-3009 signed authorization
  // for the refund transfer (merchant payout → original payer). Relayer sponsors gas.
  app.post("/:id/authorize", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = authorizeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const auth: RefundAuth = parsed.data;
    const refund = await prisma.refund.findFirst({ where: { id, merchantId: req.merchantId! } });
    if (!refund) return reply.code(404).send({ error: { code: "not_found", message: "Refund not found" } });
    if (refund.status !== "awaiting_authorization") {
      return reply.code(409).send({ error: { code: "invalid_state", message: `Refund is ${refund.status}, cannot authorize` } });
    }
    const payment = await prisma.paymentIntent.findUnique({ where: { id: refund.paymentId } });
    if (!payment?.payerWallet) {
      return reply.code(400).send({ error: { code: "no_payer_wallet", message: "Original payment has no payer wallet on record" } });
    }
    const merchant = await prisma.merchant.findUnique({ where: { id: req.merchantId! } });
    if (!merchant?.payoutWallet) {
      return reply.code(400).send({ error: { code: "no_payout_wallet", message: "Merchant has no payout wallet" } });
    }
    try {
      await validateRefundAuthorization({
        merchantPayoutWallet: merchant.payoutWallet,
        originalPayer: payment.payerWallet,
        refundAmount: refund.amount,
        auth,
      });
      await prisma.refund.update({ where: { id: refund.id }, data: { status: "authorized", authorizationRef: auth.nonce } });
      await getRelayerQueue().add(
        "refund-relay",
        { refundId: refund.id, merchantId: req.merchantId!, from: auth.from, to: auth.to, value: auth.value, validAfter: auth.validAfter, validBefore: auth.validBefore, nonce: auth.nonce, signature: auth.signature, paymentId: refund.paymentId },
        { jobId: auth.nonce }
      );
      return reply.code(202).send({ status: "authorized", relayerQueued: true });
    } catch (e) {
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode) return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
      throw e;
    }
  });
}
