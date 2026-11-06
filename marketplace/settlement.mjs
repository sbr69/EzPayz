import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyPaymentWebhook({ secret, body, signature, event }) {
  if (event !== 'payment.succeeded' || typeof secret !== 'string' || !secret ||
      (typeof body !== 'string' && !Buffer.isBuffer(body)) ||
      typeof signature !== 'string' || signature.length !== 64 || !/^[\da-f]{64}$/i.test(signature)) {
    return null;
  }

  const expected = createHmac('sha256', secret).update(body).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return null;

  try {
    const payload = JSON.parse(body);
    return payload?.status === 'succeeded' && typeof payload.id === 'string' && payload.id ? payload.id : null;
  } catch {
    return null;
  }
}

export async function verifySettlement({ apiUrl, secretKey }, { id, total, paymentId }) {
  if (typeof id !== 'string' || !id || typeof total !== 'string' || !total ||
      typeof paymentId !== 'string' || !paymentId || typeof secretKey !== 'string' || !secretKey) {
    return null;
  }

  try {
    const url = new URL('/v1/payment-intents/' + encodeURIComponent(paymentId), apiUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${secretKey}` },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;

    const { paymentIntent } = await response.json();
    if (paymentIntent?.id !== paymentId || paymentIntent.status !== 'succeeded' ||
        paymentIntent.metadataJson?.orderId !== id || paymentIntent.amount !== total ||
        paymentIntent.receivedAmount !== total) {
      return null;
    }
    const { txRef } = paymentIntent;
    return typeof txRef === 'string' && txRef.length === 66 && /^0x[\da-f]{64}$/i.test(txRef) ? txRef : null;
  } catch {
    return null;
  }
}
