# Whitechain USDT Payment Gateway — Phase-wise Implementation Plan

**Version:** 1.0
**Date:** 31 October 2026
**Related docs:** `docs/WHITECHAIN_PAYMENT_GATEWAY_PRD.md`, `docs/WHITECHAIN_PAYMENT_GATEWAY_FLOW.md`
**Team size:** 2 developers
**Scope:** Full MVP gateway (backend + database + smart contracts + SDK + frontend wiring). A separate demo merchant app is **out of scope** (the owner will test on their own site).

---

## 0. Locked decisions

| Area | Decision |
|---|---|
| Backend framework | **Fastify** (Node.js, schema validation via JSON schema / TypeBox) |
| Application database | **PostgreSQL (Neon) + Prisma ORM** |
| Smart contract tooling | **Foundry** (`forge`, `cast`, `anvil`) — Solidity |
| Frontend framework | Existing **React 19 + Vite 7 + Tailwind 4** app (relocated to `apps/web/`) |
| Frontend web3 | **viem + RainbowKit** (wallet connect + EIP-712 typed-data signing) |
| Backend web3 | **viem** (signature recovery, contract reads/writes, tx submission) |
| Repo layout | **pnpm workspaces monorepo** (`apps/*`, `packages/*`) |
| Auth | **Email + password + JWT** (Bearer token in `Authorization` header) |
| Background jobs | **BullMQ on Upstash Redis** (webhook/email retries + subscription scheduler) |
| Email | **Stub**: log to DB `email_log` table + Upstash job; no real SMTP in MVP |
| PayeeShield keys | **Single gateway EIP-712 signing key in `.env`** (keyId in payloads; per-merchant isolation deferred) |
| Relayer key | **`.env`** with clear warnings (hackathon-only) |
| Subscription allowance | **Shared subscription contract** = single ERC-20 spender; internal per-subscription accounting, per-cycle + cumulative caps enforced on-chain |
| One-time payment contract | **No custom contract** — relayer calls the USDT's own `transferWithAuthorization` (EIP-3009) directly |
| Refund gas path | Sponsored via merchant-signed EIP-3009 **if the token supports it**; otherwise merchant-paid-gas fallback, disclosed in UI (decided by the Phase 0 EIP-3009 result) |
| Frontend mock | **Preserved as-is** until Phase 8; `apps/web` continues to run on `services/mock/*` while backend/contracts are built |
| Deployment | **Vercel** (apps/web) + **Render** (apps/api web service + 1 background worker) + **Neon** (Postgres) + **Upstash** (Redis) |
| Demo merchant app | **Excluded** — owner tests on their own website |

### Hard rule (no guesswork)

> **EIP-3009 on the required test USDT (`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`) is a P0 release gate.** Phase 0 verifies it. If it is **not** supported, **STOP and ask the owner** before choosing any fallback. Never silently replace EIP-3009 with an allowance flow, and never relabel an allowance flow as EIP-3009. (PRD §10.3, §27.)

---

## 1. Network & token facts (verify live in Phase 0)

| Setting | Value (from PRD §7.1) |
|---|---|
| Network | Whitechain Sepolia |
| Chain ID | `1874` |
| RPC URL | `https://rpc.testnet.whitechain.io` |
| Block explorer | `https://explorer.testnet.whitechain.io/` |
| Faucet | `https://faucet.testnet.whitechain.io/` |
| Native gas token | WBT |
| Required test USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` |

Re-confirm these from official Whitechain docs immediately before deployment (PRD §7.1, §27).

---

## 2. Phase dependency graph

```
Phase 0  Foundation + EIP-3009 verification gate (P0 BLOCKER)
   |
   +-- Phase 1  Smart contracts (subscription contract; deploy + verify)
   |
   +-- Phase 2  Database (Prisma schema on Neon)
   |
   +-- Phase 3  Backend foundation (Fastify, auth, tenant isolation)
              |
              +-- Phase 4  Core one-time payment pipeline (intent -> PayeeShield -> relayer -> GasGuard -> chain observer -> settlement -> webhooks -> exceptions -> DeliveryGuard)
                         |
                         +-- Phase 5  Subscriptions (scheduler + relayer renewal + usage + cancellation)
                         |
                         +-- Phase 6  Refunds
                                    |
                                    +-- Phase 7  SDK package (@whitechain-pay/sdk)
                                               |
                                               +-- Phase 8  Frontend wiring (swap mock -> real API + RainbowKit) + deploy
                                                          |
                                                          +-- Phase 9  Hardening, acceptance, demo, submission
```

Phases 1, 2 can run in parallel once Phase 0 passes. Phase 3 depends on Phase 2. Phases 5 & 6 depend on Phase 4. See §7 for the 2-dev parallelization plan.

---

## 3. Architecture recap (maps to PRD §19, FLOW §3)

Modular monolith on Render: one Fastify web service (`apps/api`) + one background worker process (BullMQ worker hosting relayer submissions, chain observer, subscription scheduler, webhook dispatcher, email stub). Both share the Neon Postgres DB and Upstash Redis. Whitechain Sepolia is the settlement layer. The browser is **never** the authority for payment success.

| Component | Lives in | Phase |
|---|---|---|
| Merchant dashboard + hosted checkout (React) | `apps/web` | 8 |
| REST API + auth + business logic | `apps/api` (Fastify) | 3, 4, 5, 6 |
| PayeeShield signing service | `apps/api` | 4 |
| GasGuard policy engine | `apps/api` | 4 |
| Relayer (viem wallet) | `apps/api` worker | 4 |
| Chain observer / indexer (viem poller) | `apps/api` worker | 4 |
| Subscription scheduler | `apps/api` worker (BullMQ) | 5 |
| Webhook dispatcher | `apps/api` worker (BullMQ) | 4 |
| Email stub | `apps/api` worker (BullMQ) | 4 |
| Exception engine | `apps/api` | 4 |
| Subscription smart contract | `packages/contracts` (Foundry) | 1 |
| JS/TS SDK + React widget | `packages/sdk` | 7 |
| Postgres | Neon | 2 |
| Redis | Upstash | 3, 4 |

---

## 4. Repo layout (created in Phase 0)

```
white/
  package.json                 # workspace root (no source; scripts + dev deps)
  pnpm-workspace.yaml          # packages: apps/*, packages/*
  .env.example                 # all env vars (no secrets committed)
  .gitignore                   # add: .env, node_modules, dist, cache, out, artifacts, broadcast
  turbo.json                   # optional task runner (build/test/lint/dev)
  apps/
    web/                       # relocated existing React app (mock preserved)
      src/services/mock/...    # kept until Phase 8
    api/                       # Fastify backend (NEW)
      src/
        config/                # env, chain, token constants
        plugins/               # fastify plugins (auth, cors, rate-limit, error-handler)
        routes/v1/             # REST route modules
        services/              # payment, refund, subscription, payeeShield, gasGuard, relayer, chainObserver, webhook, email, exceptions, fulfilment, analytics
        db/                    # prisma client + repositories
        web3/                  # viem client, EIP-3009 helpers, contract ABIs
        workers/               # bullmq workers (relayer, observer, scheduler, webhook, email)
        utils/                 # money, ids, signing, logging
      prisma/
        schema.prisma
        migrations/
        seed.ts
  packages/
    contracts/                 # Foundry project (NEW)
      src/
        IUSDT.sol              # ERC-20 + EIP-3009 interface
        SubscriptionContract.sol
        mocks/MockUSDT.sol     # for anvil tests
      test/
        SubscriptionContract.t.sol
        Invariants.t.sol
      foundry.toml
      script/
        Deploy.s.sol
    sdk/                       # @whitechain-pay/sdk (NEW, Phase 7)
      src/
        client.ts              # secret-key server client
        checkout.tsx           # <WhitechainCheckout/> React component
        middleware.ts          # Node.js webhook verification middleware
        types.ts
  docs/                        # existing PRD + FLOW (unchanged)
  PLAN.md                      # this file
  README.md                    # Phase 9
  WHITECHAIN_FEEDBACK.md       # Phase 9
