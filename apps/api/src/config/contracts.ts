// Deployed contract addresses on Whitechain Sepolia (chain ID 1874).
// SubscriptionContract deployed in Phase 1.8; source verified on the explorer.

export const SUBSCRIPTION_CONTRACT_ADDRESS = "0x0b8Da2EE37f3599141aFD500b1e2699D5A6bCdbB";

// Contract admin (DEFAULT_ADMIN_ROLE) — the deployer (test payer key, hackathon-only).
// In Phase 5 the gateway uses this admin to grant CHARGER_ROLE to the relayer.
export const SUBSCRIPTION_CONTRACT_ADMIN = "0xa201EEE38742FE108556089F1F330dcC3944071A";

// CHARGER_ROLE = keccak256("CHARGER_ROLE") — read on-chain after deploy.
export const CHARGER_ROLE =
  "0x95d23672fd9235cfc30c077eaa07dd8041af377c236e6f3c1031e8f60cdf8fd8";

// Explorer link to the verified contract source.
export const SUBSCRIPTION_CONTRACT_EXPLORER =
  "https://explorer.testnet.whitechain.io/address/0x0b8Da2EE37f3599141aFD500b1e2699D5A6bCdbB/contracts";
