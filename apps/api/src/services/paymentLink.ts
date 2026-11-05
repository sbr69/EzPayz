import { randomBytes } from "node:crypto";
import { prisma } from "../db/client";

/** Payment links: fixed / customer_amount / reusable. QR encodes the hosted URL. PRD §9, FLOW §7. */
export async function createPaymentLink(opts: {
  merchantId: string;
  title: string;
  description?: string;
  linkType: "fixed" | "customer_amount" | "reusable";
  amount?: string;
  minAmount?: string;
  maxAmount?: string;
  reference?: string;
  returnUrl?: string;
}) {
  const slug = "pl_" + randomBytes(6).toString("hex");
  return prisma.paymentLink.create({
    data: {
      merchantId: opts.merchantId,
      slug,
      title: opts.title,
      description: opts.description ?? "",
      linkType: opts.linkType,
      amount: opts.amount,
      minAmount: opts.minAmount,
      maxAmount: opts.maxAmount,
      reference: opts.reference,
      returnUrl: opts.returnUrl,
      active: true,
    },
  });
}
