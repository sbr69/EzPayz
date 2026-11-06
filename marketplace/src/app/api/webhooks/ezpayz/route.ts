import { NextRequest, NextResponse } from "next/server";
import { verifyPaymentWebhook, verifySettlement } from "@/lib/server/gateway";
import { getOrderByPaymentId, markPaid } from "@/lib/server/store";

export async function POST(req: NextRequest) {
  try {
    const rawBody = Buffer.from(await req.arrayBuffer());
    const signature = req.headers.get("x-whitechain-signature");
    const event = req.headers.get("x-whitechain-event");

    const paymentId = verifyPaymentWebhook(rawBody, signature, event);
    if (!paymentId) {
      return NextResponse.json({ error: "Invalid webhook signature or event" }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "Order database is unavailable" }, { status: 503 });
    }

    const order = await getOrderByPaymentId(paymentId);
    if (!order) {
      // Payment might belong to another system or order not found
      return NextResponse.json({ received: true, matched: false });
    }

    if (order.status === "paid" || order.status === "fulfilled") {
      // Already reconciled idempotently
      return NextResponse.json({ received: true, alreadyPaid: true });
    }

    // Double-check with gateway API to verify settlement & retrieve txRef
    const txRef = await verifySettlement({
      id: order.id,
      total: order.total,
      paymentId,
    });

    if (txRef) {
      await markPaid(order.id, paymentId, txRef);
      return NextResponse.json({ received: true, paid: true, txRef });
    }

    return NextResponse.json({ received: true, paid: false }, { status: 503 });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
