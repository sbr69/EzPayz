import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { createInvoice } from "../../services/invoice";

const createSchema = z.object({
  customerEmail: z.string().email(),
  title: z.string().min(1),
  description: z.string().default(""),
  lineItems: z.array(z.object({ description: z.string(), quantity: z.number().int().min(1), unitPrice: z.string().regex(/^\d+$/) })).min(1),
});

export async function invoiceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const merchant = await prisma.merchant.findUnique({ where: { id: req.merchantId! } });
    if (!merchant?.payoutWallet) {
      return reply.code(400).send({ error: { code: "no_payout_wallet", message: "Merchant has no payout wallet" } });
    }
    const invoice = await createInvoice({
      merchantId: req.merchantId!,
      merchantDisplayName: merchant.displayName,
      merchantPayoutWallet: merchant.payoutWallet,
      customerEmail: parsed.data.customerEmail,
      title: parsed.data.title,
      description: parsed.data.description,
      lineItems: parsed.data.lineItems,
    });
    return reply.code(201).send({ id: invoice.id, total: invoice.total, status: invoice.status });
  });

  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const invoices = await prisma.invoice.findMany({
      where: { merchantId: req.merchantId! },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { lineItems: true },
    });
    return { invoices };
  });

  app.get("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const invoice = await prisma.invoice.findFirst({ where: { id, merchantId: req.merchantId! }, include: { lineItems: true } });
    if (!invoice) return reply.code(404).send({ error: { code: "not_found", message: "Invoice not found" } });
    return { invoice };
  });
}
