import { publicClient, getRelayerWalletClient, getRelayerAccount, CHAIN } from "../web3/client";
import { SUBSCRIPTION_ABI } from "../web3/subscriptionAbi";
import { SUBSCRIPTION_CONTRACT_ADDRESS } from "../config/contracts";
import { prisma } from "../db/client";
import { emitEvent } from "./webhook";
import { recordException } from "./exceptions";

const INTERVAL_SECONDS: Record<string, number> = { hourly: 3600, daily: 86400, monthly: 2592000 };

/**
 * Relayer renewal: calls charge(subId, periodId, amount) on the SubscriptionContract
 * (relayer pays WBT gas), waits for the receipt, verifies SubscriptionCharged, settles.
 * PRD §11.5, §11.7, FLOW §10.3–10.5.
 */
export async function renewAndSettle(job: {
  subscriptionDbId: string;
  merchantId: string;
  onChainSubscriptionId: string;
  periodId: number;
  amount: string;
  customerId: string;
}): Promise<{ txHash: string; settled: boolean }> {
  const walletClient = getRelayerWalletClient();
  const attempt = await prisma.renewalAttempt.create({
    data: {
      subscriptionId: job.subscriptionDbId,
      attempt: 1,
      scheduledFor: new Date(),
      amount: job.amount,
      status: "submitted",
      billingSequence: String(job.periodId),
    },
  });

  let txHash: string;
  try {
    txHash = await walletClient.writeContract({
      chain: CHAIN,
      account: getRelayerAccount(),
      address: SUBSCRIPTION_CONTRACT_ADDRESS as `0x${string}`,
      abi: SUBSCRIPTION_ABI,
      functionName: "charge",
      args: [job.onChainSubscriptionId as `0x${string}`, BigInt(job.periodId), BigInt(job.amount)],
    });
  } catch (e) {
    const reason = (e as Error).message.slice(0, 200);
    await prisma.renewalAttempt.update({ where: { id: attempt.id }, data: { status: "failed", reason } });
    await recordException({ merchantId: job.merchantId, type: "relayer_failure", severity: "high", whatHappened: "Subscription charge failed", whyItHappened: reason });
    await emitEvent({ merchantId: job.merchantId, type: "subscription.renewal_failed", resourceId: job.subscriptionDbId, payload: { subscriptionId: job.subscriptionDbId, periodId: job.periodId, reason } });
    throw e;
  }

  await prisma.renewalAttempt.update({ where: { id: attempt.id }, data: { txRef: txHash } });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, confirmations: 1 });
  const chargedLog = receipt.logs.find(
    (l) => l.address.toLowerCase() === SUBSCRIPTION_CONTRACT_ADDRESS.toLowerCase()
  );
  const settled = receipt.status === "success" && !!chargedLog;

  if (settled) {
    await prisma.renewalAttempt.update({ where: { id: attempt.id }, data: { status: "succeeded", executedAt: new Date() } });
    const sub = await prisma.subscription.findUnique({ where: { id: job.subscriptionDbId } });
    if (sub) {
      const newSpent = (BigInt(sub.spent) + BigInt(job.amount)).toString();
      const intervalSec = INTERVAL_SECONDS[sub.interval] ?? 2592000;
      const newNext = sub.nextBillingAt ? new Date(sub.nextBillingAt.getTime() + intervalSec * 1000) : new Date();
      await prisma.subscription.update({
        where: { id: job.subscriptionDbId },
        data: {
          spent: newSpent,
          allowanceRemaining: (BigInt(sub.cumulativeLimit) - BigInt(newSpent)).toString(),
          nextBillingAt: newNext,
        },
      });
      await prisma.subscriptionBillingHistory.create({
        data: { subscriptionId: job.subscriptionDbId, paymentId: txHash, amount: job.amount, status: "succeeded" },
      });
    }
    await emitEvent({ merchantId: job.merchantId, type: "subscription.renewed", resourceId: job.subscriptionDbId, payload: { subscriptionId: job.subscriptionDbId, periodId: job.periodId, amount: job.amount, txRef: txHash } });
  } else {
    await prisma.renewalAttempt.update({ where: { id: attempt.id }, data: { status: "failed", reason: "no SubscriptionCharged event or receipt reverted" } });
    await recordException({ merchantId: job.merchantId, type: "transaction_reverted", severity: "high", whatHappened: "Subscription renewal did not settle" });
    await emitEvent({ merchantId: job.merchantId, type: "subscription.renewal_failed", resourceId: job.subscriptionDbId, payload: { subscriptionId: job.subscriptionDbId, periodId: job.periodId, txRef: txHash } });
  }

  return { txHash, settled };
}
