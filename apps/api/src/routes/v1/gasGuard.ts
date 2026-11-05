import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";

const updateSchema = z.object({
  maxGasPerTxGwei: z.number().int().min(1).optional(),
  merchantBudgetWbt: z.string().optional(),
  dailyLimitWbt: z.string().optional(),
  rateLimitPerMinute: z.number().int().min(1).optional(),
  emergencyPaused: z.boolean().optional(),
});

export async function gasGuardRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/gas-guard — fetch the merchant's GasGuard policy.
  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    let policy = await prisma.gasGuardPolicy.findFirst({ where: { merchantId: req.merchantId! } });
    if (!policy) {
      // Create a default policy if none exists.
      policy = await prisma.gasGuardPolicy.create({
        data: {
          merchantId: req.merchantId!,
          merchantBudgetWbt: "1000000000000000000", // 1 WBT default
          dailyLimitWbt: "100000000000000000",
          allowedContract: "0x0b8Da2EE37f3599141aFD500b1e2699D5A6bCdbB",
        },
      });
    }
    return { policy };
  });

  // PATCH /v1/gas-guard — update the merchant's GasGuard policy.
  app.patch("/", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    // Upsert: create if doesn't exist, update if it does.
    const existing = await prisma.gasGuardPolicy.findFirst({ where: { merchantId: req.merchantId! } });
    if (!existing) {
      const policy = await prisma.gasGuardPolicy.create({
        data: {
          merchantId: req.merchantId!,
          merchantBudgetWbt: parsed.data.merchantBudgetWbt ?? "1000000000000000000",
          dailyLimitWbt: parsed.data.dailyLimitWbt ?? "100000000000000000",
          maxGasPerTxGwei: parsed.data.maxGasPerTxGwei ?? 100,
          rateLimitPerMinute: parsed.data.rateLimitPerMinute ?? 60,
          emergencyPaused: parsed.data.emergencyPaused ?? false,
          allowedContract: "0x0b8Da2EE37f3599141aFD500b1e2699D5A6bCdbB",
        },
      });
      return { policy };
    }
    const policy = await prisma.gasGuardPolicy.update({
      where: { id: existing.id },
      data: parsed.data,
    });
    return { policy };
  });
}
