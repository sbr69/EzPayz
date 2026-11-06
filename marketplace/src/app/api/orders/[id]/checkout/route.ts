import { NextRequest, NextResponse } from "next/server";
import { getOrder, claimCheckout, saveCheckout, reviewCheckout } from "@/lib/server/store";
import { checkoutAvailable, createCheckout } from "@/lib/server/gateway";

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
      return NextResponse.json({ error: "Order has already been paid" }, { status: 400 });
    }

    if (order.checkoutUrl) {
      return NextResponse.json({ checkoutUrl: order.checkoutUrl, paymentId: order.paymentId });
    }

    if (!checkoutAvailable()) {
      return NextResponse.json(
        { error: "EzPayz gateway credentials are not configured on this server." },
        { status: 503 }
      );
    }

    const claimed = await claimCheckout(id);
    if (!claimed) {
      return NextResponse.json({ error: "Checkout is currently processing or already completed" }, { status: 409 });
    }

    try {
      const { paymentId, checkoutUrl } = await createCheckout({
        id: order.id,
        total: order.total,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
      });
      await saveCheckout(id, paymentId, checkoutUrl);
      return NextResponse.json({ paymentId, checkoutUrl });
    } catch (err) {
      await reviewCheckout(id);
      throw err;
    }
  } catch (err) {
    console.error("Checkout initiation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to initiate EzPayz checkout" },
      { status: 500 }
    );
  }
}
