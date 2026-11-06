"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import { useCart } from "@/features/storefront/cart-context";
import { ShopWordmark } from "./shop-wordmark";
import { WalletMenu } from "./wallet-menu";

export function Header() {
  const { itemCount, isLoading } = useCart();
  const pathname = usePathname();
  return (
    <header className="store-header">
      <div className="site-width header-inner">
        <ShopWordmark />
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/items" aria-current={pathname.startsWith("/items") ? "page" : undefined}>Shop</Link>
          <Link href="/x402" className="header-chat" aria-current={pathname === "/x402" ? "page" : undefined}>
            <MessageCircle size={16} aria-hidden /> Shop chat
          </Link>
        </nav>
        <div className="header-tools flex items-center gap-2 sm:gap-4">
          <WalletMenu />
          <Link href="/cart" className="bag-link" aria-current={pathname === "/cart" ? "page" : undefined}>
            <ShoppingBag size={18} strokeWidth={1.6} aria-hidden />
            <span>Bag<motion.span className="bag-count" key={itemCount} initial={{ scale: 0.82 }} animate={{ scale: 1 }}>{isLoading ? "" : ` (${itemCount})`}</motion.span></span>
          </Link>
        </div>
      </div>
    </header>
  );
}
