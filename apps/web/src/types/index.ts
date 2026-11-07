/**
 * Domain types for the Whitechain USDT payment gateway frontend.
 *
 * All token amounts are represented as integer base units held in strings
 * (`BaseAmount`) so that no floating point arithmetic is used for money and
 * the value survives JSON serialisation in localStorage.
 */

export type ID = string;
/** Integer amount of token base units, e.g. "1250000". Never a float. */
export type BaseAmount = string;
export type ISODate = string;

export type Environment = "testnet" | "mainnet";

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export type PaymentStatus =
  | "created"
  | "requires_authorization"
  | "authorized"
  | "submitted"
  | "pending_confirmation"
  | "succeeded"
  | "underpaid"
  | "overpaid"
  | "expired"
  | "failed"
  | "cancelled"
  | "partially_refunded"
  | "refunded"
  | "exception";

export type PaymentKind = "one_time" | "payment_link" | "invoice" | "subscription" | "usage";

export type PaymentSourceKind = "checkout_session" | "payment_link" | "invoice" | "subscription";

export interface PaymentTimelineEntry {
  status: PaymentStatus | string;
  label: string;
  detail?: string;
  at: ISODate;
  simulated?: boolean;
}

export interface Payment {
  id: ID;
  merchantId: ID;
  customerId: ID | null;
  /** Customer-entered email captured on hosted checkout. */
  customerEmail?: string | null;
  description: string;
  amount: BaseAmount;
  /** Actually received amount when it differs from the requested amount. */
  receivedAmount?: BaseAmount | null;
  refundedAmount: BaseAmount;
  token: string;
  network: string;
  kind: PaymentKind;
  source?: { kind: PaymentSourceKind; id: ID; label: string } | null;
  payerWallet: string | null;
  payoutWallet: string;
  status: PaymentStatus;
  /** Demo-only transaction reference. Never a real on-chain hash. */
  txRef: string | null;
  authorizationRef: string | null;
  gasSponsored: boolean;
  createdAt: ISODate;
  settledAt: ISODate | null;
  expiresAt: ISODate | null;
  timeline: PaymentTimelineEntry[];
  invoiceId: ID | null;
  paymentLinkId: ID | null;
  subscriptionId: ID | null;
  fulfilmentId: ID | null;
  checkoutUrl: string;
  /** Email receipt delivery state — independent of settlement status. */
  receiptEmail: EmailDeliveryState;
  payeeShield: PayeeShieldRecord | null;
  failureReason?: string | null;
}

export type EmailDeliveryState =
  | "not_applicable"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "suppressed";

/* ------------------------------------------------------------------ */
/* PayeeShield                                                         */
/* ------------------------------------------------------------------ */

export type PayeeShieldStatus =
  | "verified"
  | "verification_pending"
  | "invalid_signature"
  | "tampered"
  | "expired"
  | "signing_key_revoked";

export interface PayeeShieldRecord {
  status: PayeeShieldStatus;
  signingKeyId: string;
  signingKeyStatus: "active" | "rotating" | "revoked";
  signatureTimestamp: ISODate;
  verifiedAt: ISODate | null;
  /** Protected field digest used by the demo verification routine. */
  digest: string;
  protectedFields: {
    invoiceId: string;
    recipient: string;
    amount: BaseAmount;
    token: string;
    network: string;
    expiry: ISODate;
    nonce: string;
  };
  failedField?: string | null;
}

/* ------------------------------------------------------------------ */
/* Merchants / customers / products                                    */
/* ------------------------------------------------------------------ */

export interface Merchant {
  id: ID;
  businessName: string;
  displayName: string;
  website: string;
  businessEmail: string;
  supportEmail: string;
  description: string;
  logoText: string;
  accentColor: string;
  checkoutExpiryHours?: number;
  payoutWallet: string;
  walletVerified: boolean;
  walletVerifiedAt: ISODate | null;
  environment: Environment;
  onboardingComplete: boolean;
  createdAt: ISODate;
  country: string;
}

export interface Customer {
  id: ID;
  merchantId: ID;
  email: string;
  name: string;
  wallet: string | null;
  notes: string[];
  createdAt: ISODate;
  lastPaymentAt: ISODate | null;
}

export type BillingMode = "fixed" | "usage";

export interface Product {
  id: ID;
  merchantId: ID;
  name: string;
  description: string;
  /** Emoji/glyph mark used until a merchant uploads artwork. */
  imageGlyph: string;
  price: BaseAmount;
  currency: string;
  billingMode: BillingMode;
  /** For usage products: price per single unit. */
  unitLabel?: string;
  unitPrice?: BaseAmount;
  active: boolean;
  createdAt: ISODate;
}

/* ------------------------------------------------------------------ */
/* Payment links                                                       */
/* ------------------------------------------------------------------ */

export type LinkType = "fixed" | "customer_amount" | "reusable";

