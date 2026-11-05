import {
  EXCEPTION_SEVERITY_META,
  EXCEPTION_STATUS_META,
  FULFILMENT_STATUS_META,
  INVOICE_STATUS_META,
  PAYEESHIELD_STATUS_META,
  PAYMENT_STATUS_META,
  REFUND_STATUS_META,
  SUBSCRIPTION_STATUS_META,
  type Tone,
} from "@/config/ui";
import type {
  ExceptionSeverity,
  ExceptionStatus,
  FulfilmentStatus,
  InvoiceStatus,
  PayeeShieldStatus,
  PaymentStatus,
  RefundStatus,
  SubscriptionStatus,
} from "@/types";

function toToneMap<T extends string>(meta: Record<T, { label: string; tone: Tone }>): Record<T, Tone> {
  const out = {} as Record<T, Tone>;
  (Object.keys(meta) as T[]).forEach((k) => {
    out[k] = meta[k].tone;
  });
  return out;
}

export const PAYMENT_TONES = toToneMap<PaymentStatus>(PAYMENT_STATUS_META);
export const INVOICE_TONES = toToneMap<InvoiceStatus>(INVOICE_STATUS_META);
export const REFUND_TONES = toToneMap<RefundStatus>(REFUND_STATUS_META);
export const SUBSCRIPTION_TONES = toToneMap<SubscriptionStatus>(SUBSCRIPTION_STATUS_META);
export const FULFILMENT_TONES = toToneMap<FulfilmentStatus>(FULFILMENT_STATUS_META);
export const EXCEPTION_STATUS_TONES = toToneMap<ExceptionStatus>(EXCEPTION_STATUS_META);
export const EXCEPTION_SEVERITY_TONES = toToneMap<ExceptionSeverity>(EXCEPTION_SEVERITY_META);
export const PAYEEESHIELD_TONES = toToneMap<PayeeShieldStatus>(PAYEESHIELD_STATUS_META);
