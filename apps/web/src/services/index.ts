// Service abstraction layer.
//
// Feature flag: when VITE_DEMO_MODE=true, the app uses the mock adapter (seed data,
// simulated wallet, no API calls). When unset (default), the real HTTP adapter is active.
//
// To test UI with mock data: create .env.demo with VITE_DEMO_MODE=true, run: vite --mode demo
// The mock adapter code is preserved and fully functional — no deletion, no commenting.

import { type MockApi } from "./mock/adapter";
import { realApi } from "./api/adapter";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export type GatewayApi = MockApi;
export const api: GatewayApi = (DEMO_MODE ? (await import("./mock/adapter")).mockApi : realApi) as unknown as MockApi;

export const isDemoMode = () => DEMO_MODE;

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
