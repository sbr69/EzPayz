import "./config";
import { Worker } from "bullmq";
import { getRedisConnection } from "./queues/connection";
import { relayAndSettle } from "./services/relayer";
import { renewAndSettle } from "./services/renewal";
import { calculateUsageCharge } from "./services/usageBilling";
import { relayAndSettleRefund } from "./services/refund";
import { activateSubscriptionBySig, cancelSubscriptionBySig } from "./services/subscriptionBySig";
import { dispatchWebhookEvent, emitEvent } from "./services/webhook";
import { processEmail } from "./services/email";
import { getRelayerQueue } from "./queues";
import type { RelayPaymentJob, RenewalJob, RefundJob } from "./queues";
import { prisma } from "./db/client";

/**
 * Background worker process. Processes relayer (one-time + renewal) + webhook + email jobs,
 * + a scheduler poller that finds due subscriptions and enqueues renewal jobs.
 * Run: pnpm --filter @ezpayz/api worker
 */
const relayerWorker = new Worker(
  "relayer",
  async (job) => {
    if (job.name === "relay-payment") {
      const data = job.data as RelayPaymentJob;
      const result = await relayAndSettle(data);
      job.log(`relayed+settled txHash=${result.txHash} settled=${result.settled}`);
      return result;
    }
    if (job.name === "renew-subscription") {
      const data = job.data as RenewalJob;
      const result = await renewAndSettle(data);
      job.log(`renewed txHash=${result.txHash} settled=${result.settled}`);
      return result;
    }
    if (job.name === "refund-relay") {
      const data = job.data as RefundJob;
      const result = await relayAndSettleRefund(data);
      job.log(`refund txHash=${result.txHash} settled=${result.settled}`);
      return result;
    }
    if (job.name === "activate-subscription-by-sig") {
      const data = job.data as {
        payer: string; subscriptionId: string; merchant: string; amount: string;
        intervalSeconds: number; maxChargePerCycle: string; cumulativeCap: string;
        nextDueTime: number; expiry: number;
        permitSignature: string; permitDeadline: string; permitNonce: string;
        createSubSignature: string; createSubDeadline: string; createSubNonce: string;
        merchantId: string; planId: string; checkoutSessionId: string;
      };
      const result = await activateSubscriptionBySig({
        payer: data.payer,
        subscriptionId: data.subscriptionId,
        merchant: data.merchant,
        amount: data.amount,
        intervalSeconds: data.intervalSeconds,
        maxChargePerCycle: data.maxChargePerCycle,
        cumulativeCap: data.cumulativeCap,
        nextDueTime: data.nextDueTime,
        expiry: data.expiry,
        permitSignature: data.permitSignature,
        permitDeadline: data.permitDeadline,
        permitNonce: data.permitNonce,
        createSubSignature: data.createSubSignature,
        createSubDeadline: data.createSubDeadline,
        createSubNonce: data.createSubNonce,
      });
      job.log(`activated-by-sig permitTx=${result.permitTxHash} createSubTx=${result.createSubTxHash}`);

      // Mirror the subscription to the database.
      const { recordOnChainSubscription } = await import("./services/subscription");
      const sub = await recordOnChainSubscription({
        merchantId: data.merchantId,
        merchantPayoutWallet: data.merchant,
        planId: data.planId,
        onChainSubscriptionId: data.subscriptionId,
        payerWallet: data.payer,
      });
      await prisma.subscriptionCheckoutSession.update({ where: { id: data.checkoutSessionId }, data: { status: "completed" } });
      await emitEvent({ merchantId: data.merchantId, type: "subscription.created", resourceId: sub.id, payload: { subscriptionId: sub.id, payer: data.payer, permitTx: result.permitTxHash, createSubTx: result.createSubTxHash } });
      return result;
    }
    if (job.name === "cancel-subscription-by-sig") {
      const data = job.data as { subscriptionId: string; payer: string; deadline: string; signature: string; merchantId: string; subscriptionDbId: string };
      const txHash = await cancelSubscriptionBySig({
        subscriptionId: data.subscriptionId,
        payer: data.payer,
        deadline: data.deadline,
        signature: data.signature,
      });
      job.log(`cancelled-by-sig txHash=${txHash}`);
      await prisma.subscription.update({ where: { id: data.subscriptionDbId }, data: { status: "cancelled" } });
      await emitEvent({ merchantId: data.merchantId, type: "subscription.cancelled", resourceId: data.subscriptionDbId, payload: { subscriptionId: data.subscriptionDbId, txHash } });
      return { txHash };
    }
    throw new Error(`Unknown relayer job name: ${job.name}`);
  },
  { connection: getRedisConnection(), concurrency: 1 }
);

const webhookWorker = new Worker(
  "webhook",
  async (job) => {
    if (job.name === "dispatch") {
      const data = job.data as { outboxId: string; merchantId: string; type: string; resourceId: string; payload: Record<string, unknown> };
      await dispatchWebhookEvent(data);
      return { dispatched: true };
    }
    throw new Error(`Unknown webhook job name: ${job.name}`);
  },
  { connection: getRedisConnection(), concurrency: 2 }
);

