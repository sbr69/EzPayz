// Deployed contract addresses on Whitechain Sepolia (chain ID 1874).
// SubscriptionContract v2 (with BySig functions) deployed 2026-11-01; source verified on the explorer.

export const SUBSCRIPTION_CONTRACT_ADDRESS = "0xb084286fc4649021eb4486e92b4a83f815c0dd08";

// Contract admin (DEFAULT_ADMIN_ROLE) — the deployer (test payer key, hackathon-only).
export const SUBSCRIPTION_CONTRACT_ADMIN = "0xa201EEE38742FE108556089F1F330dcC3944071A";

// CHARGER_ROLE = keccak256("CHARGER_ROLE") — granted to the relayer after deploy.
export const CHARGER_ROLE =
  "0x95d23672fd9235cfc30c077eaa07dd8041af377c236e6f3c1031e8f60cdf8fd8";

// Explorer link to the verified contract source.
export const SUBSCRIPTION_CONTRACT_EXPLORER =
  "https://explorer.testnet.whitechain.io/address/0xb084286fc4649021eb4486e92b4a83f815c0dd08/contracts";
