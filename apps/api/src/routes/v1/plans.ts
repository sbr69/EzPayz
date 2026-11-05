import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { parseHumanAmount } from "../../utils/amount";
import { recordIdempotency } from "../../plugins/idempotency";
import { parsePagination, cursorPrismaArgs, paginate } from "../../utils/pagination";

const decimalAmount = z.string().regex(/^\d+(\.\d{1,6})?$/, "amount must be a decimal string like \"10.00\" (max 6 decimal places)");

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  amount: decimalAmount,
  billingMode: z.enum(["fixed", "usage"]).default("fixed"),
  unitLabel: z.string().optional(),
  unitPrice: decimalAmount.optional(),
  interval: z.enum(["hourly", "daily", "monthly"]).default("monthly"),
  maxChargePerCycle: decimalAmount,
  cumulativeLimit: decimalAmount,
  planExpiryMonths: z.number().int().optional(),
  notifyCustomer: z.boolean().default(true),
});

export async function planRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", { preHandler: [app.authenticate, app.requireSecretKey, app.idempotency] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const data = {
      merchantId: req.merchantId!,
      name: parsed.data.name,
      description: parsed.data.description,
      amount: parseHumanAmount(parsed.data.amount),
      billingMode: parsed.data.billingMode,
      unitLabel: parsed.data.unitLabel,
      unitPrice: parsed.data.unitPrice ? parseHumanAmount(parsed.data.unitPrice) : undefined,
      interval: parsed.data.interval,
      maxChargePerCycle: parseHumanAmount(parsed.data.maxChargePerCycle),
      cumulativeLimit: parseHumanAmount(parsed.data.cumulativeLimit),
      planExpiryMonths: parsed.data.planExpiryMonths,
      notifyCustomer: parsed.data.notifyCustomer,
    };
    const plan = await prisma.subscriptionPlan.create({ data: { ...data, active: true, retryPolicyJson: { maxAttempts: 3, backoff: "exponential", intervalMinutes: 60 } as never } });
    const key = (req.headers["idempotency-key"] as string).trim();
    await recordIdempotency(req.merchantId!, key, "plan", plan.id);
    return reply.code(201).send({ id: plan.id, name: plan.name });
  });

  app.get("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const plan = await prisma.subscriptionPlan.findFirst({ where: { id, merchantId: req.merchantId! } });
    if (!plan) return reply.code(404).send({ error: { code: "not_found", message: "Plan not found" } });
    return { plan };
  });

  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>);
    const plans = await prisma.subscriptionPlan.findMany({
      where: { merchantId: req.merchantId!, active: true },
      ...cursorPrismaArgs({ limit, cursor }),
    });
    const result = paginate(plans, limit);
    return { plans: result.data, hasMore: result.hasMore, nextCursor: result.nextCursor };
  });
}
