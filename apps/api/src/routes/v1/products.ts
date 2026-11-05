import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { parseHumanAmount, formatBaseUnits } from "../../utils/amount";
import { parsePagination, cursorPrismaArgs, paginate } from "../../utils/pagination";
import { recordIdempotency } from "../../plugins/idempotency";

const decimalAmount = z.string().regex(/^\d+(\.\d{1,6})?$/, "price must be a decimal string like \"10.00\" (max 6 decimal places)");

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  imageGlyph: z.string().max(2).default("$"),
  price: decimalAmount,
  billingMode: z.enum(["fixed", "usage"]).default("fixed"),
  unitLabel: z.string().optional(),
  unitPrice: decimalAmount.optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  imageGlyph: z.string().max(2).optional(),
  price: decimalAmount.optional(),
  billingMode: z.enum(["fixed", "usage"]).optional(),
  unitLabel: z.string().optional(),
  unitPrice: decimalAmount.optional(),
  active: z.boolean().optional(),
});

export async function productRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/products — create a product.
  app.post("/", { preHandler: [app.authenticate, app.requireSecretKey, app.idempotency] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const product = await prisma.product.create({
      data: {
        merchantId: req.merchantId!,
        name: parsed.data.name,
        description: parsed.data.description,
        imageGlyph: parsed.data.imageGlyph,
        price: parseHumanAmount(parsed.data.price),
        billingMode: parsed.data.billingMode,
        unitLabel: parsed.data.unitLabel,
        unitPrice: parsed.data.unitPrice ? parseHumanAmount(parsed.data.unitPrice) : undefined,
        active: true,
      },
    });
    const key = (req.headers["idempotency-key"] as string).trim();
    await recordIdempotency(req.merchantId!, key, "product", product.id);
    return reply.code(201).send({ id: product.id, name: product.name, displayPrice: formatBaseUnits(product.price) });
  });

  // GET /v1/products — list with cursor pagination.
  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>);
    const products = await prisma.product.findMany({
      where: { merchantId: req.merchantId!, active: true },
      ...cursorPrismaArgs({ limit, cursor }),
    });
    const result = paginate(products, limit);
    return {
      products: result.data.map((p) => ({ ...p, displayPrice: formatBaseUnits(p.price) })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  });

  // GET /v1/products/:id — single product.
  app.get("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const product = await prisma.product.findFirst({ where: { id, merchantId: req.merchantId! } });
    if (!product) return reply.code(404).send({ error: { code: "not_found", message: "Product not found" } });
    return { product: { ...product, displayPrice: formatBaseUnits(product.price) } };
  });

  // PATCH /v1/products/:id — update a product.
  app.patch("/:id", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.price) data.price = parseHumanAmount(parsed.data.price);
    if (parsed.data.unitPrice) data.unitPrice = parseHumanAmount(parsed.data.unitPrice);
    const product = await prisma.product.updateMany({ where: { id, merchantId: req.merchantId! }, data: data as never });
    if (product.count === 0) return reply.code(404).send({ error: { code: "not_found", message: "Product not found" } });
    return { updated: true };
  });

  // DELETE /v1/products/:id — soft delete (set active = false).
  app.delete("/:id", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const res = await prisma.product.updateMany({ where: { id, merchantId: req.merchantId! }, data: { active: false } });
    if (res.count === 0) return reply.code(404).send({ error: { code: "not_found", message: "Product not found" } });
    return { deleted: true };
  });
}
