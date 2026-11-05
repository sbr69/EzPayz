import "./config";
import { Worker } from "bullmq";
import { getRedisConnection } from "./queues/connection";
import { relayAndSettle } from "./services/relayer";
import type { RelayPaymentJob } from "./queues";

/**
 * Background worker process (separate from the API). Processes relayer jobs:
 * submits transferWithAuthorization on-chain + verifies settlement.
 * Run: pnpm --filter @ezpayz/api worker
 */
const worker = new Worker(
  "relayer",
  async (job) => {
    if (job.name === "relay-payment") {
      const data = job.data as RelayPaymentJob;
      const result = await relayAndSettle(data);
      job.log(`relayed+settled txHash=${result.txHash} settled=${result.settled}`);
      return result;
    }
    throw new Error(`Unknown job name: ${job.name}`);
  },
  { connection: getRedisConnection(), concurrency: 1 }
);

worker.on("completed", (job) => console.log(`[relayer] completed job ${job.id}`));
worker.on("failed", (job, err) => console.error(`[relayer] failed job ${job?.id}: ${err.message}`));

console.log("Relayer worker started (queue: relayer).");

process.on("SIGINT", async () => { await worker.close(); process.exit(0); });
process.on("SIGTERM", async () => { await worker.close(); process.exit(0); });
