import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

// BullMQ queues for the gateway's background workers. PRD §16, §18, FLOW §6.5, §14.
let relayer: Queue | null = null;
let webhook: Queue | null = null;
let email: Queue | null = null;
let scheduler: Queue | null = null;

export function getRelayerQueue(): Queue {
  if (!relayer) relayer = new Queue("relayer", { connection: getRedisConnection() });
  return relayer;
}
export function getWebhookQueue(): Queue {
  if (!webhook) webhook = new Queue("webhook", { connection: getRedisConnection() });
  return webhook;
}
export function getEmailQueue(): Queue {
  if (!email) email = new Queue("email", { connection: getRedisConnection() });
  return email;
}
export function getSchedulerQueue(): Queue {
  if (!scheduler) scheduler = new Queue("scheduler", { connection: getRedisConnection() });
  return scheduler;
}

// The job payload for a one-time payment relay.
export interface RelayPaymentJob {
  paymentIntentId: string;
  merchantId: string;
  from: string; // payer
  to: string; // merchant payout
  value: string; // base units (string -> bigint at submit time)
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string;
}
