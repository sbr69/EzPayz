import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { parseHumanAmount } from "../../utils/amount";

const decimalAmount = z.string().regex(/^\d+(\.\d{1,6})?$/, "amount must be a decimal string like \"10.00\" (max 6 decimal places)");

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  amount: decimalAmount,
  interval: z.enum(["hourly", "daily", "monthly"]).default("monthly"),
  maxChargePerCycle: decimalAmount,
  cumulativeLimit: decimalAmount,
  planExpiryMonths: z.number().int().optional(),
  notifyCustomer: z.boolean().default(true),
});

export async function planRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const data = {
      merchantId: req.merchantId!,
      name: parsed.data.name,
      description: parsed.data.description,
      amount: parseHumanAmount(parsed.data.amount),
      interval: parsed.data.interval,
      maxChargePerCycle: parseHumanAmount(parsed.data.maxChargePerCycle),
      cumulativeLimit: parseHumanAmount(parsed.data.cumulativeLimit),
      planExpiryMonths: parsed.data.planExpiryMonths,
      notifyCustomer: parsed.data.notifyCustomer,
    };
    const plan = await prisma.subscriptionPlan.create({ data: { ...data, active: true, retryPolicyJson: { maxAttempts: 3, backoff: "exponential", intervalMinutes: 60 } as never } });
    return reply.code(201).send({ id: plan.id, name: plan.name });
  });

  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const plans = await prisma.subscriptionPlan.findMany({ where: { merchantId: req.merchantId!, active: true }, orderBy: { createdAt: "desc" } });
    return { plans };
  });
}
