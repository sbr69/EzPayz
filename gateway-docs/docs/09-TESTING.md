# 09 · Testing

Rule: **a feature is done when a test or a recorded transaction proves it.**

## 1. Contracts (Foundry)

| Area | Tests |
|---|---|
| `MerchantRegistry` | register once; only owner mutates; zero-address rejected; payoutVersion bumps; events |
| `settle` | pays registry payout; wrong nonce reverts; second settle same `intentId` reverts; inactive merchant reverts; paused reverts; amount/payer mismatch reverts via bad signature |
| `settleOpen` | recipient from registry; token nonce reuse reverts |
| `refund` | cap enforced; fuzz `Σrefunds ≤ paid`; wrong destination impossible; effects-before-interaction; token revert leaves state unchanged |
| Invariants | router token balance always 0; `refunded ≤ paid`; no payout other than registry/payer |
| Adversarial token | reverting/reentrant mock token cannot corrupt state |
| Live (Sepolia) | one real settle + one refund against the required USDT (record tx hashes) |

## 2. API / backend (vitest)

- Tenant isolation: merchant A cannot read/modify merchant B resources (each resource type).
- Idempotency: same key same body; same key different body → conflict.
- PayeeShield: valid passes; tampered payout/amount/token/chain/version, expired, replayed nonce fail.
- Authorize: expired window, wrong chain, wrong token, bad signature, insufficient balance, nonce mismatch → correct error codes.
- GasGuard: each rule has a rejecting test; budget exhaustion; pause switch; rate limits.
- Observer: duplicate logs, out-of-order logs, restart/backfill, reorg simulation → no state regression.
- Webhooks: signature verification, replay protection, retry/backoff, dedupe by event ID.
- Refunds: partial, full, over-refund rejected, double-submit idempotent.
- Exceptions: underpaid, overpaid, duplicate, expired-but-paid detection.
- x402: verify rejects wrong `payTo`/amount/expired/used nonce; settle goes through GasGuard.
- CRE report intake: bad auth rejected; `not_fulfilled` creates exception only (never refund).
- Arkiv reader: tampered listing signature or mismatched `payTo` flagged.

## 3. End-to-end (Playwright + scripted wallet)

1. Merchant registers wallet → creates intent in `demo-store` → payer pays with **0 WBT** → `succeeded` → webhook received → receipt email sent (Mailpit).
2. Payment link (fixed, range, expired, disabled).
3. Partial refund then over-refund rejected.
4. Tampered invoice blocked in checkout UI.
5. Agent pays x402 route; dashboard shows it.
6. `/discover` lists live Arkiv entities; selecting an offer passes the payout check.
7. CRE simulation reports unfulfilled order → exception visible.

## 4. Manual checks before recording the demo

- Fresh browser profile, wallet with USDT and **no WBT**.
- Chain switch prompt works.
- Explorer links open the right tx and contract pages.
- Relayer balance sufficient; budgets not exhausted.

## 5. CI

`pnpm lint && pnpm typecheck && pnpm test` and `forge test`; e2e runs locally or in a nightly job.
