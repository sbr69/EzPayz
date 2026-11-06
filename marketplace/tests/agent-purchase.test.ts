import assert from "node:assert/strict";
import test from "node:test";
import { USDT_ADDRESS } from "@ezpayz/x402";
import { buyerPaymentPath, matchesBuyerOffer, paymentMessage, shopOriginAllowed, walletErrorMessage, type BuyerQuote } from "../src/lib/agent-purchase";

const quote: BuyerQuote = { id: "order", item: "Cup", amount: 6400000, scheme: "exact", network: "eip155:1874",
  asset: USDT_ADDRESS, payTo: "0x1111111111111111111111111111111111111111", nonce: "0x11", validAfter: 10, validBefore: 20 };

test("wallet authorization binds the saved amount and refuses changed x402 terms", () => {
  const offer = { scheme: "exact", network: quote.network, asset: quote.asset,
    payTo: quote.payTo, maxAmountRequired: "6400000", resource: buyerPaymentPath };
  assert.equal(matchesBuyerOffer(quote, offer), true);
  for (const change of [{ maxAmountRequired: "6400001" }, { payTo: "0x123" }, { asset: "USDC" }, { network: "eip155:1" }, { resource: "/different" }]) {
    assert.equal(matchesBuyerOffer(quote, { ...offer, ...change }), false);
  }
  assert.equal(paymentMessage(quote, quote.payTo).value, 6400000n);
});

test("same-origin catalog browsing works on a preview while payment keeps its production origin", () => {
  const canonical = "https://shop.example.test";
  const preview = new Request("https://preview.example.test/api/x402/shop", { headers: {
    Origin: "https://preview.example.test", "Sec-Fetch-Site": "same-origin",
  } });
  assert.equal(shopOriginAllowed(preview, canonical, true), true);
  assert.equal(shopOriginAllowed(preview, canonical, false), false);
  assert.equal(shopOriginAllowed(new Request(preview.url, { headers: { Origin: "https://other.example.test" } }), canonical, true), false);
  assert.equal(shopOriginAllowed(new Request("http://127.0.0.1:3018/api/x402/shop", { headers: {
    Origin: "http://127.0.0.1:3018", "Sec-Fetch-Site": "same-origin",
  } }), "http://127.0.0.1:3016", false), true);
});

test("wallet errors report the next action without provider internals", () => {
  assert.equal(walletErrorMessage({ cause: { code: 4001, message: "private provider output" } }, "sign"), "Signature cancelled. No payment was submitted.");
  assert.equal(walletErrorMessage({ code: -32002 }, "connect"), "Open your wallet and finish the pending request.");
  assert.match(walletErrorMessage(new Error("raw RPC"), "balance"), /balance.*try again/i);
});
