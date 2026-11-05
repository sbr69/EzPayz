# 07 · Implementation plan

Tick boxes as you go. **Order matters.** If time runs short, cut from the bottom (see "Cut line"). Every task has acceptance criteria that can be demonstrated by a test or a transaction hash.

Unknown: the hackathon deadline. Fill this in and schedule backward: `DEADLINE = ____`.

## Phase 0: Gates and scaffolding (first, before any feature)

- [ ] **G0.1 Repo scaffold.** pnpm workspace, folders from README, CI (lint, typecheck, test), `.env.example`, MIT/Apache-2.0 `LICENSE`, `AI_USAGE.md`, `WHITECHAIN_FEEDBACK.md` stub. *Accept:* CI green on first push. Commit early and often.
- [ ] **G0.2 Network check.** Confirm chain ID, RPC, explorer, faucet from current docs; fund a deployer, relayer and two test payer wallets with WBT and test USDT. *Accept:* `cast chain-id` returns 1874; balances recorded in notes.
- [ ] **G1 EIP-3009 on real USDT.** Fetch ABI/source from the explorer; read `name/symbol/decimals/version`/`DOMAIN_SEPARATOR`; sign a `TransferWithAuthorization` from a funded payer and submit from another wallet. *Accept:* tx hash on explorer; result documented in `10-RISKS-AND-GATES.md`. **If it fails: stop and re-plan with the human.**
- [ ] **G2 Wallet typed-data.** Sign the typed data in MetaMask (and one fallback wallet) on chain 1874. *Accept:* signature recovers to the signer.
- [ ] **G3 CRE reach.** Read CRE docs for supported networks/triggers; run the template workflow in simulation. Decide write-back mode (on-chain vs HTTP only). *Accept:* `cre workflow simulate` runs; decision recorded.
- [ ] **G4 Arkiv hello world.** With `@arkiv-network/sdk`, create one entity, query it back, note expiry semantics and funding needs. *Accept:* entity key + query output recorded.
- [ ] **G5 x402 spec check.** Read current x402 spec and `@x402/*` packages; confirm EVM "exact" payload fields and nonce handling. *Accept:* notes in `10-RISKS-AND-GATES.md`.

## Phase 1: Contracts

- [ ] **C1 `MerchantRegistry`** + unit tests. *Accept:* all registry invariants (04 §1) tested.
- [ ] **C2 `GatewayRouter.settle`** with mock EIP-3009 token. *Accept:* invariants 1,2,4,5,7,8 tested incl. fuzz.
- [ ] **C3 `settleOpen`, `refund`, pause, relayer rotation.** *Accept:* invariants 3 and 6 tested; invariant test for `refunded <= paid`.
- [ ] **C4 Deploy + verify on Whitechain Sepolia.** *Accept:* verified source on explorer; addresses in `deployments/whitechain-sepolia.json` and README.
- [ ] **C5 Live settle test against real USDT.** *Accept:* one real tx via router; **save explorer link for README**.

## Phase 2: API core

- [ ] **A1 Config, DB migrations, auth (API keys), merchant creation, tenant-scoped repository layer.** *Accept:* cross-tenant access test fails closed.
- [ ] **A2 On-chain merchant registration flow** (calldata for owner wallet; registry sync). *Accept:* merchant registered on-chain via dashboard/CLI.
- [ ] **A3 PayeeShield signer** (per-merchant key; EIP-712 payload; verification helper shared with checkout). *Accept:* valid passes; tampered payout/amount/token/chain/expired fail (unit tests).
- [ ] **A4 Payment intents** (create, retrieve, idempotency, expiry job). *Accept:* repeat POST with same key returns same intent.
- [ ] **A5 Authorize endpoint + GasGuard-lite + relayer** (`settle` only). *Accept:* real gasless payment from a wallet with **zero WBT**; unsafe requests rejected with `gasguard_rejected`.
- [ ] **A6 Chain observer + confirmation policy + payments table.** *Accept:* status becomes `succeeded` only from verified logs; survives restart; backfill works.
- [ ] **A7 Outbox, webhooks (HMAC, retries, replay), receipt email.** *Accept:* demo-store verifies signature; failure retried; no regression of state.

## Phase 3: Checkout and SDK

