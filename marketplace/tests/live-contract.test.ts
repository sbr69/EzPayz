import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST as submitOrder } from "../src/app/api/orders/route";
import { POST as receiveWebhook } from "../src/app/api/webhooks/ezpayz/route";
import { createOrder, getProduct } from "../src/lib/server/store";

const webhookSecret = "local-contract-test";

test("sample catalog cannot accept checkout without a live database", async (t) => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  t.after(() => {
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  });
  const response = await submitOrder(new NextRequest("http://localhost/api/orders", {
    method: "POST", body: JSON.stringify({ items: [{ slug: "oat-stoneware-mugs", quantity: 1 }] }),
  }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Checkout is unavailable until the marketplace database is configured." });
});

test("a configured database owns the catalog and a removed item cannot be purchased", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ fields: [], rows: [] }));
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://test:test@database.example.test/marketplace";
  t.after(() => {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  });
  assert.equal(await getProduct("oat-stoneware-mugs"), undefined);
  await assert.rejects(createOrder([{ slug: "oat-stoneware-mugs", quantity: 1 }]), /unavailable/i);
});

test("webhook accepts the gateway's documented signature and event headers", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ fields: [], rows: [] }));
  const previous = { url: process.env.DATABASE_URL, secret: process.env.EZPAYZ_WEBHOOK_SECRET };
  process.env.DATABASE_URL = "postgresql://test:test@database.example.test/marketplace";
  process.env.EZPAYZ_WEBHOOK_SECRET = webhookSecret;
  t.after(() => {
    if (previous.url === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.url;
    if (previous.secret === undefined) delete process.env.EZPAYZ_WEBHOOK_SECRET;
    else process.env.EZPAYZ_WEBHOOK_SECRET = previous.secret;
  });
  const body = JSON.stringify({ id: "pay_unmatched", status: "succeeded" });
  const signature = createHmac("sha256", webhookSecret).update(body).digest("hex");
  const request = (signatureValue: string) => new NextRequest("http://localhost/api/webhooks/ezpayz", {
    method: "POST", body, headers: {
      "X-Whitechain-Signature": signatureValue,
      "X-Whitechain-Event": "payment.succeeded",
    },
  });
  assert.equal((await receiveWebhook(request("0".repeat(64)))).status, 400);
  const response = await receiveWebhook(request(signature));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, matched: false });
});
