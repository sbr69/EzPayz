import { createHmac, timingSafeEqual } from "node:crypto";

type OrderAmount = {
  id: string;
  total: number;
  customerName?: string | null;
  customerEmail?: string | null;
};

type GatewayIntent = {
  id?: unknown;
  amount?: unknown;
  receivedAmount?: unknown;
  status?: unknown;
  checkoutUrl?: unknown;
  txRef?: unknown;
  metadataJson?: { orderId?: unknown; customerName?: unknown; customerEmail?: unknown };
};

type CheckoutReply = {
  id?: unknown;
  checkoutSlug?: unknown;
  amountBaseUnits?: unknown;
  idempotentReplay?: unknown;
  resourceType?: unknown;
  resourceId?: unknown;
};

function httpOrigin(value: string | undefined) {
  const url = value && URL.parse(value);
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  return url.origin;
}

export function appOrigin() {
  return httpOrigin(process.env.APP_ORIGIN);
}

export function checkoutAvailable() {
  return Boolean(
    process.env.EZPAYZ_SECRET_KEY?.trim() &&
    appOrigin() &&
    httpOrigin(process.env.EZPAYZ_API_URL) &&
    httpOrigin(process.env.EZPAYZ_CHECKOUT_ORIGIN)
  );
}

function paymentIdValid(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !/[^a-zA-Z0-9_-]/.test(value);
}

function checkoutSlugValid(value: unknown): value is string {
  return typeof value === "string" && value.length === 19 && /^ck_[a-f0-9]{16}$/.test(value);
}

export function existingCheckoutUrl(value: string) {
  const origin = httpOrigin(process.env.EZPAYZ_CHECKOUT_ORIGIN);
  if (!origin) return null;
  const canonical = `${origin}/real-checkout/`;
  const legacy = `${origin}/#/real-checkout/`;
  const prefix = value.startsWith(canonical) ? canonical : legacy;
  const slug = value.slice(prefix.length);
  return value.startsWith(prefix) && checkoutSlugValid(slug) ? canonical + slug : null;
}

async function paymentRequest(path: string, signal: AbortSignal, options: RequestInit = {}): Promise<unknown> {
  const origin = httpOrigin(process.env.EZPAYZ_API_URL);
  const key = process.env.EZPAYZ_SECRET_KEY;
  if (!origin || !key?.trim()) throw new Error();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${key}`);
  const response = await fetch(origin + "/v1/payment-intents" + path, {
    ...options,
    headers,
    redirect: "error",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error();
  }
  return response.json();
}

async function paymentDetail(paymentId: string, signal: AbortSignal) {
  const detail = (await paymentRequest("/" + paymentId, signal)) as { paymentIntent?: GatewayIntent } | null;
  return detail?.paymentIntent;
}

function matchesOrder(intent: GatewayIntent | undefined, order: OrderAmount, paymentId: string) {
  return intent?.id === paymentId && intent.amount === String(order.total) && intent.metadataJson?.orderId === order.id;
}

export async function createCheckout(order: OrderAmount) {
  try {
    const origin = appOrigin();
    const hosted = httpOrigin(process.env.EZPAYZ_CHECKOUT_ORIGIN);
    const { id, total } = order;
    if (!origin || !hosted || !Number.isSafeInteger(total) || total <= 0) throw new Error();
    const units = String(total).padStart(7, "0");
    const fraction = units.slice(-6).replace(/0+$/, "").padEnd(2, "0");
    const amount = units.slice(0, -6) + "." + fraction;
    const returnUrl = `${origin}/orders/${id}`;
    const signal = AbortSignal.timeout(10_000);

    const metadata: Record<string, unknown> = { orderId: id };
    if (order.customerName) metadata.customerName = order.customerName;
    if (order.customerEmail) metadata.customerEmail = order.customerEmail;

    const payment = (await paymentRequest("", signal, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": id },
      body: JSON.stringify({
        amount,
        description: `Marketplace order ${id}`,
        metadata,
        successUrl: returnUrl,
        cancelUrl: returnUrl,
      }),
    })) as CheckoutReply | null;

    const replay = payment?.idempotentReplay === true;
    const paymentId = replay ? payment.resourceId : payment?.id;
    const secret = process.env.EZPAYZ_SECRET_KEY;
    if (!paymentIdValid(paymentId) || (secret && paymentId.includes(secret))) throw new Error();

    let slug = payment?.checkoutSlug;
    if (replay) {
      if (payment.resourceType !== "payment_intent") throw new Error();
      const intent = await paymentDetail(paymentId, signal);
      const path = intent?.checkoutUrl;
      if (!matchesOrder(intent, order, paymentId) || typeof path !== "string" || !path.startsWith("/checkout/")) {
        throw new Error();
      }
      slug = path.slice("/checkout/".length);
    } else if (payment?.amountBaseUnits !== String(total)) {
      throw new Error();
    }

    if (!checkoutSlugValid(slug)) throw new Error();
    return { paymentId, checkoutUrl: `${hosted}/real-checkout/${slug}` };
  } catch {
    throw new Error("EzPayz checkout request failed");
  }
}

export async function verifySettlement(order: OrderAmount & { paymentId: string }) {
  if (!paymentIdValid(order.paymentId)) return null;
  try {
    const intent = await paymentDetail(order.paymentId, AbortSignal.timeout(5_000));
    if (
      !matchesOrder(intent, order, order.paymentId) ||
      intent?.status !== "succeeded" ||
      intent.receivedAmount !== String(order.total)
    )
      return null;

    const { txRef } = intent;
    return typeof txRef === "string" && txRef.length === 66 && /^0x[\da-f]{64}$/i.test(txRef) ? txRef : null;
  } catch {
    return null;
  }
}

export function verifyPaymentWebhook(body: Buffer, signature: string | null, event: string | null) {
  const secret = process.env.EZPAYZ_WEBHOOK_SECRET;
  if (event !== "payment.succeeded" || !secret || signature?.length !== 64 || !/^[\da-f]{64}$/i.test(signature)) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(body).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return null;

  try {
    const payload = JSON.parse(body.toString("utf8"));
    return payload?.status === "succeeded" && paymentIdValid(payload.id) ? payload.id : null;
  } catch {
    return null;
  }
}
