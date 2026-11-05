import { createHmac } from "node:crypto";
import { Prisma } from "../db/generated";
import { prisma } from "../db/client";
import { getWebhookQueue } from "../queues";

/**
 * Webhook dispatcher: transactional outbox + HMAC-SHA256 signed delivery + retries.
 * PRD §18, FLOW §14. The signing secret is stored (MVP: plaintext in the
 * signingSecretHash column — a future refinement encrypts at rest) + shown once
 * at endpoint creation.
 */

export function signWebhookPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Emit a gateway event: writes an OutboxEvent (transactional) + enqueues a dispatch job. */
export async function emitEvent(opts: {
  merchantId: string;
  type: string;
  resourceId: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const outbox = await prisma.outboxEvent.create({
    data: {
      merchantId: opts.merchantId,
      type: opts.type,
      resourceId: opts.resourceId,
      payloadJson: opts.payload as unknown as Prisma.InputJsonValue,
    },
  });
  await getWebhookQueue().add(
    "dispatch",
    { outboxId: outbox.id, merchantId: opts.merchantId, type: opts.type, resourceId: opts.resourceId, payload: opts.payload },
    { jobId: outbox.id }
  );
  return outbox.id;
}

/** Dispatch one event to every active endpoint subscribed to its type. Signs + POSTs + records delivery. */
export async function dispatchWebhookEvent(opts: {
  outboxId: string;
  merchantId: string;
  type: string;
  resourceId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const payloadStr = JSON.stringify(opts.payload);
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { merchantId: opts.merchantId, active: true },
  });

  for (const ep of endpoints) {
    if (!ep.eventTypes.includes(opts.type)) continue;
    const signature = signWebhookPayload(ep.signingSecretHash, payloadStr);
    const event = await prisma.webhookEvent.create({
      data: {
        merchantId: opts.merchantId,
        type: opts.type,
        endpointId: ep.id,
        payloadSummary: opts.type,
        payloadJson: opts.payload as unknown as Prisma.InputJsonValue,
        status: "pending",
        relatedPaymentId: opts.type.startsWith("payment.") ? opts.resourceId : undefined,
      },
    });
    let delivered = false;
    let responseStatus: number | undefined;
    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Whitechain-Signature": signature,
          "X-Whitechain-Event": opts.type,
          "X-Whitechain-Event-Id": event.id,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(10000),
      });
      responseStatus = res.status;
      delivered = res.status >= 200 && res.status < 300;
    } catch {
      delivered = false;
    }
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: delivered ? "delivered" : "failed",
        responseStatus,
        attempts: 1,
        lastAttemptAt: new Date(),
        nextRetryAt: delivered ? undefined : new Date(Date.now() + 60_000),
      },
    });
    await prisma.webhookEndpoint.update({
      where: { id: ep.id },
      data: { lastDeliveryAt: new Date(), health: delivered ? "healthy" : "failing" },
    });
  }

  await prisma.outboxEvent.update({ where: { id: opts.outboxId }, data: { processedAt: new Date() } });
}
