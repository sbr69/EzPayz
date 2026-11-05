import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  amount: z.string().regex(/^\d+$/),
  interval: z.enum(["hourly", "daily", "monthly"]).default("monthly"),
  maxChargePerCycle: z.string().regex(/^\d+$/),
  cumulativeLimit: z.string().regex(/^\d+$/),
  planExpiryMonths: z.number().int().optional(),
  notifyCustomer: z.boolean().default(true),
});

export async function planRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const plan = await prisma.subscriptionPlan.create({ data: { merchantId: req.merchantId!, ...parsed.data, active: true, retryPolicyJson: { maxAttempts: 3, backoff: "exponential", intervalMinutes: 60 } as never } });
    return reply.code(201).send({ id: plan.id, name: plan.name });
  });

  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const plans = await prisma.subscriptionPlan.findMany({ where: { merchantId: req.merchantId!, active: true }, orderBy: { createdAt: "desc" } });
    return { plans };
  });
}
