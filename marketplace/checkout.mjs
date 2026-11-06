const paymentIdPattern = /^[a-zA-Z0-9_-]+$/;
const checkoutSlugPattern = /^ck_[a-f0-9]{16}$/;
const storedCheckoutPrefix = '/checkout/';

function httpOrigin(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
  return url.origin;
}

export async function createCheckout({ apiUrl, checkoutOrigin, secretKey, returnOrigin }, { id, total }) {
  try {
    if (typeof id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) ||
        typeof total !== 'string' || !/^\d+$/.test(total) || typeof secretKey !== 'string' || !secretKey.trim()) {
      throw new Error();
    }
    const units = BigInt(total);
    if (units === 0n) throw new Error();
    const baseUnits = units.toString();
    const digits = baseUnits.padStart(7, '0');
    const fraction = digits.slice(-6).replace(/0+$/, '').padEnd(2, '0');
    const amount = digits.slice(0, -6) + '.' + fraction;
    const endpoint = httpOrigin(apiUrl) + '/v1/payment-intents';
    const hostedOrigin = httpOrigin(checkoutOrigin);
    const returnUrl = httpOrigin(returnOrigin) + '/orders/' + id;
    const authorization = 'Bearer ' + secretKey;
    const signal = AbortSignal.timeout(10_000);

    async function request(url, options) {
      const response = await fetch(url, { ...options, redirect: 'error', signal });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error();
      }
      return response.json();
    }

    const payment = await request(endpoint, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json', 'Idempotency-Key': id },
      body: JSON.stringify({
        amount, description: 'Marketplace order ' + id, metadata: { orderId: id },
        successUrl: returnUrl, cancelUrl: returnUrl,
      }),
    });

    const replay = payment?.idempotentReplay === true;
    const paymentId = replay ? payment.resourceId : payment?.id;
    if (typeof paymentId !== 'string' || !paymentIdPattern.test(paymentId) || paymentId.includes(secretKey)) throw new Error();

    let slug = payment.checkoutSlug;
    if (replay) {
      if (payment.resourceType !== 'payment_intent') throw new Error();
      const detail = await request(endpoint + '/' + paymentId, { headers: { Authorization: authorization } });
      const intent = detail?.paymentIntent;
      if (intent?.id !== paymentId || intent.amount !== baseUnits || intent.metadataJson?.orderId !== id) throw new Error();
      slug = intent.checkoutSlug;
      if (slug == null && typeof intent.checkoutUrl === 'string' && intent.checkoutUrl.startsWith(storedCheckoutPrefix)) {
        slug = intent.checkoutUrl.slice(storedCheckoutPrefix.length);
      }
    } else if (payment.amountBaseUnits !== baseUnits) {
      throw new Error();
    }

    if (typeof slug !== 'string' || !checkoutSlugPattern.test(slug)) throw new Error();
    return { paymentId, checkoutUrl: hostedOrigin + '/real-checkout/' + slug };
  } catch {
    throw new Error('EzPayz checkout request failed');
  }
}