export interface PaymentLink {
  id: ID;
  merchantId: ID;
  slug: string;
  title: string;
  description: string;
  linkType: LinkType;
  amount: BaseAmount | null;
  minAmount: BaseAmount | null;
  maxAmount: BaseAmount | null;
  productId: ID | null;
  reference: string | null;
  returnUrl: string | null;
  active: boolean;
  usageCount: number;
  totalCollected: BaseAmount;
  createdAt: ISODate;
  expiresAt: ISODate | null;
}

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

export type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "partially_paid"
  | "overpaid"
  | "uncollectible"
  | "void"
  | "expired";

export interface InvoiceLineItem {
  id: ID;
  description: string;
  quantity: number;
  unitPrice: BaseAmount;
}

export interface Invoice {
  id: ID;
  merchantId: ID;
  customerId: ID | null;
  customerEmail: string;
  title: string;
  description: string;
  lineItems: InvoiceLineItem[];
  total: BaseAmount;
  status: InvoiceStatus;
  orderReference: string | null;
  createdAt: ISODate;
  expiresAt: ISODate | null;
  paidAt: ISODate | null;
  paymentId: ID | null;
  payeeShield: PayeeShieldRecord;
  receiptEmailedAt: ISODate | null;
  /** Demo flag: the merchant manually tampered with the request in the demo lab. */
  tampered?: boolean;
}

/* ------------------------------------------------------------------ */
/* Refunds                                                             */
/* ------------------------------------------------------------------ */

export type RefundStatus =
  | "created"
  | "awaiting_authorization"
  | "authorized"
  | "submitted"
  | "pending_confirmation"
  | "succeeded"
  | "failed"
  | "exception";

export interface Refund {
  id: ID;
  merchantId: ID;
  paymentId: ID;
  customerId: ID | null;
  amount: BaseAmount;
  reason: string;
  status: RefundStatus;
  /** true = GasGuard sponsored (EIP-3009 style), false = merchant-paid gas. */
  gasSponsored: boolean;
  authorizationRef: string | null;
  txRef: string | null;
  createdAt: ISODate;
  settledAt: ISODate | null;
  timeline: PaymentTimelineEntry[];
  customerNotified: EmailDeliveryState;
}

/* ------------------------------------------------------------------ */
/* Subscriptions                                                       */
/* ------------------------------------------------------------------ */

export type BillingInterval = "hourly" | "daily" | "monthly";

export interface RetryPolicy {
  maxAttempts: number;
  backoff: "fixed" | "linear" | "exponential";
  intervalMinutes: number;
  gracePeriodMinutes: number;
}

export interface SubscriptionPlan {
  id: ID;
  merchantId: ID;
  name: string;
  description: string;
  amount: BaseAmount;
  currency: string;
  billingMode: BillingMode;
  unitLabel?: string;
  unitPrice?: BaseAmount;
  interval: BillingInterval;
  maxChargePerCycle: BaseAmount;
  /** Required bounded total. Unbounded allowances are prohibited (PRD §11.2). */
  cumulativeLimit: BaseAmount;
  planExpiryMonths: number | null;
  retryPolicy: RetryPolicy;
  notifyCustomer: boolean;
  active: boolean;
  createdAt: ISODate;
}

export type SubscriptionStatus =
  | "pending_authorization"
  | "pending_activation"
  | "active"
  | "renewal_due"
  | "processing"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired"
  | "failed";

export interface RenewalAttempt {
  id: ID;
  attempt: number;
  scheduledFor: ISODate;
  executedAt: ISODate | null;
  status: "scheduled" | "submitted" | "succeeded" | "failed" | "skipped";
  amount: BaseAmount;
  reason?: string | null;
  txRef?: string | null;
}

export interface Subscription {
  id: ID;
  merchantId: ID;
  customerId: ID;
  planId: ID;
  status: SubscriptionStatus;
  amount: BaseAmount;
  interval: BillingInterval;
  maxChargePerCycle: BaseAmount;
  cumulativeLimit: BaseAmount;
  spent: BaseAmount;
  allowanceRemaining: BaseAmount;
  nextBillingAt: ISODate | null;
  createdAt: ISODate;
  expiresAt: ISODate | null;
  cancelledAt: ISODate | null;
  allowanceRevokedAt: ISODate | null;
  activationTxRef: string | null;
  approvalTxRef: string | null;
  retryPolicy: RetryPolicy;
  attempts: RenewalAttempt[];
  billingHistory: { paymentId: ID; amount: BaseAmount; at: ISODate; status: string }[];
}

export interface UsageRecord {
  id: ID;
  merchantId: ID;
  subscriptionId: ID;
  units: number;
  unitPrice: BaseAmount;
  amount: BaseAmount;
  recordedAt: ISODate;
  /** Merchant-reported, not independently verified by the gateway. */
  merchantReference: string;
  billed: boolean;
  billedPaymentId: ID | null;
}

/* ------------------------------------------------------------------ */
/* Fulfilment (DeliveryGuard)                                          */
/* ------------------------------------------------------------------ */

export type FulfilmentStatus =
  | "not_started"
  | "processing"
  | "fulfilled"
  | "cancelled"
  | "return_requested"
  | "refund_initiated"
  | "refunded";

