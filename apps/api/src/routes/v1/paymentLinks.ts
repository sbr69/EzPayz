import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { createPaymentLink } from "../../services/paymentLink";
import { parseHumanAmount } from "../../utils/amount";

const decimalAmount = z.string().regex(/^\d+(\.\d{1,6})?$/, "amount must be a decimal string like \"10.00\" (max 6 decimal places)");

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  linkType: z.enum(["fixed", "customer_amount", "reusable"]).default("fixed"),
  amount: decimalAmount.optional(),
  minAmount: decimalAmount.optional(),
  maxAmount: decimalAmount.optional(),
});

export async function paymentLinkRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const data = {
      ...parsed.data,
      amount: parsed.data.amount ? parseHumanAmount(parsed.data.amount) : undefined,
      minAmount: parsed.data.minAmount ? parseHumanAmount(parsed.data.minAmount) : undefined,
      maxAmount: parsed.data.maxAmount ? parseHumanAmount(parsed.data.maxAmount) : undefined,
    };
    const link = await createPaymentLink({ merchantId: req.merchantId!, ...data });
    return reply.code(201).send({ id: link.id, slug: link.slug, url: `/l/${link.slug}` });
  });

  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const links = await prisma.paymentLink.findMany({ where: { merchantId: req.merchantId! }, orderBy: { createdAt: "desc" } });
    return { links };
  });

  app.post("/:id/disable", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const res = await prisma.paymentLink.updateMany({ where: { id, merchantId: req.merchantId! }, data: { active: false } });
    if (res.count === 0) return reply.code(404).send({ error: { code: "not_found", message: "Payment link not found" } });
    return reply.send({ disabled: true });
  });
}
