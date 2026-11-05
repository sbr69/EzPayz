import { randomBytes } from "node:crypto";
import { prisma } from "../db/client";
import { generateClientSecret } from "../utils/clientSecret";
import { env } from "../config";
import { formatBaseUnits } from "../utils/amount";

/**
 * Creates a subscription checkout session for the hosted widget on a merchant's site.
 * The merchant backend calls this with a planId; the gateway returns a clientSecret +
 * checkoutSlug. The merchant frontend mounts <WhitechainSubscriptionCheckout/> with
 * the clientSecret. PRD §11.4.1, FLOW §10.2.1.
 */
export async function createSubscriptionCheckout(opts: {
  merchantId: string;
  planId: string;
}): Promise<{ sessionId: string; checkoutSlug: string; clientSecret: string }> {
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { id: opts.planId, merchantId: opts.merchantId, active: true },
  });
  if (!plan) {
    throw { statusCode: 404, code: "not_found", message: "Active subscription plan not found" };
  }

  const slug = "sc_" + randomBytes(8).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min (longer than one-time — on-chain setup takes time)
  const session = await prisma.subscriptionCheckoutSession.create({
    data: { planId: plan.id, merchantId: opts.merchantId, hostedSlug: slug, status: "open", expiresAt },
  });

  const clientSecret = generateClientSecret(
    { paymentIntentId: session.id, checkoutSlug: slug, merchantId: opts.merchantId },
    env.JWT_SECRET,
    30 * 60 // 30 min
  );

  return { sessionId: session.id, checkoutSlug: slug, clientSecret };
}

/** Public fetch of the subscription checkout session + plan details for the widget. */
export async function getSubscriptionCheckoutSession(slug: string) {
  const session = await prisma.subscriptionCheckoutSession.findUnique({ where: { hostedSlug: slug } });
  if (!session || session.status !== "open") return null;
  if (session.expiresAt && session.expiresAt < new Date()) return null;

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: session.planId } });
  if (!plan) return null;

  const merchant = await prisma.merchant.findUnique({ where: { id: session.merchantId } });

  return {
    session,
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      displayAmount: formatBaseUnits(plan.amount),
      amount: plan.amount,
      interval: plan.interval,
      displayMaxChargePerCycle: formatBaseUnits(plan.maxChargePerCycle),
      maxChargePerCycle: plan.maxChargePerCycle,
      displayCumulativeLimit: formatBaseUnits(plan.cumulativeLimit),
      cumulativeLimit: plan.cumulativeLimit,
      planExpiryMonths: plan.planExpiryMonths,
    },
    merchant: {
      displayName: merchant?.displayName ?? "",
      payoutWallet: merchant?.payoutWallet ?? "",
    },
  };
}
