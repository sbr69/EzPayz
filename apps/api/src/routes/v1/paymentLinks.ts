import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { createPaymentLink } from "../../services/paymentLink";
import { createPaymentIntent } from "../../services/paymentIntent";
import { recordIdempotency } from "../../plugins/idempotency";
import { parseHumanAmount, formatBaseUnits } from "../../utils/amount";
import { parsePagination, cursorPrismaArgs, paginate } from "../../utils/pagination";

const decimalAmount = z.string().regex(/^\d+(\.\d{1,6})?$/, "amount must be a decimal string like \"10.00\" (max 6 decimal places)");

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  linkType: z.enum(["fixed", "customer_amount", "reusable"]).default("fixed"),
  amount: decimalAmount.optional(),
  minAmount: decimalAmount.optional(),
  maxAmount: decimalAmount.optional(),
});

export async function paymentLinkRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", { preHandler: [app.authenticate, app.requireSecretKey, app.idempotency] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const data = {
      ...parsed.data,
      amount: parsed.data.amount ? parseHumanAmount(parsed.data.amount) : undefined,
      minAmount: parsed.data.minAmount ? parseHumanAmount(parsed.data.minAmount) : undefined,
      maxAmount: parsed.data.maxAmount ? parseHumanAmount(parsed.data.maxAmount) : undefined,
    };
    const link = await createPaymentLink({ merchantId: req.merchantId!, ...data });
    const key = (req.headers["idempotency-key"] as string).trim();
    await recordIdempotency(req.merchantId!, key, "payment_link", link.id);
    return reply.code(201).send({ id: link.id, slug: link.slug, url: `/l/${link.slug}` });
  });

  // GET /v1/payment-links — list with cursor pagination.
  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>);
    const links = await prisma.paymentLink.findMany({
      where: { merchantId: req.merchantId! },
      ...cursorPrismaArgs({ limit, cursor }),
    });
    const result = paginate(links, limit);
    return { paymentLinks: result.data, hasMore: result.hasMore, nextCursor: result.nextCursor };
  });

  // GET /v1/payment-links/:slug — PUBLIC resolve (no auth). Returns link details for the checkout page.
  app.get("/:slug", async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const link = await prisma.paymentLink.findUnique({ where: { slug } });
    if (!link || !link.active) {
      return reply.code(404).send({ error: { code: "not_found", message: "Payment link not found or inactive" } });
    }
    const merchant = await prisma.merchant.findUnique({ where: { id: link.merchantId } });
    return reply.send({
      id: link.id,
      title: link.title,
      description: link.description,
      linkType: link.linkType,
      amount: link.amount,
      displayAmount: link.amount ? formatBaseUnits(link.amount) : null,
      minAmount: link.minAmount,
      maxAmount: link.maxAmount,
      merchant: { displayName: merchant?.displayName ?? "", payoutWallet: merchant?.payoutWallet ?? "" },
      token: { symbol: "USDT", decimals: 6 },
      chainId: 1874,
    });
  });

  // POST /v1/payment-links/:slug/checkout — PUBLIC. Creates a payment intent from the link's
  // configuration (the link slug acts as authorization — no secret key needed). This is how
  // payment links work end-to-end: anyone with the link URL can pay. Razorpay equivalent.
  app.post("/:slug/checkout", async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const body = req.body as { amount?: string };
    const link = await prisma.paymentLink.findUnique({ where: { slug } });
    if (!link || !link.active) {
      return reply.code(404).send({ error: { code: "not_found", message: "Payment link not found or inactive" } });
    }
    const merchant = await prisma.merchant.findUnique({ where: { id: link.merchantId } });
    if (!merchant?.payoutWallet) {
      return reply.code(400).send({ error: { code: "no_payout_wallet", message: "Merchant has no payout wallet" } });
    }
    // Determine the amount: fixed links use the stored amount; customer_amount links use the provided amount.
    let amount: string;
    if (link.linkType === "customer_amount") {
      if (!body.amount) return reply.code(400).send({ error: { code: "validation_error", message: "Amount is required for customer_amount links" } });
      amount = parseHumanAmount(body.amount);
      if (link.minAmount && BigInt(amount) < BigInt(link.minAmount)) {
        return reply.code(400).send({ error: { code: "below_minimum", message: `Minimum amount is ${formatBaseUnits(link.minAmount)} USDT` } });
      }
      if (link.maxAmount && BigInt(amount) > BigInt(link.maxAmount)) {
        return reply.code(400).send({ error: { code: "above_maximum", message: `Maximum amount is ${formatBaseUnits(link.maxAmount)} USDT` } });
      }
    } else {
      amount = link.amount ?? "0";
    }
    const { intentId, checkoutSlug, clientSecret } = await createPaymentIntent({
      merchantId: merchant.id,
      merchantDisplayName: merchant.displayName,
      merchantPayoutWallet: merchant.payoutWallet,
      amount,
      description: link.title,
    });
    return reply.code(201).send({ paymentIntentId: intentId, checkoutSlug, clientSecret, checkoutUrl: `/checkout/${checkoutSlug}` });
  });

  app.post("/:id/disable", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const res = await prisma.paymentLink.updateMany({ where: { id, merchantId: req.merchantId! }, data: { active: false } });
    if (res.count === 0) return reply.code(404).send({ error: { code: "not_found", message: "Payment link not found" } });
    return reply.send({ disabled: true });
  });
}
