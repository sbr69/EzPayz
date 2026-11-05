import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";

const eventSchema = z.object({
  status: z.enum(["not_started", "processing", "fulfilled", "cancelled", "return_requested", "refund_initiated", "refunded"]),
  note: z.string().default(""),
  customerVisible: z.boolean().default(false),
});

export async function fulfilmentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const orders = await prisma.fulfilmentOrder.findMany({
      where: { merchantId: req.merchantId! },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { events: { orderBy: { at: "desc" } } },
    });
    return { orders };
  });

  app.post("/:id/events", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const order = await prisma.fulfilmentOrder.findFirst({ where: { id, merchantId: req.merchantId! } });
    if (!order) return reply.code(404).send({ error: { code: "not_found", message: "Fulfilment order not found" } });
    await prisma.fulfilmentEvent.create({
      data: { fulfilmentId: id, status: parsed.data.status, note: parsed.data.note, customerVisible: parsed.data.customerVisible },
    });
    await prisma.fulfilmentOrder.update({ where: { id }, data: { status: parsed.data.status } });
    return reply.send({ updated: true });
  });
}
