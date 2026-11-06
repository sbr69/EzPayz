"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { AddToCartButton } from "@/components/shared/add-to-cart-button";

export function ProductPurchaseBox({ slug, name }: { slug: string; name: string }) {
  const [quantity, setQuantity] = useState(1);

  const increment = () => setQuantity((q) => Math.min(q + 1, 99));
  const decrement = () => setQuantity((q) => Math.max(q - 1, 1));

  return (
    <div className="flex flex-col gap-5 pt-6 border-t border-gray-100">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Quantity
        </label>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-gray-200 bg-[#FAF7F0] p-1">
            <button
              type="button"
              onClick={decrement}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-600 shadow-2xs transition hover:bg-gray-50 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-12 text-center text-sm font-bold text-[#1A1A1A]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={increment}
              disabled={quantity >= 99}
              aria-label="Increase quantity"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-600 shadow-2xs transition hover:bg-gray-50 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <span className="text-xs text-gray-400">Max 99 per item</span>
        </div>
      </div>

      <AddToCartButton slug={slug} name={name} quantity={quantity} />
    </div>
  );
}
