# ISSUE.md — Gateway issues blocking live merchant integrations

> **Context.** The merchant app **USDTStore** ( Next.js marketplace) is already
> fully integrated against the documented StableGate API (`gateway-docs/docs/05-API-AND-SDK.md`):
> payment intents, hosted-checkout redirect, signed-webhook receiver, refunds, fulfilment-status
> endpoint for CRE, x402 route, and a `/api/stablegate/health` probe. It compiles, builds, and its
> webhook pipeline was verified end-to-end. **Nothing on the merchant side needs fixing.**
>
> This file lists everything on the **gateway side** that must be built/fixed so that merchant
> integrations stop falling back to manual reconciliation and run the real automatic flow.
> Priorities: **P0** = blocks any merchant checkout · **P1** = required for the full flow ·
> **P2** = after the merchant flow works.
>
> Written: 2026-11-01 · Evidence for on-chain claims was gathered live (see Appendix).

---

## 0. Verified findings (do not re-discover these)

| # | Finding | Evidence |
|---|---|---|
| F1 | **Gate G1 FAILED** — test USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` ("Tether USD", 6 decimals, verified `TetherTokenV2`) is a **plain ERC-20**: no EIP-3009 (`transferWithAuthorization` both overloads, `authorizationState`, `nonces`, `DOMAIN_SEPARATOR` all absent from runtime bytecode), no EIP-2612 `permit`. **Gasless checkout and the x402 "exact" scheme are impossible with this token.** | Selector search over `eth_getCode` on 2026-11-01; recorded in `docs/10-RISKS-AND-GATES.md` |
| F2 | The repository is **frontend-only** (Vite dashboard). `package.json` has no server framework and no DB/chain client. The documented API on `:4000` does not exist; nothing listens on any port. | `package.json` scripts + port probes, 2026-11-01 |
| F3 | No contracts are deployed (docs status table: all ☐). | `gateway-docs/docs/…` status tables |
| F4 | Relayer wallet `0x82BDe0d470951DD1804Cc9E18746e49F0d0ce073` holds **0.198 WBT** and **24.29 USDT** (usable for tests). Faucet: `https://faucet.testnet.whitechain.io`, 0.5 WBT per rolling 24h, GitHub OAuth (account ≥30 days). | explorer.testnet.whitechain.io API |
| F5 | `PAYEESHIELD_SIGNING_KEY` is **empty** in `.env` — invoices cannot be signed even once the API exists. | `.env` |
| F6 | Gateway Neon Postgres URL and Upstash Redis are configured in `.env` but no schema/migrations exist. | `.env` |

---

## 1. P0 — blockers (merchant checkout cannot go live without these)

### GW-001 · Decide and execute the G1 re-plan (unblocks everything)
- **Problem.** The whole design assumes EIP-3009. F1 proves the token can't do it. Docs say: *stop, re-plan, never fake it.*
- **Decision needed (recommendation marked):**
  - **(A) Recommended — approve/`transferFrom` router.** Payer sends `approve(router, amount)` then either calls the router themselves or signs an off-chain authorization the relayer executes via `transferFrom`. Payer needs a little WBT for gas (~0.19 WBT covers hundreds of txs). Keeps: registry-enforced payout, on-chain receipts, refund caps. Drops: "gasless" claim (docs already forbid claiming it).
  - (B) Smart-account + paymaster (ERC-4337) — true gasless, large build.
  - (C) Gateway-issued EIP-3009 mock token for the *gasless demo*, while real-USDT payments run plain-transfer. Only as an add-on to (A); never presented as the required USDT.
- **Impact on contracts.** `GatewayRouter.settle` becomes `transferFrom(payer, payout, value)` after `approve`; remove EIP-3009 nonce binding, keep `paid[intentId]` one-shot and refund cap. `MerchantRegistry` unchanged.
- **Accept.** Re-plan recorded in `docs/10-RISKS-AND-GATES.md`; README claims updated (no "gasless" wording).

### GW-002 · Deploy `MerchantRegistry` + `GatewayRouter` to Whitechain Sepolia (chain 1874)
- **Problem.** F3 — no contracts exist. Nothing can settle or emit receipts.
- **Scope.** C1–C4 from `docs/07-IMPLEMENTATION-PLAN.md`, with the GW-001 redesign: registry (owner, payout, active; payout changes versioned) + router (`settle` via `transferFrom`, one-shot per intent, refund cap enforced, `RefundSettled`/`PaymentSettled` events, relayer allowlist, pause).
- **Accept.** Verified source on the explorer; addresses in `deployments/whitechain-sepolia.json`; one real test tx via the router with explorer link.

