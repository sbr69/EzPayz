// Minimal SubscriptionContract ABI for the relayer + observer.
// Full source verified on the explorer (0xc0Bc1f…2c40).
// v2 includes createSubscriptionBySig + cancelBySig for gasless subscription lifecycle.
export const SUBSCRIPTION_ABI = [
  {
    inputs: [{ type: "bytes32" }, { type: "uint256" }, { type: "uint256" }],
    name: "charge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { type: "bytes32" }, { type: "address" }, { type: "address" },
      { type: "uint256" }, { type: "uint256" }, { type: "uint256" },
      { type: "uint256" }, { type: "uint256" }, { type: "uint256" },
      { type: "uint256" }, { type: "bytes" },
    ],
    name: "createSubscriptionBySig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }, { type: "bytes" }],
    name: "cancelBySig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "bytes32" }],
    name: "getSubscription",
    outputs: [
      { name: "payer", type: "address" },
      { name: "merchant", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "intervalSeconds", type: "uint256" },
      { name: "maxChargePerCycle", type: "uint256" },
      { name: "cumulativeCap", type: "uint256" },
      { name: "totalSpent", type: "uint256" },
      { name: "nextDueTime", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "cancelled", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "bytes32" }],
    name: "remainingCumulative",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "domainSeparatorV4",
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "subscriptionId", type: "bytes32" },
      { indexed: true, name: "periodId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "totalSpent", type: "uint256" },
      { indexed: false, name: "nextDueTime", type: "uint256" },
    ],
    name: "SubscriptionCharged",
    type: "event",
  },
] as const;
