import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

export async function exceptionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const exceptions = await prisma.paymentException.findMany({
      where: { merchantId: req.merchantId! },
      orderBy: { detectedAt: "desc" },
      take: 50,
    });
    return { exceptions };
  });

  app.get("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const ex = await prisma.paymentException.findFirst({
      where: { id, merchantId: req.merchantId! },
      include: { attempts: { orderBy: { at: "desc" } } },
    });
    if (!ex) return reply.code(404).send({ error: { code: "not_found", message: "Exception not found" } });
    return { exception: ex };
  });
}
