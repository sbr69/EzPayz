import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { createPaymentIntent, getPaymentIntentForMerchant } from "../../services/paymentIntent";
import { recordIdempotency } from "../../plugins/idempotency";
import { parseHumanAmount, formatBaseUnits } from "../../utils/amount";
import { parsePagination, cursorPrismaArgs, paginate } from "../../utils/pagination";
import { generatePaymentReceiptPdfBuffer } from "../../services/paymentIntentReceipt";

const createSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, "amount must be a decimal string like \"10.00\" (max 6 decimal places)"),
  description: z.string().min(1),
  customerEmail: z.string().email().optional(),
  expiresAt: z.string().datetime().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export async function paymentIntentRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/payment-intents — create a payment intent + PayeeShield-signed request + checkout session.
  // Idempotent (Idempotency-Key required).
  app.post(
    "/",
    { preHandler: [app.authenticate, app.requireSecretKey, app.idempotency] },
    async (req, reply) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") },
        });
      }
      const merchant = await prisma.merchant.findUnique({ where: { id: req.merchantId! } });
      if (!merchant) return reply.code(404).send({ error: { code: "not_found", message: "Merchant not found" } });
      if (!merchant.payoutWallet) {
        return reply.code(400).send({ error: { code: "no_payout_wallet", message: "Merchant has no payout wallet set" } });
      }

      const amountBaseUnits = parseHumanAmount(parsed.data.amount);
      const { intentId, checkoutSlug, clientSecret, payeeShield } = await createPaymentIntent({
        merchantId: req.merchantId!,
        merchantDisplayName: merchant.displayName,
        merchantPayoutWallet: merchant.payoutWallet,
        amount: amountBaseUnits,
        description: parsed.data.description,
        customerEmail: parsed.data.customerEmail,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
        successUrl: parsed.data.successUrl,
        cancelUrl: parsed.data.cancelUrl,
        metadata: parsed.data.metadata,
      });

      // Record the idempotency key → resource (so replays return the same intentId).
      const key = (req.headers["idempotency-key"] as string).trim();
      await recordIdempotency(req.merchantId!, key, "payment_intent", intentId);

      return reply.code(201).send({
        id: intentId,
        clientSecret,
        checkoutUrl: `/checkout/${checkoutSlug}`,
        checkoutSlug,
        amount: parsed.data.amount,
        amountBaseUnits,
        payeeShield: { payload: payeeShield.payload, signature: payeeShield.signature, signingAddress: payeeShield.signingAddress, keyId: payeeShield.keyId },
      });
    }
  );

  // GET /v1/payment-intents — list with cursor pagination + optional status/date filters.
  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const query = req.query as Record<string, unknown>;
    const { limit, cursor } = parsePagination(query);
    const where: Record<string, unknown> = { merchantId: req.merchantId! };
    if (typeof query.status === "string" && query.status.length > 0) where.status = query.status;
    if (typeof query.from === "string") where.createdAt = { gte: new Date(query.from) };
    if (typeof query.to === "string") where.createdAt = { ...((where.createdAt as Record<string, unknown>) ?? {}), lte: new Date(query.to) };
    const intents = await prisma.paymentIntent.findMany({
      where: where as never,
      ...cursorPrismaArgs({ limit, cursor }),
    });
    const result = paginate(intents, limit);
    return {
      paymentIntents: result.data.map((i) => ({ ...i, displayAmount: formatBaseUnits(i.amount) })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  });

  // GET /v1/payment-intents/:id — tenant-isolated fetch.
  app.get("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const intent = await getPaymentIntentForMerchant(req.merchantId!, id);
    if (!intent) return reply.code(404).send({ error: { code: "not_found", message: "Payment intent not found" } });
    return reply.send({
      paymentIntent: intent,
      displayAmount: formatBaseUnits(intent.amount),
      displayRefundedAmount: formatBaseUnits(intent.refundedAmount || "0"),
    });
  });

  // GET /v1/payment-intents/:id/receipt.pdf — downloadable receipt PDF (no invoice required).
  app.get("/:id/receipt.pdf", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const pdf = await generatePaymentReceiptPdfBuffer(id, req.merchantId!);
    if (!pdf) return reply.code(404).send({ error: { code: "not_found", message: "Payment intent not found" } });
    reply.type("application/pdf");
    reply.header("Content-Disposition", `attachment; filename="receipt-${id}.pdf"`);
    return reply.send(pdf);
  });
}
