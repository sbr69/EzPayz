import "./config";
import { Worker } from "bullmq";
import { getRedisConnection } from "./queues/connection";
import { relayAndSettle } from "./services/relayer";
import { renewAndSettle } from "./services/renewal";
import { dispatchWebhookEvent } from "./services/webhook";
import { processEmail } from "./services/email";
import { getRelayerQueue } from "./queues";
import type { RelayPaymentJob, RenewalJob } from "./queues";
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
      await getRelayerQueue().add(
        "renew-subscription",
        {
          subscriptionDbId: sub.id,
          merchantId: sub.merchantId,
          onChainSubscriptionId: sub.onChainSubscriptionId,
          periodId,
          amount: sub.amount,
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

console.log("Workers started (queues: relayer, webhook, email) + subscription scheduler poller (60s).");

async function shutdown(): Promise<void> {
  await relayerWorker.close();
  await webhookWorker.close();
  await emailWorker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
