import { randomBytes } from "node:crypto";
import { Prisma } from "../db/generated";
import { prisma } from "../db/client";
import { signPaymentRequest } from "./payeeShield";

/** Invoices: line items + total (base units) + PayeeShield-signed. PRD §9, §13.3, FLOW §8. */
export async function createInvoice(opts: {
  merchantId: string;
  merchantDisplayName: string;
  merchantPayoutWallet: string;
  customerEmail: string;
  customerId?: string;
  title: string;
  description?: string;
  orderReference?: string;
  expiresAt?: Date;
  lineItems: { description: string; quantity: number; unitPrice: string }[];
}) {
  let total = 0n;
  for (const li of opts.lineItems) total += BigInt(li.quantity) * BigInt(li.unitPrice);
  const totalStr = total.toString();

  const invoice = await prisma.invoice.create({
    data: {
      merchantId: opts.merchantId,
      customerId: opts.customerId,
      customerEmail: opts.customerEmail,
      title: opts.title,
      description: opts.description ?? "",
      orderReference: opts.orderReference,
      expiresAt: opts.expiresAt,
      total: totalStr,
      status: "open",
      lineItems: { create: opts.lineItems },
    },
  });

  const ps = await signPaymentRequest({
    paymentIntentId: invoice.id,
    merchantId: opts.merchantId,
    merchantDisplayName: opts.merchantDisplayName,
    payoutWallet: opts.merchantPayoutWallet,
    amount: totalStr,
    description: opts.title,
    expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    nonce: "0x" + randomBytes(16).toString("hex"),
  });
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { payeeShieldJson: { payload: ps.payload, signature: ps.signature, signingAddress: ps.signingAddress, keyId: ps.keyId } as unknown as Prisma.InputJsonValue },
  });
  return invoice;
}
