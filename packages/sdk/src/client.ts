/**
 * @ezpayz/sdk — server client.
 * Authenticated with the merchant's secret API key (Bearer). Methods mirror the REST API.
 *
 * Amounts are human-readable decimal strings at the public API (e.g. "10.00" for 10 USDT).
 * The gateway converts to base units (USDT 6 decimals) internally; the SDK passes the
 * human-readable string as-is to the API. PRD §7.2, §17.6.
 */
export class WhitechainClient {
  constructor(private secretKey: string, private apiUrl: string) {}

  private headers(idempotencyKey?: string): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.secretKey}`,
    };
    if (idempotencyKey) h["Idempotency-Key"] = idempotencyKey;
    return h;
  }

  private async request(path: string, init?: RequestInit) {
    const res = await fetch(`${this.apiUrl}${path}`, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new WhitechainError(body?.error?.code ?? "request_failed", body?.error?.message ?? `HTTP ${res.status}`, res.status);
    }
    return body;
  }

  paymentIntents = {
    create: (opts: { amount: string; description: string; customerEmail?: string; successUrl?: string; cancelUrl?: string; metadata?: Record<string, string>; idempotencyKey?: string }) =>
      this.request("/v1/payment-intents", {
        method: "POST",
        headers: this.headers(opts.idempotencyKey ?? `auto-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
        body: JSON.stringify({
          amount: opts.amount,
          description: opts.description,
          customerEmail: opts.customerEmail,
          successUrl: opts.successUrl,
          cancelUrl: opts.cancelUrl,
          metadata: opts.metadata,
        }),
      }),
    get: (id: string) => this.request(`/v1/payment-intents/${id}`, { headers: this.headers() }),
  };

  paymentLinks = {
    create: (opts: { title: string; linkType?: "fixed" | "customer_amount" | "reusable"; amount?: string }) =>
      this.request("/v1/payment-links", {
        method: "POST",
        headers: this.headers(`pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        body: JSON.stringify({ title: opts.title, linkType: opts.linkType ?? "fixed", amount: opts.amount }),
      }),
    list: () => this.request("/v1/payment-links", { headers: this.headers() }),
  };

  invoices = {
    create: (opts: { customerEmail: string; title: string; lineItems: { description: string; quantity: number; unitPrice: string }[] }) =>
      this.request("/v1/invoices", { method: "POST", headers: this.headers(`inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`), body: JSON.stringify(opts) }),
    get: (id: string) => this.request(`/v1/invoices/${id}`, { headers: this.headers() }),
  };

  refunds = {
    create: (opts: { paymentId: string; amount: string; reason?: string; idempotencyKey?: string }) =>
      this.request("/v1/refunds", {
        method: "POST",
        headers: this.headers(opts.idempotencyKey ?? `rf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        body: JSON.stringify({ paymentId: opts.paymentId, amount: opts.amount, reason: opts.reason ?? "" }),
      }),
    get: (id: string) => this.request(`/v1/refunds/${id}`, { headers: this.headers() }),
  };

  subscriptions = {
    create: (opts: { onChainSubscriptionId: string; planId: string; payerWallet: string }) =>
      this.request("/v1/subscriptions", { method: "POST", headers: this.headers(`sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`), body: JSON.stringify(opts) }),
    get: (id: string) => this.request(`/v1/subscriptions/${id}`, { headers: this.headers() }),
    checkout: (opts: { planId: string }) =>
      this.request("/v1/subscriptions/checkout", { method: "POST", headers: this.headers(`sc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`), body: JSON.stringify({ planId: opts.planId }) }),
  };

  analytics = {
    overview: () => this.request("/v1/analytics/overview", { headers: this.headers() }),
  };

  customers = {
    create: (opts: { email: string; name?: string }) =>
      this.request("/v1/customers", { method: "POST", headers: { ...this.headers(), "Content-Type": "application/json" }, body: JSON.stringify(opts) }),
    list: () => this.request("/v1/customers?limit=100", { headers: this.headers() }),
    get: (id: string) => this.request(`/v1/customers/${id}`, { headers: this.headers() }),
  };

  webhooks = {
    create: (opts: { url: string; eventTypes: string[]; description?: string }) =>
      this.request("/v1/webhooks", { method: "POST", headers: { ...this.headers("wh-" + Date.now()), "Content-Type": "application/json" }, body: JSON.stringify(opts) }),
    list: () => this.request("/v1/webhooks?limit=100", { headers: this.headers() }),
    events: () => this.request("/v1/webhooks/events?limit=100", { headers: this.headers() }),
    replay: (eventId: string) => this.request(`/v1/webhooks/events/${eventId}/replay`, { method: "POST", headers: this.headers() }),
  };

  apiKeys = {
    create: (opts: { name: string; environment?: string }) =>
      this.request("/v1/api-keys", { method: "POST", headers: { ...this.headers("ak-" + Date.now()), "Content-Type": "application/json" }, body: JSON.stringify({ name: opts.name, environment: opts.environment ?? "testnet" }) }),
    list: () => this.request("/v1/api-keys", { headers: this.headers() }),
    revoke: (id: string) => this.request(`/v1/api-keys/${id}/revoke`, { method: "POST", headers: this.headers() }),
  };

  plans = {
    create: (opts: { name: string; amount: string; interval?: string; maxChargePerCycle: string; cumulativeLimit: string; description?: string }) =>
      this.request("/v1/plans", { method: "POST", headers: { ...this.headers("pl-" + Date.now()), "Content-Type": "application/json" }, body: JSON.stringify({ ...opts, interval: opts.interval ?? "monthly" }) }),
    list: () => this.request("/v1/plans?limit=100", { headers: this.headers() }),
  };

  products = {
    create: (opts: { name: string; description?: string; price: string; billingMode?: string; unitLabel?: string; unitPrice?: string }) =>
      this.request("/v1/products", { method: "POST", headers: { ...this.headers("prd-" + Date.now()), "Content-Type": "application/json" }, body: JSON.stringify(opts) }),
    list: () => this.request("/v1/products?limit=100", { headers: this.headers() }),
    get: (id: string) => this.request(`/v1/products/${id}`, { headers: this.headers() }),
    update: (id: string, opts: Record<string, unknown>) =>
      this.request(`/v1/products/${id}`, { method: "PATCH", headers: { ...this.headers(), "Content-Type": "application/json" }, body: JSON.stringify(opts) }),
    delete: (id: string) => this.request(`/v1/products/${id}`, { method: "DELETE", headers: this.headers() }),
  };

  usage = {
    record: (opts: { subscriptionId: string; units: number; reference: string }) =>
      this.request("/v1/usage", { method: "POST", headers: { ...this.headers("usg-" + Date.now()), "Content-Type": "application/json" }, body: JSON.stringify(opts) }),
  };
}

export class WhitechainError extends Error {
  constructor(readonly code: string, message: string, readonly statusCode: number) {
    super(message);
    this.name = "WhitechainError";
  }
}