```

**Design constraint (carries from "preserve mock"):** The REST API + SDK method names should align with the existing `apps/web/src/services/mock/adapter.ts` `mockApi` signatures (e.g. `createPaymentIntent`, `authorizePayment`, `relayPayment`, `verifyPayment`, `createRefund`, `createPlan`, `createSubscription`, `runRenewal`, `verifySignedRequest`) so Phase 8 is a low-friction swap. The SDK wraps the resource-oriented REST routes (PRD §17.5) into those method names.

---

## 5. Cross-cutting engineering rules (apply in every phase)

1. **Money:** All token amounts are integer base-unit strings (`BaseAmount`). No floating-point arithmetic anywhere. Reuse the patterns in `apps/web/src/lib/money.ts` (`addBase`, `subBase`, `cmpBase`, `mulBaseInt`). Backend re-implements equivalent helpers.
2. **Token decimals:** Read `decimals()` from the USDT contract at runtime in Phase 0; never hardcode. All amount math uses the verified base-unit scale.
3. **Tenant isolation:** Every merchant-owned DB query includes `merchantId` from the auth context. Enforced in the repository layer, not just routes. Tested in Phase 9 (Merchant A cannot read Merchant B).
4. **Idempotency:** All write endpoints accept `Idempotency-Key` header; stored in `idempotency_record` table with a unique constraint on `(merchantId, key)`. Applies to payment creation, relayer submission, renewal, refund, webhook processing (PRD §5.6, §17.6, FLOW §6.5).
5. **Server authority:** Payment success is set ONLY by the chain observer after verified on-chain settlement. A frontend callback never marks success (PRD §5.5, FLOW §6.6).
6. **Secrets:** No private keys, API secrets, webhook secrets, or signing keys in client code or git. Relayer key + PayeeShield key + JWT secret in `.env`. API secret keys hashed at rest (shown once). Webhook signing secret shown once.
7. **No backward state:** Payment state transitions are server-validated; a webhook retry or stale client request cannot move `succeeded` back to `pending` (PRD §21).
8. **Logging:** Structured `pino` logs with `merchantId`, `paymentId`, `requestId`. Never log full signatures, private keys, or raw secrets.
9. **Testing:** Foundry unit + invariant tests for contracts; Vitest for backend services (signature verification, state machine, GasGuard policy, idempotency, tenant isolation); Playwright optional for e2e in Phase 8/9.
10. **Chain checks on every tx path:** Validate chain ID `1874` + token address on every transaction path (PRD §23.1).

---

## Phase 0 — Foundation & Critical Verification Gate

**Goal:** Stand up the monorepo, confirm the Whitechain environment is live, and run the P0 EIP-3009 / ERC-20 verification that gates the entire gasless architecture.

**Prerequisites:** `pnpm`, Node 20+, `foundryup` (or Foundry Windows binaries / WSL), a Whitechain Sepolia faucet-eligible wallet.

### Tasks

0.1 **Monorepo bootstrap**
- Create root `package.json` (workspace root, private, no source), `pnpm-workspace.yaml` listing `apps/*` and `packages/*`.
- `git mv` the existing root frontend (`package.json`, `src/`, `vite.config.ts`, `index.html`, `tsconfig.json`, `index.css`) into `apps/web/`. Preserve `apps/web/src/services/mock/*` unchanged.
- Add root dev tooling: TypeScript, ESLint, Prettier, `turbo` (optional). Add workspace scripts (`dev`, `build`, `lint`, `test`).
- Update `.gitignore` (`.env`, `node_modules`, `dist`, `apps/api/dist`, `packages/contracts/out`, `packages/contracts/cache`, `packages/contracts/broadcast`, `packages/contracts/lib`).
- Create empty `apps/api`, `packages/contracts`, `packages/sdk` skeletons with their own `package.json`.

0.2 **Whitechain environment verification**
- Confirm RPC responds (`eth_chainId` → `0x752` = 1874), explorer loads, faucet works (PRD §7.1, FLOW §18 P0).
- Record confirmed endpoints in `apps/api/src/config/chain.ts`.

0.3 **EIP-3009 + ERC-20 verification gate (P0 BLOCKER)** — target the exact USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`:
- Read on explorer: is the contract source verified? Save its ABI into `packages/contracts/src/IUSDT.sol` / `apps/api/src/web3/abi/usdt.json`.
- `cast call` (or viem script) for: `name`, `symbol`, `decimals`, `DOMAIN_SEPARATOR`, `nonce(address)`.
- Check method selectors for `transferWithAuthorization`, `receiveWithAuthorization`, `cancelAuthorization`, `authorizationState(address,bytes32)`.
- ERC-20 behavior tests: `approve` → `allowance` → `transferFrom` → revoke (`approve(0)`) between two funded test wallets.
- EIP-3009 end-to-end test: from a funded test wallet, build an EIP-712 `TransferWithAuthorization` typed message using the token's real domain separator (chain 1874, verifying contract = USDT address), sign it, submit via `cast send`/viem, and confirm the transfer settles. Verify nonce consumption + replay rejection.
- Record results in `docs/EIP3009_VERIFICATION.md` (go/no-go).

0.4 **Relayer wallet + WBT funding**
- Generate a dedicated relayer EVM key (hackathon-only; fund via faucet). Store in `.env` as `RELAYER_PRIVATE_KEY`. Document warnings.
- Create a second test wallet as a demo payer; fund with test USDT + WBT.

0.5 **Confirmation / finality policy**
- Investigate Whitechain Sepolia block time + reorg behavior; define thresholds for `processing` (tx submitted) → `confirmed` (1 block) → `finalized` (configurable, default 3 blocks). Record in `apps/api/src/config/settlement.ts` (PRD §23.3, FLOW §6.6, §18 P0).

### Deliverables
- pnpm monorepo with relocated `apps/web` (mock intact) + empty `apps/api`, `packages/contracts`, `packages/sdk`.
- `docs/EIP3009_VERIFICATION.md` with a **go / no-go** decision.
- `.env.example` with all required keys (relayer key, PayeeShield key, JWT secret, DATABASE_URL, REDIS_URL, USDT address, chain ID, RPC).
- Funded relayer + payer test wallets.

### Acceptance
- `pnpm install` + `pnpm --filter web dev` still runs the existing frontend unchanged.
- EIP-3009 `transferWithAuthorization` settles a real test-USDT transfer on Whitechain Sepolia; nonce replay is rejected.
- **If EIP-3009 is NOT supported → STOP and ask the owner. Do not proceed to Phase 1/4 gasless work.**

### Docs refs
PRD §7, §10.3, §16, §23, §27 (P0). FLOW §18 (P0 register), §22 (item 1–2).

---

## Phase 1 — Smart Contracts (Foundry)

**Goal:** Write, test, deploy, and verify the **subscription contract** on Whitechain Sepolia. The one-time gasless flow needs **no custom contract** (relayer calls the USDT's EIP-3009 directly, confirmed in Phase 0).

**Prerequisites:** Phase 0 passed (EIP-3009 + ERC-20 verified; endpoints confirmed).

### Tasks

1.1 **Foundry project setup** in `packages/contracts`
- `foundry.toml`: `[profile.default]` with `evm_version`, remappings (`@openzeppelin/=lib/openzeppelin-contracts/contracts/`), `solc_version`.
- `forge install OpenZeppelin/openzeppelin-contracts` (ReentrancyGuard, IERC20, SafeERC20, Ownable, Pausable).
- Submodule ignore rules in `.gitignore`.

1.2 **Token interface** `src/IUSDT.sol`
- ERC-20 interface + EIP-3009 interface (`TransferWithAuthorization` struct + function, `AuthorizationState` enum, events) matching the verified ABI from Phase 0.3.

1.3 **Subscription contract** `src/SubscriptionContract.sol` — shared spender model (PRD §11, §20.2, §20.3; FLOW §10):
- Storage: `mapping(bytes32 => Subscription)` keyed by `subscriptionId` (or sequential uint); `mapping(address => uint256)` is **not** used as the only limit (per-sub internal accounting required).
- `Subscription` struct: payer, merchant (fixed recipient), token (allowlisted = USDT only), amount or pricingRef, interval, maxChargePerCycle, cumulativeCap, totalSpent, nextDueTime, expiry, cancelled, lastChargedSequence.
- `createSubscription(...)` — called by payer (or via payer's signed approval pattern if needed). Stores terms; emits `SubscriptionCreated`.
- `charge(bytes32 subscriptionId, uint256 periodId, uint256 amount)` — **relayer-called** (configurable authorized caller role). Enforces ALL invariants from PRD §11.5:
  - active && not cancelled,
  - `block.timestamp >= nextDueTime`,
  - `periodId` not already charged (unique per cycle),
  - `amount <= maxChargePerCycle`,
  - `totalSpent + amount <= cumulativeCap`,
  - not expired,
  - recipient == stored merchant (no arbitrary recipient),
  - token == allowlisted USDT.
  - Then `SafeERC20.safeTransferFrom(payer, merchant, amount)`, update `totalSpent`, `nextDueTime`, `lastChargedSequence` **only on success** (checks-effects-interactions + ReentrancyGuard). Emit `SubscriptionCharged` or `SubscriptionRenewalFailed`.
- `cancel(bytes32 subscriptionId)` — payer-only; sets `cancelled = true`; blocks all future charges. Emit `SubscriptionCancelled`.
- `revokeAllowanceHint` — view-only helper returning remaining allowance info (the contract cannot call `approve(0)` for the customer; UX explains this — PRD §11.3, FLOW §10.6).
- `pause()` / `unpause()` — owner-only emergency stop on charging (Pausable on `charge`).
- Explicit token allowlist: `onlyAllowedToken` modifier; no arbitrary user-supplied token (PRD §20.3).
- Events sufficient for backend reconciliation: `SubscriptionCreated`, `SubscriptionCharged(amount, periodId, txIndex)`, `SubscriptionRenewalFailed(reason)`, `SubscriptionCancelled`, `Paused`, `Unpaused`.

1.4 **Mock USDT** `src/mocks/MockUSDT.sol`
- ERC-20 + EIP-3009 implementation for `anvil` tests (mintable, with real `DOMAIN_SEPARATOR` and `transferWithAuthorization`).

1.5 **Unit tests** `test/SubscriptionContract.t.sol`
- Cover every invariant in PRD §11.5: over-cap rejection, early charge rejection, expired rejection, cancelled rejection, double-charge-same-period rejection, recipient immutability, failed transfer does not advance state, cumulative cap boundary.
- Test pause/unpause, role guards.

1.6 **Invariant tests** `test/Invariants.t.sol`
- Fuzz: `totalSpent` never exceeds `cumulativeCap`; a period is never charged twice; cancelled subscription can never be charged.

1.7 **Integration test** `test/Integration.t.sol`
- Full flow on `anvil` with `MockUSDT`: approve → createSubscription → advance time → charge → verify transferFrom succeeded → cancel → charge reverts.

1.8 **Deploy + verify on Whitechain Sepolia**
- `script/Deploy.s.sol`: deploy `SubscriptionContract(usdtAddress, owner=relayer-or-gateway)`.
- `forge script script/Deploy.s.sol --rpc-url $WHITECHAIN_RPC --private-key $DEPLOYER_KEY --broadcast`.
- Verify source on the Whitechain explorer (Blockscout-compatible flow from the `whitechain-dev` skill).
- Record deployed address in `packages/contracts/.env.example`, `apps/api/src/config/contracts.ts`, and later in `README.md`.

### Deliverables
- Deployed + explorer-verified `SubscriptionContract` address on chain ID 1874.
- Passing `forge test` (unit + invariant + integration).

### Acceptance (PRD §24.6, FLOW §19.4)
- Contract rejects over-cap / early / expired / cancelled charges.
- `transferFrom` failure does not advance the cycle or increase `totalSpent`.
- Same billing period cannot be charged twice.
- Cancellation blocks future charges.
- Events emitted for backend reconciliation.

### Docs refs
PRD §11, §20.2, §20.3, §24.6. FLOW §10, §19.4, §22 (items 3, 7–9).

---

## Phase 2 — Database (Prisma + Neon)

**Goal:** Model the full application data layer matching the existing `apps/web/src/types/index.ts` domain types and PRD §22 entities, on Neon Postgres.

**Prerequisites:** Phase 0 (env). Can run in parallel with Phase 1.

### Tasks

2.1 **Provision Neon** — create DB, obtain `DATABASE_URL`, add to `.env`.

2.2 **Prisma setup** in `apps/api/prisma/`
- `schema.prisma` with Postgres provider. Generator outputs to `../src/db/generated`.

2.3 **Schema** — mirror the TS domain types + PRD §22. All merchant-owned models carry `merchantId` + indexes. Enums match the TS unions. Models:

- `Merchant` (id, businessName, displayName, website, businessEmail, supportEmail, description, logoText, accentColor, payoutWallet, walletVerified, walletVerifiedAt, environment, onboardingComplete, country, createdAt) — PRD §22.
- `MerchantApiKey` (id, merchantId, name, environment, publishable, secretHash, secretLast4, permissions[], status, createdAt, lastUsedAt, revokedAt).
- `Customer` (id, merchantId, email, name, wallet, notes[], createdAt, lastPaymentAt). Unique `(merchantId, email)`.
- `Product` (id, merchantId, name, description, imageGlyph, price, currency, billingMode, unitLabel?, unitPrice?, active, createdAt).
- `PaymentIntent` (id, merchantId, customerId?, customerEmail?, description, amount, receivedAmount?, refundedAmount, token, network, kind, sourceKind?, sourceId?, payerWallet?, payoutWallet, status, txRef?, authorizationRef?, gasSponsored, createdAt, settledAt?, expiresAt?, invoiceId?, paymentLinkId?, subscriptionId?, fulfilmentId?, receiptEmail, failureReason?). `@@index([merchantId, status])`, `@@index([merchantId, createdAt])`.
- `PaymentTimelineEntry` (id, paymentId, status, label, detail?, at, simulated?).
- `CheckoutSession` (id, paymentId, hostedSlug, status, expiresAt).
- `PaymentLink` (id, merchantId, slug unique, title, description, linkType, amount?, minAmount?, maxAmount?, productId?, reference?, returnUrl?, active, usageCount, totalCollected, createdAt, expiresAt?).
- `Invoice` + `InvoiceLineItem` (id, merchantId, customerId?, customerEmail, title, description, total, status, orderReference?, createdAt, expiresAt?, paidAt?, paymentId?, receiptEmailedAt?, tampered?).
- `PayeeShieldRecord` (id, invoiceId?/paymentId?, status, signingKeyId, signingKeyStatus, signatureTimestamp, verifiedAt?, digest, protectedFieldsJson). Or inline JSON on invoice/payment.
- `OnChainTransaction` (id, chainId, txHash unique, tokenContract, from, to, amount, blockNumber, receiptStatus, paymentId?).
- `Refund` (id, merchantId, paymentId, customerId?, amount, reason, status, gasSponsored, authorizationRef?, txRef?, createdAt, settledAt?, customerNotified).
- `RefundTimelineEntry`.
- `SubscriptionPlan` (id, merchantId, name, description, amount, currency, billingMode, unitLabel?, unitPrice?, interval, maxChargePerCycle, cumulativeLimit, planExpiryMonths?, retryPolicyJson, notifyCustomer, active, createdAt).
- `Subscription` (id, merchantId, customerId, planId, status, amount, interval, maxChargePerCycle, cumulativeLimit, spent, allowanceRemaining, nextBillingAt?, createdAt, expiresAt?, cancelledAt?, allowanceRevokedAt?, activationTxRef?, approvalTxRef?, onChainSubscriptionId?, retryPolicyJson).
- `RenewalAttempt` (id, subscriptionId, attempt, scheduledFor, executedAt?, status, amount, reason?, txRef?).
- `SubscriptionBillingHistory` (id, subscriptionId, paymentId, amount, at, status).
- `UsageRecord` (id, merchantId, subscriptionId, units, unitPrice, amount, recordedAt, merchantReference, billed, billedPaymentId?).
- `FulfilmentOrder` (id, merchantId, paymentId, customerId, productId?, orderReference, amount, status, trackingNumber?, completionUrl?, merchantNotes, customerNotes, updatedAt).
- `FulfilmentEvent` (id, fulfilmentId, status, note, at, actor, customerVisible).
- `WebhookEndpoint` (id, merchantId, url, description, events[], active, signingSecretHash, signingSecretLast4, createdAt, lastDeliveryAt?, health).
- `WebhookEvent` (id, merchantId, type, endpointId, payloadSummary, responseStatus?, attempts, status, createdAt, lastAttemptAt?, nextRetryAt?, relatedPaymentId?, relatedSubscriptionId?, payloadJson).
- `PaymentException` (id, merchantId, type, severity, status, paymentId?, customerId?, subscriptionId?, amount?, webhookEventId?, detectedAt, whatHappened, whyItHappened, suggestedAction, recommendedAction).
- `ResolutionAttempt` (id, exceptionId, action, at, result, succeeded).
- `RelayerTransaction` (id, merchantId, operation, gasSponsored, wbtCost, status, createdAt, txRef, paymentId?, rejectionReason?).
- `RelayerBudget` (id, scope: merchant|global, merchantId?, maxSpendWbt, currentUsageWbt, dailyLimitWbt, dailySpentWbt, windowStart, paused).
- `GasGuardPolicy` (id, merchantId?, maxGasPerTxGwei, merchantBudgetWbt, dailyLimitWbt, allowedNetwork, allowedToken, allowedContract, allowedFunctions[], rateLimitPerMinute, authorizationExpiryCheck, replayProtection, emergencyPaused).
- `SecurityEvent` (id, merchantId?, at, event, detail, ip).
- `AppNotification` (id, merchantId, title, body, at, read, kind, link?).
- `IdempotencyRecord` (id, merchantId, key unique, resourceType, resourceId, createdAt, requestBodyHash). `@@unique([merchantId, key])`.
- `OutboxEvent` (id, merchantId, type, resourceId, payloadJson, createdAt, processedAt?) — transactional outbox for webhook dispatch (FLOW §14.2).
- `EmailLog` (id, merchantId, toAddress, template, subject, bodyJson, status: queued|sent|failed, createdAt, sentAt?, failureReason?) — stub email record.

2.4 **Migrations + seed**
- `prisma migrate dev` baseline.
- `seed.ts`: create **2 merchants** (to demo cross-merchant isolation in Phase 9), demo products, plans, a webhook endpoint, GasGuard policies, global relayer budget.

2.5 **Prisma client + repository layer**
- `apps/api/src/db/client.ts` (singleton Prisma client).
- `apps/api/src/db/repositories/*.ts`: typed repos that **always** filter by `merchantId` (tenant isolation enforced here, not in routes). Mirror the `mockApi` method shapes where practical.

### Deliverables
- Migrated Neon DB; seed data; generated Prisma client; typed repository layer.

### Acceptance
- `pnpm --filter api prisma:migrate deploy` + `prisma:seed` succeed.
- Repo layer rejects a query missing `merchantId` (type-level or runtime guard).

### Docs refs
PRD §22 (entities), §8.3 (isolation), §19.3 (data persistence). FLOW §15.

---

## Phase 3 — Backend Foundation (Fastify)

**Goal:** Stand up the Fastify app with auth, tenant isolation, idempotency, and shared infrastructure — the spine every later phase plugs into.

**Prerequisites:** Phase 2.

### Tasks

3.1 **App scaffold** (`apps/api/src`)
- Fastify instance with `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit` (Upstash-backed or in-memory), `@fastify/sensible`, `pino` structured logging, request-id, global error handler returning structured error codes (PRD §17.6).
- `src/config/index.ts` — env parsing (Zod), `src/config/chain.ts` (chain ID 1874, RPC, USDT address), `src/config/contracts.ts` (subscription contract address from Phase 1).
- Health endpoints `GET /health`, `GET /v1/status` (network/token/feature capabilities — PRD §17.5 "Developer status").

3.2 **viem web3 layer** (`apps/api/src/web3`)
- Public client (RPC = Whitechain Sepolia).
- Wallet client for relayer (from `RELAYER_PRIVATE_KEY`).
- `abi/usdt.json` (verified ABI), `abi/subscription.json`.
- EIP-712 helpers: build + verify `TransferWithAuthorization` typed data against the token's real domain separator.

3.3 **Auth: email + password + JWT** (`src/plugins/auth.ts`, `src/routes/v1/auth.ts`)
- `POST /v1/auth/register`, `POST /v1/auth/login` (bcrypt password hash, JWT signed with `JWT_SECRET`, returned as Bearer token).
- `authGuard` plugin: verify JWT, attach `merchantId` to request.
- Wallet-ownership verification flow for payout wallet (`POST /v1/merchants/wallet/verify` — challenge + verify signature, PRD §8.1, FLOW §4.1, §18 P0).

3.4 **API keys** (`src/routes/v1/api-keys.ts`)
- `POST /v1/api-keys` (generate publishable + secret; hash secret at rest; show secret once).
- `apiKeyGuard` for SDK/REST auth (publishable = browser-safe; secret = server-only).
- `POST /v1/api-keys/:id/revoke`.

3.5 **Tenant isolation middleware** — `requireMerchant` decorator; every repository call uses it. Cross-merchant access returns 404 (not 403, to avoid leaking existence).

3.6 **Idempotency middleware** — `Idempotency-Key` header → `IdempotencyRecord` lookup; replay returns the original response (PRD §17.6, §5.6).

3.7 **Shared helpers**
- Pagination (`limit`, `cursor`), filtering, ISO timestamps, structured error envelopes (`{ error: { code, message, params } }`).
- Rate limiting on sensitive endpoints (login, payment create, relayer submit).

3.8 **BullMQ setup** (`src/queues`)
- Upstash Redis connection; queue definitions: `relayer`, `webhook`, `email`, `scheduler`, `observer`. Worker entrypoint `src/worker.ts` (separate Render background process).

### Deliverables
- Running Fastify with auth, API keys, idempotency, tenant isolation, rate limiting, BullMQ queues.
- `pnpm --filter api dev` serves `/health`, `/v1/status`, auth routes.

### Acceptance
- Register → login → call a protected route with Bearer token.
- A second merchant cannot read merchant 1's resources (returns 404).
- Duplicate `Idempotency-Key` returns the original response.

### Docs refs
PRD §8.1, §17.5, §17.6, §23.1. FLOW §4, §5.

---

## Phase 4 — Core One-Time Payment Pipeline

**Goal:** The full gasless one-time USDT checkout working end-to-end on Whitechain Sepolia, with PayeeShield, GasGuard, relayer, chain observer, settlement, webhooks, email stub, exceptions, and DeliveryGuard.

**Prerequisites:** Phase 0 (EIP-3009 verified), Phase 1 (contracts deployed — not strictly required for one-time, but needed for shared config), Phase 3.

### Tasks (vertical slices)

4.1 **Payment intents + checkout sessions** (`src/routes/v1/payment-intents.ts`, `checkout-sessions.ts`)
- `POST /v1/payment-intents` (validate amount/token/chain/payout/description/idempotency; create intent + checkout session; PRD §17.5).
- `GET /v1/payment-intents/:id`.
- `POST /v1/checkout-sessions`, `GET /v1/checkout-sessions/:id` (client-safe; returns signed payload + merchant + amount + token + chain + recipient + expiry — FLOW §6.3).

4.2 **PayeeShield signing service** (`src/services/payeeShield.ts`)
- Canonical payload builder (schema/version, merchantId, invoice/payment-request ID, merchant display identity, payout wallet, chain ID, token contract + decimals metadata, amount in base units, description, created/expiry, nonce, keyId — FLOW §9.3).
- EIP-712 sign with single gateway key from `.env` (`PAYEESHIELD_SIGNING_KEY`); include `keyId`.
- Sign on intent/invoice creation; store `PayeeShieldRecord`.
- `POST /v1/payeeshield/verify` (server-side) + a public key endpoint so checkout can resolve the public key by `keyId` and verify (FLOW §9.4).
- Tamper detection: any mismatched field → reject/flag (PRD §13.2).
- Keep signing key separate from relayer key.

4.3 **Payment links + QR** (`src/routes/v1/payment-links.ts`)
- `POST /v1/payment-links` (fixed / customer_amount / reusable; min/max for customer_amount; slug unique; QR encodes hosted URL not raw transfer — FLOW §7).
- `GET /v1/payment-links/:id`, disable/expire link.
- `GET /l/:slug` resolves to checkout session creation for the link.

4.4 **Invoices** (`src/routes/v1/invoices.ts`)
- `POST /v1/invoices` (line items, total computed in base units, PayeeShield-signed, expiry).
- `GET /v1/invoices/:id`, link to payment intent.

4.5 **Checkout backend** (`src/routes/v1/checkout.ts`)
- `GET /v1/checkout/:sessionId` → returns signed payment request for the widget.
- `POST /v1/checkout/:sessionId/authorize` → payer submits EIP-3009 signed `TransferWithAuthorization` (from, to, value, validAfter, validBefore, nonce, signature) + payer wallet.

4.6 **Authorization validation service** (`src/services/authorization.ts`) — PRD §10.2, FLOW §6.4:
- Verify EIP-712 domain (name/version, chain ID 1874, verifying contract = USDT address).
- `recoverAddress` from signature → must equal claimed payer wallet.
- Check `validAfter`/`validBefore` window (short).
- Check nonce uniqueness + `authorizationState` not already consumed.
- Bind to the intent's exact amount, recipient, token, chain.
- Reject stale / duplicate / mismatched / already-consumed authorizations.
- Mark intent `authorized`.

4.7 **GasGuard policy engine** (`src/services/gasGuard.ts`) — PRD §16, FLOW §6.5, §16.1:
- Pre-submission checks: merchant active; token + chain + target contract/function allowlisted; destination == merchant payout wallet for this intent; amount within per-payment + merchant limits; signature + validity window acceptable; nonce/intent not used; merchant + global WBT budgets have capacity; per-payer + per-merchant + global rate limits; relayer WBT balance above minimum; emergency pause off.
- Per-transaction gas ceiling; simulate/estimate via `eth_estimateGas` before broadcasting where possible.
- DB-backed `RelayerBudget` + `GasGuardPolicy`; atomic spend reservation.
- Manual pause switch (`POST /v1/ops/relayer/pause`, owner-only).
- Record gas paid, tx hash, payment, budget usage.
- Reject repeated authorizations / duplicate intents.

4.8 **Relayer service** (`src/services/relayer.ts` + `src/workers/relayer.worker.ts`) — FLOW §6.5:
- GasGuard approves → enqueue idempotent tx (BullMQ `relayer` queue, idempotency key).
- Worker: relayer wallet signs + submits `transferWithAuthorization` to USDT; pays WBT gas; store tx hash + gas + budget usage.
- Timeout/ambiguous handling: query `authorizationState` + chain receipt before retrying; **never blindly resubmit** (PRD §10.2, FLOW §6.5, §13).
- Mark intent `submitted`; emit `payment.processing` via outbox.

4.9 **Chain observer** (`src/workers/observer.worker.ts`) — PRD §10.1 step 11–12, FLOW §6.6:
- viem poller watching USDT `Transfer` events + tx receipts for submitted intents.
- Verify: chain ID 1874, USDT contract, receipt status success, expected `Transfer` event, `from` == payer, `to` == merchant payout, amount == expected base units, intent not already settled.
- Apply confirmation/finality policy (Phase 0.5): `processing` → `confirmed` → `finalized`.
- Only then mark payment `succeeded` (state machine).

4.10 **Payment state machine** (`src/services/paymentStateMachine.ts`) — PRD §21:
- States: created → requires_authorization → authorized → submitted → pending_confirmation → succeeded (+ underpaid/overpaid/expired/failed/cancelled/partially_refunded/refunded/exception).
- Server-validated transitions; no backward moves; immutable on-chain transfer record.

4.11 **Webhook dispatcher** (`src/services/webhook.ts` + `src/workers/webhook.worker.ts`) — PRD §18, FLOW §14:
- Transactional outbox: business-state change + event written atomically.
- Worker loads event + endpoint; HMAC-SHA256 sign payload with endpoint secret; include event ID, created time, merchant ID, resource ID, schema version, replay-protection timestamp.
- Send; record response, latency, attempt count. Retry non-2xx with exponential backoff + jitter + bounded window.
- Dashboard replay endpoint `POST /v1/webhooks/events/:id/replay`.
- Event types: `payment.created`, `payment.processing`, `payment.succeeded`, `payment.failed`, `payment.expired`, `payment.underpaid`, `payment.overpaid`, `payment.duplicate_detected`, `refund.*`, `invoice.paid`, `subscription.*`, `fulfilment.updated` (PRD §18.1).

4.12 **Email stub** (`src/services/email.ts` + `src/workers/email.worker.ts`)
- Paid receipt / refund / renewal emails written to `EmailLog` + enqueued. Worker just marks `sent` (or `failed` after retry). No SMTP.
- Receipt content includes merchant identity, invoice ref, amount/token, network, paid timestamp, tx hash/explorer link (PRD §13.3).
- Email failure → notification exception; **never reverses settlement** (PRD §13.3, FLOW §14.3).

4.13 **Exception engine** (`src/services/exceptions.ts`) — PRD §15, FLOW §13:
- Reconcile observed transfers against intents/invoices.
- Detect: underpaid, overpaid, duplicate, expired-paid-late, reverted, unconfirmed, unexpected recipient/token/chain, duplicate relayer submission, webhook/email delivery failure, refund-not-settled, subscription renewal failure.
- Each exception: type, severity, status, reason code, supporting refs, timestamps, suggested action, audit trail of resolution attempts.
- Auto-retry safe infra (webhook/email) with bounded policy; **never auto-refund** without merchant authorization.

4.14 **DeliveryGuard** (`src/routes/v1/fulfilment.ts`, `src/services/fulfilment.ts`) — PRD §14, FLOW §12:
- Create fulfilment record on settlement; statuses: not_started, processing, fulfilled, cancelled, return_requested, refund_initiated/refunded.
- Merchant updates with timestamped events + evidence refs (off-chain); customer-visible vs merchant-only notes separated.
- Customer order view endpoint `GET /v1/orders/:id` (customer-scoped).

4.15 **Analytics + dashboard read endpoints** (`src/routes/v1/dashboard.ts`, `analytics.ts`)
- Overview metrics (gross USDT, successful/pending/failed, refunds, active subs, exception counts).
- Payments list with pagination/filter; customers; etc. (mirrors `mockApi` query shapes for Phase 8).

### Deliverables
- End-to-end gasless one-time payment on testnet: intent → PayeeShield → checkout → EIP-3009 sign → relayer submit → observer verify → `succeeded` → webhook + receipt (stubbed).

### Acceptance (PRD §24.1, §24.2, §24.4, §24.7, §24.8, §24.9; FLOW §19.1, §19.2, §19.6)
- Correct EIP-3009 signature settles exact amount payer→merchant; payer pays no WBT.
- Wrong chain/token/recipient/amount rejected; expired authorization rejected; replayed nonce rejected.
- Duplicate idempotency key returns same intent.
- Relayer timeout does not produce a duplicate transfer.
- Payment never marked successful from a frontend callback alone.
- PayeeShield: valid passes; modified recipient/amount/token/chain/expiry fails.
- GasGuard rejects unsupported chain/token, over-budget, duplicate/expired authorizations; pause works.
- Underpayment/overpayment/duplicate/late-payment detected by exception engine.
- Merchant A cannot read Merchant B's payment/customer.

### Docs refs
PRD §9, §10, §13, §14, §15, §16, §17, §18, §21, §24. FLOW §6, §7, §8, §9, §12, §13, §14, §16, §19.

---

## Phase 5 — Subscriptions & Usage Billing

**Goal:** Recurring billing via the deployed subscription contract + backend scheduler + relayer, with usage-based billing and cancellation/allowance-revocation UX.

**Prerequisites:** Phase 1 (contract) + Phase 4 (relayer/observer/GasGuard/webhooks).

### Tasks

5.1 **Plans + products** (`src/routes/v1/plans.ts`) — `POST /v1/plans`, `GET`, list. Plan config: amount or usage pricing, interval (hourly/daily/monthly), maxChargePerCycle, cumulativeLimit, expiry, retryPolicy, notifyCustomer (FLOW §10.1).

5.2 **Subscription create** (`src/routes/v1/subscriptions.ts`) — mirrors on-chain activation:
- Customer flow: `approve(subscriptionContract, cumulativeCap)` (customer-paid WBT) → `createSubscription(...)` on contract (customer-paid WBT) — FLOW §10.2, PRD §11.4.
- Backend monitors `SubscriptionCreated` event → stores mirror `Subscription` record (onChainSubscriptionId, terms, nextBillingAt, status `active`).
- `POST /v1/subscriptions`, `GET /v1/subscriptions/:id`, `POST /v1/subscriptions/:id/cancel` (records intent; customer must submit on-chain `cancel`).

5.3 **Renewal scheduler** (`src/workers/scheduler.worker.ts`) — FLOW §10.3:
- BullMQ repeatable job scans active subscriptions due (`nextBillingAt <= now`).
- For each: create idempotent renewal job `(subscriptionId, billingSequence)`. Check mirror state + on-chain state + retry policy + expiry + not-already-processed.

5.4 **Relayer renewal execution** (`src/services/renewal.ts` + relayer worker):
- GasGuard check → relayer calls `subscriptionContract.charge(subscriptionId, periodId, amount)`.
- Contract enforces invariants (Phase 1); `transferFrom(payer, merchant, amount)`; pays WBT gas.

5.5 **Renewal settlement verification** — observer verifies `SubscriptionCharged` event + USDT `Transfer` event → update `totalSpent`, `nextBillingAt`, `RenewalAttempt`, `SubscriptionBillingHistory`, emit `subscription.renewed` webhook.

5.6 **Usage-based billing** (`src/routes/v1/usage.ts`) — PRD §11.6, FLOW §10.4:
- `POST /v1/usage` (merchant reports usage with idempotency key; gateway validates + aggregates per period).
- `billUsage` computes amount in base units; enforce ≤ `maxChargePerCycle` and ≤ remaining cumulative cap; route through the renewal charge path with `periodId`.
- If usage exceeds cap: no charge; mark cap-exceeded / requires customer action.

5.7 **Renewal failure handling** (`src/services/renewal.ts`) — PRD §11.7, FLOW §10.5:
- Classify failure (insufficient balance, allowance exhausted, allowance revoked, cancelled, expired, cap exceeded, relayer/RPC failure, contract rejection).
- Retry per merchant policy (max attempts, backoff, idempotent same `billingSequence`); no double-charge; no cycle advance on failure; no multi-cycle catch-up by default.
- Notify merchant + customer; emit `subscription.renewal_failed`.

5.8 **Cancellation + allowance revocation** (`src/routes/v1/subscriptions.ts`) — PRD §11.3, FLOW §10.6:
- Customer submits on-chain `cancel` (customer-paid WBT); observer sees `SubscriptionCancelled` → backend stops scheduling.
- UX clearly explains allowance revocation is a **separate** customer `approve(0)` transaction; provide a revoke-allowance action in the dashboard.

### Deliverables
- Working recurring billing on testnet: plan → approve → activate → scheduled renewal → settled transfer → webhook. Failure + cancellation paths work.

### Acceptance (PRD §24.6; FLOW §19.4)
- Renewal succeeds only when due and within caps.
- Duplicate scheduler job cannot charge one cycle twice.
- Contract rejects over-cap / early / expired / cancelled charges.
- `transferFrom` failure does not advance cycle or increase `totalSpent`.
- Cancellation immediately blocks future charges.
- Allowance revocation shown as separate customer action.

### Docs refs
PRD §11, §24.6. FLOW §10, §19.4, §22 (items 3–10).

---

## Phase 6 — Refunds

**Goal:** Full + partial merchant-authorized refunds as new USDT transfers from merchant → payer, settled only after on-chain verification.

**Prerequisites:** Phase 4 (chain observer, state machine, webhooks).

### Tasks

6.1 **Refund create** (`src/routes/v1/refunds.ts`) — PRD §12, FLOW §11:
- `POST /v1/refunds` (paymentId, amount, reason, gasSponsored, idempotency key).
- Eligibility: payment `succeeded`/`partially_refunded`/`overpaid`; amount > 0; cumulative refunds ≤ original settled amount − prior refunds.
- Default destination = original payer; changing destination requires explicit confirmation + higher-risk flag.
- Creates `Refund` record (`awaiting_authorization`).

6.2 **Refund authorization** — FLOW §11.2, §11.3:
- If EIP-3009 supported (from Phase 0): merchant signs `TransferWithAuthorization(merchant → payer, refund amount)`; relayer sponsors gas.
- Else: merchant submits a normal USDT transfer and pays WBT; UI **must disclose** this is not gas-sponsored (PRD §12.3).

6.3 **Relayer refund submission + verification**:
- Sponsored path: relayer submits authorization; observer verifies USDT transfer merchant→payer.
- Merchant-paid path: merchant provides tx hash; observer verifies it.
- Refund → `succeeded` only after verified settlement (PRD §12.2).

6.4 **Refund notifications**:
- Update original payment `refundedAmount` + status (`partially_refunded`/`refunded`).
- Emit `refund.succeeded` webhook; email stub sends refund confirmation.
- DeliveryGuard status → `refund_initiated`/`refunded` if linked.

### Deliverables
- Full + partial refunds settling on testnet; cumulative-refund accounting correct.

### Acceptance (PRD §24.5; FLOW §19.5)
- Full refund cannot exceed original payment.
- Partial refunds sum without exceeding original.
- Duplicate refund API call is idempotent.
- Sponsored path works where supported; fallback disclosed where not.
- Refund marked successful only after verified transfer to original payer.

### Docs refs
PRD §12, §24.5. FLOW §11, §19.5.

---

## Phase 7 — SDK (`packages/sdk`)

**Goal:** A typed `@whitechain-pay/sdk` with a server client, a React checkout widget, and a Node.js webhook-verification middleware.

**Prerequisites:** Phases 3–6 (REST API stable enough).

### Tasks

7.1 **Server client** (`src/client.ts`) — secret-key methods mirroring `mockApi` shapes: `paymentIntents.create/get`, `paymentLinks.create/get/disable`, `invoices.create/get`, `refunds.create/get`, `customers.create/get/list`, `plans.crud`, `subscriptions.create/get/cancel`, `usage.record/bill`, `webhooks.create/update/replay`. Idempotency-key support, structured errors, typed responses (PRD §17.4, §17.6).

7.2 **React checkout widget** (`src/checkout.tsx`) — `<WhitechainCheckout checkoutId={...} onSuccess onError />`:
- Fetches signed payment request from `/v1/checkout/:id`.
- Verifies PayeeShield signature client-side (resolve public key by keyId; compare displayed amount/token/chain/recipient — FLOW §9.4).
- Mounts RainbowKit + viem; requests chain switch to 1874; checks USDT balance.
- Builds EIP-712 `TransferWithAuthorization` from the token's real domain; prompts wallet sign; submits to `/v1/checkout/:id/authorize`.
- Never treats browser callback as settlement; polls `/v1/payment-intents/:id` for authoritative status (PRD §17.4).

7.3 **Node.js middleware** (`src/middleware.ts`) — `verifyWebhookSignature(secret)` HMAC-SHA256 verifier with event-ID dedupe guidance (PRD §18.2).

7.4 **Build + types** — `tsup` build, `dist/` types, package `exports` map. Local tarball for hackathon consumption.

### Deliverables
- Importable `@whitechain-pay/sdk` with server client + `<WhitechainCheckout/>` + webhook verifier.

### Acceptance (PRD §24.3)
- A server can create a payment intent and verify status via the SDK.
- The widget completes a real gasless payment.
- Webhook signature verifies in a consumer app.

### Docs refs
PRD §17, §24.3. FLOW §5.

---

## Phase 8 — Frontend Wiring (`apps/web`)

**Goal:** Replace the mock adapter with the real API client + RainbowKit/viem wallet signing, and deploy.

**Prerequisites:** Phases 3–7 (API + SDK ready). **This is the phase where the preserved mock is finally removed.**

### Tasks

8.1 **Real API client** — delete `apps/web/src/services/mock/*`; introduce `src/services/api.ts` (HTTP client using `@whitechain-pay/sdk` or direct fetch against `apps/api` `/v1`). Keep method shapes aligned with the prior `mockApi` so dashboard components need minimal changes.

8.2 **Auth + session** — email/password login → JWT bearer stored (httpOnly cookie or in-memory); route guards; onboarding + wallet-ownership verification flow.

8.3 **Checkout with RainbowKit + viem** — integrate `<WhitechainCheckout/>` (or the SDK's primitives) into `features/checkout/Checkout.tsx` and `SubscriptionCheckout.tsx`: PayeeShield verify, chain switch to 1874, EIP-712 sign, submit, poll status. Same for subscription approve/activate/cancel.

8.4 **Dashboard reads** — point all dashboard pages (payments, links, invoices, customers, products, subscriptions, refunds, fulfilment, exceptions, analytics, GasGuard, developers, settings) at real endpoints; replace `useDemo` store with server state (React Query or SWR).

8.5 **Routing + build** — switch `HashRouter` → `BrowserRouter` (or keep HashRouter if Vercel SPA rewrite is simpler); remove `vite-plugin-singlefile` for a normal Vercel build; add `vercel.json` SPA rewrite.

8.6 **Deploy**
- `apps/web` → Vercel (env: `VITE_API_BASE_URL`, `VITE_PUBLISHABLE_KEY`, `VITE_WC_PROJECT_ID`).
- `apps/api` web service → Render; `apps/api` worker (`src/worker.ts`) → Render background worker (env: `DATABASE_URL`, `REDIS_URL`, `RELAYER_PRIVATE_KEY`, `PAYEESHIELD_SIGNING_KEY`, `JWT_SECRET`, `USDT_ADDRESS`, `SUBSCRIPTION_CONTRACT_ADDRESS`, `WHITECHAIN_RPC`, `CHAIN_ID`).
- Neon + Upstash wired.

### Deliverables
- Live gateway on Whitechain Sepolia: real merchant dashboard + hosted checkout + real wallet flow.

### Acceptance
- A merchant can log in, configure a payout wallet, create a payment, and a payer can complete a gasless payment via the hosted checkout.
- Dashboard shows real settled payments + tx hashes.

### Docs refs
PRD §8, §9, §25. FLOW §15, §20.

---

## Phase 9 — Hardening, Demo & Submission

**Goal:** Prove every acceptance criterion, write docs, record the demo, submit.

### Tasks

9.1 **Cross-merchant isolation tests** — automated + manual: Merchant A cannot fetch Merchant B's customers/payments/invoices by ID (PRD §8.3, §24.4).

9.2 **End-to-end scenario sweep** — execute every scenario in PRD §24 / FLOW §19:
- One-time (§19.1), PayeeShield (§19.2), links/receipts (§19.3), subscription (§19.4), refunds (§19.5), post-payment ops (§19.6).

9.3 **README** — setup, architecture, current limitations, contract addresses, **explorer transaction link** for at least one real test-USDT payment, and the "why on-chain stablecoin settlement on Whitechain" explanation (PRD §24.1, §25; FLOW §21).

9.4 **`WHITECHAIN_FEEDBACK.md`** — honest notes on what worked, what was difficult, what docs were missing (FLOW §21).

9.5 **Demo features** — GasGuard rejected-request demo; PayeeShield tampered-recipient rejection demo (PRD §25 step 8, 10).

9.6 **Demo video** — 2–4 minutes, merchant + payer views, one real settlement, one post-payment op (refund or renewal) (PRD §25, FLOW §20).

9.7 **Acceptance checklist walk-through** — PRD §24.1–§24.9 item by item.

9.8 **Steady commit history** — ensure commits across phases, not a single bulk upload (FLOW §21).

### Deliverables
- Submission-ready repo + video + feedback file.

### Acceptance (PRD §28, FLOW §21)
- Contracts deployed + verified on Whitechain Sepolia (1874).
- ≥1 real test-USDT payment settled; explorer link in README.
- Core payer + merchant flow works end-to-end.
- Relayer WBT funding + GasGuard protections visible.
- Payment direct to merchant wallet; non-custodial.
- ≥1 post-payment operation (refund or renewal) demonstrated.
- SDK/widget usable.
- Dashboard + customer checkout both shown.
- README + limitations + contract addresses documented.
- Steady commit history; 2–4 min video; `WHITECHAIN_FEEDBACK.md`.

---

## 7. Two-developer parallelization plan

Assuming Dev A (backend/contracts-leaning) and Dev B (backend/integration-leaning). Frontend wiring (Phase 8) is later and joint.

| Window | Dev A | Dev B |
|---|---|---|
| 1 | Phase 0 (monorepo + EIP-3009 gate) | Phase 0 (Whitechain env + relayer wallet + confirmation policy) |
| 2 | Phase 1 (subscription contract + tests + deploy) | Phase 2 (Prisma schema + Neon + repos + seed) |
| 3 | Phase 3 (Fastify + auth + API keys + idempotency) | Phase 3 (tenant isolation + BullMQ + web3/viem layer) |
| 4 | Phase 4.1–4.6 (intents, PayeeShield, links, invoices, checkout, auth validation) | Phase 4.7–4.11 (GasGuard, relayer, observer, state machine, webhooks) |
| 5 | Phase 4.12–4.15 (email stub, exceptions, DeliveryGuard, analytics) | Phase 5 (subscriptions + scheduler + usage) |
| 6 | Phase 6 (refunds) | Phase 7 (SDK) |
| 7 | Phase 8 (frontend wiring — checkout + RainbowKit) | Phase 8 (frontend wiring — dashboard reads + auth) |
| 8 | Phase 9 (e2e tests, isolation tests, GasGuard/PayeeShield demos) | Phase 9 (README, feedback, video, submission checklist) |

---

## 8. Risk register (tracks PRD §27)

| Priority | Risk | Mitigation in this plan |
|---|---|---|
| P0 | Test USDT lacks EIP-3009 | Phase 0.3 hard gate; **stop and ask owner** if unsupported — no silent fallback. |
| P0 | Token decimals/transfer behavior unverified | Phase 0.3 reads `decimals`/`symbol`/`name` + tests transfers; no hardcoded decimals. |
| P0 | Subscription allowance/`transferFrom` behavior | Phase 1.5–1.7 tests on `MockUSDT` + integration on Whitechain Sepolia. |
| P0 | Whitechain endpoints change | Phase 0.2 re-confirms live before deploy. |
| P1 | No embedded wallet | External-wallet flow (RainbowKit); UX discloses wallet requirement (PRD §9.1, FLOW §1.2, §18). |
| P1 | Subscription setup/cancel not gasless | Disclosed in UI + demo (Phase 5.8, FLOW §10.6). |
| P1 | Allowance revocation is separate | Explicit customer `approve(0)` action (Phase 5.8). |
| P1 | Refund sponsorship conditional | Phase 6.2 branches on Phase 0 EIP-3009 result; fallback disclosed. |
| P1 | Confirmation/finality policy | Phase 0.5 defines processing/confirmed/finalized. |
| P1 | Relayer key custody | `.env` + warnings; documented as hackathon-only (Phase 0.4). |
| P1 | PayeeShield key custody | Single gateway key in `.env`, separate from relayer key (Phase 4.2). |
| P1 | Webhook durability | Transactional outbox + BullMQ retries + replay (Phase 4.11). |
| P1 | Chain/indexer reliability | Observer retry/backfill + RPC outage handling (Phase 4.9). |

---

## 9. Acceptance criteria traceability (PRD §24)

| Criterion | Phase |
|---|---|
| §24.1 Whitechain qualification (deploy, verify, real USDT payment, README link, on-chain rationale) | 0, 1, 4, 9 |
| §24.2 One-time checkout | 4 |
| §24.3 Developer integration (SDK) | 7 |
| §24.4 Merchant/customer views + isolation | 3, 8, 9 |
| §24.5 Refund | 6 |
| §24.6 Subscription | 1, 5 |
| §24.7 GasGuard | 4.7 |
| §24.8 PayeeShield | 4.2 |
| §24.9 DeliveryGuard + exceptions | 4.13, 4.14 |

---

## 10. Definition of done

The MVP is done when:
1. Phase 0 EIP-3009 gate passed (or an owner-approved fallback is documented).
2. `SubscriptionContract` deployed + verified on Whitechain Sepolia (1874).
3. ≥1 real test-USDT gasless one-time payment settled; explorer link in README.
4. PayeeShield, GasGuard, webhooks (signed + retried), exceptions, DeliveryGuard all functional.
5. Subscriptions + at least one refund demonstrated on testnet.
6. SDK usable (`<WhitechainCheckout/>` + server client + webhook verifier).
7. Gateway's own dashboard + hosted checkout wired to the real API and deployed (Vercel + Render + Neon + Upstash).
8. Cross-merchant isolation proven.
9. README + `WHITECHAIN_FEEDBACK.md` + 2–4 min demo video complete.
10. Steady commit history across phases.

A hackathon pass does **not** imply production readiness (PRD §28).
