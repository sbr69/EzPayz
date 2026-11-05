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
apps/web        React dashboard + hosted checkout. Auth is real (JWT from /v1/auth/login, auto-attached by apiFetch). Dashboard syncs real data from the API via useSyncRealData hook. Real checkout, subscription checkout, refund signing, onboarding wallet verify — all wired to the live API via wagmi/RainbowKit.
apps/api        Fastify REST API + auth + business logic + BullMQ workers (relayer/observer/webhook/email/scheduler) + MCP server at /mcp
packages/contracts   Foundry/Solidity — SubscriptionContract (deployed + verified)
packages/sdk    @ezpayz/sdk — typed server client + <WhitechainCheckout/> widget + webhook middleware
packages/mcp    @ezpayz/mcp — MCP server (11 tools + 8 resources) for AI agents (Claude Desktop, Cursor, VS Code). stdio + HTTP transports.
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

The SDK builds via `tsup` to two formats. Run `cd packages/sdk && pnpm build` after cloning (`dist/` is gitignored). Not yet published to npm — see `packages/sdk/NPM_PUBLISH.md` for publishing setup.

**Two integration paths:**

| Format | File | Who uses it |
|---|---|---|
| npm package (ESM) | `dist/index.js` + `dist/index.d.ts` | React/Next.js/Vue developers |
| Standalone `<script>` (IIFE) | `dist/browser-entry.global.js` (8KB) | WordPress, Shopify, plain HTML — no build tool |

```ts
import { WhitechainClient, formatBaseUnits } from "@ezpayz/sdk";

const client = new WhitechainClient(secretKey, "http://localhost:3000");
// Amounts are human-readable decimals — the gateway converts to base units internally
const intent = await client.paymentIntents.create({
  amount: "10.00",
  description: "Pro plan",
  successUrl: "https://yourapp.com/thankyou",
  idempotencyKey: "order-123",
});
// → { id, clientSecret, checkoutSlug, amount: "10.00", amountBaseUnits: "10000000", payeeShield }
```

React widgets:
```tsx
import { WhitechainCheckout, WhitechainSubscriptionCheckout } from "@ezpayz/sdk";
// One-time checkout (gasless for the payer)
// <WhitechainCheckout checkoutSlug={slug} apiUrl="..." signTypedData={...} />
// Subscription checkout (customer pays WBT for setup; renewals are gasless)
// <WhitechainSubscriptionCheckout checkoutSlug={slug} apiUrl="..." payerAddress={...} signTypedData={...} sendTransaction={...} />
```

Amount helpers + webhook verification:
```ts
import { formatBaseUnits, parseHumanAmount, verifyWebhookSignature } from "@ezpayz/sdk";
formatBaseUnits("10000000")    // → "10.00"
parseHumanAmount("10.00")      // → "10000000"
const valid = verifyWebhookSignature(secret, rawBody, signature);
```

---

## MCP server

The gateway includes an MCP (Model Context Protocol) server at `packages/mcp/` that exposes tools + documentation to AI agents. See `packages/mcp/README.md` for full setup.

**Local (Claude Desktop / Cursor):**
```bash
cd packages/mcp && pnpm build
```
```json
{ "mcpServers": { "whitechain": { "command": "node", "args": ["packages/mcp/dist/index.js"], "env": { "GATEWAY_SECRET_KEY": "wcp_sec_...", "GATEWAY_API_URL": "http://localhost:3000" } } } }
```

**Remote (HTTP):** The MCP server is mounted at `/mcp` on the gateway API. Connect via `mcp-remote`.

**11 tools:** create_payment_intent, list_payments, get_payment, create_payment_link, create_refund, list_refunds, list_customers, list_subscriptions, create_plan, get_analytics, verify_webhook_signature

**8 resources:** how-to-use, PRD, flow, EIP-3009, API reference, SDK guide, live gateway status

---

## REST API (key endpoints)

