import { DEMO } from "@/config/app";
import { mockApi, type MockApi } from "./mock/adapter";

/**
 * Service abstraction layer.
 *
 * The UI only ever talks to `api`. When a real backend exists, implement the
 * same surface with an HTTP adapter and swap the export below — no UI code
 * changes required.
 *
 *   src/services/api/httpAdapter.ts   -> GatewayApi over fetch
 *   src/services/adapters/...         -> request/response mapping
 *
 * While `DEMO.demoMode` is true every operation is simulated in the browser and
 * no network request is made.
 */

export type GatewayApi = MockApi;

export const api: GatewayApi = mockApi;

export const isDemoMode = () => DEMO.demoMode;

export { hostedUrl } from "./mock/adapter";
export type {
  CreatePaymentInput,
  CreateRefundInput,
  CreatePlanInput,
  CreateInvoiceInput,
  CreateLinkInput,
  PayeeShieldMutation,
} from "./mock/adapter";
