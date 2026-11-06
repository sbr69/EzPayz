"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { CartItem } from "@/lib/domain";
import { cartCookie, changeCart, readCart } from "./cart";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  addItem: (slug: string, quantity?: number) => boolean;
  setItemQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clearCart: () => void;
  isLoading: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
const cartChanged = "ezpayz-cart-changed";
let inMemoryCart: string | undefined;

function getClientCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setClientCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=604800; SameSite=Lax`;
}

function subscribe(listener: () => void) {
  window.addEventListener(cartChanged, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(cartChanged, listener);
    window.removeEventListener("storage", listener);
  };
}

function readSnapshot() {
  try {
    return localStorage.getItem(cartCookie) ?? getClientCookie(cartCookie) ?? inMemoryCart ?? "";
  } catch {
    return inMemoryCart ?? "";
  }
}

function persist(next: CartItem[]) {
  const json = JSON.stringify(next);
  inMemoryCart = json;
  try { setClientCookie(cartCookie, json); } catch {}
  try { localStorage.setItem(cartCookie, json); } catch {}
  window.dispatchEvent(new Event(cartChanged));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => null);
  const items = readCart(snapshot ?? undefined);

  const addItem = (slug: string, quantity = 1) => {
    try {
      const next = changeCart(readCart(readSnapshot()), slug, quantity, "add");
      persist(next);
      return true;
    } catch (e) {
      console.error("Failed to add item to cart:", e);
      return false;
    }
  };

  const setItemQuantity = (slug: string, quantity: number) => {
    try {
      const next = changeCart(readCart(readSnapshot()), slug, quantity, "set");
      persist(next);
    } catch (e) {
      console.error("Failed to update cart quantity:", e);
    }
  };

  const removeItem = (slug: string) => {
    setItemQuantity(slug, 0);
  };

  const clearCart = () => {
    persist([]);
  };

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        addItem,
        setItemQuantity,
        removeItem,
        clearCart,
        isLoading: snapshot === null,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