### GW-003 · Build the REST API service on `:4000` (the core gap)
- **Problem.** F2 — the API the merchant app calls does not exist. The app's health probe (`GET /api/stablegate/health`) currently reports `connected:false`.
- **Minimum endpoint set the merchant app already calls** (from `05-API-AND-SDK.md` — keep names stable):

| Endpoint | Used by merchant app for |
|---|---|
| `GET /v1/capabilities` | health chip, network/token/decimals (`decimals: 6`) |
| `POST /v1/payment-intents` | create intent on checkout (body: `amount` **base-units string**, `currency: "USDT"`, `reference`, `description`, `customer.email`, `expires_in`, `fulfilment.url`; headers: `Authorization: Bearer sk_test_…`, `Idempotency-Key`) → must return `{ id, status, checkoutUrl, clientSecret, invoice }` |
| `GET /v1/payment-intents/:id` | authoritative status polling; when settled include the `payment` object (`id` pay_…, `intent_id`, `tx_id`/`tx_hash`, `reference`) |
| `POST /v1/refunds` | `{ payment_id, amount, reason }` → refund object (optional `signingRequest`, `mode`) |
| `POST /x402/verify`, `POST /x402/settle` | agent route (P2 OK to stub with 501 initially) |

- **Also required underneath:** DB migrations in the gateway Neon DB (tables per `03-DATA-MODEL.md`), API-key auth (`sk_test_…` hashed, `pk_test_…` limited), idempotency storage, tenant scoping.
- **Accept.** `GET /api/stablegate/health` on the merchant app returns `connected:true` with capabilities; repeat `POST /v1/payment-intents` with same `Idempotency-Key` returns the same intent; cross-tenant access test fails closed.

### GW-004 · Hosted checkout page `/c/[intentId]` that works on this chain
- **Problem.** The merchant app redirects payers to `checkoutUrl`; nothing serves that page.
- **Scope.** Show merchant, amount, USDT, registered payout + PayeeShield ✓, then the GW-001 (A) flow: wallet connect → `approve` → router call (or relayer submit) → status polling. No "sign only, no gas" UI — the payer sends transactions.
- **Accept.** A payer with WBT + USDT completes a real payment from the merchant app's pay page → redirect → merchant webhook received.

### GW-005 · Chain observer + confirmation policy
- **Problem.** Nothing watches the chain; intent status would never leave `requires_authorization`.
- **Scope.** A6 from the plan: watch `PaymentSettled`/`Transfer` logs (and plain USDT transfers if GW-001 (A) allows direct-transfer reconciliation), apply confirmations, write `payments` rows, update intent status. Must survive restarts and backfill by block range.
- **Accept.** A real on-chain settlement flips `GET /v1/payment-intents/:id` to `succeeded` without any manual step.

### GW-006 · Signed-webhook dispatcher (merchant fulfilment depends on it)
- **Problem.** The merchant app fulfils orders from `payment.succeeded` webhooks; nothing sends them.
- **Contract to implement exactly** (the app is already tested against this):
  - `POST` to the merchant's registered endpoint (e.g. `https://…/api/webhooks/stablegate`).
  - Header: `StableGate-Signature: t=<unix>,v1=<hex hmac_sha256(secret, t + "." + rawBody)>`; reject tolerance on consumer side is 300s.
  - Envelope: `{ "id": "evt_…", "type": "payment.succeeded", "created": ISO, "merchant_id": "mer_…", "api_version": "2026-10-01", "data": { "payment": { id, intent_id, reference, amount, payer, tx_id, status, source } } }`.
  - Minimum events: `payment.created|pending|succeeded|failed|expired`, `refund.created|succeeded|failed`.
  - Retries with exponential backoff up to 24h; every attempt logged; manual replay endpoint.
- **Accept.** Merchant app order flips PENDING → PAID automatically from a real settlement, with dedupe verified (same `evt_` id delivered twice is processed once).

---

## 2. P1 — required for the complete merchant flow

