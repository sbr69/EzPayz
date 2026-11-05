import "./config";
import { Worker } from "bullmq";
import { getRedisConnection } from "./queues/connection";
import { relayAndSettle } from "./services/relayer";
import { dispatchWebhookEvent } from "./services/webhook";
import { processEmail } from "./services/email";
import type { RelayPaymentJob } from "./queues";

/**
 * Background worker process (separate from the API). Processes relayer + webhook + email jobs.
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

console.log("Workers started (queues: relayer, webhook, email).");

async function shutdown(): Promise<void> {
  await relayerWorker.close();
  await webhookWorker.close();
  await emailWorker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
