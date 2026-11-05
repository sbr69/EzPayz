import { randomBytes } from "node:crypto";
import { prisma } from "../db/client";
import { Prisma } from "../db/generated";
import { signPaymentRequest, type SignedPaymentRequest } from "./payeeShield";

/**
 * Creates a one-time payment intent + PayeeShield-signed request + checkout session.
 * PRD §9, §17.5, FLOW §6. The intent starts in `created` and advances through the
 * state machine (PLAN 4.10) as the payer authorizes + the relayer submits + the
 * observer verifies settlement.
 */
export async function createPaymentIntent(opts: {
  merchantId: string;
  merchantDisplayName: string;
  merchantPayoutWallet: string;
  amount: string; // base units (string)
  description: string;
  customerEmail?: string;
  expiresAt?: Date;
}): Promise<{ intentId: string; checkoutSlug: string; payeeShield: SignedPaymentRequest }> {
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000); // 15 min default
  const expiryIso = expiresAt.toISOString();
  const nonce = "0x" + randomBytes(16).toString("hex");

  const intent = await prisma.paymentIntent.create({
    data: {
      merchantId: opts.merchantId,
      customerEmail: opts.customerEmail,
      description: opts.description,
      amount: opts.amount,
      token: "USDT",
      network: "whitechain-sepolia",
      kind: "one_time",
      payoutWallet: opts.merchantPayoutWallet,
      status: "created",
      expiresAt,
      authorizationRef: nonce,
      checkoutUrl: "",
    },
  });

  const payeeShield = await signPaymentRequest({
    paymentIntentId: intent.id,
    merchantId: opts.merchantId,
    merchantDisplayName: opts.merchantDisplayName,
    payoutWallet: opts.merchantPayoutWallet,
    amount: opts.amount,
    description: opts.description,
    expiry: expiryIso,
    nonce,
  });

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { payeeShieldJson: { payload: payeeShield.payload, signature: payeeShield.signature, signingAddress: payeeShield.signingAddress, keyId: payeeShield.keyId } as unknown as Prisma.InputJsonValue },
  });

  const slug = "ck_" + randomBytes(8).toString("hex");
  const session = await prisma.checkoutSession.create({
    data: { paymentId: intent.id, merchantId: opts.merchantId, hostedSlug: slug, status: "open", expiresAt },
  });
  await prisma.paymentIntent.update({ where: { id: intent.id }, data: { checkoutUrl: `/checkout/${slug}` } });

  return { intentId: intent.id, checkoutSlug: slug, payeeShield };
}

/** Tenant-isolated fetch of a payment intent (includes timeline). */
export async function getPaymentIntentForMerchant(merchantId: string, id: string) {
  return prisma.paymentIntent.findFirst({
    where: { id, merchantId },
    include: { timeline: { orderBy: { at: "asc" } } },
  });
}

/** Public (no auth) fetch of the checkout session + its payment intent for the widget. */
export async function getCheckoutSession(slug: string) {
  const session = await prisma.checkoutSession.findUnique({ where: { hostedSlug: slug } });
  if (!session || session.status !== "open") return null;
  const paymentIntent = await prisma.paymentIntent.findUnique({ where: { id: session.paymentId } });
  if (!paymentIntent) return null;
  return { session, paymentIntent };
}
