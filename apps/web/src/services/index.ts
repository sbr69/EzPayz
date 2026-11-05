// Service abstraction layer.
//
// The dashboard now uses the REAL gateway API (services/api/adapter.ts) instead of
// the mock adapter at runtime. The mock adapter file is preserved (not deleted) for
// its type definitions, which the dashboard pages rely on.
//
// The real adapter is cast to the mock type so pages keep their TypeScript types.
// At runtime, methods either call the real API or throw a clear error (for
// simulation-only methods like authorizePayment/relayPayment that are backend-internal).
//
// To revert to mock mode for testing, uncomment the mockApi line and comment out realApi.

import { type MockApi } from "./mock/adapter";
import { realApi } from "./api/adapter";

// Cast: the real adapter implements the same method names as the mock, but with
// different parameter types. At runtime it calls the real API; TypeScript sees
// the mock types for backward compatibility with all dashboard pages.
export type GatewayApi = MockApi;
export const api: GatewayApi = realApi as unknown as MockApi;

export const isDemoMode = () => false;

export function hostedUrl(fragment: string): string {
  if (typeof window === "undefined") return `https://checkout.ezpayz.example/${fragment}`;
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/${fragment}`;
}

// Re-export types from the mock adapter (type-only, no runtime code).
export type {
  CreatePaymentInput,
  CreateRefundInput,
  CreatePlanInput,
  CreateInvoiceInput,
  CreateLinkInput,
  PayeeShieldMutation,
} from "./mock/adapter";
