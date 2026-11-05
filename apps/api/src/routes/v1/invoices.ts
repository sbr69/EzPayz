import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { createInvoice } from "../../services/invoice";
import { generateInvoicePdfBuffer } from "../../services/invoicePdf";
import { recordIdempotency } from "../../plugins/idempotency";
import { parseHumanAmount, formatBaseUnits } from "../../utils/amount";
import { parsePagination, cursorPrismaArgs, paginate } from "../../utils/pagination";

const decimalPrice = z.string().regex(/^\d+(\.\d{1,6})?$/, "unitPrice must be a decimal string like \"5.00\" (max 6 decimal places)");

const createSchema = z.object({
  customerEmail: z.string().email(),
  title: z.string().min(1),
  description: z.string().default(""),
  lineItems: z.array(z.object({ description: z.string(), quantity: z.number().int().min(1), unitPrice: decimalPrice })).min(1),
});

export async function invoiceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", { preHandler: [app.authenticate, app.requireSecretKey, app.idempotency] }, async (req, reply) => {
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
      lineItems: parsed.data.lineItems.map((li) => ({ ...li, unitPrice: parseHumanAmount(li.unitPrice) })),
    });
    const key = (req.headers["idempotency-key"] as string).trim();
    await recordIdempotency(req.merchantId!, key, "invoice", invoice.id);
    return reply.code(201).send({ id: invoice.id, total: invoice.total, displayTotal: formatBaseUnits(invoice.total), status: invoice.status });
  });

  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const { limit, cursor } = parsePagination(req.query as Record<string, unknown>);
    const invoices = await prisma.invoice.findMany({
      where: { merchantId: req.merchantId! },
      ...cursorPrismaArgs({ limit, cursor }),
      include: { lineItems: true },
    });
    const result = paginate(invoices, limit);
    return { invoices: result.data, hasMore: result.hasMore, nextCursor: result.nextCursor };
  });

  app.get("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const invoice = await prisma.invoice.findFirst({ where: { id, merchantId: req.merchantId! }, include: { lineItems: true } });
    if (!invoice) return reply.code(404).send({ error: { code: "not_found", message: "Invoice not found" } });
    return { invoice, displayTotal: formatBaseUnits(invoice.total) };
  });

  // GET /v1/invoices/:id/pdf — downloadable paid receipt PDF. PRD §13.1, FLOW §6.7.
  app.get("/:id/pdf", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const pdf = await generateInvoicePdfBuffer(id, req.merchantId!);
    if (!pdf) return reply.code(404).send({ error: { code: "not_found", message: "Invoice not found" } });
    reply.type("application/pdf");
    reply.header("Content-Disposition", `attachment; filename="receipt-${id}.pdf"`);
    return reply.send(pdf);
  });
}
