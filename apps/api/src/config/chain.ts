// Whitechain Sepolia network configuration.
// Confirmed live in Phase 0.2 — see docs/EIP3009_VERIFICATION.md.
// Phase 3 wraps these constants in viem's defineChain().

export const WHITECHAIN_CHAIN_ID = 1874;
export const WHITECHAIN_RPC_URL = "https://rpc.testnet.whitechain.io";
export const WHITECHAIN_WS_URL = "wss://rpc.testnet.whitechain.io/ws";
export const WHITECHAIN_EXPLORER_URL = "https://explorer.testnet.whitechain.io";
export const WHITECHAIN_EXPLORER_API = "https://explorer.testnet.whitechain.io/api/v2";
export const WHITECHAIN_NATIVE_SYMBOL = "WBT";
export const WHITECHAIN_NATIVE_DECIMALS = 18;

// Required ETHGlobal test USDT.
// EIP-1967 transparent proxy -> TetherTokenV2 implementation (source-verified).
export const USDT_ADDRESS = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
export const USDT_IMPLEMENTATION_ADDRESS =
  "0x26425662D126412128967ECf0a02EC48573026F7";
export const USDT_DECIMALS = 6;
export const USDT_SYMBOL = "USDT";
export const USDT_NAME = "Tether USD";
export const USDT_DOMAIN_SEPARATOR =
  "0xcdcfacb6b15c8238b4e5fbb47bdb83b7f83f50a531d264bf9763d2bd1d3d2a25";

// Public RPC rate limit (whitechain-dev skill, network.md).
export const RPC_RATE_LIMIT_RPS = 50;
