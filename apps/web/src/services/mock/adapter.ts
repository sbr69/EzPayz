import { DEFAULT_NETWORK, DEMO, TOKEN } from "@/config/app";
import { addBase, cmpBase, demoAuthRef, demoTxRef, mulBaseInt, shortId, sleep, subBase } from "@/lib/money";
import { useDemo } from "@/store/demoStore";
import type {
  BaseAmount,
  Customer,
  ExceptionActionId,
  FulfilmentOrder,
  FulfilmentStatus,
  Invoice,
  InvoiceLineItem,
  Payment,
  PaymentException,
  PaymentLink,
  Product,
  Refund,
  Subscription,
  SubscriptionPlan,
  UsageRecord,
} from "@/types";

const S = () => useDemo.getState();
const nowIso = () => new Date().toISOString();
const ahead = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export function hostedUrl(fragment: string): string {
  if (typeof window === "undefined") return `https://checkout.whitepay-gateway.example/${fragment}`;
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/${fragment}`;
}

function digestOf(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `sig_${h.toString(16).padStart(8, "0")}${((h >>> 5) % 0xfffff).toString(16)}`;
}

function payeeShieldFor(invoiceId: string, recipient: string, amount: BaseAmount, expiry: string) {
  return {
    status: "verified" as const,
    signingKeyId: "gwk_2F91A",
    signingKeyStatus: "active" as const,
    signatureTimestamp: nowIso(),
    verifiedAt: nowIso(),
    digest: digestOf(`${invoiceId}${recipient}${amount}${expiry}`),
    protectedFields: {
      invoiceId,
      recipient,
      amount,
      token: TOKEN.symbol,
      network: DEFAULT_NETWORK.name,
      expiry,
      nonce: `n_${Math.random().toString(36).slice(2, 10)}`,
    },
    failedField: null,
  };
}

function emitWebhook(
  type: string,
  data: { paymentId?: string | null; subscriptionId?: string | null },
  opts: { fail?: boolean } = {},
) {
  const state = S();
  const endpoint = state.data.webhookEndpoints.find((e) => e.active) ?? state.data.webhookEndpoints[0];
  if (!endpoint) return;
  const id = shortId("evt", 8);
  state.add("webhookEvents", {
    id,
    merchantId: state.data.merchant.id,
    type,
    endpointId: endpoint.id,
    payloadSummary: "Gateway state change event (demo payload).",
    responseStatus: opts.fail ? 500 : 200,
    attempts: opts.fail ? 3 : 1,
    status: opts.fail ? "failed" : "delivered",
    createdAt: nowIso(),
    lastAttemptAt: nowIso(),
    nextRetryAt: opts.fail ? ahead(0.5) : null,
    relatedPaymentId: data.paymentId ?? null,
    relatedSubscriptionId: data.subscriptionId ?? null,
    payload: {
      id,
      type,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      demo: true,
      data: { object: { ...data } },
    },
  });
}

function addRelayer(
  operation: "payment.relay" | "refund.relay" | "subscription.renewal" | "subscription.activation",
  paymentId: string | null,
  opts: { fail?: boolean; reason?: string } = {},
) {
  const state = S();
  const gas = 62000 + Math.floor(Math.random() * 60000);
  state.add("relayer", {
    id: shortId("rlx", 6),
    merchantId: state.data.merchant.id,
    operation,
    gasSponsored: String(gas),
    wbtCost: (0.0002 + Math.random() * 0.0007).toFixed(6),
    status: opts.fail ? "rejected" : "confirmed",
    createdAt: nowIso(),
    txRef: demoTxRef(),
    paymentId,
    rejectionReason: opts.reason ?? null,
  });
  const spent = Number((state.data.gasGuard.merchantSpentWbt + 0.0005).toFixed(6));
  state.patchGasGuard({ merchantSpentWbt: spent, dailySpentWbt: Number((state.data.gasGuard.dailySpentWbt + 0.0005).toFixed(6)) });
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export interface CreatePaymentInput {
  amount: BaseAmount;
  description: string;
  customerId?: string | null;
  customerEmail?: string | null;
  kind?: Payment["kind"];
  expiresInHours?: number;
  invoiceId?: string | null;
  paymentLinkId?: string | null;
  productId?: string | null;
  payerWallet?: string | null;
}

export interface CreateRefundInput {
  paymentId: string;
  amount: BaseAmount;
  reason: string;
  gasSponsored?: boolean;
}

export interface CreatePlanInput {
  name: string;
  description: string;
  amount: BaseAmount;
  billingMode: "fixed" | "usage";
  unitLabel?: string;
  unitPrice?: BaseAmount;
  interval: "hourly" | "daily" | "monthly";
  maxChargePerCycle: BaseAmount;
  /** Required bounded total — unbounded allowances are prohibited (PRD §11.2). */
  cumulativeLimit: BaseAmount;
  planExpiryMonths: number | null;
  retryPolicy: SubscriptionPlan["retryPolicy"];
  notifyCustomer: boolean;
}

export interface CreateInvoiceInput {
  customerId: string | null;
  customerEmail: string;
  title: string;
  description: string;
  lineItems: InvoiceLineItem[];
  orderReference: string | null;
  expiresInHours: number;
}

export interface CreateLinkInput {
  title: string;
  description: string;
  linkType: PaymentLink["linkType"];
  amount: BaseAmount | null;
  minAmount: BaseAmount | null;
  maxAmount: BaseAmount | null;
  productId: string | null;
  reference: string | null;
  returnUrl: string | null;
  expiresInHours: number | null;
}

export type PayeeShieldMutation =
  | { field: "recipient"; value: string }
  | { field: "amount"; value: BaseAmount }
  | { field: "token"; value: string }
  | { field: "network"; value: string }
  | { field: "expiry"; value: string };

/* ------------------------------------------------------------------ */
/* Mock API                                                            */
/* ------------------------------------------------------------------ */

export const mockApi = {
  /* ---------------- payments ---------------- */

  async createPaymentIntent(input: CreatePaymentInput): Promise<Payment> {
    await sleep(DEMO.delays.medium);
    const state = S();
    const id = shortId("pay", 8);
    const expiresAt = ahead(input.expiresInHours ?? 24);
    const sessionId = `ses_${id.replace("pay_", "")}`;
    const payment: Payment = {
      id,
      merchantId: state.data.merchant.id,
      customerId: input.customerId ?? null,
      customerEmail: input.customerEmail ?? null,
      description: input.description,
      amount: input.amount,
      receivedAmount: null,
      refundedAmount: "0",
      token: TOKEN.symbol,
      network: DEFAULT_NETWORK.name,
      kind: input.kind ?? "one_time",
      source: input.paymentLinkId
        ? { kind: "payment_link", id: input.paymentLinkId, label: "Payment link" }
        : input.invoiceId
          ? { kind: "invoice", id: input.invoiceId, label: "Invoice" }
          : null,
      payerWallet: input.payerWallet ?? null,
      payoutWallet: state.data.merchant.payoutWallet,
      status: "requires_authorization",
      txRef: null,
      authorizationRef: null,
      gasSponsored: true,
      createdAt: nowIso(),
      settledAt: null,
      expiresAt,
      timeline: [
        {
          status: "created",
          label: "Payment intent created",
          detail: "Demo payment intent created in the mock service layer.",
          at: nowIso(),
          simulated: true,
        },
      ],
      invoiceId: input.invoiceId ?? null,
      paymentLinkId: input.paymentLinkId ?? null,
      subscriptionId: null,
      fulfilmentId: null,
      checkoutUrl: hostedUrl(`checkout/${sessionId}`),
      receiptEmail: "not_applicable",
      payeeShield: payeeShieldFor(input.invoiceId ?? id, state.data.merchant.payoutWallet, input.amount, expiresAt),
      failureReason: null,
    };
    state.add("payments", payment);
    emitWebhook("payment.created", { paymentId: id });
    return payment;
  },

  /** Simulated EIP-3009 authorization. No wallet signature is ever requested. */
  async authorizePayment(id: string, payerWallet: string): Promise<Payment> {
    await sleep(DEMO.delays.slow);
    const state = S();
    const payment = state.data.payments.find((p) => p.id === id);
    if (!payment) throw new Error("Payment not found");
    const ref = demoAuthRef();
    state.patch("payments", id, {
      status: "authorized",
      payerWallet,
      authorizationRef: ref,
      timeline: [
        ...payment.timeline,
        {
          status: "authorized",
          label: "EIP-3009 authorization received",
          detail: `${ref} — simulated signature. No wallet signature was requested.`,
          at: nowIso(),
          simulated: true,
        },
      ],
    });
    // No webhook here: "authorized" is not a catalogue event; the next
    // documented event is payment.processing, emitted at relayer submission.
    return S().data.payments.find((p) => p.id === id)!;
  },

  /** GasGuard validation + relayer submission. */
  async relayPayment(id: string, opts: { fail?: boolean } = {}): Promise<Payment> {
    await sleep(DEMO.delays.slow);
    const state = S();
    const payment = state.data.payments.find((p) => p.id === id);
    if (!payment) throw new Error("Payment not found");
    const guard = state.data.gasGuard;
    if (guard.emergencyPaused) {
      state.patch("payments", id, {
        status: "exception",
        failureReason: "GasGuard relayer is paused by the gateway operator.",
        timeline: [
          ...payment.timeline,
          { status: "exception", label: "Relayer paused", detail: "Emergency pause active.", at: nowIso(), simulated: true },
        ],
      });
      throw new Error("GasGuard relayer is paused. The authorization was not submitted.");
    }
    const txRef = demoTxRef();
    state.patch("payments", id, {
      status: "submitted",
      txRef,
      timeline: [
        ...payment.timeline,
        {
          status: "submitted",
          label: "GasGuard validated, relayer submitted transaction",
          detail: `${txRef} — simulated submission sponsored by the merchant.`,
          at: nowIso(),
          simulated: true,
        },
      ],
    });
    addRelayer("payment.relay", id, { fail: opts.fail });
    emitWebhook("payment.processing", { paymentId: id });
    return S().data.payments.find((p) => p.id === id)!;
  },

  async verifyPayment(
    id: string,
    opts: { outcome?: "succeeded" | "underpaid" | "overpaid" | "failed"; receivedDelta?: BaseAmount } = {},
  ): Promise<Payment> {
    await sleep(DEMO.delays.slow);
    const state = S();
    const payment = state.data.payments.find((p) => p.id === id);
    if (!payment) throw new Error("Payment not found");
    const outcome = opts.outcome ?? "succeeded";
    const received =
      outcome === "underpaid"
        ? subBase(payment.amount, opts.receivedDelta ?? "100000")
        : outcome === "overpaid"
          ? addBase(payment.amount, opts.receivedDelta ?? "100000")
          : payment.amount;
    const status: Payment["status"] =
      outcome === "failed" ? "failed" : outcome === "underpaid" ? "underpaid" : outcome === "overpaid" ? "overpaid" : "succeeded";
    const settledAt = nowIso();
    const txRef = payment.txRef ?? demoTxRef();

    state.patch("payments", id, {
      status,
      receivedAmount: outcome === "succeeded" || outcome === "failed" ? null : received,
      settledAt: outcome === "failed" ? null : settledAt,
      txRef,
      receiptEmail: outcome === "succeeded" ? "queued" : outcome === "failed" ? "not_applicable" : "failed",
      failureReason:
        outcome === "failed"
          ? "Transaction reverted before confirmation (simulated failure)."
          : outcome === "underpaid"
            ? "Received amount is below the requested amount."
            : outcome === "overpaid"
              ? "Received amount exceeds the requested amount."
              : null,
      timeline: [
        ...payment.timeline,
        { status: "pending_confirmation", label: "Pending confirmation", at: nowIso(), simulated: true },
        {
          status,
          label: `Payment ${status.replace(/_/g, " ")}`,
          detail: `${txRef} — simulated settlement reference, not an on-chain confirmation.`,
          at: settledAt,
          simulated: true,
        },
      ],
    });

    if (outcome === "failed") {
      emitWebhook("payment.failed", { paymentId: id });
      S().notify({ title: "Payment failed", body: `${id} could not be confirmed.`, kind: "payment", link: `/payments/${id}` });
      return S().data.payments.find((p) => p.id === id)!;
    }

    emitWebhook(outcome === "succeeded" ? "payment.succeeded" : `payment.${outcome}`, { paymentId: id });

    // Invoice linkage
    const invoice = S().data.invoices.find((i) => i.id === payment.invoiceId);
    if (invoice) {
      S().patch("invoices", invoice.id, {
        status: outcome === "succeeded" ? "paid" : outcome === "overpaid" ? "overpaid" : "partially_paid",
        paidAt: settledAt,
        paymentId: id,
        receiptEmailedAt: settledAt,
      });
    }

    // Payment link accounting
    if (payment.paymentLinkId) {
      const link = S().data.paymentLinks.find((l) => l.id === payment.paymentLinkId);
      if (link) {
        S().patch("paymentLinks", link.id, {
          usageCount: link.usageCount + 1,
          totalCollected: addBase(link.totalCollected, received),
        });
      }
    }

    // Customer last payment
    if (payment.customerId) {
      const customer = S().data.customers.find((c) => c.id === payment.customerId);
      if (customer) S().patch("customers", customer.id, { lastPaymentAt: settledAt });
    }

    if (outcome === "succeeded") {
      S().notify({
        title: "Payment succeeded",
        body: `${payment.description} — settled in demo mode.`,
        kind: "payment",
        link: `/payments/${id}`,
      });
      // Paid receipt email is delivered after settlement.
      await sleep(DEMO.delays.fast);
      S().patch("payments", id, { receiptEmail: "delivered" });
    } else {
      S().notify({
        title: outcome === "underpaid" ? "Payment underpaid" : "Payment overpaid",
        body: `${id} needs review.`,
        kind: "exception",
        link: `/payments/${id}`,
      });
      S().add("exceptions", {
        id: shortId("exc", 6),
        merchantId: S().data.merchant.id,
        type: outcome === "underpaid" ? "underpayment" : "overpayment",
        severity: "high",
        status: "action_required",
        paymentId: id,
        customerId: payment.customerId,
        subscriptionId: null,
        amount: payment.amount,
        webhookEventId: null,
        detectedAt: nowIso(),
        whatHappened:
          outcome === "underpaid"
            ? "The payer sent less than the requested amount."
            : "The payer sent more than the requested amount.",
        whyItHappened: "Amount mismatch detected during settlement verification (demo).",
        suggestedAction: "Create a balance-due request or issue a partial refund.",
        attempts: [],
        recommendedAction: outcome === "underpaid" ? "create_balance_due_request" : "initiate_refund",
      } satisfies PaymentException);
    }

    return S().data.payments.find((p) => p.id === id)!;
  },

  async cancelPayment(id: string): Promise<Payment> {
    await sleep(DEMO.delays.fast);
    const state = S();
    const payment = state.data.payments.find((p) => p.id === id);
    if (!payment) throw new Error("Payment not found");
    state.patch("payments", id, {
      status: "cancelled",
      failureReason: "Cancelled by merchant.",
      timeline: [...payment.timeline, { status: "cancelled", label: "Payment cancelled by merchant", at: nowIso(), simulated: true }],
    });
    emitWebhook("payment.expired", { paymentId: id });
    return S().data.payments.find((p) => p.id === id)!;
  },

  /* ---------------- payeesield ---------------- */

  async verifySignedRequest(
    target: { invoiceId?: string; paymentId?: string },
    mutation?: PayeeShieldMutation,
  ): Promise<{
    status: "verified" | "tampered" | "expired" | "invalid_signature" | "signing_key_revoked" | "verification_pending";
    failedField: string | null;
    digest: string;
  }> {
    await sleep(DEMO.delays.medium);
    const state = S();
    const invoice = target.invoiceId ? state.data.invoices.find((i) => i.id === target.invoiceId) : undefined;
    const payment = target.paymentId ? state.data.payments.find((p) => p.id === target.paymentId) : undefined;
    const record = invoice?.payeeShield ?? payment?.payeeShield ?? null;
    if (!record) {
      return { status: "verification_pending", failedField: null, digest: "—" };
    }
    const base = record.protectedFields;
    if (record.signingKeyStatus === "revoked") {
      return { status: "signing_key_revoked", failedField: "signingKeyId", digest: record.digest };
    }
    if (new Date(base.expiry).getTime() < Date.now()) {
      return { status: "expired", failedField: "expiry", digest: record.digest };
    }
    if (mutation) {
      const expected =
        mutation.field === "recipient"
          ? base.recipient
          : mutation.field === "amount"
            ? base.amount
            : mutation.field === "token"
              ? base.token
              : mutation.field === "network"
                ? base.network
                : base.expiry;
      if (String(mutation.value) !== String(expected)) {
        return { status: "tampered", failedField: mutation.field, digest: record.digest };
      }
    }
    const recomputed = digestOf(
      `${base.invoiceId}${base.recipient}${base.amount}${base.token}${base.network}${base.expiry}${base.nonce}`,
    );
    if (recomputed !== record.digest) {
      return { status: "invalid_signature", failedField: "digest", digest: recomputed };
    }
    return { status: "verified", failedField: null, digest: record.digest };
  },

  /* ---------------- refunds ---------------- */

  async createRefund(input: CreateRefundInput): Promise<Refund> {
    await sleep(DEMO.delays.medium);
    const state = S();
    const payment = state.data.payments.find((p) => p.id === input.paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "succeeded" && payment.status !== "partially_refunded" && payment.status !== "overpaid") {
      throw new Error("Only settled payments can be refunded.");
    }
    const remaining = subBase(payment.amount, payment.refundedAmount);
    if (cmpBase(input.amount, remaining) > 0) {
      throw new Error("Refund exceeds the remaining refundable amount for this payment.");
    }
    if (cmpBase(input.amount, "0") <= 0) throw new Error("Refund amount must be greater than zero.");
    const id = shortId("ref", 6);
    const refund: Refund = {
      id,
      merchantId: state.data.merchant.id,
      paymentId: payment.id,
      customerId: payment.customerId,
      amount: input.amount,
      reason: input.reason,
      status: "awaiting_authorization",
      gasSponsored: input.gasSponsored ?? true,
      authorizationRef: null,
      txRef: null,
      createdAt: nowIso(),
      settledAt: null,
      timeline: [
        {
          status: "created",
          label: "Refund created",
          detail: "A refund is a new USDT transfer from the merchant to the customer. It does not reverse the original transaction.",
          at: nowIso(),
          simulated: true,
        },
      ],
      customerNotified: "queued",
    };
    state.add("refunds", refund);
    emitWebhook("refund.created", { paymentId: payment.id });
    return refund;
  },

  async authorizeRefund(id: string): Promise<Refund> {
    await sleep(DEMO.delays.slow);
    const state = S();
    const refund = state.data.refunds.find((r) => r.id === id);
    if (!refund) throw new Error("Refund not found");
    const ref = demoAuthRef();
    state.patch("refunds", id, {
      status: "authorized",
      authorizationRef: ref,
      timeline: [
        ...refund.timeline,
        {
          status: "authorized",
          label: refund.gasSponsored
            ? "Merchant signed gasless refund authorization"
            : "Merchant selected the merchant-paid gas path",
          detail: refund.gasSponsored
            ? `${ref} — simulated authorization signature. GasGuard sponsors the transfer.`
            : "The merchant submits and pays network gas for this transfer.",
          at: nowIso(),
          simulated: true,
        },
      ],
    });
    return S().data.refunds.find((r) => r.id === id)!;
  },

  async processRefund(id: string): Promise<Refund> {
    await sleep(DEMO.delays.slow);
    const state = S();
    const refund = state.data.refunds.find((r) => r.id === id);
    if (!refund) throw new Error("Refund not found");
    const payment = state.data.payments.find((p) => p.id === refund.paymentId)!;
    const txRef = demoTxRef();
    const settledAt = nowIso();
    state.patch("refunds", id, {
      status: "succeeded",
      txRef,
      settledAt,
      customerNotified: "delivered",
      timeline: [
        ...refund.timeline,
        { status: "submitted", label: "Refund transaction submitted", at: nowIso(), simulated: true },
        { status: "succeeded", label: "Refund settled", detail: `${txRef} — simulated settlement reference.`, at: settledAt, simulated: true },
      ],
    });
    if (refund.gasSponsored) addRelayer("refund.relay", payment.id);
    const refundedAmount = addBase(payment.refundedAmount, refund.amount);
    state.patch("payments", payment.id, {
      refundedAmount,
      status: cmpBase(refundedAmount, payment.amount) >= 0 ? "refunded" : "partially_refunded",
    });
    if (payment.fulfilmentId) {
      S().patch("fulfilment", payment.fulfilmentId, { status: "refunded", updatedAt: settledAt });
    }
    emitWebhook("refund.succeeded", { paymentId: payment.id });
    S().notify({ title: "Refund settled", body: `${refund.id} settled in demo mode.`, kind: "refund", link: `/refunds/${id}` });
    return S().data.refunds.find((r) => r.id === id)!;
  },

  /* ---------------- invoices ---------------- */

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    await sleep(DEMO.delays.medium);
    const state = S();
    const id = shortId("inv", 6);
    const total = input.lineItems.reduce(
      (acc, li) => addBase(acc, mulBaseInt(li.unitPrice, li.quantity)),
      "0" as BaseAmount,
    );
    const expiresAt = ahead(input.expiresInHours);
    const invoice: Invoice = {
      id,
      merchantId: state.data.merchant.id,
      customerId: input.customerId,
      customerEmail: input.customerEmail,
      title: input.title,
      description: input.description,
      lineItems: input.lineItems,
      total,
      status: "open",
      orderReference: input.orderReference,
      createdAt: nowIso(),
      expiresAt,
      paidAt: null,
      paymentId: null,
      payeeShield: payeeShieldFor(id, state.data.merchant.payoutWallet, total, expiresAt),
      receiptEmailedAt: null,
    };
    state.add("invoices", invoice);
    return invoice;
  },

  async createInvoicePayment(invoiceId: string, email?: string | null): Promise<Payment> {
    const state = S();
    const invoice = state.data.invoices.find((i) => i.id === invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    return mockApi.createPaymentIntent({
      amount: invoice.total,
      description: invoice.title,
      customerId: invoice.customerId,
      customerEmail: email ?? invoice.customerEmail,
      kind: "invoice",
      invoiceId: invoice.id,
    });
  },

  /* ---------------- payment links ---------------- */

  async createPaymentLink(input: CreateLinkInput): Promise<PaymentLink> {
    await sleep(DEMO.delays.medium);
    const state = S();
    const slug =
      input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 28) || "link";
    const link: PaymentLink = {
      id: shortId("plk", 6),
      merchantId: state.data.merchant.id,
      slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
      title: input.title,
      description: input.description,
      linkType: input.linkType,
      amount: input.amount,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
      productId: input.productId,
      reference: input.reference,
      returnUrl: input.returnUrl,
      active: true,
      usageCount: 0,
      totalCollected: "0",
      createdAt: nowIso(),
      expiresAt: input.expiresInHours ? ahead(input.expiresInHours) : null,
    };
    state.add("paymentLinks", link);
    return link;
  },

  async setPaymentLinkActive(id: string, active: boolean): Promise<PaymentLink> {
    await sleep(DEMO.delays.fast);
    S().patch("paymentLinks", id, { active });
    return S().data.paymentLinks.find((l) => l.id === id)!;
  },

  /* ---------------- customers & products ---------------- */

  async createCustomer(input: { email: string; name: string; wallet?: string | null }): Promise<Customer> {
    await sleep(DEMO.delays.fast);
    const state = S();
    const customer: Customer = {
      id: shortId("cus", 6),
      merchantId: state.data.merchant.id,
      email: input.email,
      name: input.name,
      wallet: input.wallet ?? null,
      notes: [],
      createdAt: nowIso(),
      lastPaymentAt: null,
    };
    state.add("customers", customer);
    return customer;
  },

  async addCustomerNote(id: string, note: string): Promise<void> {
    await sleep(DEMO.delays.fast);
    const state = S();
    const customer = state.data.customers.find((c) => c.id === id);
    if (!customer) throw new Error("Customer not found");
    state.patch("customers", id, { notes: [...customer.notes, note] });
  },

  async createProduct(input: Omit<Product, "id" | "merchantId" | "createdAt" | "active">): Promise<Product> {
    await sleep(DEMO.delays.medium);
    const state = S();
    const product: Product = {
      ...input,
      id: shortId("prd", 6),
      merchantId: state.data.merchant.id,
      active: true,
      createdAt: nowIso(),
    };
    state.add("products", product);
    return product;
  },

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
    await sleep(DEMO.delays.fast);
    S().patch("products", id, patch);
    return S().data.products.find((p) => p.id === id)!;
  },

  /* ---------------- subscriptions ---------------- */

  async createPlan(input: CreatePlanInput): Promise<SubscriptionPlan> {
    await sleep(DEMO.delays.medium);
    const state = S();
    const plan: SubscriptionPlan = {
      ...input,
      id: shortId("plan", 6),
      merchantId: state.data.merchant.id,
      currency: TOKEN.symbol,
      active: true,
      createdAt: nowIso(),
    };
    state.add("plans", plan);
    return plan;
  },

  async updatePlan(id: string, patch: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    await sleep(DEMO.delays.fast);
    S().patch("plans", id, patch);
    return S().data.plans.find((p) => p.id === id)!;
  },

  async createSubscription(input: { planId: string; customerId: string }): Promise<Subscription> {
    await sleep(DEMO.delays.medium);
    const state = S();
    const plan = state.data.plans.find((p) => p.id === input.planId);
    if (!plan) throw new Error("Plan not found");
    const sub: Subscription = {
      id: shortId("sub", 6),
      merchantId: state.data.merchant.id,
      customerId: input.customerId,
      planId: plan.id,
      status: "pending_authorization",
      amount: plan.amount,
      interval: plan.interval,
      maxChargePerCycle: plan.maxChargePerCycle,
      cumulativeLimit: plan.cumulativeLimit ?? "0",
      spent: "0",
      allowanceRemaining: plan.cumulativeLimit ?? "0",
      nextBillingAt: null,
      createdAt: nowIso(),
      expiresAt: plan.planExpiryMonths ? ahead(24 * 30 * plan.planExpiryMonths) : null,
      cancelledAt: null,
      allowanceRevokedAt: null,
      activationTxRef: null,
      approvalTxRef: null,
      retryPolicy: plan.retryPolicy,
      attempts: [],
      billingHistory: [],
    };
    state.add("subscriptions", sub);
    emitWebhook("subscription.created", { subscriptionId: sub.id });
    return sub;
  },

  /** Step 3-5 of the allowance flow: approve() signed and submitted by the customer. */
  async approveAllowance(id: string): Promise<Subscription> {
    await sleep(DEMO.delays.slow);
    const state = S();
    const sub = state.data.subscriptions.find((s) => s.id === id);
    if (!sub) throw new Error("Subscription not found");
    const approvalTxRef = demoTxRef();
    state.patch("subscriptions", id, {
      status: "pending_activation",
      approvalTxRef,
    });
    S().notify({
      title: "Token allowance approved",
      body: `${sub.id} allowance approved — customer-paid gas (demo).`,
      kind: "subscription",
      link: `/subscriptions/${id}`,
    });
    return S().data.subscriptions.find((s) => s.id === id)!;
  },

  async activateSubscription(id: string): Promise<Subscription> {
    await sleep(DEMO.delays.slow);
    const state = S();
    const sub = state.data.subscriptions.find((s) => s.id === id);
    if (!sub) throw new Error("Subscription not found");
    const activationTxRef = demoTxRef();
    const stepH = sub.interval === "hourly" ? 1 : sub.interval === "daily" ? 24 : 24 * 30;
    state.patch("subscriptions", id, {
      status: "active",
      activationTxRef,
      nextBillingAt: ahead(stepH),
      expiresAt: sub.expiresAt ?? ahead(24 * 30 * 12),
    });
    addRelayer("subscription.activation", null);
    // "subscription.activated" is not a catalogue event; activation is covered
    // by the earlier subscription.created webhook.
    return S().data.subscriptions.find((s) => s.id === id)!;
  },

  async runRenewal(id: string, opts: { fail?: boolean; reason?: string } = {}): Promise<Subscription> {
    await sleep(DEMO.delays.slow);
    const state = S();
    const sub = state.data.subscriptions.find((s) => s.id === id);
    if (!sub) throw new Error("Subscription not found");
    if (sub.status === "cancelled") throw new Error("A cancelled subscription cannot be renewed.");
    const attemptNo = sub.attempts.length + 1;
    const amount = sub.amount;
    const txRef = opts.fail ? null : demoTxRef();

    const paymentId = opts.fail ? null : shortId("pay", 8);
    if (paymentId) {
      const plan = state.data.plans.find((p) => p.id === sub.planId);
      state.add("payments", {
        id: paymentId,
        merchantId: sub.merchantId,
        customerId: sub.customerId,
        customerEmail: null,
        description: `${plan?.name ?? "Subscription"} — ${sub.interval} renewal`,
        amount,
        receivedAmount: null,
        refundedAmount: "0",
        token: TOKEN.symbol,
        network: DEFAULT_NETWORK.name,
        kind: "subscription",
        source: { kind: "subscription", id: sub.id, label: "Subscription" },
        payerWallet: state.data.customers.find((c) => c.id === sub.customerId)?.wallet ?? null,
        payoutWallet: state.data.merchant.payoutWallet,
        status: "succeeded",
        txRef,
        authorizationRef: demoAuthRef(),
        gasSponsored: true,
        createdAt: nowIso(),
        settledAt: nowIso(),
        expiresAt: null,
        timeline: [
          { status: "created", label: "Renewal scheduled by backend scheduler", at: ago(0.1), simulated: true },
          { status: "authorized", label: "Standing authorization applied", at: ago(0.05), simulated: true },
          { status: "submitted", label: "Relayer submitted renewal call", at: nowIso(), simulated: true },
          { status: "succeeded", label: "Renewal settled", detail: `${txRef} — simulated settlement.`, at: nowIso(), simulated: true },
        ],
        invoiceId: null,
        paymentLinkId: null,
        subscriptionId: sub.id,
        fulfilmentId: null,
        checkoutUrl: hostedUrl(`checkout/ses_${paymentId.replace("pay_", "")}`),
        receiptEmail: "delivered",
        payeeShield: null,
        failureReason: null,
      });
      addRelayer("subscription.renewal", paymentId);
      emitWebhook("subscription.renewed", { subscriptionId: sub.id, paymentId });
    } else {
      emitWebhook("subscription.renewal_failed", { subscriptionId: sub.id });
      S().add("exceptions", {
        id: shortId("exc", 6),
        merchantId: sub.merchantId,
        type: opts.reason?.includes("allowance") ? "insufficient_allowance" : "insufficient_subscription_balance",
        severity: "high",
        status: "action_required",
        paymentId: null,
        customerId: sub.customerId,
        subscriptionId: sub.id,
        amount,
        webhookEventId: null,
        detectedAt: nowIso(),
        whatHappened: "A scheduled renewal could not be executed.",
        whyItHappened: opts.reason ?? "Customer wallet held insufficient USDT.",
        suggestedAction: "Notify the customer and retry inside the retry window.",
        attempts: [],
        recommendedAction: "resolve",
      } satisfies PaymentException);
    }

    const stepH = sub.interval === "hourly" ? 1 : sub.interval === "daily" ? 24 : 24 * 30;
    state.patch("subscriptions", id, {
      status: opts.fail ? "past_due" : "active",
      spent: addBase(sub.spent, opts.fail ? "0" : amount),
      allowanceRemaining: opts.fail ? sub.allowanceRemaining : sub.allowanceRemaining,
      nextBillingAt: opts.fail ? ahead(sub.retryPolicy.intervalMinutes / 60) : ahead(stepH),
      attempts: [
        ...sub.attempts,
        {
          id: shortId("att", 6),
          attempt: attemptNo,
          scheduledFor: nowIso(),
          executedAt: nowIso(),
          status: opts.fail ? "failed" : "succeeded",
          amount,
          reason: opts.fail ? (opts.reason ?? "Insufficient USDT balance") : null,
          txRef,
        },
      ],
      billingHistory: opts.fail
        ? sub.billingHistory
        : [
            { paymentId: paymentId!, amount, at: nowIso(), status: "succeeded" },
            ...sub.billingHistory,
          ],
    });
    return S().data.subscriptions.find((s) => s.id === id)!;
  },

  async cancelSubscription(id: string): Promise<Subscription> {
    await sleep(DEMO.delays.slow);
    const state = S();
    const sub = state.data.subscriptions.find((s) => s.id === id);
    if (!sub) throw new Error("Subscription not found");
    state.patch("subscriptions", id, {
      status: "cancelled",
      cancelledAt: nowIso(),
      nextBillingAt: null,
    });
    emitWebhook("subscription.cancelled", { subscriptionId: id });
    S().notify({
      title: "Subscription cancelled",
      body: `${id} will not be charged again. Allowance was not revoked.`,
      kind: "subscription",
      link: `/subscriptions/${id}`,
    });
    return S().data.subscriptions.find((s) => s.id === id)!;
  },

  async revokeAllowance(id: string): Promise<Subscription> {
    await sleep(DEMO.delays.slow);
    const state = S();
    const sub = state.data.subscriptions.find((s) => s.id === id);
    if (!sub) throw new Error("Subscription not found");
    state.patch("subscriptions", id, {
      allowanceRevokedAt: nowIso(),
      allowanceRemaining: "0",
      status: sub.status === "active" ? "cancelled" : sub.status,
      cancelledAt: sub.cancelledAt ?? nowIso(),
      nextBillingAt: null,
    });
    return S().data.subscriptions.find((s) => s.id === id)!;
  },

  async recordUsage(input: { subscriptionId: string; units: number; reference: string }): Promise<UsageRecord> {
    await sleep(DEMO.delays.fast);
    const state = S();
    const sub = state.data.subscriptions.find((s) => s.id === input.subscriptionId);
    if (!sub) throw new Error("Subscription not found");
    const plan = state.data.plans.find((p) => p.id === sub.planId);
    const unitPrice = plan?.unitPrice ?? "10000";
    const amount = mulBaseInt(unitPrice, input.units);
    const record: UsageRecord = {
      id: shortId("usg", 6),
      merchantId: sub.merchantId,
      subscriptionId: sub.id,
      units: input.units,
      unitPrice,
      amount,
      recordedAt: nowIso(),
      merchantReference: input.reference,
      billed: false,
      billedPaymentId: null,
    };
    state.add("usageRecords", record);
    return record;
  },

  async billUsage(subscriptionId: string): Promise<UsageRecord[]> {
    await sleep(DEMO.delays.medium);
    const state = S();
    const pending = state.data.usageRecords.filter((r) => r.subscriptionId === subscriptionId && !r.billed);
    const paymentId = shortId("pay", 8);
    const total = pending.reduce((acc, r) => addBase(acc, r.amount), "0" as BaseAmount);
    const sub = state.data.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) throw new Error("Subscription not found");
    if (cmpBase(total, sub.maxChargePerCycle) > 0) {
      throw new Error(
        `Calculated usage charge exceeds the per-cycle cap of ${sub.maxChargePerCycle} base units. Reduce the number of unbilled records.`,
      );
    }
    state.add("payments", {
      id: paymentId,
      merchantId: sub.merchantId,
      customerId: sub.customerId,
      customerEmail: null,
      description: "Usage-based charge",
      amount: total,
      receivedAmount: null,
      refundedAmount: "0",
      token: TOKEN.symbol,
      network: DEFAULT_NETWORK.name,
      kind: "usage",
      source: { kind: "subscription", id: sub.id, label: "Subscription" },
      payerWallet: state.data.customers.find((c) => c.id === sub.customerId)?.wallet ?? null,
      payoutWallet: state.data.merchant.payoutWallet,
      status: "succeeded",
      txRef: demoTxRef(),
      authorizationRef: demoAuthRef(),
      gasSponsored: true,
      createdAt: nowIso(),
      settledAt: nowIso(),
      expiresAt: null,
      timeline: [
        { status: "created", label: "Usage charge scheduled", at: nowIso(), simulated: true },
        { status: "succeeded", label: "Usage charge settled", at: nowIso(), simulated: true },
      ],
      invoiceId: null,
      paymentLinkId: null,
      subscriptionId: sub.id,
      fulfilmentId: null,
      checkoutUrl: hostedUrl(`checkout/ses_${paymentId.replace("pay_", "")}`),
      receiptEmail: "delivered",
      payeeShield: null,
      failureReason: null,
    });
    pending.forEach((r) => S().patch("usageRecords", r.id, { billed: true, billedPaymentId: paymentId }));
    S().patch("subscriptions", sub.id, {
      spent: addBase(sub.spent, total),
      allowanceRemaining: sub.allowanceRemaining,
    });
    return pending;
  },

  /* ---------------- fulfilment ---------------- */

  async updateFulfilment(
    id: string,
    status: FulfilmentStatus,
    input: { merchantNotes?: string; customerNotes?: string; trackingNumber?: string | null; completionUrl?: string | null },
  ): Promise<FulfilmentOrder> {
    await sleep(DEMO.delays.medium);
    const state = S();
    const order = state.data.fulfilment.find((f) => f.id === id);
    if (!order) throw new Error("Order not found");
    state.patch("fulfilment", id, {
      status,
      updatedAt: nowIso(),
      merchantNotes: input.merchantNotes ?? order.merchantNotes,
      customerNotes: input.customerNotes ?? order.customerNotes,
      trackingNumber: input.trackingNumber ?? order.trackingNumber,
      completionUrl: input.completionUrl ?? order.completionUrl,
      timeline: [
        ...order.timeline,
        { status, note: input.customerNotes || `Status changed to ${status}.`, at: nowIso(), actor: "merchant", customerVisible: true },
      ],
    });
    emitWebhook("fulfilment.updated", { paymentId: order.paymentId });
    return S().data.fulfilment.find((f) => f.id === id)!;
  },

  async createFulfilmentForPayment(paymentId: string): Promise<FulfilmentOrder> {
    const state = S();
    const payment = state.data.payments.find((p) => p.id === paymentId);
    if (!payment) throw new Error("Payment not found");
    const order: FulfilmentOrder = {
      id: shortId("ful", 6),
      merchantId: payment.merchantId,
      paymentId,
      customerId: payment.customerId ?? "",
      productId: null,
      orderReference: `ORD-${Math.floor(1000 + Math.random() * 8999)}`,
      amount: payment.amount,
      status: "not_started",
      trackingNumber: null,
      completionUrl: null,
      merchantNotes: "",
      customerNotes: "Your order has been received.",
      timeline: [
        { status: "not_started", note: "Order created after settlement.", at: nowIso(), actor: "system", customerVisible: true },
      ],
      updatedAt: nowIso(),
    };
    state.add("fulfilment", order);
    state.patch("payments", paymentId, { fulfilmentId: order.id });
    return order;
  },

  /* ---------------- exceptions ---------------- */

  async runExceptionAction(id: string, action: ExceptionActionId): Promise<PaymentException> {
    await sleep(DEMO.delays.medium);
    const state = S();
    const exception = state.data.exceptions.find((e) => e.id === id);
    if (!exception) throw new Error("Exception not found");

    let result = "";
    let succeeded = true;

    switch (action) {
      case "retry_webhook": {
        const event = state.data.webhookEvents.find((e) => e.id === exception.webhookEventId);
        if (event) {
          S().patch("webhookEvents", event.id, {
            attempts: event.attempts + 1,
            status: "delivered",
            responseStatus: 200,
            lastAttemptAt: nowIso(),
            nextRetryAt: null,
          });
          result = `Webhook ${event.id} delivered with HTTP 200 on attempt ${event.attempts + 1}.`;
        } else {
          succeeded = false;
          result = "No webhook event is linked to this exception.";
        }
        break;
      }
      case "replay_event": {
        const event = state.data.webhookEvents.find((e) => e.id === exception.webhookEventId);
        if (event) {
          await mockApi.sendTestEvent(event.endpointId, event.type);
          result = `Event ${event.type} replayed to the configured endpoint.`;
        } else {
          succeeded = false;
          result = "No webhook event is linked to this exception.";
        }
        break;
      }
      case "recheck_transaction": {
        const payment = state.data.payments.find((p) => p.id === exception.paymentId);
        if (payment) {
          S().patch("payments", payment.id, {
            status: payment.status === "exception" ? "succeeded" : payment.status,
            settledAt: payment.settledAt ?? nowIso(),
            failureReason: null,
          });
          result = "Transaction re-checked. The simulated submission is now treated as settled.";
        } else {
          succeeded = false;
          result = "No payment is linked to this exception.";
        }
        break;
      }
      case "mark_for_review":
        result = "Exception flagged for merchant review.";
        break;
      case "create_balance_due_request": {
        const payment = state.data.payments.find((p) => p.id === exception.paymentId);
        if (payment && payment.receivedAmount) {
          const remaining = subBase(payment.amount, payment.receivedAmount);
          await mockApi.createPaymentIntent({
            amount: remaining,
            description: `Balance due for ${payment.id}`,
            customerId: payment.customerId,
            customerEmail: payment.customerEmail,
            kind: "one_time",
          });
          result = "Balance-due payment request created for the outstanding amount.";
        } else {
          succeeded = false;
          result = "This exception has no received amount to reconcile.";
        }
        break;
      }
      case "initiate_refund": {
        const payment = state.data.payments.find((p) => p.id === exception.paymentId);
        if (payment) {
          const amount = payment.receivedAmount ?? payment.amount;
          await mockApi.createRefund({
            paymentId: payment.id,
            amount,
            reason: `Created from exception ${exception.id}.`,
            gasSponsored: true,
          });
          result = "Refund draft created and is awaiting merchant authorization.";
        } else {
          succeeded = false;
          result = "No payment is linked to this exception.";
        }
        break;
      }
      case "dismiss":
        result = "Exception dismissed.";
        break;
      case "resolve":
      default:
        result = "Exception resolved by merchant.";
        break;
    }

    const nextStatus: PaymentException["status"] =
      action === "resolve" ? "resolved" : action === "dismiss" ? "dismissed" : action === "mark_for_review" ? "action_required" : "investigating";

    S().patch("exceptions", id, {
      status: nextStatus,
      attempts: [...exception.attempts, { action, at: nowIso(), result, succeeded }],
    });
    return S().data.exceptions.find((e) => e.id === id)!;
  },

  /* ---------------- developer platform ---------------- */

  async createApiKey(input: { name: string; environment: "testnet" | "mainnet"; permissions: string[] }) {
    await sleep(DEMO.delays.medium);
    const state = S();
    const suffix = Math.random().toString(36).slice(2, 6);
    const secret = `sk_test_demo_${"0".repeat(28)}${suffix}`;
    const id = shortId("key", 6);
    const publishable = `pk_test_demo_${suffix}${Math.random().toString(36).slice(2, 8)}`;
    state.add("apiKeys", {
      id,
      merchantId: state.data.merchant.id,
      name: input.name,
      environment: input.environment,
      publishable,
      secretLast4: suffix,
      permissions: input.permissions,
      createdAt: nowIso(),
      lastUsedAt: null,
      revokedAt: null,
      status: "active",
    });
    return { id, publishable, secret };
  },

  async revokeApiKey(id: string): Promise<void> {
    await sleep(DEMO.delays.fast);
    S().patch("apiKeys", id, { revokedAt: nowIso(), status: "revoked" });
  },

  async createWebhookEndpoint(input: { url: string; description: string; events: string[] }) {
    await sleep(DEMO.delays.medium);
    const state = S();
    const suffix = Math.random().toString(36).slice(2, 6);
    const secret = `whsec_demo_${"0".repeat(26)}${suffix}`;
    const id = shortId("whe", 6);
    state.add("webhookEndpoints", {
      id,
      merchantId: state.data.merchant.id,
      url: input.url,
      description: input.description,
      events: input.events,
      active: true,
      signingSecretLast4: suffix,
      createdAt: nowIso(),
      lastDeliveryAt: null,
      health: "untested",
    });
    return { id, secret };
  },

  async updateWebhookEndpoint(id: string, patch: { url?: string; events?: string[]; active?: boolean; description?: string }) {
    await sleep(DEMO.delays.fast);
    S().patch("webhookEndpoints", id, patch);
    return S().data.webhookEndpoints.find((e) => e.id === id)!;
  },

  async sendTestEvent(endpointId: string, type: string) {
    await sleep(DEMO.delays.slow);
    const state = S();
    const endpoint = state.data.webhookEndpoints.find((e) => e.id === endpointId);
    if (!endpoint) throw new Error("Endpoint not found");
    const id = shortId("evt", 8);
    state.add("webhookEvents", {
      id,
      merchantId: state.data.merchant.id,
      type,
      endpointId,
      payloadSummary: "Test event sent from the developer dashboard.",
      responseStatus: 200,
      attempts: 1,
      status: "delivered",
      createdAt: nowIso(),
      lastAttemptAt: nowIso(),
      nextRetryAt: null,
      relatedPaymentId: null,
      relatedSubscriptionId: null,
      payload: {
        id,
        type,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        demo: true,
        data: { object: { test: true, endpoint: endpoint.url } },
      },
    });
    S().patch("webhookEndpoints", endpointId, { lastDeliveryAt: nowIso(), health: "healthy" });
    return id;
  },

  async retryWebhookEvent(eventId: string) {
    await sleep(DEMO.delays.slow);
    const state = S();
    const event = state.data.webhookEvents.find((e) => e.id === eventId);
    if (!event) throw new Error("Event not found");
    S().patch("webhookEvents", eventId, {
      attempts: event.attempts + 1,
      responseStatus: 200,
      status: "delivered",
      lastAttemptAt: nowIso(),
      nextRetryAt: null,
    });
    S().patch("webhookEndpoints", event.endpointId, { lastDeliveryAt: nowIso(), health: "healthy" });
    return S().data.webhookEvents.find((e) => e.id === eventId)!;
  },

  /* ---------------- settings ---------------- */

  async updateMerchant(patch: Record<string, unknown>) {
    await sleep(DEMO.delays.fast);
    S().patchMerchant(patch as never);
  },

  async updateGasGuard(patch: Record<string, unknown>) {
    await sleep(DEMO.delays.fast);
    S().patchGasGuard(patch as never);
  },

  async verifyWalletOwnership(address: string) {
    await sleep(DEMO.delays.slow);
    S().patchMerchant({
      payoutWallet: address,
      walletVerified: true,
      walletVerifiedAt: nowIso(),
    });
    S().add("securityEvents", {
      id: shortId("sec", 6),
      at: nowIso(),
      event: "Payout wallet signature verified",
      detail: `Simulated challenge for ${address.slice(0, 10)}…`,
      ip: "198.51.100.7",
    });
    return true;
  },
};

export type MockApi = typeof mockApi;
