import assert from "node:assert/strict";
import test from "node:test";
import { changeCart, formatUsdt, readCart } from "../src/features/storefront/cart.ts";

test("a damaged or malformed cart cookie opens an empty cart", () => {
  assert.deepEqual(readCart("{"), []);
  assert.deepEqual(readCart('[{"slug":"mug","quantity":"2"}]'), []);
});

test("adding an item accumulates units while a quantity update replaces them", () => {
  const original = [{ slug: "mug", quantity: 2 }, { slug: "vase", quantity: 1 }];
  assert.deepEqual(changeCart(original, "mug", 3, "add"), [
    { slug: "mug", quantity: 5 }, { slug: "vase", quantity: 1 },
  ]);
  assert.deepEqual(changeCart(original, "mug", 3, "set"), [
    { slug: "mug", quantity: 3 }, { slug: "vase", quantity: 1 },
  ]);
  assert.deepEqual(changeCart(original, "mug", 0, "set"), [{ slug: "vase", quantity: 1 }]);
  assert.throws(() => changeCart(original, "mug", 98, "add"));
});

test("amount display keeps all significant base units", () => {
  assert.equal(formatUsdt(4_000_000), "4.00 USDT");
  assert.equal(formatUsdt(12_345_001_200), "12,345.0012 USDT");
  assert.equal(formatUsdt(1), "0.000001 USDT");
});
