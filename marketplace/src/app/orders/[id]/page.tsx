import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOrder } from "@/lib/server/store";
import { OrderClient } from "./order-client";

export const revalidate = 0;

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-serif-heading text-2xl font-bold text-gray-900">
          Order Not Found
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          We could not find an order with reference ID: {id}
        </p>
        <Link
          href="/items"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#28334B] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#3E4C68]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Shop
        </Link>
      </div>
    );
  }

  // Format order data for client component
  const clientOrder = {
    id: order.id,
    total: order.total,
    status: order.status,
    paymentId: order.paymentId ?? null,
    checkoutUrl: order.checkoutUrl ?? null,
    txRef: order.txRef ?? null,
    createdAt: order.createdAt ? order.createdAt.toISOString() : new Date().toISOString(),
    lines: order.lines.map((l) => ({
      productSlug: l.productSlug,
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
  };

  return (
    <div className="site-width pb-20">
      <div className="page-heading flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#28334B]">
            Purchase / Order status
          </span>
          <h1 className="display">
            Your <em>order.</em>
          </h1>
        </div>
        <Link
          href="/items"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#28334B]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Continue Shopping
        </Link>
      </div>

      <OrderClient order={clientOrder} />
    </div>
  );
}
