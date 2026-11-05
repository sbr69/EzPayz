import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";
import { parsePagination, cursorPrismaArgs, paginate } from "../../utils/pagination";

export async function exceptionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>);
    const exceptions = await prisma.paymentException.findMany({
      where: { merchantId: req.merchantId! },
      ...cursorPrismaArgs({ limit, cursor }, "detectedAt"),
    });
    const result = paginate(exceptions, limit);
    return { exceptions: result.data, hasMore: result.hasMore, nextCursor: result.nextCursor };
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
