import { publicClient } from "../web3/client";
import { SUBSCRIPTION_ABI } from "../web3/subscriptionAbi";
import { SUBSCRIPTION_CONTRACT_ADDRESS } from "../config/contracts";
import { prisma } from "../db/client";
import { Prisma } from "../db/generated";

const INTERVAL_SECONDS: Record<string, number> = { hourly: 3600, daily: 86400, monthly: 2592000 };

type OnChainSubscription = {
  payer: string; merchant: string; amount: bigint; intervalSeconds: bigint;
  maxChargePerCycle: bigint; cumulativeCap: bigint; totalSpent: bigint;
  nextDueTime: bigint; expiry: bigint; active: boolean; cancelled: boolean;
};

/**
 * Records a mirror of an on-chain subscription after the customer activates it
 * (approve + createSubscription via their wallet). Reads getSubscription() + verifies
 * payer/merchant/terms match the plan. PRD §11.4, FLOW §10.2.
 */
export async function recordOnChainSubscription(opts: {
  merchantId: string;
  merchantPayoutWallet: string;
  planId: string;
  onChainSubscriptionId: string;
  payerWallet: string;
}) {
  const [payer, merchant, amount, intervalSeconds, maxChargePerCycle, cumulativeCap, totalSpent, nextDueTime, expiry, active, cancelled] = (await publicClient.readContract({
    address: SUBSCRIPTION_CONTRACT_ADDRESS as `0x${string}`,
    abi: SUBSCRIPTION_ABI,
    functionName: "getSubscription",
    args: [opts.onChainSubscriptionId as `0x${string}`],
  })) as [string, string, bigint, bigint, bigint, bigint, bigint, bigint, bigint, boolean, boolean];

  if (payer.toLowerCase() !== opts.payerWallet.toLowerCase()) {
    throw { statusCode: 400, code: "payer_mismatch", message: "On-chain payer does not match the provided wallet" };
  }
  if (merchant.toLowerCase() !== opts.merchantPayoutWallet.toLowerCase()) {
    throw { statusCode: 400, code: "merchant_mismatch", message: "On-chain merchant does not match the merchant payout wallet" };
  }
  if (!active || cancelled) {
    throw { statusCode: 400, code: "not_active", message: "On-chain subscription is not active" };
  }

  const plan = await prisma.subscriptionPlan.findFirst({ where: { id: opts.planId, merchantId: opts.merchantId } });
  if (!plan) throw { statusCode: 404, code: "plan_not_found", message: "Plan not found" };
  if (amount !== BigInt(plan.amount)) {
    throw { statusCode: 400, code: "amount_mismatch", message: "On-chain amount does not match the plan" };
  }
  if (intervalSeconds !== BigInt(INTERVAL_SECONDS[plan.interval])) {
    throw { statusCode: 400, code: "interval_mismatch", message: "On-chain interval does not match the plan" };
  }

  let customer = await prisma.customer.findFirst({ where: { merchantId: opts.merchantId, wallet: opts.payerWallet } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { merchantId: opts.merchantId, email: opts.payerWallet.toLowerCase() + "@onchain", name: opts.payerWallet.slice(0, 10), wallet: opts.payerWallet },
    });
  }

  const allowanceRemaining = (cumulativeCap - totalSpent).toString();
  return prisma.subscription.create({
    data: {
      merchantId: opts.merchantId,
      customerId: customer.id,
      planId: plan.id,
      onChainSubscriptionId: opts.onChainSubscriptionId,
      status: "active",
      amount: plan.amount,
      interval: plan.interval,
      maxChargePerCycle: plan.maxChargePerCycle,
      cumulativeLimit: plan.cumulativeLimit,
      spent: totalSpent.toString(),
      allowanceRemaining,
      nextBillingAt: new Date(Number(nextDueTime) * 1000),
      expiresAt: new Date(Number(expiry) * 1000),
      activationTxRef: opts.onChainSubscriptionId,
      retryPolicyJson: { maxAttempts: 3, backoff: "exponential", intervalMinutes: 60 } as unknown as Prisma.InputJsonValue,
    },
  });
}
