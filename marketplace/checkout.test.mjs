import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { createCheckout } from './checkout.mjs';

const order = { id: 'ac7dc208-8686-458a-9119-f840e0acc1e8', total: '9007199254740993' };
const paymentId = 'clcrls5ta0001tq0cv8xvpr91';
const slug = 'ck_abc123456789abcd';
const secretKey = 'sk_test_private_merchant_key';
const checkoutOrigin = 'https://checkout.example.test';
const returnOrigin = 'https://market.example.test';
const hostedCheckout = { paymentId, checkoutUrl: 'https://checkout.example.test/real-checkout/ck_abc123456789abcd' };

async function startGateway(t, respond) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    requests.push({
      path: request.url,
      method: request.method,
      headers: request.headers,
      body: rawBody ? JSON.parse(rawBody) : null,
    });
    respond(request, response);
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const apiUrl = `http://127.0.0.1:${server.address().port}`;
  return { requests, config: { apiUrl, checkoutOrigin, secretKey, returnOrigin } };
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

test('creates a hosted payment with the exact amount and server-generated order references', async t => {
  const { config, requests } = await startGateway(t, (_, response) => {
    json(response, 201, {
      id: paymentId, checkoutSlug: slug, amountBaseUnits: order.total,
      clientSecret: 'cs_session_token', checkoutUrl: '/checkout/' + slug, amount: '9007199254.740993',
    });
  });

  assert.deepEqual(await createCheckout(config, order), hostedCheckout);
  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.path, '/v1/payment-intents');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.authorization, 'Bearer ' + secretKey);
  assert.equal(request.headers['idempotency-key'], order.id);
  assert.equal(request.headers['content-type'], 'application/json');
  assert.equal(request.body.amount, '9007199254.740993');
  assert.ok(request.body.description.length > 0);
  assert.deepEqual(request.body.metadata, { orderId: order.id });
  assert.equal(request.body.successUrl, 'https://market.example.test/orders/ac7dc208-8686-458a-9119-f840e0acc1e8');
  assert.equal(request.body.cancelUrl, request.body.successUrl);
});

test('recovers the checkout slug from the matching authenticated payment detail on replay', async t => {
  const { config, requests } = await startGateway(t, (request, response) => {
    if (request.method === 'POST') {
      json(response, 200, { idempotentReplay: true, resourceType: 'payment_intent', resourceId: paymentId });
    } else {
      json(response, 200, {
        paymentIntent: { id: paymentId, amount: order.total, metadataJson: { orderId: order.id }, checkoutUrl: '/checkout/' + slug },
      });
    }
  });

  assert.deepEqual(await createCheckout(config, order), hostedCheckout);
  assert.deepEqual(requests.map(({ method, path }) => [method, path]), [
    ['POST', '/v1/payment-intents'], ['GET', '/v1/payment-intents/' + paymentId],
  ]);
  assert.equal(requests[1].headers.authorization, 'Bearer ' + secretKey);
});

test('fails closed on invalid gateway responses', async t => {
  const intent = { id: paymentId, amount: order.total, metadataJson: { orderId: order.id }, checkoutUrl: '/checkout/' + slug };
  const cases = [
    { name: 'invalid JSON', create: (response) => response.end('invalid JSON') },
    { name: 'invalid fresh slug', create: { id: paymentId, checkoutSlug: '../../elsewhere', amountBaseUnits: order.total } },
    { name: 'invalid fresh amount', create: { id: paymentId, checkoutSlug: slug, amountBaseUnits: '1' } },
    { name: 'external replay URL', detail: { ...intent, checkoutUrl: 'https://other.example.test/checkout/' + slug } },
    { name: 'missing replay slug', detail: { ...intent, checkoutUrl: '' } },
    { name: 'undocumented replay slug cannot replace stored path', detail: { ...intent, checkoutUrl: '', checkoutSlug: slug } },
    { name: 'different replay amount', detail: { ...intent, amount: '1' } },
    { name: 'different replay order', detail: { ...intent, metadataJson: { orderId: 'unrelated-order' } } },
  ];

  for (const { name, create, detail } of cases) {
    await t.test(name, async subtest => {
      const { config } = await startGateway(subtest, (request, response) => {
        if (typeof create === 'function') create(response);
        else if (create) json(response, 201, create);
        else if (request.method === 'POST') {
          json(response, 200, { idempotentReplay: true, resourceType: 'payment_intent', resourceId: paymentId });
        } else {
          json(response, 200, { paymentIntent: detail });
        }
      });
      await assert.rejects(createCheckout(config, order), /EzPayz checkout request failed/);
    });
  }
});

test('does not expose gateway errors or follow gateway redirects with merchant credentials', async t => {
  const { config, requests } = await startGateway(t, (request, response) => {
    if (request.url === '/v1/payment-intents') response.writeHead(307, { Location: '/reflected-key' });
    else response.writeHead(401);
    response.end(secretKey);
  });

  await assert.rejects(createCheckout(config, order), { message: 'EzPayz checkout request failed' });
  assert.equal(requests.length, 1);
});

test('aborts a stalled response body and returns a safe error', async t => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, 'timeout', () => timeout(150));
  const { config, requests } = await startGateway(t, (_, response) => {
    response.writeHead(201, { 'Content-Type': 'application/json' });
    response.write('{');
  });

  await assert.rejects(createCheckout(config, order), { message: 'EzPayz checkout request failed' });
  assert.equal(requests.length, 1);
});
