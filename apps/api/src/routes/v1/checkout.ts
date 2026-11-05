import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { env } from "../../config";
import { getCheckoutSession } from "../../services/paymentIntent";
import { validateAndBindAuthorization, markAuthorized } from "../../services/authorize";
import { getRelayerQueue, type RelayPaymentJob } from "../../queues";
import { formatBaseUnits } from "../../utils/amount";
import { getSubscriptionCheckoutSession } from "../../services/subscriptionCheckout";
import { SUBSCRIPTION_CONTRACT_ADDRESS } from "../../config/contracts";
import { generatePaymentReceiptPdfBuffer } from "../../services/paymentIntentReceipt";

/**
 * Public checkout endpoint (no auth) — the SDK widget fetches the PayeeShield-signed
 * payment request here to display + verify merchant/amount/token/chain/recipient/expiry.
 * PRD §9, §17.5, FLOW §6.3. Also hosts the public subscription checkout session endpoint.
 */
export async function checkoutRoutes(app: FastifyInstance): Promise<void> {
  app.get("/:slug", async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const result = await getCheckoutSession(slug);
    if (!result) {
      return reply.code(404).send({ error: { code: "not_found", message: "Checkout session not found or expired" } });
    }
    const { session, paymentIntent } = result;
    const merchant = await prisma.merchant.findUnique({ where: { id: session.merchantId } });
    return reply.send({
      paymentIntentId: paymentIntent.id,
      merchant: { displayName: merchant?.displayName ?? "", payoutWallet: paymentIntent.payoutWallet },
      amount: paymentIntent.amount,
      displayAmount: formatBaseUnits(paymentIntent.amount),
      token: { symbol: paymentIntent.token, address: env.USDT_ADDRESS, decimals: 6 },
      chainId: env.WHITECHAIN_CHAIN_ID,
      network: paymentIntent.network,
      description: paymentIntent.description,
      expiry: paymentIntent.expiresAt,
      payeeShield: paymentIntent.payeeShieldJson,
      status: paymentIntent.status,
      txRef: paymentIntent.txRef,
      successUrl: paymentIntent.successUrl,
      cancelUrl: paymentIntent.cancelUrl,
    });
  });

  // POST /v1/checkout/:slug/authorize — payer submits the EIP-3009 signed TransferWithAuthorization.
  // Validates signature + binds to intent + GasGuard + enqueues the relayer. PRD §10.2, FLOW §6.4–6.5.
  const authorizeSchema = z.object({
    from: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    value: z.string().regex(/^\d+$/),
    validAfter: z.string().regex(/^\d+$/),
    validBefore: z.string().regex(/^\d+$/),
    nonce: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
  });

  app.post("/:slug/authorize", async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const parsed = authorizeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const auth = parsed.data;
    const result = await getCheckoutSession(slug);
    if (!result) {
      return reply.code(404).send({ error: { code: "not_found", message: "Checkout session not found or expired" } });
    }
    const { session, paymentIntent } = result;
    if (paymentIntent.status !== "created" && paymentIntent.status !== "requires_authorization") {
      return reply.code(409).send({ error: { code: "invalid_state", message: `Payment is ${paymentIntent.status}, cannot authorize` } });
    }
    try {
      await validateAndBindAuthorization({
        paymentIntentId: paymentIntent.id,
        merchantId: session.merchantId,
        expectedTo: paymentIntent.payoutWallet,
        expectedAmount: paymentIntent.amount,
        auth,
      });
      await markAuthorized(paymentIntent.id, auth.nonce, auth.from);
      const job: RelayPaymentJob = {
        paymentIntentId: paymentIntent.id,
        merchantId: session.merchantId,
        from: auth.from,
        to: auth.to,
        value: auth.value,
        validAfter: auth.validAfter,
        validBefore: auth.validBefore,
        nonce: auth.nonce,
        signature: auth.signature,
      };
      // Idempotent by nonce — BullMQ dedupes via jobId.
      await getRelayerQueue().add("relay-payment", job, { jobId: auth.nonce });
      return reply.code(202).send({ status: "authorized", relayerQueued: true, paymentIntentId: paymentIntent.id });
    } catch (e) {
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode) {
        return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw e;
    }
  });

  // GET /v1/checkout/subscription/:slug — public fetch of a subscription checkout session + plan details.
  // The <WhitechainSubscriptionCheckout/> widget uses this to display plan terms before the customer
  // approves allowance + creates the subscription on-chain. PRD §11.4.1, FLOW §10.2.1.
  app.get("/subscription/:slug", async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const result = await getSubscriptionCheckoutSession(slug);
    if (!result) {
      return reply.code(404).send({ error: { code: "not_found", message: "Subscription checkout session not found or expired" } });
    }
    const { session, plan, merchant } = result;
    return reply.send({
      sessionId: session.id,
      plan,
      merchant,
      chainId: env.WHITECHAIN_CHAIN_ID,
      subscriptionContract: SUBSCRIPTION_CONTRACT_ADDRESS,
      token: { symbol: "USDT", address: env.USDT_ADDRESS, decimals: 6 },
      status: session.status,
      expiresAt: session.expiresAt,
    });
  });

  // GET /v1/checkout/:slug/receipt.pdf — PUBLIC receipt PDF download.
  // The customer has the checkout slug (not an API key), so this endpoint is unauthenticated.
  // Only returns a PDF if the payment has settled (status = succeeded).
  app.get("/:slug/receipt.pdf", async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const result = await getCheckoutSession(slug);
    if (!result) {
      return reply.code(404).send({ error: { code: "not_found", message: "Checkout session not found" } });
    }
    const { paymentIntent } = result;
    if (paymentIntent.status !== "succeeded") {
      return reply.code(409).send({ error: { code: "not_settled", message: "Payment has not settled yet" } });
    }
    const pdf = await generatePaymentReceiptPdfBuffer(paymentIntent.id, paymentIntent.merchantId);
    if (!pdf) return reply.code(404).send({ error: { code: "not_found", message: "Payment intent not found" } });
    reply.type("application/pdf");
    reply.header("Content-Disposition", `attachment; filename="receipt-${paymentIntent.id}.pdf"`);
    return reply.send(pdf);
  });

  // POST /v1/checkout/subscription/:slug/activate — PUBLIC. Mirrors an on-chain subscription
  // to the gateway after the customer activates it via the checkout widget. This is the
  // subscription equivalent of POST /v1/checkout/:slug/authorize — the customer doesn't have
  // the merchant's secret key, so the slug acts as authorization. PRD §11.4.1, FLOW §10.2.1.
  app.post("/subscription/:slug/activate", async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const body = req.body as { onChainSubscriptionId: string; payerWallet: string };
    if (!body?.onChainSubscriptionId || !body?.payerWallet) {
      return reply.code(400).send({ error: { code: "validation_error", message: "onChainSubscriptionId and payerWallet are required" } });
    }
    const result = await getSubscriptionCheckoutSession(slug);
    if (!result) {
      return reply.code(404).send({ error: { code: "not_found", message: "Subscription checkout session not found or expired" } });
    }
    const { session, plan, merchant } = result;
    if (session.status !== "open") {
      return reply.code(409).send({ error: { code: "session_closed", message: "Checkout session is no longer active" } });
    }
    // Mirror the subscription using the session's merchant + plan info.
    const { recordOnChainSubscription } = await import("../../services/subscription");
    const sub = await recordOnChainSubscription({
      merchantId: session.merchantId,
      merchantPayoutWallet: merchant.payoutWallet,
      planId: plan.id,
      onChainSubscriptionId: body.onChainSubscriptionId,
      payerWallet: body.payerWallet,
    });
    // Mark the checkout session as completed.
    await prisma.subscriptionCheckoutSession.update({ where: { id: session.id }, data: { status: "completed" } });
    return reply.code(201).send({ id: sub.id, status: sub.status, nextBillingAt: sub.nextBillingAt });
  });
}
