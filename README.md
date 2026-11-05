# EzPayz

A non-custodial USDT payment gateway on Whitechain Sepolia — like Razorpay/Stripe, but for USDT on Whitechain. Merchants accept USDT payments with **gasless** EIP-3009 one-time payments, recurring subscriptions via an on-chain contract, full/partial refunds, webhooks, PayeeShield (gateway-signed payment requests), GasGuard (relayer abuse prevention), and a typed SDK + React checkout widget.

**Status:** feature-complete MVP, verified end-to-end on Whitechain Sepolia (testnet). Built for the Whitechain hackathon.

---

## Why on-chain stablecoin settlement on Whitechain

- **Non-custodial:** every USDT payment moves directly payer → merchant wallet. The gateway never holds funds.
- **Gasless for the payer:** the payer signs an EIP-3009 `TransferWithAuthorization`; the gateway relayer submits it on-chain and pays the WBT gas. The payer pays nothing to receive USDT.
- **Recurring on-chain:** subscriptions are enforced by a deployed, source-verified smart contract with per-cycle + cumulative caps — not just an off-chain schedule.
- **Whitechain Sepolia:** EVM-compatible (chain ID 1874), ~1s blocks, low gas (WBT), a source-verified TetherTokenV2 with full EIP-3009 support.

---

## Verified on-chain transactions (Whitechain Sepolia explorer)