- [ ] **W1 Hosted checkout page** `/c/[id]`: merchant, amount, token, payout, PayeeShield ✓/✗, wallet connect, sign, status polling. *Accept:* end-to-end on Sepolia.
- [ ] **W2 Payment links + QR** (`/l/[slug]`, fixed and range). *Accept:* disabled/expired link rejects.
- [ ] **S1 `@stablegate/sdk`, `@stablegate/react`, `@stablegate/middleware`.** *Accept:* typed, documented, published locally via workspace.
- [ ] **S2 `apps/demo-store`** (separate app, ≈20 lines integration). *Accept:* line count shown in README; works end to end.

## Phase 4: Merchant dashboard and refunds

- [ ] **D1 Dashboard:** overview, payments, links, developers (keys, webhooks, deliveries), operator/GasGuard view.
- [ ] **R1 Refunds (router path)** with merchant typed-data signature and on-chain cap. *Accept:* partial refund succeeds; over-refund rejected by API and by contract.
- [ ] **R2 Manual-refund fallback + labeling.**
- [ ] **E1 Minimal exceptions:** underpaid, duplicate, expired-but-paid, tx failed. *Accept:* each triggered in a test and listed in dashboard.

**Milestone M1 (core complete):** real USDT checkout + refund + webhook + dashboard + demo-store. Record a draft demo video here as insurance.

## Phase 5: x402

- [ ] **X1 Facilitator** `/supported`, `/verify`, `/settle` using `settleOpen`.
- [ ] **X2 Paywall middleware** and `x402_resources` management.
- [ ] **X3 `apps/demo-agent`** with a spending policy. *Accept:* agent pays a priced route with real USDT; payment appears in dashboard with `source=x402`; GasGuard applies the same limits.

## Phase 6: Chainlink CRE

- [ ] **H1 Workflow:** cron trigger → fetch overdue payments from API → HTTP check merchant fulfilment endpoint → produce report. *Accept:* `cre workflow simulate` succeeds with a fulfilled and an unfulfilled case.
- [ ] **H2 Report intake** `POST /v1/cre/reports` (authenticated) → `fulfilments` update → `not_fulfilled` exception + "suggest refund" in dashboard. *Accept:* end-to-end in simulation; no automatic refund.
- [ ] **H3 (bonus) On-chain write-back or live deploy** if G3 showed support.

## Phase 7: Arkiv

- [ ] **K1 Publisher:** write `merchant_profile` and `offer` entities with listing signatures; renewal worker.
- [ ] **K2 Reader:** `GET /v1/discover` and `/discover` page read from Arkiv with filters; verify `payTo` against `MerchantRegistry` and listing signature before showing "Pay". *Accept:* live entities visible; tampered listing flagged.
- [ ] **K3 Agent discovery** in `demo-agent`: agent finds an x402 offer via query then pays.
- [ ] **K4 Arkiv docs** (`/arkiv/*.md`), runnable import/publish script, README wallet + one query.

## Phase 8: Hardening and submission

- [ ] **Z1 GasGuard polish:** pause switch, low-balance alert, circuit breaker, budgets visible.
- [ ] **Z2 Security pass** (08 checklist); remove secrets from logs; rotate test keys.
- [ ] **Z3 README** (setup, architecture, limitations, explorer links, "why onchain stablecoin settlement on Whitechain").
- [ ] **Z4 `WHITECHAIN_FEEDBACK.md`, `AI_USAGE.md`, per-sponsor files** (11).
- [ ] **Z5 Demo video 2–4 min** showing merchant, payer, agent.
- [ ] **Z6 Final verification:** fresh clone → setup works; links resolve; contracts verified.

## Cut line (if time is short)

Cut in this order: **K3 → K1/K2 (drop Arkiv track) → H3 → H1/H2 (drop CRE track) → X3 polish → R2 → E1 → W2**. Never cut: G1, C1–C5, A1–A7, W1, S1–S2, R1, Z3–Z6. A fully working gateway with refunds beats a half-working everything.

## Commit and branch hygiene

- `main` always deployable. Short-lived branches per task ID (`feat/a5-authorize`).
- Conventional commits; reference task IDs.
- Push at least daily; never batch a day of work into one commit.
