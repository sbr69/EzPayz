import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../db/client";
import { dispatchWebhookEvent } from "../../services/webhook";
import { recordIdempotency } from "../../plugins/idempotency";
import { parsePagination, cursorPrismaArgs, paginate } from "../../utils/pagination";
import { encrypt } from "../../utils/crypto";

const createSchema = z.object({
  url: z.string().url(),
  description: z.string().default(""),
  eventTypes: z.array(z.string()).min(1),
});

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/webhooks — register an endpoint. The signing secret is generated + shown once.
  app.post("/", { preHandler: [app.authenticate, app.requireSecretKey, app.idempotency] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const signingSecret = "whsec_" + randomBytes(24).toString("hex");
    const signingSecretLast4 = signingSecret.slice(-4);
    const ep = await prisma.webhookEndpoint.create({
      data: {
        merchantId: req.merchantId!,
        url: parsed.data.url,
        description: parsed.data.description,
        eventTypes: parsed.data.eventTypes,
        active: true,
        signingSecretHash: encrypt(signingSecret), // encrypted at rest (AES-256-GCM)
        signingSecretLast4,
        health: "untested",
      },
    });
    const key = (req.headers["idempotency-key"] as string).trim();
    await recordIdempotency(req.merchantId!, key, "webhook_endpoint", ep.id);
    return reply.code(201).send({ id: ep.id, url: ep.url, eventTypes: ep.eventTypes, signingSecret, signingSecretLast4 });
  });

  // GET /v1/webhooks — list endpoints with cursor pagination (secrets never returned).
  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>);
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { merchantId: req.merchantId! },
      ...cursorPrismaArgs({ limit, cursor }),
    });
    const result = paginate(endpoints, limit);
    return {
      endpoints: result.data.map((e) => ({
        id: e.id, url: e.url, description: e.description, eventTypes: e.eventTypes, active: e.active,
        signingSecretLast4: e.signingSecretLast4, health: e.health, createdAt: e.createdAt, lastDeliveryAt: e.lastDeliveryAt,
      })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  });

  // GET /v1/webhooks/events — delivery history with cursor pagination.
  app.get("/events", { preHandler: [app.authenticate] }, async (req) => {
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>);
    const events = await prisma.webhookEvent.findMany({
      where: { merchantId: req.merchantId! },
      ...cursorPrismaArgs({ limit, cursor }),
    });
    const result = paginate(events, limit);
    return { events: result.data, hasMore: result.hasMore, nextCursor: result.nextCursor };
  });

  // POST /v1/webhooks/events/:id/replay — re-dispatch an event.
  app.post("/events/:id/replay", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const ev = await prisma.webhookEvent.findFirst({ where: { id, merchantId: req.merchantId! } });
    if (!ev) return reply.code(404).send({ error: { code: "not_found", message: "Webhook event not found" } });
    await dispatchWebhookEvent({
      outboxId: "replay-" + ev.id,
      merchantId: req.merchantId!,
      type: ev.type,
      resourceId: ev.relatedPaymentId ?? "",
      payload: ev.payloadJson as Record<string, unknown>,
    });
    return reply.send({ replayed: true });
  });

  // PATCH /v1/webhooks/:id — update endpoint (toggle active, update event types/description).
  app.patch("/:id", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = req.body as { active?: boolean; eventTypes?: string[]; description?: string };
    const res = await prisma.webhookEndpoint.updateMany({
      where: { id, merchantId: req.merchantId! },
      data: {
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.eventTypes ? { eventTypes: body.eventTypes } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      },
    });
    if (res.count === 0) return reply.code(404).send({ error: { code: "not_found", message: "Webhook endpoint not found" } });
    return reply.send({ updated: true });
  });

  // POST /v1/webhooks/:id/test — send a synthetic test event to the endpoint.
  app.post("/:id/test", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const ep = await prisma.webhookEndpoint.findFirst({ where: { id, merchantId: req.merchantId! } });
    if (!ep) return reply.code(404).send({ error: { code: "not_found", message: "Webhook endpoint not found" } });
    await dispatchWebhookEvent({
      outboxId: `test-${Date.now()}`,
      merchantId: req.merchantId!,
      type: "test.event",
      resourceId: id,
      payload: { type: "test.event", timestamp: new Date().toISOString(), message: "This is a test event from the EzPayz." },
    });
    return reply.send({ sent: true });
  });

  // POST /v1/webhooks/:id/rotate-secret — generate a new signing secret.
  app.post("/:id/rotate-secret", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const newSecret = "whsec_" + randomBytes(16).toString("hex");
    const newLast4 = newSecret.slice(-4);
    const res = await prisma.webhookEndpoint.updateMany({
      where: { id, merchantId: req.merchantId! },
      data: { signingSecretHash: encrypt(newSecret), signingSecretLast4: newLast4 },
    });
    if (res.count === 0) return reply.code(404).send({ error: { code: "not_found", message: "Webhook endpoint not found" } });
    return reply.send({ signingSecret: newSecret, signingSecretLast4: newLast4 });
  });
}
