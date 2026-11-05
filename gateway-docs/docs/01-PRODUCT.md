# 01 · Product

## 1. One-line pitch

**A non-custodial, developer-first USDT payment gateway on Whitechain where the same merchant account takes payments from humans (gasless checkout) and AI agents (x402).**

## 2. The problem

Businesses that want to accept stablecoins today face one of three bad options:

1. **Show a wallet address.** No invoice state, no confirmation logic, no refunds, no webhooks. Customers send the wrong amount or token and the merchant reconciles by hand.
2. **Use an account-based processor.** Funds sit in the processor's account, onboarding is a partnership process, and the processor decides what you can do.
3. **Build it yourself.** Gas handling, signature verification, indexing, retries and refunds are weeks of work and easy to get wrong.

Customers also hit a wall: to pay in a stablecoin on an L2 they need the L2's gas token, which they do not have.

A new group is arriving: **software that pays software**. AI agents need to pay per API call with no human and no gas token.

## 3. Our answer

| Pain | What we do |
|---|---|
| Wrong amount / token / address | Contract-enforced settlement: `GatewayRouter` pays only the merchant's **registered** payout address and binds each authorization to one invoice |
| Customer has no WBT | Payer signs one EIP-3009 authorization; a relayer pays gas |
| Funds held by processor | **Non-custodial**: USDT goes payer → merchant wallet directly |
| Integration effort | ~20-line SDK + React widget + Express middleware |
| Refund pain | One-click full/partial refund, cap enforced on-chain, receipt anyone can verify |
| Agents can't pay | x402 facilitator on the same relayer, same limits, same dashboard |
| "Did they deliver?" | Chainlink CRE workflow checks the merchant's fulfilment endpoint and raises an exception |
| Merchants and agents can't find each other | Public profiles and offers in Arkiv, queryable without our API |

## 4. Positioning against WhitePay

