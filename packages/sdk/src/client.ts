/**
 * @whitechain-pay/sdk — server client.
 * Authenticated with the merchant's secret API key (Bearer). Methods mirror the REST API.
 * PRD §17.4, §17.6.
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
    create: (opts: { amount: string; description: string; customerEmail?: string; idempotencyKey?: string }) =>
      this.request("/v1/payment-intents", {
        method: "POST",
        headers: this.headers(opts.idempotencyKey),
        body: JSON.stringify({ amount: opts.amount, description: opts.description, customerEmail: opts.customerEmail }),
      }),
    get: (id: string) => this.request(`/v1/payment-intents/${id}`, { headers: this.headers() }),
  };

  paymentLinks = {
    create: (opts: { title: string; linkType?: "fixed" | "customer_amount" | "reusable"; amount?: string }) =>
      this.request("/v1/payment-links", {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ title: opts.title, linkType: opts.linkType ?? "fixed", amount: opts.amount }),
      }),
    list: () => this.request("/v1/payment-links", { headers: this.headers() }),
  };

  invoices = {
    create: (opts: { customerEmail: string; title: string; lineItems: { description: string; quantity: number; unitPrice: string }[] }) =>
      this.request("/v1/invoices", { method: "POST", headers: this.headers(), body: JSON.stringify(opts) }),
    get: (id: string) => this.request(`/v1/invoices/${id}`, { headers: this.headers() }),
  };

  refunds = {
    create: (opts: { paymentId: string; amount: string; reason?: string; idempotencyKey?: string }) =>
      this.request("/v1/refunds", {
        method: "POST",
        headers: this.headers(opts.idempotencyKey),
        body: JSON.stringify({ paymentId: opts.paymentId, amount: opts.amount, reason: opts.reason ?? "" }),
      }),
    get: (id: string) => this.request(`/v1/refunds/${id}`, { headers: this.headers() }),
  };

  subscriptions = {
    create: (opts: { onChainSubscriptionId: string; planId: string; payerWallet: string }) =>
      this.request("/v1/subscriptions", { method: "POST", headers: this.headers(), body: JSON.stringify(opts) }),
    get: (id: string) => this.request(`/v1/subscriptions/${id}`, { headers: this.headers() }),
  };

  analytics = {
    overview: () => this.request("/v1/analytics/overview", { headers: this.headers() }),
  };
}

export class WhitechainError extends Error {
  constructor(readonly code: string, message: string, readonly statusCode: number) {
    super(message);
    this.name = "WhitechainError";
  }
}
