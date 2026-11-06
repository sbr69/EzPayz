import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import test, { type TestContext } from 'node:test';
import { createCheckout, existingCheckoutUrl, verifyPaymentWebhook, verifySettlement } from '../src/lib/server/gateway';

const order = { id: 'ac7dc208-8686-458a-9119-f840e0acc1e8', total: 250_000_001 };
const paymentId = 'pay_test';
const slug = 'ck_0123456789abcdef';
const checkoutUrl = 'https://checkout.example.test/real-checkout/' + slug;
const txRef = '0x' + 'ab'.repeat(32);
const merchantSecret = 'wcp_sec_gateway_test';
const webhookSecret = 'whsec_gateway_test';
const detail = {
  id: paymentId, amount: '250000001', receivedAmount: '250000001', txRef,
  metadataJson: { orderId: order.id }, status: 'succeeded', checkoutUrl: '/checkout/' + slug,
};

function env(t: TestContext, key: string, value: string) {
  const previous = process.env[key];
  process.env[key] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
}

async function startGateway(t: TestContext, respond: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) {
  const server = createServer(respond).listen(0, '127.0.0.1');
  t.after(() => new Promise<void>(resolve => {
    server.close(() => resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  env(t, 'EZPAYZ_API_URL', `http://127.0.0.1:${address.port}`);
  env(t, 'EZPAYZ_SECRET_KEY', merchantSecret);
  env(t, 'EZPAYZ_CHECKOUT_ORIGIN', 'https://checkout.example.test');
  env(t, 'APP_ORIGIN', 'https://market.example.test');
}

test('checkout sends the exact order amount and uses the canonical hosted URL', async t => {
  const requests: unknown[] = [];
  await startGateway(t, async (req, res) => {
    requests.push({
      method: req.method, path: req.url, authorization: req.headers.authorization,
      idempotencyKey: req.headers['idempotency-key'],
      body: JSON.parse(Buffer.concat(await Array.fromAsync(req)).toString('utf8')),
    });
    res.writeHead(201).end(JSON.stringify({ id: paymentId, checkoutSlug: slug, amountBaseUnits: '250000001' }));
  });

  assert.deepEqual(await createCheckout(order), { paymentId, checkoutUrl });
  assert.deepEqual(requests, [{
    method: 'POST', path: '/v1/payment-intents', authorization: `Bearer ${merchantSecret}`,
    idempotencyKey: order.id,
    body: {
      amount: '250.000001', description: `Marketplace order ${order.id}`, metadata: { orderId: order.id },
      successUrl: `https://market.example.test/orders/${order.id}`, cancelUrl: `https://market.example.test/orders/${order.id}`,
    },
  }]);
  assert.equal(existingCheckoutUrl(checkoutUrl), checkoutUrl);
  assert.equal(existingCheckoutUrl('https://checkout.example.test/#/real-checkout/' + slug), checkoutUrl);
  assert.equal(existingCheckoutUrl('https://other.example.test/real-checkout/' + slug), null);
});

test('an idempotent replay uses authenticated detail and refuses another order’s payment', async t => {
  const requests: unknown[] = [];
  let intent = detail;
  await startGateway(t, (req, res) => {
    requests.push([req.method, req.url, req.headers.authorization]);
    if (req.method === 'POST') {
      res.end(JSON.stringify({ idempotentReplay: true, resourceType: 'payment_intent', resourceId: paymentId }));
    } else {
      res.end(JSON.stringify({ paymentIntent: intent }));
    }
  });
  assert.deepEqual(await createCheckout(order), { paymentId, checkoutUrl });
  assert.deepEqual(requests, [
    ['POST', '/v1/payment-intents', `Bearer ${merchantSecret}`],
    ['GET', '/v1/payment-intents/' + paymentId, `Bearer ${merchantSecret}`],
  ]);
  intent = { ...detail, metadataJson: { orderId: 'another-order' } };
  await assert.rejects(createCheckout(order), { message: 'EzPayz checkout request failed' });
  intent = { ...detail, checkoutUrl: 'https://other.example.test/checkout/' + slug };
  await assert.rejects(createCheckout(order), { message: 'EzPayz checkout request failed' });
});

test('checkout neither follows a gateway redirect nor retries an ambiguous create', async t => {
  const requests: Array<string | undefined> = [];
  let redirect = true;
  await startGateway(t, (req, res) => {
    requests.push(req.url);
    if (redirect) res.writeHead(307, { Location: '/reflected-key' }).end(merchantSecret);
    else res.destroy();
  });
  await assert.rejects(createCheckout(order), { message: 'EzPayz checkout request failed' });
  redirect = false;
  await assert.rejects(createCheckout(order), { message: 'EzPayz checkout request failed' });
  assert.deepEqual(requests, ['/v1/payment-intents', '/v1/payment-intents']);
});

test('settlement requires a matching authenticated intent with exact paid and received amounts', async t => {
  let intent = detail;
  await startGateway(t, (req, res) => {
    if (req.method !== 'GET' || req.url !== '/v1/payment-intents/' + paymentId ||
        req.headers.authorization !== `Bearer ${merchantSecret}`) {
      res.writeHead(401).end();
    } else {
      res.end(JSON.stringify({ paymentIntent: intent }));
    }
  });
  assert.equal(await verifySettlement({ ...order, paymentId }), txRef);
  for (const mismatch of [
    { id: 'different-payment' }, { status: 'submitted' }, { amount: '250000002' }, { receivedAmount: '250000000' },
    { txRef: txRef + '\n' }, { metadataJson: { orderId: 'another-order' } },
  ]) {
    intent = { ...detail, ...mismatch };
    assert.equal(await verifySettlement({ ...order, paymentId }), null);
  }
});

test('webhook verification authenticates original bytes and requires a signed succeeded status', t => {
  env(t, 'EZPAYZ_WEBHOOK_SECRET', webhookSecret);
  const body = Buffer.from(`{ "id": "${paymentId}", "status": "succeeded", "note": "Café" }`);
  const signature = createHmac('sha256', webhookSecret).update(body).digest('hex');
  assert.equal(verifyPaymentWebhook(body, signature, 'payment.succeeded'), paymentId);
  assert.equal(verifyPaymentWebhook(Buffer.from(JSON.stringify(JSON.parse(body.toString()))), signature, 'payment.succeeded'), null);
  assert.equal(verifyPaymentWebhook(body, signature + '\n', 'payment.succeeded'), null);
  assert.equal(verifyPaymentWebhook(body, signature, 'payment.failed'), null);
  const failed = Buffer.from(`{"id":"${paymentId}","status":"failed"}`);
  assert.equal(verifyPaymentWebhook(failed, createHmac('sha256', webhookSecret).update(failed).digest('hex'), 'payment.succeeded'), null);
});
