/**
 * Central application configuration.
 *
 * IMPORTANT PRODUCT QUALIFICATION
 * -------------------------------
 * The token contract address, chain id and decimal precision below are
 * configurable *metadata* used by the frontend for display only. The frontend
 * does NOT assume that the configured test USDT contract implements EIP-3009;
 * `eip3009Verified` stays false until the integration is verified against the
 * deployed contract. All simulated operations are controlled by `demoMode`.
 */

export const DEMO = {
  /** Master switch for every simulated operation in the app. */
  demoMode: true,
  /** Simulated latencies (ms) used by the mock service layer. */
  delays: {
    fast: 320,
    medium: 750,
    slow: 1400,
    step: 1100,
  },
  /** Prefix used for every demo transaction reference. */
  txPrefix: "demo-tx",
  authPrefix: "demo-auth-3009",
} as const;

export interface NetworkConfig {
  id: string;
  name: string;
  chainId: number;
  chainIdHex: string;
  currency: { symbol: string; name: string; decimals: number | null; decimalsVerified: boolean };
  explorerLabel: string;
  explorerUrl: string | null;
  rpcLabel: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  "whitechain-sepolia": {
    id: "whitechain-sepolia",
    name: "Whitechain Sepolia",
    chainId: 1874,
    chainIdHex: "0x752",
    currency: {
      symbol: "WBT",
      name: "WhiteBIT Token",
      decimals: 18,
      decimalsVerified: false,
    },
    explorerLabel: "Whitechain explorer",
    explorerUrl: null,
    rpcLabel: "Configured RPC endpoint (demo)",
  },
  "whitechain-mainnet": {
    id: "whitechain-mainnet",
    name: "Whitechain",
    chainId: 1,
    chainIdHex: "0x1",
    currency: { symbol: "WBT", name: "WhiteBIT Token", decimals: 18, decimalsVerified: false },
    explorerLabel: "Whitechain explorer",
    explorerUrl: null,
    rpcLabel: "Configured RPC endpoint (demo)",
  },
};

export const DEFAULT_NETWORK = NETWORKS["whitechain-sepolia"];

export interface TokenConfig {
  symbol: string;
  name: string;
  networkId: string;
  /** Contract address is configurable metadata — not an endorsement of its feature set. */
  contract: string;
  decimals: number | null;
  decimalsVerified: boolean;
  /** False until the deployed contract is verified to implement EIP-3009. */
  eip3009Verified: boolean;
  displayPrecision: number;
}

export const TOKEN: TokenConfig = {
  symbol: "USDT",
  name: "Tether USD (test)",
  networkId: "whitechain-sepolia",
  contract: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  decimals: 6,
  decimalsVerified: false,
  eip3009Verified: false,
  displayPrecision: 2,
};

export const TOKENS = [TOKEN];

export const GATEWAY = {
  productName: "EzPayz",
  tagline: "One integration. Complete USDT payment infrastructure on Whitechain.",
  docsVersion: "v0.9 (provisional)",
  apiBase: "https://api.example-whitepay-gateway.dev/v1",
  sdkPackage: "@whitepay/usdt-sdk",
} as const;

/**
 * Webhook event catalogue offered to merchants.
 *
 * Canonical list: union of PRD §18.1 and FLOW §14.1 with one name per event.
 * Doc conflicts resolved to: payment.processing, subscription.renewed,
 * subscription.renewal_failed and fulfilment.updated (PRD spelling).
 * Every emitted webhook type must appear here.
 */
export const WEBHOOK_EVENTS: { group: string; events: string[] }[] = [
  {
    group: "Payment",
    events: [
      "payment.created",
      "payment.processing",
      "payment.succeeded",
      "payment.failed",
      "payment.expired",
      "payment.underpaid",
      "payment.overpaid",
      "payment.duplicate_detected",
      "payment.exception",
    ],
  },
  {
    group: "Refund",
    events: ["refund.created", "refund.processing", "refund.succeeded", "refund.failed"],
  },
  { group: "Invoice", events: ["invoice.paid"] },
  {
    group: "Subscription",
    events: [
      "subscription.created",
      "subscription.renewal_due",
      "subscription.renewed",
      "subscription.renewal_failed",
      "subscription.cancelled",
    ],
  },
  { group: "Fulfilment", events: ["fulfilment.updated"] },
];

export const ROADMAP = [
  {
    title: "x402 support",
    detail:
      "Programmatic and API-native payments so machines can pay machines over HTTP with USDT.",
    status: "Coming later",
  },
  {
    title: "Arkiv registry integration",
    detail:
      "Searchable merchant registry and expiring payment offers published and resolved on Whitechain.",
    status: "Coming later",
  },
  {
    title: "Chainlink CRE",
    detail: "Trigger external business workflows from verified payment and settlement events.",
    status: "Coming later",
  },
  {
    title: "WhiteBIT USDT-to-fiat off-ramp",
    detail:
      "Optional conversion of settled USDT to fiat, subject to availability, eligibility and regional compliance.",
    status: "Coming later",
  },
  {
    title: "EzPayz interoperability",
    detail: "Interop with the EzPayz product surface, subject to public API availability.",
    status: "Coming later",
  },
  {
    title: "Multi-chain acceptance",
    detail: "Accept USDT across additional chains from a single merchant account.",
    status: "Coming later",
  },
  {
    title: "Discoverable API / service marketplace",
    detail: "Merchants publish paid APIs and services that customers can discover and subscribe to.",
    status: "Coming later",
  },
  {
    title: "Verified merchant identities",
    detail: "Optional business verification layer that merchants can complete and display.",
    status: "Coming later",
  },
  {
    title: "Procurement Mode",
    detail: "Multi-approver purchase approvals for teams buying through the gateway.",
    status: "Coming later",
  },
  {
    title: "Advanced B2B reconciliation",
    detail: "Statement-level reconciliation, exports and ERP-friendly reporting.",
    status: "Coming later",
  },
] as const;

export const WALLET_DISCLOSURE =
  "Wallet connection confirms control of an address. It is not legal or business identity verification.";

export const GASLESS_DISCLOSURE =
  "Network gas is sponsored by the merchant through this gateway. You do not need WBT for gas for this supported checkout flow — but you still authorise the payment with a signature from your wallet.";

export const SUBSCRIPTION_GAS_DISCLOSURE =
  "Initial token approval and subscription activation require customer-paid network gas in the current MVP.";

export const REFUND_GAS_NOTE =
  "Refunds are a new USDT transaction from the merchant to the customer. They never reverse the original blockchain transaction.";
