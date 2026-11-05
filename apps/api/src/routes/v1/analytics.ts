import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

/** Dashboard analytics overview (tenant-isolated). PRD §25, FLOW §15. */
export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/overview", { preHandler: [app.authenticate] }, async (req) => {
    const merchantId = req.merchantId!;
    const [total, succeeded, failed, pending, refunds, openExceptions, activeSubs] = await Promise.all([
      prisma.paymentIntent.count({ where: { merchantId } }),
      prisma.paymentIntent.count({ where: { merchantId, status: "succeeded" } }),
      prisma.paymentIntent.count({ where: { merchantId, status: "failed" } }),
      prisma.paymentIntent.count({ where: { merchantId, status: { in: ["created", "authorized", "submitted", "pending_confirmation"] } } }),
      prisma.refund.count({ where: { merchantId } }),
      prisma.paymentException.count({ where: { merchantId, status: "open" } }),
      prisma.subscription.count({ where: { merchantId, status: "active" } }),
    ]);
    return {
      payments: { total, succeeded, failed, pending },
      refunds,
      openExceptions,
      activeSubscriptions: activeSubs,
    };
  });
}
