// Service abstraction layer.
//
// Adapter selection happens at RUNTIME, per session:
//   - If VITE_DEMO_MODE=true (build-time env), mock is forced for everyone.
//   - Else, if the logged-in account is the demo account (store.isDemo), the
//     mock adapter is used (seed data, simulated wallet, no API calls).
//   - Otherwise the real HTTP adapter is used.
//
// The `api` export is a Proxy that delegates every method call to the
// currently-active adapter, so flipping into demo mode at login time takes
// effect immediately without a reload.

import { useDemo } from "@/store/demoStore";
import { realApi } from "./api/adapter";
import { mockApi, type MockApi } from "./mock/adapter";

export type GatewayApi = MockApi;

const ENV_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

function activeAdapter(): GatewayApi {
  if (ENV_DEMO) return mockApi;
  return useDemo.getState().isDemo ? mockApi : (realApi as unknown as GatewayApi);
}

export const api: GatewayApi = new Proxy({} as GatewayApi, {
  get(_target, prop) {
    const adapter = activeAdapter() as unknown as Record<PropertyKey, unknown>;
    const value = adapter[prop as PropertyKey];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(adapter)
      : value;
  },
}) as GatewayApi;

export function hostedUrl(fragment: string): string {
  if (typeof window === "undefined") return `https://checkout.ezpayz.example/${fragment}`;
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/${fragment}`;
}

export type {
  CreatePaymentInput,
  CreateRefundInput,
  CreatePlanInput,
  CreateInvoiceInput,
  CreateLinkInput,
  PayeeShieldMutation,
} from "./mock/adapter";
