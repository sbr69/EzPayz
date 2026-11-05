# 08 · Security and GasGuard

Hackathon scope: aim for **defensible design and honest limits**, not audit-grade assurance.

## 1. Threat model

| # | Threat | Impact | Mitigation |
|---|---|---|---|
| T1 | Server or database compromised; attacker changes payout address shown to payers | Funds sent to attacker | Router pays **only** `MerchantRegistry.payout`; payout change requires owner wallet; PayeeShield check in checkout |
| T2 | Signature replay across invoices | Payer charged for wrong order | Nonce bound to `(intentId, merchantId, payout, value)`; router recomputes; token's nonce uniqueness |
| T3 | Double settlement | Duplicate charge | `paid[intentId]` guard; idempotency keys; observer reconciles by log identity |
| T4 | Relayer drained of WBT | Sponsored payments stop | GasGuard budgets, per-tx gas cap, simulation before send, allowlist, rate limits, circuit breaker |
| T5 | Relayer used as generic forwarder | Arbitrary tx on our gas | No arbitrary-calldata endpoint; relayer calls only `settle/settleOpen/refund` on the router |
| T6 | Griefing: valid-looking authorizations from payers without balance | Wasted gas | `eth_call` simulation and balance check before broadcast; per-payer rate limits |
| T7 | Refund abuse | Merchant funds sent wrong | Merchant wallet signature required; contract cap; destination fixed to payer at payment time |
| T8 | Webhook forgery | Merchant ships goods without payment | HMAC signatures + timestamp; docs tell merchants to also retrieve intent server-side |
| T9 | Cross-tenant data access | PII leak | Tenant-scoped repositories; dedicated tests; no merchant ID taken only from request body |
| T10 | Key leakage (relayer, signer, API) | Total compromise of that key | Env/KMS storage, never logged or in client, per-merchant signer isolation, rotation endpoint |
| T11 | Malicious Arkiv/CRE data | Misleading UI or false exceptions | Verify listing signatures and registry payout; CRE reports authenticated, only create *suggestions* |
| T12 | Reorg / premature success | Goods released early | Confirmation policy; `succeeded` only after threshold |
| T13 | x402 payer replay | Free API usage | Token nonce consumption + facilitator verifies `payTo`, amount, validity |
| T14 | Phishing via QR or link | Payer pays wrong merchant | QR encodes hosted URL; checkout shows merchant identity and payout; PayeeShield |
| T15 | Frontrunning direct token call | Missing receipt | Observer also watches token `AuthorizationUsed`/`Transfer` and reconciles |

## 2. GasGuard rules (Proposed defaults; make them configurable)

A request is sponsored only if **all** pass; each rejection is logged with a reason code.

1. **Allowlist:** chain 1874; token = required USDT; target = `GatewayRouter`; function ∈ {`settle`, `settleOpen`, `refund`}.
2. **Validity:** signature recovers to `from`; `validAfter ≤ now < validBefore`; window ≤ 15 minutes; nonce matches binding (for `settle`); intent state eligible; not already paid.
3. **Simulation:** `eth_call` / gas estimate succeeds; `gas ≤ GAS_MAX_PER_TX`.
4. **Funds check:** payer USDT balance ≥ value.
5. **Budgets:** global daily/weekly WBT cap; per-merchant daily cap; per-payer hourly count; per-IP rate limit on `/authorize` and `/x402/settle`.
6. **Duplicate guard:** (token, payer, nonce) unique; same intent in flight → return existing job.
7. **Circuit breaker:** open when failure rate or WBT burn rate exceeds threshold; manual **pause** switch in operator view; contract-level `pause()` as last resort.
8. **Balance monitor:** alert when relayer WBT < threshold; refuse new sponsored requests below a floor.
9. **Accounting:** every sponsored tx writes `relayer_ledger` (gas, cost, merchant, payment).

### How the relayer gets WBT and what stops abuse (answer for judges)

- Testnet: funded from the Whitechain faucet by the operator. Mainnet (future): operator buys WBT and recoups through fees or merchant-funded gas budgets (commercial policy not decided).
- Abuse is bounded by budgets, simulation, per-payer/IP limits and the allowlist. Worst case is capped by the global budget; an attacker cannot move anyone's funds, only trigger sponsored gas on valid signed transfers.

## 3. PayeeShield key model (Proposed, matches the flow doc)

- One signing key **per merchant**, scoped only to signing invoice/offer payloads. Never a spending, payout, or relayer key.
- The signer's **address is registered on-chain** by the merchant owner in `MerchantRegistry`. Rotation = owner calls `setSigner`.
- Hackathon storage: encrypted at rest with an env master secret. Limitation: not HSM/KMS-backed. Say so in README.
- Trust limitation: the gateway is a trusted *issuer* of payment requests. PayeeShield detects tampering between issuance and display; it does not prove the business is legitimate.

## 4. Privacy

- PII stays in Postgres. Never in Arkiv, logs, URLs, or on-chain data.
- Tell users plainly: wallet addresses and amounts are public on-chain.
- Receipt emails contain no secrets.

## 5. Secure coding checklist

- [ ] Validate every input with zod; reject unknown fields.
- [ ] Constant-time comparison for HMACs and API key hashes.
- [ ] Rate limiting on auth, authorize, settle, webhook-replay.
- [ ] Parameterized queries only (ORM).
- [ ] CORS locked to known origins; CSRF protection for dashboard sessions.
- [ ] Secrets only via env; `.gitignore` covers `.env*`; run a secret scanner in CI.
- [ ] Logs redact keys, signatures, emails.
- [ ] Dependency audit in CI.
- [ ] Contracts: ReentrancyGuard, CEI ordering, no `tx.origin`, no unchecked low-level calls, `forge coverage` reviewed.
- [ ] README limitation: "Not audited. Testnet only."

## 6. Known limitations to disclose

Single relayer key; admin is a deployer EOA; per-merchant signing keys not in KMS; EOA-only payout wallets; no KYC/AML; confirmation timings unverified; Arkiv entities are gateway-owned.
