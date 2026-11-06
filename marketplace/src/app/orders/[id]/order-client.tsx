"use client";

import { useState } from "react";
import { CheckCircle2, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { formatUsdt } from "@/features/storefront/cart";

interface OrderClientProps {
  order: {
    id: string;
    total: number;
    status: "pending" | "creating" | "review" | "paid" | "fulfilled";
    paymentId: string | null;
    checkoutUrl: string | null;
    txRef: string | null;
    createdAt: string;
    lines: Array<{
      productSlug: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
  };
}

export function OrderClient({ order: initialOrder }: OrderClientProps) {
  const [order, setOrder] = useState(initialOrder);
  const [checking, setChecking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const checkPaymentStatus = async () => {
    setChecking(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/check-payment`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === "paid") {
          setOrder((prev) => ({ ...prev, status: "paid", txRef: data.txRef }));
          setStatusMessage("Payment confirmed! Your order is paid.");
        } else {
          setStatusMessage(data.message || "Payment has not settled yet. Please complete checkout or try again in a few moments.");
        }
      } else {
        setStatusMessage(data.error || "Failed to check status.");
      }
    } catch {
      setStatusMessage("Network error while checking status.");
    } finally {
      setChecking(false);
    }
  };

  const handlePay = async () => {
    if (order.checkoutUrl) {
      window.location.href = order.checkoutUrl;
      return;
    }
    setPaying(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/checkout`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setStatusMessage(data.error || "Unable to initiate checkout. Please ensure gateway is configured.");
      }
    } catch {
      setStatusMessage("Failed to connect to checkout gateway.");
    } finally {
      setPaying(false);
    }
  };

  const isPaid = order.status === "paid" || order.status === "fulfilled";

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
      {/* Order Status & Actions */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="work-panel">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Order ID
              </span>
              <p className="break-all font-mono text-sm text-brand-primary mt-0.5">
                {order.id}
              </p>
            </div>

            {/* Status Badge */}
            {isPaid ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{order.status === "fulfilled" ? "Fulfilled" : "Paid"}</span>
              </div>
            ) : order.status === "review" ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>Under Review</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F3B687]/30 px-3 py-1 text-xs font-bold text-[#754123]">
                <Clock className="h-4 w-4 text-[#754123]" />
                <span>Pending Payment</span>
              </div>
            )}
          </div>

          {/* Succeeded details */}
          {isPaid && (
            <div className="mt-6 rounded-2xl bg-[#28334B]/5 border border-[#28334B]/15 p-5 text-sm">
              <h3 className="font-serif-heading font-bold text-[#28334B]">
                Payment Settled on Whitechain Sepolia
              </h3>
              <p className="mt-1 text-xs text-gray-600">
                EzPayz confirmed payment for this order.
              </p>
              {order.txRef && (
                <div className="mt-4 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-gray-400">
                    Transaction Hash
                  </span>
                  <a
                    href={`https://explorer.testnet.whitechain.io/tx/${order.txRef}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-[#28334B] underline break-all hover:text-[#3E4C68]"
                  >
                    <span>{order.txRef}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Pending Actions */}
          {!isPaid && (
            <div className="mt-6 flex flex-col gap-4">
              <div className="border-y border-[#D6CCBD] py-4 text-sm">
                <p>
                  To complete this test purchase, pay with test USDT on Whitechain Sepolia (Chain 1874).
                </p>
              </div>

              {statusMessage && (
                <div role="status" className="border-l-2 border-brand-accent p-3 text-sm">
                  {statusMessage}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handlePay}
                  disabled={paying || order.status === "review" || order.status === "creating"}
                  className="action action-green flex-1 justify-center disabled:opacity-50"
                >
                  {paying ? "Preparing Gateway..." : "Pay with EzPayz"}
                </button>

                <button
                  onClick={checkPaymentStatus}
                  disabled={checking}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3.5 px-5 font-semibold text-sm text-gray-700 shadow-2xs hover:bg-gray-50 active:scale-[0.99] disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
                  <span>Check Status</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Order Items Breakdown */}
      <div className="lg:col-span-5">
        <div className="border-t border-brand-primary bg-[#F2EBDD] p-5 sm:p-8">
          <h2 className="font-serif-heading text-lg font-bold text-[#28334B]">
            Ordered Items
          </h2>

          <div className="mt-4 divide-y divide-gray-100">
            {order.lines.map((line) => (
              <div key={line.productSlug} className="py-3 flex justify-between items-center text-sm">
                <div>
                  <p className="font-medium text-gray-900">{line.name}</p>
                  <p className="text-xs text-gray-400">
                    Qty: {line.quantity} × {formatUsdt(line.unitPrice)}
                  </p>
                </div>
                <span className="font-semibold text-gray-900">
                  {formatUsdt(line.unitPrice * line.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4 flex justify-between items-baseline">
            <span className="font-bold text-sm text-gray-700">Total</span>
            <span className="font-serif-heading font-bold text-2xl text-[#28334B]">
              {formatUsdt(order.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
