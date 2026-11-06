import assert from "node:assert/strict";
import test from "node:test";
import { generatePrivateKey } from "viem/accounts";
import { USDT_ADDRESS } from "@ezpayz/x402";
import { validateOffer, settledHash, makeOffer, requestCatalogPayment } from "../src/lib/server/x402";

const payTo = "0x1111111111111111111111111111111111111111";
const resource = "http://localhost:3000/api/x402/catalog";

test("x402 checks the exact amount, recipient, asset, network and resource before signing", () => {
  const offer = makeOffer(payTo, resource);
  assert.equal(validateOffer(offer, payTo, resource), true);
  for (const change of [{ maxAmountRequired: "10001" }, { network: "eip155:1" }, { payTo: "other" }, { asset: "USDC" }, { resource: "https://elsewhere.test" }]) {
    assert.equal(validateOffer({ ...offer, ...change }, payTo, resource), false);
  }
});

test("only a positive facilitator receipt with a valid transaction hash releases results", () => {
  const txHash = "0x" + "ab".repeat(32);
  assert.equal(settledHash({ success: true, txHash }), txHash);
  assert.equal(settledHash({ success: false, txHash }), null);
  assert.equal(settledHash({ success: true, txHash: "missing" }), null);
});

test("the approved flow signs the fixed challenge once and submits it to verify and settle", async (t) => {
  const txHash = "0x" + "ab".repeat(32);
  const signedRequests: unknown[] = [];
  const calls: string[] = [];
  const offer = makeOffer(payTo, resource);
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (url === resource) return new Response(null, {
      status: 402, headers: { "X-PAYMENT-REQUIREMENTS": Buffer.from(JSON.stringify(offer)).toString("base64") },
    });
    if (url.endsWith("/supported")) return Response.json({
      schemes: ["exact"], networks: ["eip155:1874"], assets: { "eip155:1874": { address: USDT_ADDRESS } },
    });
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fixture-merchant-key");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.paymentPayload.value, "10000");
    assert.equal(body.paymentPayload.to, payTo);
    assert.match(body.paymentPayload.signature, /^0x[a-f\d]{130}$/i);
    assert.deepEqual(body.paymentRequirements, offer);
    signedRequests.push(body);
    return url.endsWith("/verify") ? Response.json({ isValid: true }) : Response.json({ success: true, txHash });
  });
  assert.equal(await requestCatalogPayment({
    origin: "http://localhost:3000", api: "https://gateway.example.test", payTo,
    privateKey: generatePrivateKey(), merchantKey: "fixture-merchant-key", groqKey: "unused", model: "unused",
  }, new Date().toISOString().slice(0, 10)), txHash);
  assert.deepEqual(calls, [resource, "https://gateway.example.test/v1/x402/supported",
    "https://gateway.example.test/v1/x402/verify", "https://gateway.example.test/v1/x402/settle"]);
  assert.deepEqual(signedRequests[0], signedRequests[1]);
});
