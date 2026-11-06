import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { createMarketplace } from './server.mjs';

test('order uses one hosted checkout, verifies settlement, then allows merchant fulfilment', async t => {
  const password = 'marketplace-test-password';
  const webhookSecret = 'webhook-test-secret';
  const txRef = '0x' + 'ab'.repeat(32);
  let intent;
  let createCount = 0;
  let submittedAmount;
  const gateway = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== 'Bearer test-key') {
      res.writeHead(401).end('{}');
      return;
    }
    if (req.method === 'POST') {
      const body = JSON.parse(await Array.fromAsync(req).then(chunks => Buffer.concat(chunks)));
      createCount++;
      intent = {
        id: createCount === 1 ? 'payment-test' : 'payment-test-' + createCount,
        checkoutSlug: 'ck_0123456789abcdef', amount: '2500000',
        status: 'created', metadataJson: body.metadata,
      };
      submittedAmount = body.amount;
      res.writeHead(201).end(JSON.stringify({
        id: intent.id, checkoutSlug: intent.checkoutSlug, amountBaseUnits: intent.amount,
      }));
      return;
    }
    res.end(JSON.stringify({ paymentIntent: intent }));
  }).listen(0, '127.0.0.1');
  t.after(() => gateway.close());
  await once(gateway, 'listening');
  const app = createMarketplace({
    database: ':memory:', password,
    products: [{ id: 'tea', name: 'Tea', price: '2.50' }],
    gateway: {
      apiUrl: 'http://127.0.0.1:' + gateway.address().port,
      checkoutOrigin: 'https://checkout.example',
      returnOrigin: 'http://127.0.0.1:5174',
      secretKey: 'test-key',
      webhookSecret,
    },
  }).listen(0, '127.0.0.1');
  t.after(() => app.close());
  await once(app, 'listening');
  const base = 'http://127.0.0.1:' + app.address().port;
  const order = await fetch(base + '/orders', {
    method: 'POST', redirect: 'manual', body: new URLSearchParams({ tea: '1', total: '0.01' }),
  });
  const path = order.headers.get('location');
  assert.ok(path);
  const confirmation = await fetch(base + path);
  assert.match(confirmation.headers.get('content-security-policy'), /form-action 'self' https:\/\/checkout\.example/);
  const start = () => fetch(base + path + '/checkout', { method: 'POST', redirect: 'manual' });
  const checkouts = await Promise.all([start(), start()]);
  for (const response of checkouts) {
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://checkout.example/real-checkout/ck_0123456789abcdef');
  }
  assert.equal(createCount, 1);
  assert.equal(submittedAmount, '2.50');
  assert.equal(intent.metadataJson.orderId, path.split('/').at(-1));

  const authorization = 'Basic ' + Buffer.from('merchant:' + password).toString('base64');
  const admin = () => fetch(base + '/admin/orders', { headers: { authorization } }).then(response => response.text());
  const fulfil = token => fetch(base + '/admin' + path + '/fulfil', {
    method: 'POST', redirect: 'manual', headers: { authorization },
    body: new URLSearchParams({ token }),
  });
  assert.match(await admin(), /Awaiting payment/);
  const orderId = path.split('/').at(-1);
  const validToken = createHmac('sha256', password).update('fulfil:' + orderId).digest('hex');
  assert.equal((await fulfil(validToken)).status, 409);
  const returned = await fetch(base + path + '?paymentIntentId=payment-test&status=succeeded');
  assert.equal(returned.status, 200);
  assert.match(await returned.text(), /Awaiting payment/);
  const body = JSON.stringify({ id: intent.id, amount: intent.amount, txRef, status: 'succeeded' });
  const sendWebhook = signature => fetch(base + '/webhooks/ezpayz', {
    method: 'POST', body, headers: {
      'X-Whitechain-Event': 'payment.succeeded', 'X-Whitechain-Signature': signature,
    },
  });
  assert.equal((await sendWebhook('0'.repeat(64))).status, 401);
  const signature = createHmac('sha256', webhookSecret).update(body).digest('hex');
  assert.equal((await sendWebhook(signature)).status, 503);
  intent = { ...intent, status: 'succeeded', txRef, receivedAmount: intent.amount };
  assert.equal((await sendWebhook(signature)).status, 204);
  assert.equal((await sendWebhook(signature)).status, 204);
  const paid = await admin();
  assert.match(paid, /Paid/);
  const token = paid.match(/name="token" value="([a-f0-9]+)"/)?.[1];
  assert.ok(token);
  assert.equal((await fulfil('invalid')).status, 403);
  assert.equal((await fulfil(token)).status, 303);
  assert.match(await admin(), /Fulfilled/);
  assert.equal((await sendWebhook(signature)).status, 204);
  assert.match(await admin(), /Fulfilled/);

  const nextOrder = await fetch(base + '/orders', {
    method: 'POST', redirect: 'manual', body: new URLSearchParams({ tea: '1' }),
  });
  const nextPath = nextOrder.headers.get('location');
  const nextCheckout = await fetch(base + nextPath + '/checkout', { method: 'POST', redirect: 'manual' });
  assert.equal(nextCheckout.status, 303);
  intent = { ...intent, status: 'succeeded', txRef: '0x' + 'cd'.repeat(32), receivedAmount: intent.amount };
  assert.equal((await fetch(base + nextPath + '/refresh', { method: 'POST', redirect: 'manual' })).status, 303);
  assert.match(await (await fetch(base + nextPath)).text(), /· Paid/);
});
