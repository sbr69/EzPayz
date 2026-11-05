import type { ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  Code2,
  CreditCard,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Link2,
  ListTree,
  PackageCheck,
  Receipt,
  RefreshCcw,
  Repeat,
  ScrollText,
  Settings,
  Terminal,
  Users,
  Webhook,
} from "lucide-react";
import type {
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionType,
  FulfilmentStatus,
  InvoiceStatus,
  PayeeShieldStatus,
  PaymentStatus,
  RefundStatus,
  SubscriptionStatus,
} from "@/types";

export type Tone =
  | "neutral"
  | "info"
  | "positive"
  | "warn"
  | "danger"
  | "accent"
  | "subtle";

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  created: { label: "Created", tone: "neutral" },
  requires_authorization: { label: "Requires authorization", tone: "info" },
  authorized: { label: "Authorized", tone: "info" },
  submitted: { label: "Submitted", tone: "info" },
  pending_confirmation: { label: "Pending confirmation", tone: "warn" },
  succeeded: { label: "Succeeded", tone: "positive" },
  underpaid: { label: "Underpaid", tone: "warn" },
  overpaid: { label: "Overpaid", tone: "warn" },
  expired: { label: "Expired", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  partially_refunded: { label: "Partially refunded", tone: "accent" },
  refunded: { label: "Refunded", tone: "accent" },
  exception: { label: "Exception", tone: "danger" },
};

export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open", tone: "info" },
  paid: { label: "Paid", tone: "positive" },
  partially_paid: { label: "Partially paid", tone: "warn" },
  overpaid: { label: "Overpaid", tone: "warn" },
  uncollectible: { label: "Uncollectible", tone: "danger" },
  void: { label: "Void", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};

export const REFUND_STATUS_META: Record<RefundStatus, { label: string; tone: Tone }> = {
  created: { label: "Created", tone: "neutral" },
  awaiting_authorization: { label: "Awaiting authorization", tone: "info" },
  authorized: { label: "Authorized", tone: "info" },
  submitted: { label: "Submitted", tone: "info" },
  pending_confirmation: { label: "Pending confirmation", tone: "warn" },
  succeeded: { label: "Succeeded", tone: "positive" },
  failed: { label: "Failed", tone: "danger" },
  exception: { label: "Exception", tone: "danger" },
};

export const SUBSCRIPTION_STATUS_META: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  pending_authorization: { label: "Pending authorization", tone: "info" },
  pending_activation: { label: "Pending activation", tone: "info" },
  active: { label: "Active", tone: "positive" },
  renewal_due: { label: "Renewal due", tone: "warn" },
  processing: { label: "Processing", tone: "info" },
  past_due: { label: "Past due", tone: "warn" },
  paused: { label: "Paused", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

export const FULFILMENT_STATUS_META: Record<FulfilmentStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  processing: { label: "Processing", tone: "info" },
  fulfilled: { label: "Fulfilled", tone: "positive" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  return_requested: { label: "Return requested", tone: "warn" },
  refund_initiated: { label: "Refund initiated", tone: "accent" },
  refunded: { label: "Refunded", tone: "accent" },
};

export const EXCEPTION_STATUS_META: Record<ExceptionStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "danger" },
  investigating: { label: "Investigating", tone: "info" },
  action_required: { label: "Action required", tone: "warn" },
  resolved: { label: "Resolved", tone: "positive" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

export const EXCEPTION_SEVERITY_META: Record<ExceptionSeverity, { label: string; tone: Tone }> = {
  critical: { label: "Critical", tone: "danger" },
  high: { label: "High", tone: "warn" },
  medium: { label: "Medium", tone: "info" },
  low: { label: "Low", tone: "neutral" },
};

export const EXCEPTION_TYPE_LABEL: Record<ExceptionType, string> = {
  underpayment: "Underpayment",
  overpayment: "Overpayment",
  duplicate_payment: "Duplicate payment",
  expired_invoice_paid_late: "Expired invoice paid late",
  failed_transaction: "Failed transaction",
  transaction_reverted: "Transaction reversion",
  insufficient_subscription_balance: "Insufficient subscription balance",
  insufficient_allowance: "Insufficient allowance",
  relayer_failure: "Relayer failure",
  refund_failure: "Refund failure",
  webhook_delivery_failure: "Webhook delivery failure",
  email_delivery_failure: "Email delivery failure",
  unconfirmed_payment: "Unconfirmed payment",
  reconciliation_mismatch: "Reconciliation mismatch",
};

export const PAYEESHIELD_STATUS_META: Record<
  PayeeShieldStatus,
  { label: string; tone: Tone; description: string }
> = {
  verified: {
    label: "Verified",
    tone: "positive",
    description: "Gateway signature matched all protected fields.",
  },
  verification_pending: {
    label: "Verification pending",
    tone: "warn",
    description: "The gateway signature has not been verified yet.",
  },
  invalid_signature: {
    label: "Invalid signature",
    tone: "danger",
    description: "The signature does not match the signed payload.",
  },
  tampered: {
    label: "Tampered",
    tone: "danger",
    description: "A protected field was modified after signing.",
  },
  expired: {
    label: "Expired",
    tone: "warn",
    description: "The signed payment request has passed its expiry.",
  },
  signing_key_revoked: {
    label: "Signing key revoked",
    tone: "danger",
    description: "The gateway signing key that produced this signature was revoked.",
  },
};

export const INTERVAL_LABEL: Record<string, string> = {
  hourly: "Hourly",
  daily: "Daily",
  monthly: "Monthly",
};

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  end?: boolean;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const MERCHANT_NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Payments",
    items: [
      { label: "Payments", to: "/payments", icon: CreditCard },
      { label: "Payment Links", to: "/payment-links", icon: Link2 },
      { label: "Invoices", to: "/invoices", icon: Receipt },
      { label: "Refunds", to: "/refunds", icon: RefreshCcw },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "Customers", to: "/customers", icon: Users },
      { label: "Products & Services", to: "/products", icon: Boxes },
      { label: "Subscriptions", to: "/subscriptions", icon: Repeat },
      { label: "Fulfilment", to: "/fulfilment", icon: PackageCheck },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Exceptions", to: "/exceptions", icon: AlertTriangle },
      { label: "Analytics", to: "/analytics", icon: BarChart3 },
      { label: "GasGuard", to: "/gasguard", icon: Gauge },
    ],
  },
  {
    title: "Developers",
    items: [
      { label: "Overview", to: "/developers", icon: Terminal, end: true },
      { label: "API Keys", to: "/developers/api-keys", icon: KeyRound },
      { label: "Webhooks", to: "/developers/webhooks", icon: Webhook },
      { label: "Event Logs", to: "/developers/events", icon: ListTree },
      { label: "SDK & Integration", to: "/developers/quickstart", icon: Code2 },
      { label: "API Reference", to: "/developers/api-reference", icon: BookOpen },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Business Profile", to: "/settings/business", icon: Settings },
      { label: "Payout Wallet", to: "/settings/wallet", icon: Activity },
      { label: "Checkout", to: "/settings/checkout", icon: ScrollText },
      { label: "Notifications", to: "/settings/notifications", icon: ListTree },
      { label: "Security", to: "/settings/security", icon: KeyRound },
      { label: "Gas Sponsorship", to: "/settings/gas-sponsorship", icon: Gauge },
    ],
  },
];
