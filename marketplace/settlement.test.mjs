import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';

const txRef = '0x' + 'a1'.repeat(32);
const order = { id: 'order-1', total: '9000000', paymentId: 'payment-1' };
const secret = 'whsec_test';
const secretKey = 'sk_test';
const sign = body => createHmac('sha256', secret).update(body).digest('hex');

test('payment webhook authenticates the original bytes and the signed succeeded status', async () => {
  const { verifyPaymentWebhook } = await import('./settlement.mjs');
  const body = Buffer.from(`{ "id": "payment-1", "amount": "9000000", "txRef": "${txRef}", "status": "succeeded" }`);
  const delivery = { secret, body, signature: sign(body), event: 'payment.succeeded' };
  assert.equal(verifyPaymentWebhook(delivery), 'payment-1');
  assert.equal(verifyPaymentWebhook({ ...delivery, body: JSON.stringify(JSON.parse(body)) }), null);
  assert.equal(verifyPaymentWebhook({ ...delivery, signature: '0'.repeat(64) }), null);
  assert.equal(verifyPaymentWebhook({ ...delivery, signature: delivery.signature + '\n' }), null);
  assert.equal(verifyPaymentWebhook({ ...delivery, signature: 'bad' }), null);
  assert.equal(verifyPaymentWebhook({ ...delivery, event: 'payment.failed' }), null);
  assert.equal(verifyPaymentWebhook({ ...delivery, secret: '' }), null);

  for (const invalidBody of ['{"id":"payment-1","status":"failed"}', '{"status":"succeeded"}', 'null', '{']) {
    assert.equal(verifyPaymentWebhook({ ...delivery, body: invalidBody, signature: sign(invalidBody) }), null);
  }
});

test('settlement requires an authenticated detail matching the stored order', async t => {
  const { verifySettlement } = await import('./settlement.mjs');
  const intent = {
    id: 'payment-1', status: 'succeeded', amount: '9000000', receivedAmount: '9000000', txRef,
    metadataJson: { orderId: 'order-1' },
  };
  let payload = { paymentIntent: intent, displayAmount: '9.00', displayRefundedAmount: '0.00' };
  let status = 200;
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/v1/payment-intents/payment-1' ||
        request.headers.authorization !== 'Bearer sk_test') {
      response.writeHead(401).end();
      return;
    }
    response.writeHead(status, { 'Content-Type': 'application/json', Location: '/v1/payment-intents/payment-1' });
    response.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
  }).listen(0, '127.0.0.1');
  t.after(() => {
    const closed = once(server, 'close');
    server.close();
    server.closeAllConnections();
    return closed;
  });
  await once(server, 'listening');
  const config = { apiUrl: `http://127.0.0.1:${server.address().port}/`, secretKey };
  assert.equal(await verifySettlement(config, order), txRef);
  assert.equal(await verifySettlement({ ...config, apiUrl: config.apiUrl + 'v1?mode=test#status' }, order), txRef);

  for (const [field, value] of Object.entries({
    id: 'payment-2', status: 'submitted', amount: '8999999', receivedAmount: '9000001',
    txRef: txRef + '\n', metadataJson: { orderId: 'order-2' },
  })) {
    payload = { ...payload, paymentIntent: { ...intent, [field]: value } };
    assert.equal(await verifySettlement(config, order), null, field);
  }
  payload = { paymentIntent: { ...intent, receivedAmount: null } };
  assert.equal(await verifySettlement(config, order), null);
  payload = '{';
  assert.equal(await verifySettlement(config, order), null);
  payload = { paymentIntent: intent };
  status = 503;
  assert.equal(await verifySettlement(config, order), null);
});
