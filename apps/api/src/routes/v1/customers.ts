import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { parsePagination, cursorPrismaArgs, paginate } from "../../utils/pagination";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
});

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/customers — create a customer record (tenant-isolated).
  app.post("/", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const customer = await prisma.customer.create({
      data: {
        merchantId: req.merchantId!,
        email: parsed.data.email,
        name: parsed.data.name ?? "",
      },
    });
    return reply.code(201).send({ id: customer.id, email: customer.email, name: customer.name });
  });

  // GET /v1/customers — list with cursor pagination + optional email search.
  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const query = req.query as Record<string, unknown>;
    const { limit, cursor } = parsePagination(query);
    const where: Record<string, unknown> = { merchantId: req.merchantId! };
    if (typeof query.email === "string" && query.email.length > 0) {
      where.email = { contains: query.email, mode: "insensitive" };
    }
    const customers = await prisma.customer.findMany({
      where: where as never,
      ...cursorPrismaArgs({ limit, cursor }),
    });
    const result = paginate(customers, limit);
    return { customers: result.data, hasMore: result.hasMore, nextCursor: result.nextCursor };
  });

  // GET /v1/customers/:id — tenant-isolated fetch.
  app.get("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const customer = await prisma.customer.findFirst({ where: { id, merchantId: req.merchantId! } });
    if (!customer) return reply.code(404).send({ error: { code: "not_found", message: "Customer not found" } });
    return { customer };
  });
}
