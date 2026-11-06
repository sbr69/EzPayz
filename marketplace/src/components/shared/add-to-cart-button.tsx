"use client";

import { Plus, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/features/storefront/cart-context";

export function AddToCartButton({
  slug, name, quantity = 1, compact = false,
}: { slug: string; name: string; quantity?: number; compact?: boolean }) {
  const { addItem } = useCart();
  const router = useRouter();

  function handleAdd() {
    if (!addItem(slug, quantity)) {
      toast.error("Couldn’t add this item", { description: "Check the quantities in your bag and try again." });
      return;
    }
    toast.success("Added to your bag", {
      id: "bag:" + slug,
      description: quantity === 1 ? name : `${quantity} × ${name}`,
      action: { label: "View bag", onClick: () => router.push("/cart") },
    });
  }

  return (
    <Button type="button" onClick={handleAdd} variant={compact ? "outline" : "primary"}
      size={compact ? "icon" : "default"} className={compact ? undefined : "w-full"}
      aria-label={`Add ${name} to bag`}>
      {compact ? <Plus size={18} aria-hidden /> : <><ShoppingBag size={17} aria-hidden /> Add to bag</>}
    </Button>
  );
}