WhitePay (WhiteBIT's merchant processor) offers crypto acquiring, payment links, plugins, POS terminals, fiat conversion and AML screening. We **do not** compete on fiat, compliance or exchange distribution.

| | Account-based processor | StableGate |
|---|---|---|
| Onboarding | Partnership / approval | Self-serve, register a wallet |
| Custody | Funds credited to a merchant account | None; funds go straight to merchant wallet |
| Payer gas | Customer pays network fee | Sponsored by relayer (one-time checkout) |
| Records | Provider database | On-chain receipts + public Arkiv listings |
| Agents | Not the focus | x402 built in, same account |
| Fiat off-ramp | Yes | **No** (out of scope; future via exchange partners) |

Be honest about this in every pitch: our edge is **self-serve, non-custodial, gasless, and agent-ready**, not "better than WhitePay at everything".

## 5. Users

| Persona | Needs |
|---|---|
| **Merchant owner** | Get paid in USDT, see payments, refund, know if orders were fulfilled |
| **Merchant developer** | Integrate in minutes: SDK, widget, webhooks, test mode |
| **Payer (human)** | Understand who they pay and how much; no gas token; no seed phrase requests |
| **AI agent / agent developer** | Discover paid APIs, pay per call automatically within a spending policy |
| **Operator (us)** | Keep the relayer funded, safe, and observable |

## 6. Scope

### 6.1 MVP (must work end to end on Whitechain Sepolia with the required USDT)

| ID | Feature | Notes |
|---|---|---|
| P1 | Gasless one-time checkout (EIP-3009 + relayer + `GatewayRouter`) | Core. Real USDT. |
| P2 | Payment links + QR → hosted checkout | QR encodes the URL, never a raw transfer |
| P3 | SDK + React widget + Express middleware | "~20 lines" proven by a **separate** `demo-store` |
| P4 | Signed webhooks with retries and idempotency | Transactional outbox |
| P5 | Merchant dashboard: payments, links, refunds, API keys, webhook log, GasGuard budget | |
| P6 | Refunds: full + partial, on-chain cap | Merchant signs; relayer submits |
| P7 | PayeeShield | Signed invoice payload + on-chain payout check |
| P8 | GasGuard-lite | Allowlist, per-merchant budget, rate limit, pause switch |
| P9 | Paid receipt email | After verified settlement only |
| X1 | x402 paywall + facilitator (`/supported`, `/verify`, `/settle`) | Same relayer, same ledger |
| H1 | CRE workflow: fulfilment check | Simulation is enough to qualify; live is a bonus |
| A1 | Arkiv: merchant profile + offers + `/discover` page and agent endpoint | Must be **read** by a user-visible feature |

### 6.2 Deliberately cut (do not build; do not claim)

Subscriptions and usage billing, full DeliveryGuard workflow UI, full exception intelligence (keep only *underpaid*, *duplicate*, *expired* detection), multi-chain, fiat conversion, WhiteBIT/EzPayz integration, KYC/identity verification, procurement approvals, escrow, marketplace, CCIP.

> Subscriptions are the first thing to add **only if** everything above is done and stable. They are specified in the original PRD and can be re-imported later.

### 6.3 Non-goals (permanent for this build)

Custody of customer funds, trustless dispute adjudication, claims of production readiness.

## 7. The three journeys

### 7.1 Human checkout
```text
Merchant creates payment intent → shares link/QR or embeds widget
Payer opens checkout → sees merchant, amount, USDT, payout address, PayeeShield ✓
Payer signs ONE typed message (no gas) → relayer submits → USDT lands in merchant wallet
Backend verifies on-chain → status succeeded → webhook + receipt email + dashboard
Merchant can refund (full/partial) in one click
```

### 7.2 Agent pays an API (x402)
```text
Agent calls GET /api/prices → server (with StableGate middleware) replies 402 + price + payTo
Agent's x402 client signs an EIP-3009 authorization within its spending policy
Facilitator (/verify, /settle) submits via the same relayer → USDT to merchant payout wallet
Server returns the data; payment appears in the same dashboard as human checkouts
```

### 7.3 Discovery + fulfilment trust
```text
Merchant publishes profile + offers (Arkiv, expiring)  →  /discover and agent endpoint query Arkiv
After payment, CRE workflow checks the merchant's fulfilment endpoint on a schedule
If not fulfilled by the deadline → exception + suggested refund (merchant must approve)
```

## 8. Success criteria for the hackathon

- One real USDT payment settled through `GatewayRouter`, explorer link in README.
- A **separate** demo app integrates checkout in ≈20 lines.
- Demo video (2–4 min) shows **merchant, payer, and agent** perspectives.
- A rejected unsafe relayer request and a rejected tampered invoice are both shown live.
- x402 payment settles in real USDT.
- CRE workflow simulation succeeds via the CRE CLI.
- Arkiv `/discover` shows live data read from Arkiv; one runnable query in README.

## 9. Business model (assumptions, not market data)

- Per-settlement fee on gateway volume (small percentage or flat per transaction).
- Paid gas sponsorship tiers (merchants buy a gas budget instead of running a relayer).
- Premium dashboard: reconciliation exports, team access, spend policies.
- White-label for partners who want their own branded gateway.

The hackathon build charges nothing; the relayer is funded from our WBT faucet balance. Real revenue depends on merchant adoption, which this build does not prove.

## 10. Demo script (3 minutes)

| Time | Show | Proves |
|---|---|---|
| 0:00 | Merchant dashboard, payout wallet registered on-chain | Non-custodial setup |
| 0:20 | `demo-store` code: ~20 lines | Integration claim |
| 0:35 | Payer opens checkout, PayeeShield ✓, signs once, **no WBT in wallet** | Gasless payer |
| 1:05 | Explorer: relayer tx, USDT directly to merchant | Settlement + non-custody |
| 1:20 | Tampered invoice rejected; arbitrary relayer call rejected | PayeeShield + GasGuard |
| 1:45 | Partial refund, then over-refund rejected | On-chain cap |
| 2:05 | Agent pays an API over x402; appears in dashboard | Agents |
| 2:25 | `/discover` list from Arkiv; CRE simulation flags an unfulfilled order | Arkiv + CRE |
| 2:50 | Limitations slide | Honesty |