| Flow | Transaction |
|---|---|
| Gasless one-time payment (Phase 4 e2e) | [0xd45a6efd…c975b13](https://explorer.testnet.whitechain.io/tx/0xd45a6efd488ed2ae3bb28e840466dc72b7d11568ce6cae712eaf38a39b975b13) |
| Subscription renewal via `charge()` (Phase 5 e2e) | [0x4b9a8396…885a8](https://explorer.testnet.whitechain.io/tx/0x4b9a8396a3fd0ed4de65a4ba96d0e8daedb41ce6046a92faa81c548f984885a8) |
| Refund merchant→payer (Phase 6 e2e) | [0xc366ab8e…f6433](https://explorer.testnet.whitechain.io/tx/0xc366ab8e54f959f4643b96d1a91c71007cf18ab18c5a81d6b0d00558fb2f6433) |

---

## Contract addresses

| Contract | Address | Source verified |
|---|---|---|
| SubscriptionContract | `0x0b8Da2EE37f3599141aFD500b1e2699D5A6bCdbB` | ✅ Blockscout |
| USDT (TetherTokenV2 proxy) | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` | ✅ (impl `0x26425662…026F7`) |
| Network | Whitechain Sepolia (chain ID `1874`) | — |

EIP-3009 verification: [docs/EIP3009_VERIFICATION.md](docs/EIP3009_VERIFICATION.md) — ABI-level + live settlement test PASSED.

---

## Architecture

```
apps/web        React dashboard + hosted checkout (existing mock UI + a real checkout route with wagmi/RainbowKit)
apps/api        Fastify REST API + auth + business logic + BullMQ workers (relayer/observer/webhook/email/scheduler)
packages/contracts   Foundry/Solidity — SubscriptionContract (deployed + verified)
packages/sdk    @ezpayz/sdk — typed server client + <WhitechainCheckout/> widget + webhook middleware
docs/           PRD, FLOW, PLAN, EIP-3009 verification
```

**Stack:** Fastify, PostgreSQL (Neon) + Prisma, Foundry/Solidity, viem (FE+BE), RainbowKit/wagmi, BullMQ/Upstash Redis, JWT auth.

**Key components:**
- **PayeeShield** — the gateway signs each payment request (EIP-712); the checkout verifies it before signing.
- **GasGuard** — pre-submission policy checks (chain/token allowlist, budgets, pause) before the relayer pays gas.
- **Relayer** — submits `transferWithAuthorization` (one-time) + `charge()` (subscriptions) + refund authorizations on-chain; pays WBT gas.
- **Chain observer** — verifies the USDT `Transfer` / `SubscriptionCharged` event + receipt before marking a payment settled.
- **Webhooks** — transactional outbox + HMAC-SHA256 signed delivery + retries.
- **Idempotency** — `Idempotency-Key` header on all writes.
- **Tenant isolation** — every query scoped by `merchantId`.

---

## Setup

### Prerequisites
- Node 20+, pnpm, Foundry (in WSL on Windows: `~/.foundry/bin`)
- A Whitechain Sepolia wallet funded with WBT (faucet: https://faucet.testnet.whitechain.io) + test USDT
- Neon Postgres + Upstash Redis accounts (or local equivalents)

### Install
```bash
pnpm install
```

### Environment
Copy `.env.example` → `.env` (repo root) + fill in:
- `DATABASE_URL` (Neon Postgres)
- `REDIS_URL` (Upstash Redis, `rediss://…`)
- `RELAYER_PRIVATE_KEY` + `RELAYER_ADDRESS` (funded with WBT)
- `PAYEESHIELD_SIGNING_KEY` (any EIP-712 key; dev default provided)
- `JWT_SECRET`
- `TEST_PAYER_PRIVATE_KEY` + `TEST_PAYER_ADDRESS` + `TEST_RECIPIENT_ADDRESS` + `TEST_RECIPIENT_PRIVATE_KEY` (for e2e tests)

### Database
```bash
pnpm --filter @ezpayz/api db:migrate   # prisma migrate dev
pnpm --filter @ezpayz/api db:seed      # 2 merchants (Acme + Globex) + demo data
```

### Grant the relayer CHARGER_ROLE (one-time, for subscriptions)
```bash
pnpm --filter @ezpayz/api exec tsx scripts/grant-charger-role.ts
```

---

## Run locally

```bash
pnpm dev        # Fastify API on :3000
pnpm worker     # BullMQ workers (relayer/webhook/email/scheduler) — separate terminal
pnpm dev:web    # Vite frontend on :5173
```

---

## End-to-end tests

| Test | Script | What it verifies |
|---|---|---|
| Gasless one-time | `pnpm --filter api exec tsx scripts/e2e-gasless.ts` | Payer signs EIP-3009 → relayer submits → settles on-chain |
| Subscription | `pnpm --filter api exec tsx scripts/e2e-subscription.ts` | Customer approve+createSubscription → renew-now → relayer `charge()` → settles |
| Refund | `pnpm --filter api exec tsx scripts/e2e-refund.ts` | Payment → settle → merchant signs refund EIP-3009 → relayer → settles |
| Isolation | `pnpm --filter api exec tsx scripts/test-isolation.ts` | Merchant A cannot read Merchant B's data |

---

## SDK

```ts
import { WhitechainClient } from "@ezpayz/sdk";

const client = new WhitechainClient(secretKey, "http://localhost:3000");
const intent = await client.paymentIntents.create({ amount: "10000", description: "Pro plan" });
```

React widget:
```tsx
import { WhitechainCheckout } from "@ezpayz/sdk";
// <WhitechainCheckout checkoutSlug={slug} apiUrl="http://localhost:3000" signTypedData={...} />
```

Webhook verification:
```ts
import { verifyWebhookSignature } from "@ezpayz/sdk";
const valid = verifyWebhookSignature(secret, rawBody, signature);
```

---

## REST API (key endpoints)

- `POST /v1/auth/register` · `POST /v1/auth/login` (JWT)
- `POST /v1/api-keys` (publishable + secret, shown once)
- `POST /v1/payment-intents` (auth + idempotency) · `GET /v1/payment-intents/:id`
- `GET /v1/checkout/:slug` (public, PayeeShield-signed) · `POST /v1/checkout/:slug/authorize` (EIP-3009)
- `POST /v1/payment-links` · `POST /v1/invoices` · `POST /v1/refunds` · `POST /v1/refunds/:id/authorize`
- `POST /v1/plans` · `POST /v1/subscriptions` · `POST /v1/subscriptions/:id/renew-now` · `POST /v1/usage`
- `GET /v1/analytics/overview` · `GET /v1/webhooks` · `GET /v1/exceptions` · `GET /v1/fulfilment`
- `GET /health` · `GET /v1/status`

Auth: `Authorization: Bearer <JWT>` (dashboard) or `Bearer <secret API key>` (SDK).

---

## Current limitations (hackathon MVP)

- Email is stubbed (logged, no SMTP).
- PayeeShield uses a single gateway signing key (per-merchant keys deferred).
- Relayer key in `.env` (not a KMS/HSM).
- The dashboard UI largely runs on the mock adapter; the **real checkout** is at `/real-checkout/:slug`. Full dashboard wiring is incremental.
- Webhook signing secret stored as plaintext (MVP; encrypt at rest for production).
- Monthly interval = 30-day approximation on-chain (backend scheduler handles real calendar timing).

---

## Project structure

See [PLAN.md](PLAN.md) for the full phase-wise implementation plan. See [docs/](docs/) for the PRD + flow + EIP-3009 verification.