export interface FulfilmentEvent {
  status: FulfilmentStatus;
  note: string;
  at: ISODate;
  actor: "merchant" | "system";
  customerVisible: boolean;
}

export interface FulfilmentOrder {
  id: ID;
  merchantId: ID;
  paymentId: ID;
  customerId: ID;
  productId: ID | null;
  orderReference: string;
  amount: BaseAmount;
  status: FulfilmentStatus;
  trackingNumber: string | null;
  completionUrl: string | null;
  merchantNotes: string;
  customerNotes: string;
  timeline: FulfilmentEvent[];
  updatedAt: ISODate;
}

/* ------------------------------------------------------------------ */
/* Exceptions                                                          */
/* ------------------------------------------------------------------ */

export type ExceptionType =
  | "underpayment"
  | "overpayment"
  | "duplicate_payment"
  | "expired_invoice_paid_late"
  | "failed_transaction"
  | "transaction_reverted"
  | "insufficient_subscription_balance"
  | "insufficient_allowance"
  | "relayer_failure"
  | "refund_failure"
  | "webhook_delivery_failure"
  | "email_delivery_failure"
  | "unconfirmed_payment"
  | "reconciliation_mismatch";

export type ExceptionSeverity = "critical" | "high" | "medium" | "low";
export type ExceptionStatus = "open" | "investigating" | "action_required" | "resolved" | "dismissed";

export interface ResolutionAttempt {
  action: string;
  at: ISODate;
  result: string;
  succeeded: boolean;
}

export interface PaymentException {
  id: ID;
  merchantId: ID;
  type: ExceptionType;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  paymentId: ID | null;
  customerId: ID | null;
  subscriptionId: ID | null;
  amount: BaseAmount | null;
  webhookEventId: ID | null;
  detectedAt: ISODate;
  whatHappened: string;
  whyItHappened: string;
  suggestedAction: string;
  attempts: ResolutionAttempt[];
  recommendedAction: ExceptionActionId;
}

export type ExceptionActionId =
  | "retry_webhook"
  | "replay_event"
  | "recheck_transaction"
  | "mark_for_review"
  | "create_balance_due_request"
  | "initiate_refund"
  | "resolve"
  | "dismiss";

/* ------------------------------------------------------------------ */
/* Developer platform                                                  */
/* ------------------------------------------------------------------ */

export interface ApiKey {
  id: ID;
  merchantId: ID;
  name: string;
  environment: Environment;
  /** Publishable value — safe to show. */
  publishable: string;
  /** Secret reference only. The secret value is revealed once, never stored. */
  secretLast4: string;
  secretPreview?: string;
  permissions?: string[];
  createdAt: ISODate;
  lastUsedAt: ISODate | null;
  revokedAt: ISODate | null;
  status: "active" | "revoked";
}

export interface WebhookEndpoint {
  id: ID;
  merchantId: ID;
  url: string;
  description: string;
  events: string[];
  active: boolean;
  signingSecretLast4: string;
  signingSecretPreview?: string;
  createdAt: ISODate;
  lastDeliveryAt: ISODate | null;
  health: "healthy" | "degraded" | "failing" | "untested";
}

export interface WebhookEvent {
  id: ID;
  merchantId: ID;
  type: string;
  endpointId: ID;
  payloadSummary: string;
  responseStatus: number | null;
  attempts: number;
  status: "pending" | "delivered" | "failed";
  createdAt: ISODate;
  lastAttemptAt: ISODate | null;
  nextRetryAt: ISODate | null;
  relatedPaymentId: ID | null;
  relatedSubscriptionId: ID | null;
  payload: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* GasGuard / relayer                                                  */
/* ------------------------------------------------------------------ */

export interface RelayerTransaction {
  id: ID;
  merchantId: ID;
  operation:
    | "payment.relay"
    | "refund.relay"
    | "subscription.renewal"
    | "subscription.activation";
  gasSponsored: string;
  wbtCost: string;
  status: "submitted" | "confirmed" | "failed" | "rejected" | "pending";
  createdAt: ISODate;
  txRef: string;
  paymentId: ID | null;
  rejectionReason?: string | null;
}

export interface GasGuardPolicy {
  maxGasPerTxGwei: number;
  merchantBudgetWbt: number;
  merchantSpentWbt: number;
  dailyLimitWbt: number;
  dailySpentWbt: number;
  allowedNetwork: string;
  allowedToken: string;
  allowedContract: string;
  allowedFunctions: string[];
  rateLimitPerMinute: number;
  authorisationExpiryCheck: boolean;
  replayProtection: boolean;
  emergencyPaused: boolean;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export interface AppNotification {
  id: ID;
  title: string;
  body: string;
  at: ISODate;
  read: boolean;
  kind: "payment" | "refund" | "subscription" | "exception" | "system";
  link?: string;
}

export interface SecurityEvent {
  id: ID;
  at: ISODate;
  event: string;
  detail: string;
  ip: string;
}

export interface TimelineEntry {
  label: string;
  detail?: string;
  at: ISODate;
  state: "done" | "current" | "todo";
  simulated?: boolean;
}