- `POST /v1/auth/register` · `POST /v1/auth/login` (JWT)
- `POST /v1/api-keys` (publishable + secret, shown once) · `GET /v1/api-keys` (list, includes `lastUsedAt`)
- `POST /v1/payment-intents` (auth + idempotency, accepts `amount`/`successUrl`/`cancelUrl`/`metadata`) · `GET /v1/payment-intents` (list + cursor pagination + status/date filters) · `GET /v1/payment-intents/:id` · `GET /v1/payment-intents/:id/receipt.pdf` (auth)
- `GET /v1/checkout/:slug` (public, PayeeShield-signed) · `POST /v1/checkout/:slug/authorize` (EIP-3009) · `GET /v1/checkout/:slug/receipt.pdf` (public, no auth — customer downloads receipt)
- `GET /v1/checkout/subscription/:slug` (public, plan details for subscription widget)
- `GET /v1/payment-links/:slug` (public resolve) · `POST /v1/payment-links/:slug/checkout` (public, creates intent from link)
- `POST /v1/payment-links` · `GET /v1/payment-links` (paginated) · `POST /v1/invoices` · `GET /v1/invoices` (paginated) · `GET /v1/invoices/:id/pdf`
- `POST /v1/refunds` (idempotent) · `GET /v1/refunds` (paginated) · `POST /v1/refunds/:id/authorize` (merchant-signed EIP-3009)
- `POST /v1/plans` (idempotent) · `GET /v1/plans` (paginated)
- `POST /v1/subscriptions/checkout` (idempotent, hosted checkout session) · `POST /v1/subscriptions` (idempotent) · `GET /v1/subscriptions` (paginated) · `POST /v1/subscriptions/:id/renew-now` · `POST /v1/usage`
- `POST /v1/customers` · `GET /v1/customers` (paginated + email search) · `GET /v1/customers/:id`
- `GET /v1/merchants/me` · `PATCH /v1/merchants/me` (profile update) · `GET /v1/merchants/wallet/challenge` · `POST /v1/merchants/wallet/verify` (personal_sign verification)
- `GET /v1/analytics/overview` · `GET /v1/webhooks` (paginated) · `GET /v1/webhooks/events` (paginated) · `GET /v1/exceptions` (paginated) · `GET /v1/fulfilment` (paginated)
- `GET /health` · `GET /v1/status`

All list endpoints support cursor pagination: `?limit=20&cursor=<lastItemId>` → `{ data, hasMore, nextCursor }`.
All POST routes support `Idempotency-Key` header (prevents duplicates on network retry).

Auth: `Authorization: Bearer <JWT>` (dashboard), `Bearer <secret key>` (full write, server-only), or `Bearer <publishable key>` (read-only, browser-safe). Write routes require a secret key or JWT. Payment intent creation returns a short-lived `clientSecret` (15 min) for the browser widget.

---

## Current limitations (hackathon MVP)

- Email is stubbed (logged, no SMTP). The downloadable PDF receipt is the primary receipt mechanism — public `GET /v1/checkout/:slug/receipt.pdf` (no auth required). Email will be wired in a later phase.
- PayeeShield uses a single gateway signing key (per-merchant keys deferred — confirmed for MVP).
- Relayer key in `.env` (not a KMS/HSM).
- Dashboard fully wired to the live API: auth is real (JWT stored in localStorage), `apiFetch` auto-attaches the JWT, `useSyncRealData` hook syncs all list data from the API on dashboard mount. The real checkout, real subscription checkout, real refund signing, onboarding wallet verify, and dashboard data are all fully wired.
- Webhook signing secret stored as plaintext (MVP; encrypt at rest for production). Webhook retries with exponential backoff (max 5).
- Monthly interval = 30-day approximation on-chain (backend scheduler handles real calendar timing).
- Refund backend-signing deferred (browser Wagmi signing for MVP; backend-signing documented as the production path).
- SDK built locally (`pnpm build` → `dist/`); gitignored — run build after cloning. Not yet published to npm. Standalone browser bundle built but not yet served via a CDN URL.

---

## Project structure

See [PLAN.md](PLAN.md) for the full phase-wise implementation plan. See [docs/](docs/) for the PRD + flow + EIP-3009 verification.