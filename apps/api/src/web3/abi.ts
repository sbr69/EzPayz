// Minimal USDT ABI for the gateway's on-chain reads + relayer submission.
// The full verified ABI is on the explorer (impl 0x2642…026F7).
export const USDT_ABI = [
  { inputs: [], name: "decimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "DOMAIN_SEPARATOR", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
  {
    inputs: [{ type: "address" }, { type: "bytes32" }],
    name: "authorizationState",
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "address" }, { type: "address" }, { type: "uint256" },
      { type: "uint256" }, { type: "uint256" }, { type: "bytes32" }, { type: "bytes" },
    ],
    name: "transferWithAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
] as const;