const emailWorker = new Worker(
  "email",
  async (job) => {
    if (job.name === "send") {
      const data = job.data as { emailLogId: string };
      await processEmail(data.emailLogId);
      return { sent: true };
    }
    throw new Error(`Unknown email job name: ${job.name}`);
  },
  { connection: getRedisConnection(), concurrency: 2 }
);

relayerWorker.on("completed", (job) => console.log(`[relayer] completed job ${job.id}`));
relayerWorker.on("failed", (job, err) => console.error(`[relayer] failed job ${job?.id}: ${err.message}`));
webhookWorker.on("completed", (job) => console.log(`[webhook] completed job ${job.id}`));
webhookWorker.on("failed", (job, err) => console.error(`[webhook] failed job ${job?.id}: ${err.message}`));
emailWorker.on("completed", (job) => console.log(`[email] completed job ${job.id}`));
emailWorker.on("failed", (job, err) => console.error(`[email] failed job ${job?.id}: ${err.message}`));

/**
 * Scheduler poller: every 60s, find active subscriptions due for renewal + enqueue
 * a relayer renewal job (idempotent by periodId). PRD §11.7, FLOW §10.3.
 */
const INTERVAL_SECONDS: Record<string, number> = { hourly: 3600, daily: 86400, monthly: 2592000 };
async function pollDueSubscriptions(): Promise<void> {
  try {
    const due = await prisma.subscription.findMany({
      where: { status: "active", nextBillingAt: { lte: new Date() }, expiresAt: { gt: new Date() } },
      take: 20,
    });
    for (const sub of due) {
      if (!sub.onChainSubscriptionId) continue;
      const intervalSec = INTERVAL_SECONDS[sub.interval] ?? 2592000;
      const periodId = Math.floor(Date.now() / 1000 / intervalSec);

      // Determine charge amount: fixed plans use the stored amount;
      // usage plans calculate from unbilled usage records × unitPrice.
      let chargeAmount = sub.amount;
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } });
      if (plan?.billingMode === "usage") {
        const sinceDate = sub.nextBillingAt ?? new Date(Date.now() - intervalSec * 1000);
        const usage = await calculateUsageCharge(sub.id, sinceDate);
        chargeAmount = usage.amount;
        if (chargeAmount === "0") {
          // No usage this cycle — skip the charge but advance the billing date.
          const newNext = new Date(sub.nextBillingAt!.getTime() + intervalSec * 1000);
          await prisma.subscription.update({ where: { id: sub.id }, data: { nextBillingAt: newNext } });
          continue;
        }
      }

      await getRelayerQueue().add(
        "renew-subscription",
        {
          subscriptionDbId: sub.id,
          merchantId: sub.merchantId,
          onChainSubscriptionId: sub.onChainSubscriptionId,
          periodId,
          amount: chargeAmount,
          customerId: sub.customerId,
        },
        { jobId: `${sub.id}-${periodId}` }
      );
    }
  } catch (e) {
    console.error("[scheduler] poll error:", (e as Error).message);
  }
}
setInterval(pollDueSubscriptions, 60_000);
void pollDueSubscriptions();

// Retry failed webhook deliveries — polls every 30s for events with nextRetryAt in the past.
// Updates nextRetryAt with exponential backoff (max 5 retries, then stops).
const MAX_WEBHOOK_RETRIES = 5;
async function pollFailedWebhooks() {
  try {
    const failed = await prisma.webhookEvent.findMany({
      where: { status: "failed", nextRetryAt: { lte: new Date() } },
      take: 20,
    });
    for (const ev of failed) {
      const attemptCount = (ev.attempts ?? 0) + 1;
      if (attemptCount > MAX_WEBHOOK_RETRIES) {
        // Exceeded max retries — stop retrying (nextRetryAt = null prevents future polls).
        await prisma.webhookEvent.update({ where: { id: ev.id }, data: { nextRetryAt: null } });
        continue;
      }
      await dispatchWebhookEvent({
        outboxId: `retry-${ev.id}`,
        merchantId: ev.merchantId,
        type: ev.type,
        resourceId: ev.relatedPaymentId ?? "",
        payload: ev.payloadJson as Record<string, unknown>,
      });
      // Set next retry with exponential backoff: 30s * 2^attempt (30s, 60s, 120s, 240s, 480s).
      const backoffSec = 30 * Math.pow(2, attemptCount);
      await prisma.webhookEvent.update({
        where: { id: ev.id },
        data: { attempts: attemptCount, nextRetryAt: new Date(Date.now() + backoffSec * 1000) },
      });
    }
    if (failed.length > 0) console.log(`[webhook-retry] processed ${failed.length} failed deliveries`);
  } catch (e) {
    console.error("[webhook-retry] poll error:", (e as Error).message);
  }
}
setInterval(pollFailedWebhooks, 30_000);

console.log("Workers started (queues: relayer, webhook, email) + subscription scheduler (60s) + webhook retry (30s).");

async function shutdown(): Promise<void> {
  await relayerWorker.close();
  await webhookWorker.close();
  await emailWorker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
