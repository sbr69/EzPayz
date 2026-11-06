import assert from "node:assert/strict";
import test from "node:test";
import { isItemPrice, priceCart, validateCart } from "../src/lib/domain.ts";

test("item prices must be positive, integral, and strictly under 10 USDT", () => {
  for (const price of [0, -1, 10_000_000, 0.1, NaN]) assert.equal(isItemPrice(price), false);
  assert.equal(isItemPrice(9_999_999), true);
});

test("cart snapshots current catalog values and permits totals over 10 USDT", () => {
  const items = validateCart([{ slug: "cup", quantity: 2, price: 1 }]);
  assert.deepEqual(priceCart(items, [{ slug: "cup", name: "Cup", price: 6_000_000 }]), {
    total: 12_000_000,
    lines: [{ productSlug: "cup", name: "Cup", unitPrice: 6_000_000, quantity: 2 }],
  });
  assert.throws(() => priceCart(items, []), /unavailable/i);
});

test("cart rejects invalid quantities and duplicate listings", () => {
  for (const quantity of [0, -1, 100, 1.5, "2"]) {
    assert.throws(() => validateCart([{ slug: "cup", quantity }]), /cart/i);
  }
  assert.throws(() => validateCart([{ slug: "cup", quantity: 1 }, { slug: "cup", quantity: 1 }]), /cart/i);
});
