import { NextRequest, NextResponse } from "next/server";
import { getOrder, markPaid } from "@/lib/server/store";
import { verifySettlement } from "@/lib/server/gateway";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const order = await getOrder(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "paid" || order.status === "fulfilled") {
      return NextResponse.json({
        status: order.status,
        txRef: order.txRef,
        message: "Order is settled",
      });
    }

    if (!order.paymentId) {
      return NextResponse.json({
        status: order.status,
        txRef: null,
        message: "No payment intent initiated for this order yet",
      });
    }

    const txRef = await verifySettlement({
      id: order.id,
      total: order.total,
      paymentId: order.paymentId,
    });

    if (txRef) {
      await markPaid(order.id, order.paymentId, txRef);
      return NextResponse.json({
        status: "paid",
        txRef,
        message: "Payment successfully verified and marked as paid!",
      });
    }

    return NextResponse.json({
      status: order.status,
      txRef: null,
      message: "Payment is pending or not yet confirmed on Whitechain Sepolia",
    });
  } catch (err) {
    console.error("Payment check failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to check payment status" },
      { status: 500 }
    );
  }
}
