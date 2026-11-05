import { apiFetch, API_URL } from "./http";

/**
 * Real HTTP adapter — implements the same interface as the mock adapter but calls
 * the live gateway API. Used when DEMO.demoMode is false (or forced via the swap
 * in services/index.ts).
 *
 * Auth: the dashboard stores the JWT from /v1/auth/login in localStorage. This
 * adapter reads it and sends it as a Bearer header on every request.
 */

function getToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem("wcp_token") ?? undefined;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Fetches a paginated list from the API. Returns all items (auto-fetches all pages). */
async function fetchAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 50; i++) {
    const query = cursor ? `?cursor=${cursor}&limit=100` : `?limit=100`;
    const res = await apiFetch<{ data: T[]; hasMore: boolean; nextCursor: string | null } & Record<string, T[]>>(
      `${path}${query}`,
      { headers: authHeaders() }
    );
    // Handle varying response shapes (paymentIntents, refunds, etc.)
    const batch = (res.data ?? res.paymentIntents ?? res.refunds ?? res.invoices ?? res.subscriptions ?? res.plans ?? res.paymentLinks ?? res.customers ?? res.endpoints ?? res.events ?? res.exceptions ?? res.orders ?? []) as T[];
    items.push(...batch);
    if (!res.hasMore || !res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return items;
}

export const realApi = {
  async getMerchant() {
    const res = await apiFetch<{ merchant: Record<string, unknown> }>(`/v1/merchants/me`, { headers: authHeaders() });
    return res.merchant;
  },

  async updateMerchant(patch: Record<string, unknown>) {
    return apiFetch<{ merchant: Record<string, unknown> }>(`/v1/merchants/me`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  },

  async getPaymentIntents() {
    return fetchAll<Record<string, unknown>>(`/v1/payment-intents`);
  },

  async getPaymentIntent(id: string) {
    return apiFetch<{ paymentIntent: Record<string, unknown> }>(`/v1/payment-intents/${id}`, { headers: authHeaders() });
  },

  async createPaymentIntent(input: { amount: string; description: string; customerEmail?: string; idempotencyKey?: string }) {
    return apiFetch<Record<string, unknown>>(`/v1/payment-intents`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}) },
      body: JSON.stringify({ amount: input.amount, description: input.description, customerEmail: input.customerEmail }),
    });
  },

  async getRefunds() {
    return fetchAll<Record<string, unknown>>(`/v1/refunds`);
  },

  async getRefund(id: string) {
    return apiFetch<{ refund: Record<string, unknown> }>(`/v1/refunds/${id}`, { headers: authHeaders() });
  },

  async createRefund(input: { paymentId: string; amount: string; reason?: string; idempotencyKey?: string }) {
    return apiFetch<Record<string, unknown>>(`/v1/refunds`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}) },
      body: JSON.stringify({ paymentId: input.paymentId, amount: input.amount, reason: input.reason ?? "" }),
    });
  },

  async getInvoices() {
    return fetchAll<Record<string, unknown>>(`/v1/invoices`);
  },

  async createInvoice(input: { customerEmail: string; title: string; description?: string; lineItems: { description: string; quantity: number; unitPrice: string }[] }) {
    return apiFetch<Record<string, unknown>>(`/v1/invoices`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async getPaymentLinks() {
    return fetchAll<Record<string, unknown>>(`/v1/payment-links`);
  },

  async createPaymentLink(input: { title: string; linkType?: string; amount?: string; description?: string }) {
    return apiFetch<Record<string, unknown>>(`/v1/payment-links`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async getPlans() {
    return fetchAll<Record<string, unknown>>(`/v1/plans`);
  },

  async createPlan(input: { name: string; amount: string; interval?: string; maxChargePerCycle: string; cumulativeLimit: string; description?: string }) {
    return apiFetch<Record<string, unknown>>(`/v1/plans`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async getSubscriptions() {
    return fetchAll<Record<string, unknown>>(`/v1/subscriptions`);
  },

  async getCustomers() {
    return fetchAll<Record<string, unknown>>(`/v1/customers`);
  },

  async createCustomer(input: { email: string; name?: string }) {
    return apiFetch<Record<string, unknown>>(`/v1/customers`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async getWebhooks() {
    return fetchAll<Record<string, unknown>>(`/v1/webhooks`);
  },

  async getWebhookEvents() {
    return fetchAll<Record<string, unknown>>(`/v1/webhooks/events`);
  },

  async createWebhook(input: { url: string; eventTypes: string[]; description?: string }) {
    return apiFetch<Record<string, unknown>>(`/v1/webhooks`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async getExceptions() {
    return fetchAll<Record<string, unknown>>(`/v1/exceptions`);
  },

  async getFulfilment() {
    return fetchAll<Record<string, unknown>>(`/v1/fulfilment`);
  },

  async getAnalytics() {
    return apiFetch<Record<string, unknown>>(`/v1/analytics/overview`, { headers: authHeaders() });
  },

  async getApiKeys() {
    const res = await apiFetch<{ apiKeys: Record<string, unknown>[] }>(`/v1/api-keys`, { headers: authHeaders() });
    return res.apiKeys ?? [];
  },

  async createApiKey(input: { name: string }) {
    return apiFetch<Record<string, unknown>>(`/v1/api-keys`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async getWalletChallenge() {
    return apiFetch<{ challenge: string; verificationToken: string; message: string }>(`/v1/merchants/wallet/challenge`, { headers: authHeaders() });
  },

  async verifyWallet(input: { wallet: string; signature: string; challenge: string; verificationToken: string }) {
    return apiFetch<{ verified: boolean; wallet: string }>(`/v1/merchants/wallet/verify`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  receiptUrl(paymentIntentId: string): string {
    return `${API_URL}/v1/payment-intents/${paymentIntentId}/receipt.pdf`;
  },

  // --- Methods with real API endpoints ---

  async cancelSubscription(id: string) {
    return apiFetch(`/v1/subscriptions/${id}/cancel`, { method: "POST", headers: authHeaders() });
  },

  async runRenewal(id: string) {
    return apiFetch(`/v1/subscriptions/${id}/renew-now`, { method: "POST", headers: authHeaders() });
  },

  async createSubscription(input: { onChainSubscriptionId: string; planId: string; payerWallet: string }) {
    return apiFetch(`/v1/subscriptions`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  },

  async createWebhookEndpoint(input: { url: string; eventTypes: string[]; description?: string }) {
    return apiFetch(`/v1/webhooks`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  },

  async retryWebhookEvent(id: string) {
    return apiFetch(`/v1/webhooks/events/${id}/replay`, { method: "POST", headers: authHeaders() });
  },

  async revokeApiKey(id: string) {
    return apiFetch(`/v1/api-keys/${id}/revoke`, { method: "POST", headers: authHeaders() });
  },

  async setPaymentLinkActive(id: string, active: boolean) {
    if (active) throw new Error("Reactivating payment links is not supported via the API. Create a new link.");
    return apiFetch(`/v1/payment-links/${id}/disable`, { method: "POST", headers: authHeaders() });
  },

  async updateFulfilment(id: string, input: { status: string; note?: string; customerVisible?: boolean }) {
    return apiFetch(`/v1/fulfilment/${id}/events`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status: input.status, note: input.note ?? "", customerVisible: input.customerVisible ?? false }),
    });
  },

  async recordUsage(input: { subscriptionId: string; units: number; reference: string }) {
    return apiFetch(`/v1/usage`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input) });
  },

  async verifyWalletOwnership(input: { wallet: string; signature: string; challenge: string; verificationToken: string }) {
    return apiFetch(`/v1/merchants/wallet/verify`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  // --- Simulation-only methods (no real API equivalent — these are backend-internal) ---
  // Stubs return a clear error so pages that call them know to update their UI.

  async authorizePayment() { throw new Error("authorizePayment is a backend operation. The customer authorizes via the checkout widget (/real-checkout/:slug)."); },
  async relayPayment() { throw new Error("relayPayment is a backend operation. The relayer submits automatically after authorization."); },
  async verifyPayment() { throw new Error("verifyPayment is a backend operation. The chain observer verifies automatically."); },
  async cancelPayment() { throw new Error("cancelPayment is not supported. Payment intents expire automatically."); },
  async verifySignedRequest() { throw new Error("PayeeShield verification is performed by the checkout widget automatically."); },
  async approveAllowance() { throw new Error("Allowance approval is performed by the customer on-chain via the subscription checkout widget."); },
  async activateSubscription() { throw new Error("Subscription activation is performed by the customer via the subscription checkout widget."); },
  async revokeAllowance() { throw new Error("Allowance revocation is performed by the customer on-chain (approve(contract, 0))."); },
  async createInvoicePayment() { throw new Error("Invoice payment is initiated by sharing the checkout URL with the customer."); },
  async createProduct() { throw new Error("Products CRUD is not yet implemented in the live API."); },
  async updateProduct() { throw new Error("Products CRUD is not yet implemented in the live API."); },
  async addCustomerNote() { throw new Error("Customer notes are not yet implemented in the live API."); },
  async billUsage() { throw new Error("Usage billing is not yet implemented in the live API."); },
  async runExceptionAction() { throw new Error("Exception actions are not yet implemented in the live API."); },
  async sendTestEvent() { throw new Error("Test webhook events are not yet implemented. Create a payment to trigger real events."); },
  async updateGasGuard() { throw new Error("GasGuard configuration is not yet exposed via the API."); },
  async updateWebhookEndpoint() { throw new Error("Webhook endpoint updates are not yet implemented. Delete and recreate the endpoint."); },
};

export type RealApi = typeof realApi;