### GW-007 · Merchant onboarding + key issuance
- Create merchant (dashboard flow), register payout on-chain (calldata for owner wallet), then **issue `sk_test_…` and webhook signing secret** in `/developers`.
- Accept. USDTStore can put real keys into `.env` (`STABLEGATE_SECRET_KEY`, `STABLEGATE_WEBHOOK_SECRET`) and pass the app's health check.

### GW-008 · Relayer worker + GasGuard-lite
- Fund the relayer (F4: faucet), allowlist only router functions, per-merchant budgets, pause switch; `relayer_unavailable` error when unfunded.
- Accept. `GET /v1/relayer/status` shows balance/budgets; unsafe requests rejected with `gasguard_rejected`.

### GW-009 · PayeeShield signing key + invoice payloads
- Generate the missing `PAYEESHIELD_SIGNING_KEY` (F5); register its address as the merchant `signer` in `MerchantRegistry`; sign invoice payloads (EIP-712: payout, payoutVersion, chainId, token, amount, intentId, expiry, nonce, keyId). Checkout must verify and flag mismatches.
- Accept. Tampered invoice rejected in the hosted checkout.

### GW-010 · Refunds end-to-end
- Router path per GW-001 redesign (merchant payout wallet authorizes; cap enforced on-chain) + manual fallback with `mode: "manual"`.
- Accept. Partial refund succeeds on-chain; over-refund rejected by API **and** contract; merchant app receives `refund.succeeded`.

### GW-011 · Payment status reconciliation for direct transfers
- With GW-001 (A), payers may send plain transfers. Observer must reconcile by amount + reference memo or per-intent derived address, else produce `underpaid`/`overpaid`/`duplicate_detected` exceptions instead of silent success.
- Accept. Wrong-amount payment produces a visible exception in the dashboard, not a false `succeeded`.

---

## 3. P2 — after the merchant flow works

- **GW-012** x402 facilitator `/supported`, `/verify`, `/settle` — redesign for GW-001 (agents pay on-chain per call; the standard "exact" EIP-3009 scheme is unavailable per F1). Merchant app's `/api/agent/courses` adapts via `lib/stablegate/client.ts` only.
- **GW-013** Dashboard completion: payments list, deliveries log, exceptions view, operator view.
- **GW-014** CRE fulfilment workflow (uses the merchant app's `GET /api/orders/:id/fulfilment-status`) — simulation is enough per docs.
- **GW-015** Arkiv publisher + `/discover` (+ agent discovery).
- **GW-016** Receipt emails, exports, API versioning polish.

---

## 4. Definition of done — "merchant page works properly"

Run this exact check from the merchant side:

1. `GET http://localhost:3000/api/stablegate/health` → `connected: true`, capabilities show chain 1874 / USDT / 6 decimals.
2. Buyer enrolls on USDTStore → pay page shows the **StableGate hosted checkout** button (no fallback banner) → payer completes the GW-001 (A) flow with real WBT gas → returns → order flips to PAID **without anyone clicking "Mark paid"**.
3. Order status arrived via a **signed webhook** whose signature the app verified (check app logs: no `Rejected:` lines, `payment.succeeded` processed).
4. Dashboard **Refund** → real on-chain refund → `refund.succeeded` webhook → order REFUNDED.
5. Explorer shows USDT moved payer → registered payout, and the router receipt event.

Until every P0 is closed, the merchant app stays on its verified fallback: real manual USDT transfer + admin "Mark paid" reconciliation (already working and real).

---

## Appendix — G1 evidence (2026-11-01)

`eth_getCode` on `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (2227 bytes, verified source `TetherTokenV2`, `name() = "Tether USD"`, `decimals() = 6`, `version()` reverts):

| Function | Selector | Present |
|---|---|---|
| `transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)` | `0xe3ee160e` | ✗ |
| `transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)` | `0xcf092995` | ✗ |
| `receiveWithAuthorization(...)` | `0xef55bec6` | ✗ |
| `authorizationState(address,bytes32)` | `0xe94a0102` | ✗ |
| `nonces(address)` | `0x7ecebe00` | ✗ |
| `DOMAIN_SEPARATOR()` | `0x3644e515` | ✗ |
| `permit(address,address,uint256,uint256,uint8,bytes32,bytes32)` (EIP-2612) | `0xd505accf` | ✗ |

Conclusion: plain ERC-20. Gate G1 recorded as **FAILED** in `docs/10-RISKS-AND-GATES.md`; G1c answered (name/decimals confirmed, no version/domain).
