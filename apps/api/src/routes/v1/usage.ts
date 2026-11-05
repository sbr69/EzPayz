import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";

const recordSchema = z.object({
  subscriptionId: z.string().min(1),
  units: z.number().int().min(1),
  merchantReference: z.string().default(""),
});

/** Usage billing: merchant reports usage; amount = units * plan.unitPrice (billed at the next renewal). PRD §11.6, FLOW §10.4. */
export async function usageRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const subscription = await prisma.subscription.findFirst({ where: { id: parsed.data.subscriptionId, merchantId: req.merchantId! } });
    if (!subscription) return reply.code(404).send({ error: { code: "not_found", message: "Subscription not found" } });
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: subscription.planId } });
    if (!plan?.unitPrice) {
      return reply.code(400).send({ error: { code: "not_usage_plan", message: "This plan is not usage-based" } });
    }
    const amount = (BigInt(parsed.data.units) * BigInt(plan.unitPrice)).toString();
    const record = await prisma.usageRecord.create({
      data: {
        merchantId: req.merchantId!,
        subscriptionId: subscription.id,
        units: parsed.data.units,
        unitPrice: plan.unitPrice,
        amount,
        merchantReference: parsed.data.merchantReference,
      },
    });
    return reply.code(201).send({ id: record.id, amount });
  });

  app.get("/:subscriptionId", { preHandler: [app.authenticate] }, async (req) => {
    const subscriptionId = (req.params as { subscriptionId: string }).subscriptionId;
    const records = await prisma.usageRecord.findMany({ where: { subscriptionId, merchantId: req.merchantId! }, orderBy: { recordedAt: "desc" }, take: 50 });
    return { records };
  });
}
