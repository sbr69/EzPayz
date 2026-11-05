// Minimal SubscriptionContract ABI for the relayer + observer.
// Full source verified on the explorer (0xc4553963…b5b6).
export const SUBSCRIPTION_ABI = [
  {
    inputs: [{ type: "bytes32" }, { type: "uint256" }, { type: "uint256" }],
    name: "charge",
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
