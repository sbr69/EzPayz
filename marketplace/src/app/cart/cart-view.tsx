"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Minus, Plus, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { WalletStatus } from "@/components/ui/wallet-status";
import { checkShopWallet } from "@/app/x402/shop-wallet";
import { useShopWallet } from "@/features/storefront/wallet-context";
import { useCart } from "@/features/storefront/cart-context";
import { formatUsdt } from "@/features/storefront/cart";
import type { Product } from "@/lib/server/schema";

interface CartViewProps {
  catalog: Product[];
}

export function CartView({ catalog }: CartViewProps) {
  const router = useRouter();
  const { items, setItemQuantity, removeItem, clearCart, isLoading } = useCart();
  const { connected, connecting, connect, setConnected, walletError } = useShopWallet();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const productMap = new Map(catalog.map((p) => [p.slug, p]));

  const cartLines = items
    .map((item) => {
      const product = productMap.get(item.slug);
      if (!product) return null;
      return {
        ...item,
        product,
        lineTotal: product.price * item.quantity,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  const totalUsdt = cartLines.reduce((sum, line) => sum + line.lineTotal, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartLines.length === 0) return;
    if (!connected) {
      setErrorMessage("Connect your Whitechain Sepolia wallet before checkout.");
      return;
    }

    if (!customerEmail || !customerEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const current = await checkShopWallet(connected.address);
      setConnected(current);
      if (current.balance < BigInt(totalUsdt)) {
        throw new Error(`Insufficient test USDT. Your bag totals ${formatUsdt(totalUsdt)}.`);
      }
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ slug: i.slug, quantity: i.quantity })),
          customerName: customerName.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create order");
      }

      // Clear client cart
      clearCart();

      // If gateway returned a hosted checkout link, redirect buyer there
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        // Otherwise navigate to the order tracking page
        router.push(`/orders/${data.id}`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Checkout failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#28334B] border-t-transparent" />
      </div>
    );
  }

  if (cartLines.length === 0) {
    return (
      <div className="work-panel py-14">
        <div className="text-brand-primary">
          <ShoppingBag className="h-10 w-10" />
        </div>
        <h2 className="font-serif-heading mt-6 text-2xl font-bold text-[#1A1A1A]">
          Your cart is currently empty
        </h2>
        <p className="mt-2 text-[15px] text-gray-500 max-w-sm">
          Browse our curated homeware collection and pay directly in test USDT on Whitechain Sepolia.
        </p>
        <Link
          href="/items"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#28334B] px-7 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#3E4C68]"
        >
          Explore All Items
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-start">
      {/* Cart Items List */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="work-panel">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h2 className="font-serif-heading text-xl font-bold text-[#28334B]">
              Cart Items ({cartLines.length})
            </h2>
            <button
              onClick={clearCart}
              className="text-sm text-gray-400 hover:text-red-600 transition"
            >
              Clear cart
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {cartLines.map(({ slug, quantity, product, lineTotal }) => (
              <div key={slug} className="flex gap-4 py-6 items-center">
                <div className="relative h-16 w-14 sm:h-20 sm:w-20 shrink-0 overflow-hidden bg-[#F2EBDD]">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col min-w-0">
                  <Link
                    href={`/items/${product.slug}`}
                    className="font-serif-heading text-base font-bold text-[#1A1A1A] hover:text-[#28334B] truncate transition-colors"
                  >
                    {product.name}
                  </Link>
                  <span className="text-sm text-gray-500">
                    {formatUsdt(product.price)} each
                  </span>

                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center rounded-lg border border-gray-200 bg-[#FAF7F0] p-0.5">
                      <button
                        onClick={() => setItemQuantity(slug, quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-gray-600 shadow-2xs hover:bg-gray-50"
                        aria-label="Decrease"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-[#1A1A1A]">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setItemQuantity(slug, quantity + 1)}
                        disabled={quantity >= 99}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-gray-600 shadow-2xs hover:bg-gray-50 disabled:opacity-40"
                        aria-label="Increase"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(slug)}
                      className="text-gray-400 hover:text-red-500 transition"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-semibold text-sm text-[#1A1A1A]">
                    {formatUsdt(lineTotal)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Info & Order Summary */}
      <div className="lg:col-span-5 lg:sticky lg:top-8">
        <div className="border-t border-brand-primary bg-[#F2EBDD] p-5 sm:p-8">
          <h2 className="font-serif-heading text-xl font-bold text-[#28334B]">
            Order Checkout
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Enter your details to confirm order and proceed to payment.
          </p>

          <form onSubmit={handleCheckout} className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="customerName" className="text-sm font-semibold text-gray-700">
                Full Name
              </label>
              <input
                id="customerName"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Jane Doe"
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder-gray-400 focus:border-[#28334B] focus:bg-white focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="customerEmail" className="text-sm font-semibold text-gray-700">
                Email Address
              </label>
              <input
                id="customerEmail"
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="jane@example.com"
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder-gray-400 focus:border-[#28334B] focus:bg-white focus:outline-none transition"
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {errorMessage}
              </div>
            )}

            <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Network</span>
                <span className="font-medium text-[#1A1A1A]">Whitechain Sepolia</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Currency</span>
                <span className="font-medium text-[#1A1A1A]">Test USDT</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-gray-100 text-[#1A1A1A]">
                <span className="font-bold text-base">Total Due</span>
                <span className="font-serif-heading font-bold text-2xl text-[#28334B]">
                  {formatUsdt(totalUsdt)}
                </span>
              </div>
            </div>

            <div className="mt-1 rounded-lg border border-[#D6CCBD] bg-[#fffdf8] p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Checkout wallet</p>
                <WalletStatus connected={Boolean(connected)} connecting={connecting} />
              </div>
              <p className="my-2 break-all text-xs text-[#565A64]">
                {connected ? `Whitechain Sepolia · ${connected.address.slice(0, 6)}…${connected.address.slice(-4)} · ${formatUnits(connected.balance, 6)} test USDT` : "Connect a funded wallet to continue."}
              </p>
              <Button type="button" variant="outline" disabled={connecting || submitting} onClick={() => { setErrorMessage(null); void connect(); }}>
                <Wallet size={16} aria-hidden /> {connecting ? "Connecting…" : connected ? "Refresh balance" : "Connect wallet"}
              </Button>
              {walletError && <p className="mt-2 text-xs text-red-800" role="status">{walletError}</p>}
              {connected && connected.balance < BigInt(totalUsdt) && <p className="mt-2 text-xs text-red-800" role="status">Insufficient test USDT for this bag.</p>}
            </div>

            <button
              type="submit"
              disabled={submitting || connecting || !connected || connected.balance < BigInt(totalUsdt)}
              className="action action-green mt-4 w-full disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              <span>{submitting ? "Creating Order..." : "Confirm & Pay with EzPayz"}</span>
            </button>

            <p className="mt-2 text-center text-[11px] text-gray-400">
              Continue to EzPayz hosted checkout and approve the payment using the same wallet.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
