import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { addBase, mulBaseInt, subBase, toBase } from "@/lib/money";
import type {
  ApiKey,
  AppNotification,
  Customer,
  FulfilmentOrder,
  GasGuardPolicy,
  Invoice,
  Merchant,
  Payment,
  PaymentException,
  PaymentLink,
  PaymentStatus,
  PaymentTimelineEntry,
  Product,
  Refund,
  RelayerTransaction,
  SecurityEvent,
  Subscription,
  SubscriptionPlan,
  UsageRecord,
  WebhookEndpoint,
  WebhookEvent,
} from "@/types";

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

let seedState = 20260214;
function rng(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function hex(len: number): string {
  let out = "";
  while (out.length < len) out += Math.floor(rng() * 16).toString(16);
  return out.slice(0, len);
}
/** Synthetic, obviously-not-real demo wallet addresses. */
function wallet(tag: string): string {
  const padded = tag.replace(/[^0-9a-fA-F]/g, "").padStart(4, "0").slice(0, 4);
  return `0xd30000000000000000000000000000000000${padded}${hex(2)}`.toLowerCase();
}
const txRef = () => `demo-tx-${hex(16)}`;
const authRef = () => `demo-auth-3009-${hex(12)}`;
const digest = () => `sig_${hex(12)}`;

const H = 3600_000;
const now = Date.now();
const ago = (hours: number) => new Date(now - hours * H).toISOString();
const ahead = (hours: number) => new Date(now + hours * H).toISOString();

function base(display: string): string {
  return toBase(display);
}

function timeline(
  status: PaymentStatus,
  createdAt: string,
  settledAt: string | null,
  extras: { label: string; detail?: string }[] = [],
): PaymentTimelineEntry[] {
  const created = new Date(createdAt).getTime();
  const at = (offsetMin: number) => new Date(created + offsetMin * 60_000).toISOString();
  const seq: { status: string; label: string; detail?: string; offset: number }[] = [
    { status: "created", label: "Payment intent created", offset: 0 },
    { status: "requires_authorization", label: "Awaiting payer authorization", offset: 1 },
    {
      status: "authorized",
      label: "EIP-3009 authorization received",
      detail: "Simulated authorization signature (demo mode)",
      offset: 3,
    },
    { status: "submitted", label: "Relayer submitted transaction", offset: 4 },
    { status: "pending_confirmation", label: "Pending confirmation", offset: 5 },
  ];
  const out: PaymentTimelineEntry[] = seq.map((s) => ({
    status: s.status,
    label: s.label,
    detail: s.detail,
    at: at(s.offset),
    simulated: true,
  }));
  extras.forEach((e, i) => out.push({ status: "note", label: e.label, detail: e.detail, at: at(6 + i) }));
  if (settledAt) {
    out.push({
      status,
      label: `Payment ${status.replace(/_/g, " ")}`,
      at: settledAt,
      simulated: true,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Merchant & customers                                                */
/* ------------------------------------------------------------------ */

const merchant: Merchant = {
  id: "mer_northwind_demo",
  businessName: "Northwind Digital Labs Ltd",
  displayName: "Northwind Labs",
  website: "https://northwind-labs.example",
  businessEmail: "billing@northwind-labs.example",
  supportEmail: "support@northwind-labs.example",
  description:
    "Design and engineering studio selling hosted API services, digital tooling and support retainers.",
  logoText: "NL",
  accentColor: "#0d7a6f",
  payoutWallet: wallet("aa01"),
  walletVerified: true,
  walletVerifiedAt: ago(24 * 46),
  environment: "testnet",
  onboardingComplete: true,
  createdAt: ago(24 * 62),
  country: "United Kingdom",
};

const customerSpecs: [string, string, string][] = [
  ["cus_9f21ac", "amara.osei@lumen-field.example", "Amara Osei"],
  ["cus_4b77de", "dev+billing@harborstack.example", "Harborstack GmbH"],
  ["cus_1c03ba", "tomas.reyes@brightloop.example", "Tomás Reyes"],
  ["cus_7e5512", "finance@elliotandco.example", "Elliot & Co Accountants"],
  ["cus_2d90ff", "sana.k@vellum-press.example", "Sana Karim"],
  ["cus_6a48c1", "ops@gridline-logistics.example", "Gridline Logistics"],
  ["cus_3f19e7", "hello@studio-mireille.example", "Studio Mireille"],
  ["cus_8c62d4", "it.procurement@vantos-group.example", "Vantos Group"],
];

const customers: Customer[] = customerSpecs.map(([id, email, name], i) => ({
  id,
  merchantId: merchant.id,
  email,
  name,
  wallet: wallet(`c${i}`),
  notes:
    i === 1
      ? ["Net-15 agreed for retainer work (internal).", "Prefers USDT receipts to finance@ alias."]
      : i === 3
        ? ["Requires order reference on every invoice for reconciliation."]
        : [],
  createdAt: ago(24 * (58 - i * 6)),
  lastPaymentAt: null,
}));

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

const products: Product[] = [
  {
    id: "prd_api_starter",
    merchantId: merchant.id,
    name: "Convert API — Starter",
    description: "10,000 included API requests per month, then usage-based billing.",
    imageGlyph: "API",
    price: base("49"),
    currency: TOKEN.symbol,
    billingMode: "usage",
    unitLabel: "request",
    unitPrice: base("0.01"),
    active: true,
    createdAt: ago(24 * 51),
  },
  {
    id: "prd_pro_plan",
    merchantId: merchant.id,
    name: "Northwind Pro (monthly)",
    description: "Team workspace with unlimited projects and priority support.",
    imageGlyph: "PRO",
    price: base("129"),
    currency: TOKEN.symbol,
    billingMode: "fixed",
    active: true,
    createdAt: ago(24 * 49),
  },
  {
    id: "prd_audit_pack",
    merchantId: merchant.id,
    name: "Smart-contract audit sprint",
    description: "Fixed-scope two-week audit with written remediation report.",
    imageGlyph: "AUD",
    price: base("3200"),
    currency: TOKEN.symbol,
    billingMode: "fixed",
    active: true,
    createdAt: ago(24 * 44),
  },
  {
    id: "prd_support_retainer",
    merchantId: merchant.id,
    name: "Support retainer (daily)",
    description: "Daily-billed engineering support retainer with a capped cycle charge.",
    imageGlyph: "SUP",
    price: base("18"),
    currency: TOKEN.symbol,
    billingMode: "fixed",
    active: true,
    createdAt: ago(24 * 40),
  },
  {
    id: "prd_template_pack",
    merchantId: merchant.id,
    name: "Dashboard template pack",
    description: "Figma + React source files for the Northwind analytics kit.",
    imageGlyph: "KIT",
    price: base("79"),
    currency: TOKEN.symbol,
    billingMode: "fixed",
    active: true,
    createdAt: ago(24 * 33),
  },
  {
    id: "prd_workshop",
    merchantId: merchant.id,
    name: "Team onboarding workshop",
    description: "Half-day remote workshop for up to 12 people. Currently unavailable.",
    imageGlyph: "WRK",
    price: base("650"),
    currency: TOKEN.symbol,
    billingMode: "fixed",
    active: false,
    createdAt: ago(24 * 30),
  },
];

/* ------------------------------------------------------------------ */
/* Payment links                                                       */
/* ------------------------------------------------------------------ */

const paymentLinks: PaymentLink[] = [
  {
    id: "plk_fixed_audit",
    merchantId: merchant.id,
    slug: "audit-sprint",
    title: "Smart-contract audit sprint",
    description: "Fixed-scope audit. Share the link with a client to collect a deposit.",
    linkType: "fixed",
    amount: base("3200"),
    minAmount: null,
    maxAmount: null,
    productId: "prd_audit_pack",
    reference: "AUDIT-DEPOSIT",
    returnUrl: "https://northwind-labs.example/thanks",
    active: true,
    usageCount: 3,
    totalCollected: base("9600"),
    createdAt: ago(24 * 41),
    expiresAt: ahead(24 * 20),
  },
  {
    id: "plk_open_tip",
    merchantId: merchant.id,
    slug: "support-contribution",
    title: "Support the open-source kit",
    description: "Choose what you want to contribute. Minimum 5 USDT.",
    linkType: "customer_amount",
    amount: null,
    minAmount: base("5"),
    maxAmount: base("500"),
    productId: null,
    reference: null,
    returnUrl: null,
    active: true,
    usageCount: 4,
    totalCollected: base("412.5"),
    createdAt: ago(24 * 36),
    expiresAt: null,
  },
  {
    id: "plk_reusable_template",
    merchantId: merchant.id,
    slug: "templates",
    title: "Dashboard template pack",
    description: "One reusable link — every checkout creates its own payment record.",
    linkType: "reusable",
    amount: base("79"),
    minAmount: null,
    maxAmount: null,
    productId: "prd_template_pack",
    reference: null,
    returnUrl: "https://northwind-labs.example/templates/download",
    active: true,
    usageCount: 6,
    totalCollected: base("474"),
    createdAt: ago(24 * 28),
    expiresAt: null,
  },
  {
    id: "plk_fixed_retainer",
    merchantId: merchant.id,
    slug: "retainer-invoice-topup",
    title: "Retainer top-up",
    description: "Top up a support retainer balance. Link retired — use the new retainer page.",
    linkType: "fixed",
    amount: base("450"),
    minAmount: null,
    maxAmount: null,
    productId: "prd_support_retainer",
    reference: "RETAINER-TOPUP",
    returnUrl: null,
    active: false,
    usageCount: 2,
    totalCollected: base("900"),
    createdAt: ago(24 * 22),
    expiresAt: ago(24 * 2),
  },
  {
    id: "plk_open_workshop",
    merchantId: merchant.id,
    slug: "workshop-seat",
    title: "Workshop seat (pay what suits)",
    description: "Seats are priced per team. Minimum 200 USDT, maximum 2,000 USDT.",
    linkType: "customer_amount",
    amount: null,
    minAmount: base("200"),
    maxAmount: base("2000"),
    productId: "prd_workshop",
    reference: "WRK-SEAT",
    returnUrl: null,
    active: true,
    usageCount: 1,
    totalCollected: base("650"),
    createdAt: ago(24 * 12),
    expiresAt: ahead(24 * 45),
  },
];

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

interface PaySpec {
  id: string;
  customer: string | null;
  email?: string;
  desc: string;
  amount: string;
  status: PaymentStatus;
  hoursAgo: number;
  kind: Payment["kind"];
  payer?: string;
  invoice?: string | null;
  link?: string | null;
  sub?: string | null;
  fulfil?: string | null;
  refunded?: string;
  gas?: boolean;
  failure?: string;
  received?: string;
  expiresHours?: number;
}

const paySpecs: PaySpec[] = [
  // --- recent successful volume -------------------------------------
  { id: "pay_8201", customer: "cus_9f21ac", desc: "Dashboard template pack", amount: "79", status: "succeeded", hoursAgo: 3, kind: "payment_link", link: "plk_reusable_template", fulfil: "ful_5001", gas: true },
  { id: "pay_8202", customer: "cus_4b77de", desc: "Northwind Pro — monthly subscription", amount: "129", status: "succeeded", hoursAgo: 7, kind: "subscription", sub: "sub_3001", gas: true },
  { id: "pay_8203", customer: "cus_1c03ba", desc: "Smart-contract audit sprint (deposit)", amount: "1600", status: "partially_refunded", hoursAgo: 11, kind: "invoice", invoice: "inv_7101", fulfil: "ful_5002", refunded: "320", gas: true },
  { id: "pay_8204", customer: null, email: "kai.novak@drift.build", desc: "Support the open-source kit", amount: "25", status: "succeeded", hoursAgo: 14, kind: "payment_link", link: "plk_open_tip", gas: true },
  { id: "pay_8205", customer: "cus_6a48c1", desc: "Support retainer — daily renewal", amount: "18", status: "succeeded", hoursAgo: 19, kind: "subscription", sub: "sub_3002", gas: true },
  { id: "pay_8206", customer: "cus_2d90ff", desc: "Consulting invoice INV-2043", amount: "740.5", status: "succeeded", hoursAgo: 26, kind: "invoice", invoice: "inv_7102", fulfil: "ful_5003", gas: true },
  { id: "pay_8207", customer: "cus_7e5512", desc: "Audit sprint — balance due", amount: "1600", status: "succeeded", hoursAgo: 31, kind: "invoice", invoice: "inv_7103", gas: true },
  { id: "pay_8208", customer: "cus_3f19e7", desc: "Dashboard template pack", amount: "79", status: "succeeded", hoursAgo: 38, kind: "payment_link", link: "plk_reusable_template", gas: true },
  { id: "pay_8209", customer: "cus_4b77de", desc: "Convert API — usage overage", amount: "63.24", status: "succeeded", hoursAgo: 43, kind: "usage", sub: "sub_3003", gas: true },
  { id: "pay_8210", customer: "cus_9f21ac", desc: "Northwind Pro — monthly subscription", amount: "129", status: "succeeded", hoursAgo: 52, kind: "subscription", sub: "sub_3001", gas: true },
  { id: "pay_8211", customer: "cus_8c62d4", desc: "Team onboarding workshop (seat)", amount: "650", status: "succeeded", hoursAgo: 58, kind: "payment_link", link: "plk_open_workshop", fulfil: "ful_5004", gas: true },
  { id: "pay_8212", customer: "cus_1c03ba", desc: "Smart-contract audit sprint (deposit)", amount: "3200", status: "succeeded", hoursAgo: 64, kind: "payment_link", link: "plk_fixed_audit", gas: true },
  { id: "pay_8213", customer: "cus_2d90ff", desc: "Vellum Press — hosting retainer", amount: "240", status: "succeeded", hoursAgo: 70, kind: "one_time", gas: true },
  { id: "pay_8214", customer: "cus_6a48c1", desc: "Support retainer — daily renewal", amount: "18", status: "succeeded", hoursAgo: 76, kind: "subscription", sub: "sub_3002", gas: true },
  { id: "pay_8215", customer: "cus_3f19e7", desc: "Studio Mireille — template pack", amount: "79", status: "refunded", hoursAgo: 84, kind: "payment_link", link: "plk_reusable_template", refunded: "79", gas: true },
  { id: "pay_8216", customer: "cus_7e5512", desc: "Elliot & Co — reconciliation services", amount: "1180", status: "partially_refunded", hoursAgo: 92, kind: "invoice", invoice: "inv_7104", refunded: "180", gas: true },
  { id: "pay_8217", customer: "cus_4b77de", desc: "Convert API — usage overage", amount: "41.9", status: "succeeded", hoursAgo: 100, kind: "usage", sub: "sub_3003", gas: true },
  { id: "pay_8218", customer: "cus_9f21ac", desc: "Northwind Pro — monthly subscription", amount: "129", status: "succeeded", hoursAgo: 118, kind: "subscription", sub: "sub_3001", gas: true },
  { id: "pay_8219", customer: null, email: "retro.dev@quant.fish", desc: "Support the open-source kit", amount: "142.5", status: "succeeded", hoursAgo: 128, kind: "payment_link", link: "plk_open_tip", gas: true },
  { id: "pay_8220", customer: "cus_6a48c1", desc: "Gridline — batch label export", amount: "310", status: "succeeded", hoursAgo: 140, kind: "one_time", gas: true },

  // --- problem payments ---------------------------------------------
  { id: "pay_8221", customer: "cus_1c03ba", desc: "Template pack (underpaid)", amount: "79", received: "51.2", status: "underpaid", hoursAgo: 5, kind: "payment_link", link: "plk_reusable_template", failure: "Received amount is below the requested amount." },
  { id: "pay_8222", customer: "cus_7e5512", desc: "Audit sprint (overpaid)", amount: "1600", received: "1683.4", status: "overpaid", hoursAgo: 9, kind: "invoice", invoice: "inv_7105", failure: "Received amount exceeds the requested amount." },
  { id: "pay_8223", customer: "cus_8c62d4", desc: "Procurement order PO-55821", amount: "2450", status: "pending_confirmation", hoursAgo: 2, kind: "one_time", gas: true },
  { id: "pay_8224", customer: null, email: "wanderer@mesh.example", desc: "Workshop seat", amount: "650", status: "requires_authorization", hoursAgo: 1, kind: "payment_link", link: "plk_open_workshop", expiresHours: 23 },
  { id: "pay_8225", customer: "cus_2d90ff", desc: "Vellum Press — expired invoice", amount: "480", status: "expired", hoursAgo: 40, kind: "invoice", invoice: "inv_7106", failure: "Payment request expired before authorization." },
  { id: "pay_8226", customer: "cus_3f19e7", desc: "Template pack", amount: "79", status: "failed", hoursAgo: 47, kind: "payment_link", link: "plk_reusable_template", failure: "Payer signature rejected — authorization revoked before submission." },
  { id: "pay_8227", customer: "cus_6a48c1", desc: "Retainer renewal", amount: "18", status: "failed", hoursAgo: 55, kind: "subscription", sub: "sub_3002", failure: "Insufficient USDT balance at renewal time." },
  { id: "pay_8228", customer: "cus_8c62d4", desc: "Vantos Group — duplicate attempt", amount: "320", status: "cancelled", hoursAgo: 61, kind: "one_time", failure: "Duplicate payment intent cancelled by merchant." },
  { id: "pay_8229", customer: "cus_7e5512", desc: "Audit sprint — exception", amount: "1600", status: "exception", hoursAgo: 16, kind: "invoice", invoice: "inv_7107", failure: "Relayer submission failed after authorization; funds unconfirmed." },
  { id: "pay_8230", customer: null, email: "anon@relay.test", desc: "Support the open-source kit", amount: "5", status: "created", hoursAgo: 0.4, kind: "payment_link", link: "plk_open_tip", expiresHours: 24 },
];

function statusToSettled(status: PaymentStatus, createdAt: string): string | null {
  switch (status) {
    case "succeeded":
    case "underpaid":
    case "overpaid":
    case "partially_refunded":
    case "refunded":
      return new Date(new Date(createdAt).getTime() + 6 * 60_000).toISOString();
    case "failed":
    case "cancelled":
    case "expired":
      return new Date(new Date(createdAt).getTime() + 8 * 60_000).toISOString();
    default:
      return null;
  }
}

function receiptFor(status: PaymentStatus): Payment["receiptEmail"] {
  switch (status) {
    case "succeeded":
    case "partially_refunded":
      return "delivered";
    case "refunded":
      return "sent";
    case "overpaid":
    case "underpaid":
      return "failed";
    default:
      return "not_applicable";
  }
}

const payments: Payment[] = paySpecs.map((spec) => {
  const createdAt = ago(spec.hoursAgo);
  const settledAt = statusToSettled(spec.status, createdAt);
  const customer = spec.customer ? customers.find((c) => c.id === spec.customer) : null;
  const source =
    spec.kind === "payment_link" && spec.link
      ? { kind: "payment_link" as const, id: spec.link, label: "Payment link" }
      : spec.kind === "invoice" && spec.invoice
        ? { kind: "invoice" as const, id: spec.invoice, label: "Invoice" }
        : spec.kind === "subscription" && spec.sub
          ? { kind: "subscription" as const, id: spec.sub, label: "Subscription" }
          : null;
  return {
    id: spec.id,
    merchantId: merchant.id,
    customerId: spec.customer,
    customerEmail: spec.email ?? customer?.email ?? null,
    description: spec.desc,
    amount: base(spec.amount),
    receivedAmount: spec.received ? base(spec.received) : null,
    refundedAmount: base(spec.refunded ?? "0"),
    token: TOKEN.symbol,
    network: DEFAULT_NETWORK.name,
    kind: spec.kind,
    source,
    payerWallet: spec.payer ?? customer?.wallet ?? wallet(spec.id.slice(-4)),
    payoutWallet: merchant.payoutWallet,
    status: spec.status,
    txRef:
      spec.status === "created" || spec.status === "requires_authorization" ? null : txRef(),
    authorizationRef:
      spec.status === "created" || spec.status === "requires_authorization" || spec.status === "expired"
        ? null
        : authRef(),
    gasSponsored: spec.gas ?? false,
    createdAt,
    settledAt,
    expiresAt: spec.expiresHours ? ahead(spec.expiresHours) : null,
    timeline: timeline(spec.status, createdAt, settledAt, spec.failure ? [{ label: "System note", detail: spec.failure }] : []),
    invoiceId: spec.invoice ?? null,
    paymentLinkId: spec.link ?? null,
    subscriptionId: spec.sub ?? null,
    fulfilmentId: spec.fulfil ?? null,
    checkoutUrl: `https://checkout.whitepay-gateway.example/c/${spec.id.replace("pay_", "ses_")}`,
    receiptEmail: receiptFor(spec.status),
    payeeShield: {
      status: "verified",
      signingKeyId: "gwk_2F91A",
      signingKeyStatus: "active",
      signatureTimestamp: createdAt,
      verifiedAt: createdAt,
      digest: digest(),
      protectedFields: {
        invoiceId: spec.invoice ? spec.invoice : spec.id,
        recipient: merchant.payoutWallet,
        amount: base(spec.amount),
        token: TOKEN.symbol,
        network: DEFAULT_NETWORK.name,
        expiry: spec.expiresHours ? ahead(spec.expiresHours) : ahead(24 * 7),
        nonce: `n_${hex(8)}`,
      },
      failedField: null,
    },
    failureReason: spec.failure ?? null,
  } satisfies Payment;
});

// Keep customer lastPaymentAt in sync.
customers.forEach((c) => {
  const latest = payments
    .filter((p) => p.customerId === c.id && p.settledAt)
    .sort((a, b) => (a.settledAt! < b.settledAt! ? 1 : -1))[0];
  c.lastPaymentAt = latest?.settledAt ?? null;
});

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

const invoiceSpecs: {
  id: string;
  customer: string;
  title: string;
  desc: string;
  items: [string, number, string][];
  status: Invoice["status"];
  hoursAgo: number;
  paidBy?: string;
  orderRef?: string;
  expiresHours?: number;
}[] = [
  { id: "inv_7101", customer: "cus_1c03ba", title: "Audit sprint — 50% deposit", desc: "Phase 1 deposit for the Brightloop router contract audit.", items: [["Audit sprint deposit", 1, "1600"]], status: "partially_paid", hoursAgo: 12, paidBy: "pay_8203", orderRef: "PO-BL-1180" },
  { id: "inv_7102", customer: "cus_2d90ff", title: "Consulting — February", desc: "Design systems advisory, 14 sessions.", items: [["Advisory sessions", 14, "52.89"], ["Documentation pass", 1, "0.04"]], status: "paid", hoursAgo: 27, paidBy: "pay_8206", orderRef: "VP-2043" },
  { id: "inv_7103", customer: "cus_7e5512", title: "Audit sprint — balance", desc: "Remaining balance on completion of remediation report.", items: [["Audit sprint balance", 1, "1600"]], status: "paid", hoursAgo: 32, paidBy: "pay_8207", orderRef: "EC-7723" },
  { id: "inv_7104", customer: "cus_7e5512", title: "Reconciliation services Q1", desc: "Quarterly reconciliation for three entities.", items: [["Entity reconciliation", 3, "180"], ["Reporting pack", 1, "640"]], status: "paid", hoursAgo: 93, paidBy: "pay_8216", orderRef: "EC-7719" },
  { id: "inv_7105", customer: "cus_7e5512", title: "Audit sprint — mispaid", desc: "Signed request that was overpaid on settlement.", items: [["Audit sprint", 1, "1600"]], status: "overpaid", hoursAgo: 10, paidBy: "pay_8222", orderRef: "EC-7724" },
  { id: "inv_7106", customer: "cus_2d90ff", title: "Hosting retainer", desc: "Annual hosting retainer for vellum-press.example.", items: [["Hosting retainer", 1, "480"]], status: "expired", hoursAgo: 44, expiresHours: -4 },
  { id: "inv_7107", customer: "cus_7e5512", title: "Audit sprint — retry", desc: "Signed request awaiting relayer retry.", items: [["Audit sprint", 1, "1600"]], status: "open", hoursAgo: 17 },
  { id: "inv_7108", customer: "cus_8c62d4", title: "Procurement order PO-55821", desc: "Licences and integration support for Vantos Group.", items: [["Licence bundle", 3, "650"], ["Integration support", 1, "500"]], status: "open", hoursAgo: 5, orderRef: "PO-55821", expiresHours: 24 * 9 },
  { id: "inv_7109", customer: "cus_4b77de", title: "Convert API — usage overage", desc: "Metered usage above the included quota.", items: [["API requests (metered)", 1, "63.24"]], status: "paid", hoursAgo: 44, paidBy: "pay_8209" },
];

const invoices: Invoice[] = invoiceSpecs.map((spec) => {
  const total = spec.items.reduce((acc, [, qty, price]) => addBase(acc, mulBaseInt(base(price), qty)), "0");
  const createdAt = ago(spec.hoursAgo);
  const customer = customers.find((c) => c.id === spec.customer)!;
  const payment = spec.paidBy ? payments.find((p) => p.id === spec.paidBy) : undefined;
  return {
    id: spec.id,
    merchantId: merchant.id,
    customerId: spec.customer,
    customerEmail: customer.email,
    title: spec.title,
    description: spec.desc,
    lineItems: spec.items.map(([d, qty, price], i) => ({
      id: `${spec.id}_li${i}`,
      description: d,
      quantity: qty,
      unitPrice: base(price),
    })),
    total,
    status: spec.status,
    orderReference: spec.orderRef ?? null,
    createdAt,
    expiresAt: spec.expiresHours ? ahead(spec.expiresHours) : ahead(24 * 14),
    paidAt: payment?.settledAt ?? null,
    paymentId: spec.paidBy ?? null,
    payeeShield: {
      status: "verified",
      signingKeyId: "gwk_2F91A",
      signingKeyStatus: "active",
      signatureTimestamp: createdAt,
      verifiedAt: createdAt,
      digest: digest(),
      protectedFields: {
        invoiceId: spec.id,
        recipient: merchant.payoutWallet,
        amount: total,
        token: TOKEN.symbol,
        network: DEFAULT_NETWORK.name,
        expiry: spec.expiresHours ? ahead(spec.expiresHours) : ahead(24 * 14),
        nonce: `n_${hex(8)}`,
      },
      failedField: null,
    },
    receiptEmailedAt:
      spec.status === "paid" || spec.status === "partially_paid" ? payment?.settledAt ?? null : null,
  } satisfies Invoice;
});

/* ------------------------------------------------------------------ */
/* Refunds                                                             */
/* ------------------------------------------------------------------ */

const refundSpecs: {
  id: string;
  payment: string;
  amount: string;
  reason: string;
  status: Refund["status"];
  hoursAgo: number;
  gas: boolean;
}[] = [
  { id: "ref_4401", payment: "pay_8203", amount: "320", reason: "Scope reduced after audit kickoff.", status: "succeeded", hoursAgo: 9, gas: true },
  { id: "ref_4402", payment: "pay_8216", amount: "180", reason: "Duplicate line item on the Q1 statement.", status: "succeeded", hoursAgo: 60, gas: true },
  { id: "ref_4403", payment: "pay_8215", amount: "79", reason: "Customer cancelled before download.", status: "succeeded", hoursAgo: 70, gas: false },
  { id: "ref_4404", payment: "pay_8221", amount: "51.2", reason: "Return the underpaid amount, then reissue the request.", status: "awaiting_authorization", hoursAgo: 3, gas: true },
  { id: "ref_4405", payment: "pay_8211", amount: "130", reason: "Workshop seat downgraded.", status: "failed", hoursAgo: 30, gas: false },
];

const refunds: Refund[] = refundSpecs.map((spec) => {
  const payment = payments.find((p) => p.id === spec.payment)!;
  const createdAt = ago(spec.hoursAgo);
  const settled = spec.status === "succeeded" ? new Date(new Date(createdAt).getTime() + 7 * 60_000).toISOString() : null;
  return {
    id: spec.id,
    merchantId: merchant.id,
    paymentId: payment.id,
    customerId: payment.customerId,
    amount: base(spec.amount),
    reason: spec.reason,
    status: spec.status,
    gasSponsored: spec.gas,
    authorizationRef: spec.status === "awaiting_authorization" ? null : authRef(),
    txRef: spec.status === "succeeded" ? txRef() : null,
    createdAt,
    settledAt: settled,
    timeline: [
      { status: "created", label: "Refund created", at: createdAt },
      ...(spec.status === "awaiting_authorization"
        ? [{ status: "awaiting_authorization", label: "Awaiting merchant authorization", at: createdAt }]
        : [
            { status: "authorized", label: spec.gas ? "Merchant signed gasless authorization" : "Merchant-paid gas path selected", at: createdAt, simulated: true },
            { status: "submitted", label: "Refund transaction submitted", at: createdAt, simulated: true },
          ]),
      ...(settled ? [{ status: "succeeded", label: "Refund settled (demo)", at: settled, simulated: true }] : []),
      ...(spec.status === "failed"
        ? [{ status: "failed", label: "Refund transaction reverted", detail: "Merchant wallet balance insufficient for gas.", at: createdAt, simulated: true }]
        : []),
    ],
    customerNotified: spec.status === "succeeded" ? "delivered" : spec.status === "failed" ? "failed" : "queued",
  } satisfies Refund;
});

/* ------------------------------------------------------------------ */
/* Subscription plans & subscriptions                                   */
/* ------------------------------------------------------------------ */

const plans: SubscriptionPlan[] = [
  {
    id: "plan_2001",
    merchantId: merchant.id,
    name: "Northwind Pro",
    description: "Team workspace with priority support. Billed monthly.",
    amount: base("129"),
    currency: TOKEN.symbol,
    billingMode: "fixed",
    interval: "monthly",
    maxChargePerCycle: base("129"),
    cumulativeLimit: base("1548"),
    planExpiryMonths: 12,
    retryPolicy: { maxAttempts: 3, backoff: "exponential", intervalMinutes: 60, gracePeriodMinutes: 1440 },
    notifyCustomer: true,
    active: true,
    createdAt: ago(24 * 49),
  },
  {
    id: "plan_2002",
    merchantId: merchant.id,
    name: "Support retainer",
    description: "Daily-billed engineering support retainer.",
    amount: base("18"),
    currency: TOKEN.symbol,
    billingMode: "fixed",
    interval: "daily",
    maxChargePerCycle: base("18"),
    cumulativeLimit: base("540"),
    planExpiryMonths: 1,
    retryPolicy: { maxAttempts: 4, backoff: "linear", intervalMinutes: 30, gracePeriodMinutes: 240 },
    notifyCustomer: true,
    active: true,
    createdAt: ago(24 * 40),
  },
  {
    id: "plan_2003",
    merchantId: merchant.id,
    name: "Convert API — usage",
    description: "Metered API access billed at 0.01 USDT per request.",
    amount: base("0"),
    currency: TOKEN.symbol,
    billingMode: "usage",
    unitLabel: "request",
    unitPrice: base("0.01"),
    interval: "monthly",
    maxChargePerCycle: base("150"),
    cumulativeLimit: base("900"),
    planExpiryMonths: 6,
    retryPolicy: { maxAttempts: 3, backoff: "fixed", intervalMinutes: 120, gracePeriodMinutes: 720 },
    notifyCustomer: true,
    active: true,
    createdAt: ago(24 * 46),
  },
  {
    id: "plan_2004",
    merchantId: merchant.id,
    name: "Hourly incident response",
    description: "Hourly emergency response block with a hard cycle cap.",
    amount: base("60"),
    currency: TOKEN.symbol,
    billingMode: "fixed",
    interval: "hourly",
    maxChargePerCycle: base("60"),
    cumulativeLimit: base("480"),
    planExpiryMonths: 1,
    retryPolicy: { maxAttempts: 2, backoff: "fixed", intervalMinutes: 15, gracePeriodMinutes: 60 },
    notifyCustomer: false,
    active: false,
    createdAt: ago(24 * 24),
  },
];

function buildAttempts(
  count: number,
  interval: "hourly" | "daily" | "monthly",
  firstAt: string,
  amount: string,
  statuses: ("scheduled" | "submitted" | "succeeded" | "failed" | "skipped")[],
) {
  const stepH = interval === "hourly" ? 1 : interval === "daily" ? 24 : 24 * 30;
  return Array.from({ length: count }).map((_, i) => ({
    id: `att_${hex(6)}`,
    attempt: i + 1,
    scheduledFor: new Date(new Date(firstAt).getTime() - i * stepH * H).toISOString(),
    executedAt:
      statuses[i] === "scheduled"
        ? null
        : new Date(new Date(firstAt).getTime() - i * stepH * H + 4 * 60_000).toISOString(),
    status: statuses[i],
    amount: base(amount),
    reason: statuses[i] === "failed" ? "Insufficient USDT balance" : null,
    txRef: statuses[i] === "succeeded" ? txRef() : null,
  }));
}

const subscriptions: Subscription[] = [
  {
    id: "sub_3001",
    merchantId: merchant.id,
    customerId: "cus_9f21ac",
    planId: "plan_2001",
    status: "active",
    amount: base("129"),
    interval: "monthly",
    maxChargePerCycle: base("129"),
    cumulativeLimit: base("1548"),
    spent: base("387"),
    allowanceRemaining: base("1161"),
    nextBillingAt: ahead(24 * 18),
    createdAt: ago(24 * 76),
    expiresAt: ahead(24 * 300),
    cancelledAt: null,
    allowanceRevokedAt: null,
    activationTxRef: txRef(),
    approvalTxRef: txRef(),
    retryPolicy: plans[0].retryPolicy,
    attempts: buildAttempts(3, "monthly", ago(24 * 6), "129", ["succeeded", "succeeded", "succeeded"]),
    billingHistory: [
      { paymentId: "pay_8202", amount: base("129"), at: ago(7), status: "succeeded" },
      { paymentId: "pay_8210", amount: base("129"), at: ago(52), status: "succeeded" },
      { paymentId: "pay_8218", amount: base("129"), at: ago(118), status: "succeeded" },
    ],
  },
  {
    id: "sub_3002",
    merchantId: merchant.id,
    customerId: "cus_6a48c1",
    planId: "plan_2002",
    status: "past_due",
    amount: base("18"),
    interval: "daily",
    maxChargePerCycle: base("18"),
    cumulativeLimit: base("540"),
    spent: base("288"),
    allowanceRemaining: base("252"),
    nextBillingAt: ahead(4),
    createdAt: ago(24 * 22),
    expiresAt: ahead(24 * 8),
    cancelledAt: null,
    allowanceRevokedAt: null,
    activationTxRef: txRef(),
    approvalTxRef: txRef(),
    retryPolicy: plans[1].retryPolicy,
    attempts: buildAttempts(4, "daily", ago(2), "18", ["failed", "failed", "succeeded", "succeeded"]),
    billingHistory: [
      { paymentId: "pay_8205", amount: base("18"), at: ago(19), status: "succeeded" },
      { paymentId: "pay_8214", amount: base("18"), at: ago(76), status: "succeeded" },
      { paymentId: "pay_8227", amount: base("18"), at: ago(55), status: "failed" },
    ],
  },
  {
    id: "sub_3003",
    merchantId: merchant.id,
    customerId: "cus_4b77de",
    planId: "plan_2003",
    status: "active",
    amount: base("0"),
    interval: "monthly",
    maxChargePerCycle: base("150"),
    cumulativeLimit: base("900"),
    spent: base("105.14"),
    allowanceRemaining: base("794.86"),
    nextBillingAt: ahead(24 * 12),
    createdAt: ago(24 * 30),
    expiresAt: ahead(24 * 150),
    cancelledAt: null,
    allowanceRevokedAt: null,
    activationTxRef: txRef(),
    approvalTxRef: txRef(),
    retryPolicy: plans[2].retryPolicy,
    attempts: buildAttempts(2, "monthly", ago(24 * 10), "63.24", ["succeeded", "succeeded"]),
    billingHistory: [
      { paymentId: "pay_8209", amount: base("63.24"), at: ago(43), status: "succeeded" },
      { paymentId: "pay_8217", amount: base("41.90"), at: ago(100), status: "succeeded" },
    ],
  },
  {
    id: "sub_3004",
    merchantId: merchant.id,
    customerId: "cus_3f19e7",
    planId: "plan_2001",
    status: "cancelled",
    amount: base("129"),
    interval: "monthly",
    maxChargePerCycle: base("129"),
    cumulativeLimit: base("1548"),
    spent: base("258"),
    allowanceRemaining: base("1290"),
    nextBillingAt: null,
    createdAt: ago(24 * 95),
    expiresAt: ahead(24 * 200),
    cancelledAt: ago(24 * 8),
    allowanceRevokedAt: null,
    activationTxRef: txRef(),
    approvalTxRef: txRef(),
    retryPolicy: plans[0].retryPolicy,
    attempts: buildAttempts(2, "monthly", ago(24 * 40), "129", ["succeeded", "succeeded"]),
    billingHistory: [{ paymentId: "pay_8208", amount: base("129"), at: ago(24 * 40), status: "succeeded" }],
  },
  {
    id: "sub_3005",
    merchantId: merchant.id,
    customerId: "cus_7e5512",
    planId: "plan_2002",
    status: "pending_activation",
    amount: base("18"),
    interval: "daily",
    maxChargePerCycle: base("18"),
    cumulativeLimit: base("540"),
    spent: base("0"),
    allowanceRemaining: base("540"),
    nextBillingAt: ahead(24),
    createdAt: ago(6),
    expiresAt: ahead(24 * 30),
    cancelledAt: null,
    allowanceRevokedAt: null,
    activationTxRef: null,
    approvalTxRef: txRef(),
    retryPolicy: plans[1].retryPolicy,
    attempts: [{ id: `att_${hex(6)}`, attempt: 1, scheduledFor: ahead(24), executedAt: null, status: "scheduled", amount: base("18") }],
    billingHistory: [],
  },
  {
    id: "sub_3006",
    merchantId: merchant.id,
    customerId: "cus_8c62d4",
    planId: "plan_2004",
    status: "failed",
    amount: base("60"),
    interval: "hourly",
    maxChargePerCycle: base("60"),
    cumulativeLimit: base("480"),
    spent: base("180"),
    allowanceRemaining: base("300"),
    nextBillingAt: null,
    createdAt: ago(24 * 12),
    expiresAt: ago(2),
    cancelledAt: null,
    allowanceRevokedAt: null,
    activationTxRef: txRef(),
    approvalTxRef: txRef(),
    retryPolicy: plans[3].retryPolicy,
    attempts: buildAttempts(2, "hourly", ago(5), "60", ["failed", "failed"]),
    billingHistory: [],
  },
];

/* ------------------------------------------------------------------ */
/* Usage records                                                       */
/* ------------------------------------------------------------------ */

const usageRecords: UsageRecord[] = Array.from({ length: 12 }).map((_, i) => {
  const units = 400 + Math.floor(rng() * 1400);
  return {
    id: `usg_${hex(6)}`,
    merchantId: merchant.id,
    subscriptionId: "sub_3003",
    units,
    unitPrice: base("0.01"),
    amount: mulBaseInt(base("0.01"), units),
    recordedAt: ago(2 + i * 8),
    merchantReference: `harborstack/req-${1000 + i}`,
    billed: i > 2,
    billedPaymentId: i > 2 ? (i % 2 === 0 ? "pay_8209" : "pay_8217") : null,
  } satisfies UsageRecord;
});

/* ------------------------------------------------------------------ */
/* Fulfilment                                                          */
/* ------------------------------------------------------------------ */

const fulfilment: FulfilmentOrder[] = [
  {
    id: "ful_5001",
    merchantId: merchant.id,
    paymentId: "pay_8201",
    customerId: "cus_9f21ac",
    productId: "prd_template_pack",
    orderReference: "ORD-9041",
    amount: base("79"),
    status: "fulfilled",
    trackingNumber: null,
    completionUrl: "https://northwind-labs.example/templates/download",
    merchantNotes: "Download link auto-issued on settlement.",
    customerNotes: "Your template pack is ready to download.",
    timeline: [
      { status: "not_started", note: "Order created after payment settlement.", at: ago(3), actor: "system", customerVisible: true },
      { status: "processing", note: "Generating licence key.", at: ago(2.9), actor: "merchant", customerVisible: false },
      { status: "fulfilled", note: "Licence key issued and download link enabled.", at: ago(2.7), actor: "merchant", customerVisible: true },
    ],
    updatedAt: ago(2.7),
  },
  {
    id: "ful_5002",
    merchantId: merchant.id,
    paymentId: "pay_8203",
    customerId: "cus_1c03ba",
    productId: "prd_audit_pack",
    orderReference: "ORD-9042",
    amount: base("1600"),
    status: "processing",
    trackingNumber: null,
    completionUrl: null,
    merchantNotes: "Kickoff call held; awaiting static analysis results.",
    customerNotes: "Audit in progress. Report expected within 10 business days.",
    timeline: [
      { status: "not_started", note: "Order created after deposit settlement.", at: ago(11), actor: "system", customerVisible: true },
      { status: "processing", note: "Kickoff completed, work started.", at: ago(9), actor: "merchant", customerVisible: true },
    ],
    updatedAt: ago(9),
  },
  {
    id: "ful_5003",
    merchantId: merchant.id,
    paymentId: "pay_8206",
    customerId: "cus_2d90ff",
    productId: null,
    orderReference: "ORD-9043",
    amount: base("740.5"),
    status: "fulfilled",
    trackingNumber: null,
    completionUrl: "https://northwind-labs.example/engagements/vp-2043",
    merchantNotes: "14 sessions delivered.",
    customerNotes: "Engagement delivered. Summary document attached.",
    timeline: [
      { status: "not_started", note: "Order created.", at: ago(26), actor: "system", customerVisible: true },
      { status: "processing", note: "Sessions scheduled.", at: ago(25), actor: "merchant", customerVisible: false },
      { status: "fulfilled", note: "All sessions delivered.", at: ago(20), actor: "merchant", customerVisible: true },
    ],
    updatedAt: ago(20),
  },
  {
    id: "ful_5004",
    merchantId: merchant.id,
    paymentId: "pay_8211",
    customerId: "cus_8c62d4",
    productId: "prd_workshop",
    orderReference: "ORD-9044",
    amount: base("650"),
    status: "return_requested",
    trackingNumber: null,
    completionUrl: null,
    merchantNotes: "Customer asked to move the seat to the next cohort.",
    customerNotes: "We received your request to move the seat.",
    timeline: [
      { status: "not_started", note: "Order created.", at: ago(58), actor: "system", customerVisible: true },
      { status: "processing", note: "Cohort allocation pending.", at: ago(56), actor: "merchant", customerVisible: true },
      { status: "return_requested", note: "Seat move requested by customer.", at: ago(31), actor: "merchant", customerVisible: true },
    ],
    updatedAt: ago(31),
  },
  {
    id: "ful_5005",
    merchantId: merchant.id,
    paymentId: "pay_8215",
    customerId: "cus_3f19e7",
    productId: "prd_template_pack",
    orderReference: "ORD-9045",
    amount: base("79"),
    status: "refunded",
    trackingNumber: null,
    completionUrl: null,
    merchantNotes: "Refunded in full after cancellation.",
    customerNotes: "Order cancelled and refunded.",
    timeline: [
      { status: "not_started", note: "Order created.", at: ago(84), actor: "system", customerVisible: true },
      { status: "cancelled", note: "Customer cancelled before download.", at: ago(72), actor: "merchant", customerVisible: true },
      { status: "refund_initiated", note: "Refund initiated.", at: ago(71), actor: "merchant", customerVisible: true },
      { status: "refunded", note: "Refund settled (demo).", at: ago(70), actor: "system", customerVisible: true },
    ],
    updatedAt: ago(70),
  },
  {
    id: "ful_5006",
    merchantId: merchant.id,
    paymentId: "pay_8223",
    customerId: "cus_8c62d4",
    productId: null,
    orderReference: "ORD-9046",
    amount: base("2450"),
    status: "not_started",
    trackingNumber: null,
    completionUrl: null,
    merchantNotes: "Do not provision until the payment confirms.",
    customerNotes: "Your order has been received.",
    timeline: [
      { status: "not_started", note: "Order created; payment pending confirmation.", at: ago(2), actor: "system", customerVisible: true },
    ],
    updatedAt: ago(2),
  },
];

/* ------------------------------------------------------------------ */
/* Exceptions                                                          */
/* ------------------------------------------------------------------ */

const exceptionSpecs: {
  id: string;
  type: PaymentException["type"];
  severity: PaymentException["severity"];
  status: PaymentException["status"];
  payment?: string;
  sub?: string;
  webhook?: string;
  hoursAgo: number;
  what: string;
  why: string;
  action: string;
  recommended: PaymentException["recommendedAction"];
}[] = [
  { id: "exc_6601", type: "underpayment", severity: "high", status: "action_required", payment: "pay_8221", hoursAgo: 4, what: "The payer sent 51.20 USDT against a 79.00 USDT request.", why: "The payer manually edited the amount in their wallet before signing, or an exchange withdrawal fee reduced the transferred value.", action: "Create a balance-due payment request for the remaining amount, or refund the underpayment.", recommended: "create_balance_due_request" },
  { id: "exc_6602", type: "overpayment", severity: "medium", status: "open", payment: "pay_8222", hoursAgo: 8, what: "The payer sent 1,683.40 USDT against a 1,600.00 USDT request.", why: "The payer rounded up when preparing the transfer from an exchange that does not support exact amounts.", action: "Issue a partial refund for the overpayment, or contact the customer to apply it as credit.", recommended: "initiate_refund" },
  { id: "exc_6603", type: "relayer_failure", severity: "critical", status: "investigating", payment: "pay_8229", hoursAgo: 15, what: "The GasGuard relayer rejected the submission after the payer authorization was received.", why: "The relayer gas-cap policy rejected the transaction because the estimated gas exceeded the configured per-transaction limit.", action: "Re-check the transaction and resubmit through the relayer within the authorization validity window.", recommended: "recheck_transaction" },
  { id: "exc_6604", type: "insufficient_subscription_balance", severity: "high", status: "action_required", sub: "sub_3002", payment: "pay_8227", hoursAgo: 20, what: "A scheduled daily renewal could not be executed because the customer wallet held insufficient USDT.", why: "Customer wallet balance dropped below the cycle amount before the scheduler ran.", action: "Notify the customer and retry within the configured retry window.", recommended: "resolve" },
  { id: "exc_6605", type: "webhook_delivery_failure", severity: "medium", status: "open", webhook: "evt_8803", hoursAgo: 6, what: "Webhook payment.succeeded could not be delivered to the merchant endpoint.", why: "The endpoint returned HTTP 500 on three consecutive attempts.", action: "Retry delivery after the merchant service recovers.", recommended: "retry_webhook" },
  { id: "exc_6606", type: "email_delivery_failure", severity: "low", status: "open", payment: "pay_8221", hoursAgo: 5, what: "The paid receipt email could not be delivered.", why: "The receiving mail server rejected the message with a permanent 550 response.", action: "Ask the customer for an alternative email address.", recommended: "dismiss" },
  { id: "exc_6607", type: "duplicate_payment", severity: "medium", status: "resolved", payment: "pay_8228", hoursAgo: 60, what: "Two payment intents were created for the same procurement order within one minute.", why: "The merchant checkout page was reloaded while the first intent was still open.", action: "Cancelled the duplicate intent. Resolved by merchant.", recommended: "resolve" },
  { id: "exc_6608", type: "expired_invoice_paid_late", severity: "high", status: "investigating", payment: "pay_8225", hoursAgo: 38, what: "Funds arrived for an invoice whose signed request had already expired.", why: "The payer signed the transfer after the expiry timestamp on the PayeeShield-protected request.", action: "Decide whether to accept the late payment or refund it.", recommended: "mark_for_review" },
  { id: "exc_6609", type: "reconciliation_mismatch", severity: "medium", status: "open", hoursAgo: 24, what: "Settled volume for the last 24 hours differs from the merchant's own ledger by 18.00 USDT.", why: "A renewal payment settled while the merchant ledger export was running.", action: "Re-run the reconciliation export for the affected window.", recommended: "resolve" },
  { id: "exc_6610", type: "unconfirmed_payment", severity: "high", status: "investigating", payment: "pay_8223", hoursAgo: 2, what: "A submitted transaction has not reached the configured confirmation threshold.", why: "Block production on Whitechain Sepolia is slower than the expected window (simulated).", action: "Re-check the transaction status.", recommended: "recheck_transaction" },
];

const exceptions: PaymentException[] = exceptionSpecs.map((spec) => {
  const payment = spec.payment ? payments.find((p) => p.id === spec.payment) : undefined;
  return {
    id: spec.id,
    merchantId: merchant.id,
    type: spec.type,
    severity: spec.severity,
    status: spec.status,
    paymentId: spec.payment ?? null,
    customerId: payment?.customerId ?? null,
    subscriptionId: spec.sub ?? null,
    amount: payment?.amount ?? null,
    webhookEventId: spec.webhook ?? null,
    detectedAt: ago(spec.hoursAgo),
    whatHappened: spec.what,
    whyItHappened: spec.why,
    suggestedAction: spec.action,
    attempts:
      spec.status === "resolved"
        ? [{ action: "Cancel duplicate intent", at: ago(59), result: "Intent cancelled; customer notified.", succeeded: true }]
        : spec.status === "investigating"
          ? [{ action: "Re-check transaction status", at: ago(spec.hoursAgo - 0.5), result: "Status still unconfirmed; scheduled another check.", succeeded: true }]
          : [],
    recommendedAction: spec.recommended,
  } satisfies PaymentException;
});

/* ------------------------------------------------------------------ */
/* Developer platform                                                  */
/* ------------------------------------------------------------------ */

const apiKeys: ApiKey[] = [
  {
    id: "key_9001",
    merchantId: merchant.id,
    name: "Production checkout (testnet)",
    environment: "testnet",
    publishable: "pk_test_7f3dDemoPublishableA91c",
    secretLast4: "4c21",
    secretPreview: "sk_test_demo_0000000000000000000000000000000000004c21",
    permissions: ["payment_intents:write", "invoices:write", "webhooks:read"],
    createdAt: ago(24 * 48),
    lastUsedAt: ago(2),
    revokedAt: null,
    status: "active",
  },
  {
    id: "key_9002",
    merchantId: merchant.id,
    name: "CI pipeline",
    environment: "testnet",
    publishable: "pk_test_2b9eDemoPublishable77de",
    secretLast4: "9f0a",
    secretPreview: "sk_test_demo_0000000000000000000000000000000000009f0a",
    permissions: ["payment_intents:read", "refunds:write"],
    createdAt: ago(24 * 20),
    lastUsedAt: ago(30),
    revokedAt: null,
    status: "active",
  },
  {
    id: "key_9003",
    merchantId: merchant.id,
    name: "Legacy integration",
    environment: "testnet",
    publishable: "pk_test_91aaDemoPublishable2b18",
    secretLast4: "11bd",
    permissions: ["payment_intents:write"],
    createdAt: ago(24 * 55),
    lastUsedAt: ago(24 * 12),
    revokedAt: ago(24 * 11),
    status: "revoked",
  },
];

const webhookEndpoints: WebhookEndpoint[] = [
  {
    id: "whe_7001",
    merchantId: merchant.id,
    url: "https://api.northwind-labs.example/hooks/whitepay",
    description: "Primary order provisioning endpoint",
    events: [
      "payment.created",
      "payment.succeeded",
      "payment.failed",
      "payment.underpaid",
      "payment.overpaid",
      "refund.succeeded",
      "subscription.renewed",
      "fulfilment.updated",
    ],
    active: true,
    signingSecretLast4: "3ab7",
    signingSecretPreview: "whsec_demo_000000000000000000000000003ab7",
    createdAt: ago(24 * 47),
    lastDeliveryAt: ago(3),
    health: "degraded",
  },
  {
    id: "whe_7002",
    merchantId: merchant.id,
    url: "https://staging.northwind-labs.example/hooks/whitepay",
    description: "Staging mirror",
    events: ["payment.succeeded", "subscription.renewal_failed"],
    active: false,
    signingSecretLast4: "c409",
    signingSecretPreview: "whsec_demo_00000000000000000000000000c409",
    createdAt: ago(24 * 18),
    lastDeliveryAt: ago(24 * 5),
    health: "untested",
  },
];

const eventSpecs: [string, string, number, string, string | null, string | null, number][] = [
  ["evt_8801", "payment.succeeded", 200, "whe_7001", "pay_8201", null, 3],
  ["evt_8802", "payment.created", 200, "whe_7001", "pay_8230", null, 1],
  ["evt_8803", "payment.succeeded", 500, "whe_7001", "pay_8221", null, 6],
  ["evt_8804", "payment.underpaid", 200, "whe_7001", "pay_8221", null, 5],
  ["evt_8805", "subscription.renewed", 200, "whe_7001", null, "sub_3001", 7],
  ["evt_8806", "subscription.renewal_failed", 200, "whe_7001", null, "sub_3002", 20],
  ["evt_8807", "refund.succeeded", 200, "whe_7001", "pay_8203", null, 9],
  ["evt_8808", "payment.succeeded", 200, "whe_7001", "pay_8203", null, 11],
  ["evt_8809", "payment.failed", 200, "whe_7001", "pay_8226", null, 47],
  ["evt_8810", "fulfilment.updated", 200, "whe_7001", "pay_8201", null, 2.5],
  ["evt_8811", "payment.succeeded", 200, "whe_7001", "pay_8206", null, 26],
  ["evt_8812", "payment.overpaid", 200, "whe_7001", "pay_8222", null, 8],
  ["evt_8813", "refund.failed", 404, "whe_7002", "pay_8211", null, 30],
  ["evt_8814", "subscription.created", 200, "whe_7001", null, "sub_3001", 76 * 24],
];

const webhookEvents: WebhookEvent[] = eventSpecs.map(([id, type, responseStatus, endpointId, paymentId, subId, hoursAgo]) => {
  const attempts = responseStatus >= 400 ? 3 : 1;
  return {
    id,
    merchantId: merchant.id,
    type,
    endpointId,
    payloadSummary:
      type === "payment.succeeded"
        ? "Payment settled (demo) — amount, token and recipient included."
        : type.startsWith("subscription")
          ? "Subscription state change with plan and renewal references."
          : "Gateway state change event.",
    responseStatus,
    attempts,
    status: responseStatus >= 400 ? "failed" : "delivered",
    createdAt: ago(hoursAgo),
    lastAttemptAt: ago(hoursAgo),
    nextRetryAt: responseStatus >= 400 ? ahead(0.5) : null,
    relatedPaymentId: paymentId,
    relatedSubscriptionId: subId,
    payload: {
      id,
      type,
      created: Math.floor(new Date(ago(hoursAgo)).getTime() / 1000),
      livemode: false,
      data: {
        object: paymentId
          ? { id: paymentId, amount: "79000000", token: TOKEN.symbol, network: DEFAULT_NETWORK.name }
          : { id: subId, plan: "plan_2001", interval: "monthly" },
      },
      demo: true,
    },
  } satisfies WebhookEvent;
});

/* ------------------------------------------------------------------ */
/* GasGuard relayer                                                    */
/* ------------------------------------------------------------------ */

const relayer: RelayerTransaction[] = payments
  .filter((p) => p.gasSponsored && p.txRef)
  .map((p) => ({
    id: `rlx_${hex(6)}`,
    merchantId: merchant.id,
    operation:
      p.kind === "subscription"
        ? "subscription.renewal"
        : p.kind === "usage"
          ? "subscription.renewal"
          : "payment.relay",
    gasSponsored: `${78000 + Math.floor(rng() * 90000)}`,
    wbtCost: (0.0004 + rng() * 0.0006).toFixed(6),
    status: p.status === "exception" ? "failed" : p.status === "failed" ? "rejected" : "confirmed",
    createdAt: p.createdAt,
    txRef: p.txRef!,
    paymentId: p.id,
    rejectionReason: p.status === "failed" ? "Payer authorization revoked before submission." : null,
  }));

refunds
  .filter((r) => r.gasSponsored && r.txRef)
  .forEach((r) => {
    relayer.push({
      id: `rlx_${hex(6)}`,
      merchantId: merchant.id,
      operation: "refund.relay",
      gasSponsored: `${62000 + Math.floor(rng() * 40000)}`,
      wbtCost: (0.0003 + rng() * 0.0004).toFixed(6),
      status: "confirmed",
      createdAt: r.createdAt,
      txRef: r.txRef!,
      paymentId: r.paymentId,
    });
  });

relayer.push({
  id: `rlx_${hex(6)}`,
  merchantId: merchant.id,
  operation: "subscription.activation",
  gasSponsored: "148000",
  wbtCost: "0.000812",
  status: "rejected",
  createdAt: ago(15),
  txRef: txRef(),
  paymentId: null,
  rejectionReason: "Estimated gas 148,000 exceeded the configured per-transaction cap of 120,000.",
});

const gasGuard: GasGuardPolicy = {
  maxGasPerTxGwei: 120000,
  merchantBudgetWbt: 5,
  merchantSpentWbt: Number(relayer.reduce((acc, r) => acc + Number(r.wbtCost), 0).toFixed(6)),
  dailyLimitWbt: 1,
  dailySpentWbt: 0.21,
  allowedNetwork: DEFAULT_NETWORK.name,
  allowedToken: TOKEN.symbol,
  allowedContract: TOKEN.contract,
  allowedFunctions: ["transferWithAuthorization", "receiveWithAuthorization", "cancelSignature"],
  rateLimitPerMinute: 30,
  authorisationExpiryCheck: true,
  replayProtection: true,
  emergencyPaused: false,
};

/* ------------------------------------------------------------------ */
/* Notifications & security events                                     */
/* ------------------------------------------------------------------ */

const notifications: AppNotification[] = [
  { id: "not_01", title: "Payment underpaid", body: "pay_8221 received 51.20 USDT of 79.00 USDT.", at: ago(4), read: false, kind: "exception", link: "/exceptions/exc_6601" },
  { id: "not_02", title: "Relayer submission rejected", body: "Gas cap exceeded for pay_8229.", at: ago(15), read: false, kind: "exception", link: "/exceptions/exc_6603" },
  { id: "not_03", title: "Renewal failed", body: "sub_3002 could not be renewed — insufficient balance.", at: ago(20), read: false, kind: "subscription", link: "/subscriptions/sub_3002" },
  { id: "not_04", title: "Payment succeeded", body: "1,600.00 USDT received from Elliot & Co.", at: ago(31), read: true, kind: "payment", link: "/payments/pay_8207" },
  { id: "not_05", title: "Refund awaiting authorization", body: "ref_4404 needs your wallet signature.", at: ago(3), read: false, kind: "refund", link: "/refunds/ref_4404" },
  { id: "not_06", title: "Webhook delivery failing", body: "3 consecutive failures on api.northwind-labs.example.", at: ago(6), read: true, kind: "system", link: "/developers/events" },
];

const securityEvents: SecurityEvent[] = [
  { id: "sec_01", at: ago(2), event: "API key used", detail: "key_9001 — payment_intents:write", ip: "203.0.113.24" },
  { id: "sec_02", at: ago(26), event: "Payout wallet signature verified", detail: "Simulated challenge completed during settings change.", ip: "198.51.100.7" },
  { id: "sec_03", at: ago(24 * 12), event: "API key revoked", detail: "key_9003 revoked by merchant admin.", ip: "198.51.100.7" },
  { id: "sec_04", at: ago(24 * 20), event: "Webhook signing secret rotated", detail: "whe_7002 secret regenerated.", ip: "198.51.100.7" },
  { id: "sec_05", at: ago(24 * 30), event: "New signing key activated", detail: "PayeeShield key gwk_2F91A activated (previous key retained for verification).", ip: "192.0.2.44" },
  { id: "sec_06", at: ago(24 * 46), event: "Session started", detail: "Merchant admin signed in (demo authentication).", ip: "192.0.2.44" },
];

/* ------------------------------------------------------------------ */

export interface DemoData {
  merchant: Merchant;
  customers: Customer[];
  products: Product[];
  paymentLinks: PaymentLink[];
  invoices: Invoice[];
  payments: Payment[];
  refunds: Refund[];
  plans: SubscriptionPlan[];
  subscriptions: Subscription[];
  usageRecords: UsageRecord[];
  fulfilment: FulfilmentOrder[];
  exceptions: PaymentException[];
  apiKeys: ApiKey[];
  webhookEndpoints: WebhookEndpoint[];
  webhookEvents: WebhookEvent[];
  relayer: RelayerTransaction[];
  gasGuard: GasGuardPolicy;
  notifications: AppNotification[];
  securityEvents: SecurityEvent[];
}

export function buildSeed(): DemoData {
  return {
    merchant: JSON.parse(JSON.stringify(merchant)),
    customers: JSON.parse(JSON.stringify(customers)),
    products: JSON.parse(JSON.stringify(products)),
    paymentLinks: JSON.parse(JSON.stringify(paymentLinks)),
    invoices: JSON.parse(JSON.stringify(invoices)),
    payments: JSON.parse(JSON.stringify(payments)),
    refunds: JSON.parse(JSON.stringify(refunds)),
    plans: JSON.parse(JSON.stringify(plans)),
    subscriptions: JSON.parse(JSON.stringify(subscriptions)),
    usageRecords: JSON.parse(JSON.stringify(usageRecords)),
    fulfilment: JSON.parse(JSON.stringify(fulfilment)),
    exceptions: JSON.parse(JSON.stringify(exceptions)),
    apiKeys: JSON.parse(JSON.stringify(apiKeys)),
    webhookEndpoints: JSON.parse(JSON.stringify(webhookEndpoints)),
    webhookEvents: JSON.parse(JSON.stringify(webhookEvents)),
    relayer: JSON.parse(JSON.stringify(relayer)),
    gasGuard: JSON.parse(JSON.stringify(gasGuard)),
    notifications: JSON.parse(JSON.stringify(notifications)),
    securityEvents: JSON.parse(JSON.stringify(securityEvents)),
  };
}

export { merchant, customers, payments, invoices, refunds, plans, subscriptions, usageRecords, fulfilment, exceptions, apiKeys, webhookEndpoints, webhookEvents, relayer, gasGuard, notifications, securityEvents, products, paymentLinks };
export { wallet, txRef, authRef, digest, ago, ahead, base as toBaseAmount };

export function subBaseSafe(a: string, b: string): string {
  const out = subBase(a, b);
  return out.startsWith("-") ? "0" : out;
}
