import { prisma } from "../db/client";

/**
 * Calculates the usage-based charge for a subscription's current billing cycle.
 *
 * Sums all unbilled UsageRecord entries for the subscription, multiplies by the
 * plan's unitPrice, caps at maxChargePerCycle, and returns the charge amount
 * in base units (string). Also marks the usage records as billed.
 *
 * PRD §11.5 — usage-based billing: charge = min(sum(units * unitPrice), maxChargePerCycle).
 */
export async function calculateUsageCharge(subscriptionId: string, sinceDate: Date): Promise<{
  amount: string;
  units: number;
}> {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) return { amount: "0", units: 0 };
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } });
  if (!plan) return { amount: "0", units: 0 };

  // Sum all unbilled usage records since the last billing date.
  const records = await prisma.usageRecord.findMany({
    where: {
      subscriptionId,
      billed: false,
      recordedAt: { gte: sinceDate },
    },
  });

  let totalUnits = 0;
  for (const r of records) {
    totalUnits += r.units;
  }

  // Calculate charge: units * unitPrice (both in base units).
  const unitPrice = BigInt(plan.unitPrice ?? "0");
  let chargeAmount = BigInt(totalUnits) * unitPrice;

  // Cap at maxChargePerCycle.
  const maxCharge = BigInt(sub.maxChargePerCycle);
  if (chargeAmount > maxCharge) {
    chargeAmount = maxCharge;
  }

  // Cap at remaining cumulative allowance.
  const remaining = BigInt(sub.cumulativeLimit) - BigInt(sub.spent);
  if (chargeAmount > remaining) {
    chargeAmount = remaining;
  }

  // Mark usage records as billed.
  if (records.length > 0) {
    await prisma.usageRecord.updateMany({
      where: { id: { in: records.map((r) => r.id) } },
      data: { billed: true },
    });
  }

  return {
    amount: chargeAmount.toString(),
    units: totalUnits,
  };
}
