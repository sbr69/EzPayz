// Settlement / finality policy for Whitechain Sepolia.
// Block time observed ~1s in Phase 0.5 — see docs/EIP3009_VERIFICATION.md §5.
// Thresholds are tunable; defaults below. A payment is marked 'succeeded'
// only after FINALITY_BLOCKS (or a merchant-configurable lower threshold).

export const BLOCK_TIME_SECONDS = 1;

// Blocks to wait before treating a transaction as 'confirmed' (included).
export const CONFIRMATION_BLOCKS = 1;

// Blocks to wait before treating a transaction as 'finalized' (settlement).
export const FINALITY_BLOCKS = 5;

export const SETTLEMENT_STATE = {
  PROCESSING: "processing",
  CONFIRMED: "confirmed",
  FINALIZED: "finalized",
} as const;

export type SettlementState =
  (typeof SETTLEMENT_STATE)[keyof typeof SETTLEMENT_STATE];
