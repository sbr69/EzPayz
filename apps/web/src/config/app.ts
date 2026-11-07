/**
 * Central application configuration.
 *
 * IMPORTANT PRODUCT QUALIFICATION
 * -------------------------------
 * The token contract address, chain id and decimal precision below are
 * configurable *metadata* used by the frontend for display only. The frontend
 * does NOT assume that the configured test USDT contract implements EIP-3009;
 * `eip3009Verified`/`decimalsVerified` reflect the on-chain verification recorded
 * in docs/EIP3009_VERIFICATION.md (31 Oct 2026: ABI probe + live settlement test).
 */

/**
 * Demo/simulation master switch — driven by the build environment.
 * When `VITE_DEMO_MODE` is not exactly "true", every simulated operation
 * (mock banner, simulated wallet, demo tx prefixes) is disabled and the
 * demo login path is compiled out of the bundle.
 */
export const DEMO = {
  /** Master switch for every simulated operation in the app. */
  demoMode: import.meta.env.VITE_DEMO_MODE === "true",
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
  rpcUrl: string;
  wsUrl: string;
  currency: { symbol: string; name: string; decimals: number | null; decimalsVerified: boolean };
  explorerLabel: string;
  explorerUrl: string | null;
  faucetUrl: string | null;
  bridgeUrl: string | null;
  rpcLabel: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  "whitechain-sepolia": {
    id: "whitechain-sepolia",
    name: "Whitechain Sepolia",
    chainId: 1874,
    chainIdHex: "0x752",
    rpcUrl: "https://rpc.testnet.whitechain.io",
    wsUrl: "wss://rpc.testnet.whitechain.io/ws",
    currency: {
      symbol: "WBT",
      name: "WhiteBIT Token",
      decimals: 18,
      decimalsVerified: false,
    },
    explorerLabel: "Whitechain explorer",
    explorerUrl: "https://explorer.testnet.whitechain.io",
    faucetUrl: "https://faucet.testnet.whitechain.io",
    bridgeUrl: "https://bridge.testnet.whitechain.io",
    rpcLabel: "Whitechain official public RPC",
  },
  "whitechain-mainnet": {
    id: "whitechain-mainnet",
    name: "Whitechain",
    chainId: 1875,
    chainIdHex: "0x753",
    rpcUrl: "https://rpc.whitechain.io",
    wsUrl: "wss://rpc.whitechain.io/ws",
    currency: { symbol: "WBT", name: "WhiteBIT Token", decimals: 18, decimalsVerified: false },
    explorerLabel: "Whitechain explorer",
    explorerUrl: "https://explorer.whitechain.io",
    faucetUrl: null,
    bridgeUrl: "https://bridge.whitechain.io",
    rpcLabel: "Whitechain official public RPC",
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
  // Both verified against the deployed contract on 31 Oct 2026 —
  // see docs/EIP3009_VERIFICATION.md (ABI probe + live settlement test).
  decimalsVerified: true,
  eip3009Verified: true,
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

export const WALLET_DISCLOSURE =
  "Wallet connection confirms control of an address. It is not legal or business identity verification.";

export const GASLESS_DISCLOSURE =
  "Network gas is sponsored by the merchant through this gateway. You do not need WBT for gas for this supported checkout flow — but you still authorise the payment with a signature from your wallet.";

export const SUBSCRIPTION_GAS_DISCLOSURE =
  "Initial token approval and subscription activation require customer-paid network gas in the current MVP.";

export const REFUND_GAS_NOTE =
  "Refunds are a new USDT transaction from the merchant to the customer. They never reverse the original blockchain transaction.";
