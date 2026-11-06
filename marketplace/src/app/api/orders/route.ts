import { NextRequest, NextResponse } from "next/server";
import { createOrder, claimCheckout, saveCheckout, reviewCheckout, getOrder } from "@/lib/server/store";
import { checkoutAvailable, createCheckout } from "@/lib/server/gateway";

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Checkout is unavailable until the marketplace database is configured." }, { status: 503 });
  }
  try {
    const body = await req.json();
    const { id } = await createOrder(body);

    // If gateway credentials are configured, create the payment intent immediately
    if (checkoutAvailable()) {
      const order = await getOrder(id);
      if (order && (await claimCheckout(id))) {
        try {
          const { paymentId, checkoutUrl } = await createCheckout({
            id: order.id,
            total: order.total,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
          });
          await saveCheckout(id, paymentId, checkoutUrl);
          return NextResponse.json({ id, checkoutUrl, status: "pending" });
        } catch (err) {
          await reviewCheckout(id);
          console.error("Failed to create EzPayz payment intent:", err);
          return NextResponse.json({ id, checkoutUrl: null, status: "review" });
        }
      }
    }

    return NextResponse.json({ id, checkoutUrl: null, status: "pending" });
  } catch (err) {
    if (err instanceof SyntaxError || (err instanceof Error && err.message === "Invalid cart")) {
      return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
    }
    if (err instanceof Error && err.message === "An item is unavailable") {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[marketplace] Order creation failed");
    return NextResponse.json({ error: "Checkout is temporarily unavailable." }, { status: 503 });
  }
}
