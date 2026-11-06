import { validateCart, type CartItem } from "../../lib/domain.ts";

export const cartCookie = "ezpayz-marketplace-cart";

export function readCart(raw: string | undefined): CartItem[] {
  if (!raw) return [];
  try {
    return validateCart(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function changeCart(items: CartItem[], slug: string, quantity: number, mode: "add" | "set") {
  if (!Number.isInteger(quantity) || quantity < 0 || (mode === "add" && quantity === 0)) {
    throw new Error("Invalid quantity");
  }
  const current = items.find((item) => item.slug === slug);
  const nextQuantity = mode === "add" ? (current?.quantity ?? 0) + quantity : quantity;
  const updated = { slug, quantity: nextQuantity };
  const next = nextQuantity === 0
    ? items.filter((item) => item.slug !== slug)
    : current
      ? items.map((item) => item.slug === slug ? updated : item)
      : [...items, updated];
  return next.length ? validateCart(next) : next;
}

export function formatUsdt(amount: number) {
  const digits = String(amount).padStart(7, "0");
  const whole = digits.slice(0, -6).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = digits.slice(-6).replace(/0+$/, "").padEnd(2, "0");
  return `${whole}.${fraction} USDT`;
}
