import { prisma } from "../db/client";

/** DeliveryGuard: fulfilment tracking (off-chain, not escrow). PRD §14, FLOW §12. */
export async function createFulfilmentForPayment(opts: {
  merchantId: string;
  paymentId: string;
  customerId?: string;
  productId?: string;
  orderReference: string;
  amount: string;
}) {
  return prisma.fulfilmentOrder.create({
    data: {
      merchantId: opts.merchantId,
      paymentId: opts.paymentId,
      customerId: opts.customerId ?? "",
      productId: opts.productId,
      orderReference: opts.orderReference,
      amount: opts.amount,
      status: "not_started",
    },
  });
}
