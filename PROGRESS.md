# Progress — EzPayz

**Last updated:** 31 October 2026
**Status:** Feature-complete MVP. All 10 phases built. 3 real e2e tests passed on Whitechain Sepolia. Local (no deploy yet).

---

## Completed phases

### Phase 0 — Foundation + EIP-3009 verification gate ✅
- pnpm monorepo bootstrapped: `apps/web` (relocated React frontend, mock preserved), `apps/api` (Fastify backend), `packages/contracts` (Foundry), `packages/sdk`.
- Whitechain Sepolia environment confirmed: chain ID 1874, RPC live, ~1s blocks, rate limit documented.
- **EIP-3009 verification PASSED** (`docs/EIP3009_VERIFICATION.md`): the required test USDT (`0xcedfB5…`) is an EIP-1967 proxy → `TetherTokenV2` (impl `0x2642…026F7`, source-verified). Full EIP-3009 present (`transferWithAuthorization`, `receiveWithAuthorization`, `cancelAuthorization`, `authorizationState`, typehashes, `DOMAIN_SEPARATOR`). Live settlement test passed (tx `0xf5de69f2…`).
- Relayer wallet set up (reuses the test payer key). Finality policy defined (confirmed=1 block, finalized=5 blocks).
- `.env.example`, `apps/api/src/config/chain.ts`, `apps/api/src/config/settlement.ts`.

### Phase 1 — Subscription smart contract ✅
- `SubscriptionContract` (Solidity/Foundry): shared ERC-20 spender with internal per-subscription accounting. `createSubscription` (customer), `charge` (CHARGER_ROLE relayer), `cancel` (payer), `pause`/`unpause` (admin). Enforces all PRD §11.5 invariants: due/cancelled/expired checks, per-cycle + cumulative caps, no double-charge per period, fixed recipient, CEI + ReentrancyGuard, failed transfer reverts without advancing state.
- 15 forge tests pass (13 unit + 2 fuzz/invariant).
- **Deployed + source-verified** on Whitechain Sepolia: `0x0b8Da2EE37f3599141aFD500b1e2699D5A6bCdbB`.
- `CHARGER_ROLE` granted to the relayer (one-time admin action).

### Phase 2 — Database ✅
- PostgreSQL (Neon) + Prisma 6.19.3. Schema with ~30 models mirroring the domain types + PRD §22: Merchant, MerchantApiKey, Customer, Product, PaymentIntent, CheckoutSession, PaymentLink, Invoice, OnChainTransaction, Refund, SubscriptionPlan, Subscription, RenewalAttempt, UsageRecord, FulfilmentOrder, WebhookEndpoint, WebhookEvent, PaymentException, RelayerTransaction, RelayerBudget, GasGuardPolicy, IdempotencyRecord, OutboxEvent, EmailLog, etc.
- Tenant isolation (`merchantId` on all merchant-owned models). Idempotency unique constraints.
- Migration `20261031074713_init` applied. Seed: 2 merchants (Acme + Globex) + demo data.
- Tenant-isolated repository layer (`BaseRepository` enforces `merchantId`). `tsc` clean.

### Phase 3 — Backend foundation ✅
- Fastify 5 app: helmet, cors, rate-limit, sensible, @fastify/jwt, structured error envelope, request-id, `/health` + `/v1/status`.
- Auth: email+password register/login (bcryptjs + JWT Bearer). `authenticate` accepts **either JWT (dashboard) or API key (SDK)**.
- API keys: publishable + secret pair, secret hashed at rest + shown once, list/revoke, `resolveApiKey` for SDK auth.
- Tenant isolation middleware (every query scoped by `merchantId`).
- Idempotency middleware (`Idempotency-Key` header → `IdempotencyRecord`).
- BullMQ queue definitions (relayer, webhook, email, scheduler) + Upstash Redis connection.
- Smoke-tested: register→login→`/me`, API key create→list. `tsc` clean.

### Phase 4 — Gasless one-time payment pipeline ✅
- Payment intents (4.1) + PayeeShield signing (4.2, gateway EIP-712 key) + checkout backend (4.5).
- Authorize (4.6): validates EIP-3009 `TransferWithAuthorization` signature (`recoverTypedDataAddress` vs the USDT domain), checks `authorizationState` unused, binds to intent (amount/recipient/token/chain/expiry).
- GasGuard (4.7): chain/token allowlist, merchant active, global budget pause (minimal MVP).
- Relayer (4.8) + observer (4.9, combined): submits `transferWithAuthorization` on-chain (relayer pays WBT gas), waits for receipt, verifies USDT `Transfer` event, settles.
- BullMQ relayer queue + worker. Payment state machine.
- **Gasless e2e PASSED**: real tx `0xd45a6efd488ed2ae3bb28e840466dc72b7d11568ce6cae712eaf38a39b975b13` — 0.01 USDT payer→merchant, relayer paid WBT gas, payment `succeeded`.

### Phase 4 (remaining) — webhooks, links, invoices, exceptions, DeliveryGuard, email, analytics ✅
- Webhooks (4.11): transactional outbox + HMAC-SHA256 signed dispatch via BullMQ; endpoint CRUD + events list + replay; relayer emits `payment.succeeded`/`failed`.
- Payment links (4.3): POST /v1/payment-links (fixed/customer_amount/reusable) + GET + disable.
- Invoices (4.4): POST /v1/invoices (line items + base-unit total + PayeeShield-signed) + GET.
- Email stub (4.12): EmailLog + BullMQ email worker (marks sent; no SMTP).
- Exceptions (4.13): `recordException` service + GET /v1/exceptions.
- DeliveryGuard (4.14): fulfilment service + GET /v1/fulfilment + POST /:id/events.
- Analytics (4.15): GET /v1/analytics/overview.
- Smoke-tested: analytics reflects the e2e payment; links + invoices create correctly.

### Phase 5 — Subscriptions ✅
- Plans CRUD (5.1). Subscription create (5.2): reads `getSubscription()` from the deployed contract + verifies payer/merchant/terms match the plan; stores the mirror.
- Renewal scheduler (5.3): worker poller (60s) finds due active subscriptions + enqueues idempotent relayer renewal jobs.
- Relayer renewal (5.4) + observer (5.5): calls `charge(subId, periodId, amount)` on the contract (relayer pays WBT gas), verifies `SubscriptionCharged`, updates spent/nextBillingAt, emits `subscription.renewed`/`failed` webhook.
- Usage billing (5.6). Cancellation (5.8). Renewal failure handling (5.7) + `RenewalAttempt` upsert for retries.
- **Subscription e2e PASSED**: real recurring charge tx `0x4b9a8396a3fd0ed4de65a4ba96d0e8daedb41ce6046a92faa81c548f984885a8` — relayer called `charge()` on the SubscriptionContract, 0.01 USDT payer→merchant.

### Phase 6 — Refunds ✅
- POST /v1/refunds (eligibility: settled payment, amount ≤ remaining refundable).
- POST /v1/refunds/:id/authorize: merchant submits EIP-3009 `TransferWithAuthorization` (from=merchant payout, to=original payer). Backend validates + relayer sponsors gas.
- Relayer refund worker + observer: verifies USDT Transfer merchant→payer, marks refund succeeded, updates payment `refundedAmount` + status (refunded/partially_refunded), emits `refund.succeeded`/`failed` webhook.
- Payment intent `payerWallet` recorded during authorize (so refunds know the original payer).
- **Refund e2e PASSED**: real refund tx `0xc366ab8e54f959f4643b96d1a91c71007cf18ab18c5a81d6b0d00558fb2f6433` — 0.01 USDT merchant→payer via the relayer. Payment status flipped to `refunded`.

### Phase 7 — SDK ✅
- `@ezpayz/sdk` (`packages/sdk`): typed server client (`WhitechainClient`) — paymentIntents/paymentLinks/invoices/refunds/subscriptions/analytics, idempotency-key support, structured errors (`WhitechainError`).
- `<WhitechainCheckout/>` React widget: fetches PayeeShield-signed request, signs EIP-3009 via a `signTypedData` prop (merchant's app provides the wallet via wagmi/RainbowKit), submits, polls for settlement.
- `verifyWebhookSignature` + `verifyWebhookMiddleware` (HMAC-SHA256).
- API `authenticate` accepts either JWT or API key (SDK uses the secret key). `tsc` clean.

### Phase 8 — Frontend wiring (local, no deploy) ✅
- wagmi + @rainbow-me/rainbowkit + viem + @tanstack/react-query installed in apps/web.
- Wagmi config (Whitechain Sepolia 1874) + `Providers` wrapper (WagmiProvider + RainbowKitProvider + QueryClientProvider) at the app root.
- Real API client (`services/api/http.ts`) — fetch wrapper for `http://localhost:3000`.
- `<RealCheckout/>` at `/real-checkout/:slug` — real wallet signing + live API + settlement polling.
- Existing mock dashboard pages continue to work. Frontend build passes (4614 modules).

### Phase 9 — Hardening + docs + submission prep ✅
- `README.md`: setup, architecture, contract addresses, 3 explorer tx links, e2e test instructions, SDK usage, REST API, limitations.
- `WHITECHAIN_FEEDBACK.md`: honest feedback (EIP-3009 praise, test-USDT faucet gap, Blockscout verification notes, suggestions).
- `test-isolation.ts`: cross-merchant tenant isolation test.
- This `PROGRESS.md` + `HOW_TO_USE.md`.

---

## Verified on-chain (Whitechain Sepolia explorer)

| Flow | Transaction |
|---|---|
| Gasless one-time payment | [0xd45a6efd…c975b13](https://explorer.testnet.whitechain.io/tx/0xd45a6efd488ed2ae3bb28e840466dc72b7d11568ce6cae712eaf38a39b975b13) |
| Subscription renewal via `charge()` | [0x4b9a8396…885a8](https://explorer.testnet.whitechain.io/tx/0x4b9a8396a3fd0ed4de65a4ba96d0e8daedb41ce6046a92faa81c548f984885a8) |
| Refund merchant→payer | [0xc366ab8e…f6433](https://explorer.testnet.whitechain.io/tx/0xc366ab8e54f959f4643b96d1a91c71007cf18ab18c5a81d6b0d00558fb2f6433) |

---

## What's left to implement

### Must-do before production
- [ ] **Deploy**: Vercel (frontend) + Render (API + worker) + Neon (DB) + Upstash (Redis). Currently local only.
- [ ] **Full dashboard wiring**: swap apps/web's mock adapter for the real API on ALL dashboard pages (payments, links, invoices, customers, subscriptions, refunds, exceptions, analytics, settings). Currently only the real checkout (`/real-checkout/:slug`) + the mock dashboard work.
- [ ] **Real email**: wire an SMTP provider (e.g., Resend) for receipt/refund/renewal emails. Currently stubbed (logged, no SMTP).
- [ ] **JWT_SECRET + PAYEESHIELD_SIGNING_KEY**: set strong production values (not the dev defaults).
- [ ] **Relayer key custody**: move `RELAYER_PRIVATE_KEY` from `.env` to a KMS/HSM.
- [ ] **Webhook signing secret**: encrypt at rest (currently plaintext in the `signingSecretHash` column — MVP).
- [ ] **Per-merchant PayeeShield keys**: per-merchant EIP-712 signing keys (currently a single gateway key).
- [ ] **GasGuard hardening**: per-tx gas ceiling via `eth_estimateGas`, per-merchant rate limits, nonce/replay protection on the relayer. Currently minimal (chain/token allowlist + global pause).
- [ ] **CORS**: tighten to the deployed frontend origin (currently `origin: true`).

### Nice-to-have / polish
- [ ] **Demo video**: 2–4 min walkthrough (merchant + payer views + a real settlement). The e2e scripts + the real checkout are the demo material.
- [ ] **WalletConnect projectId**: set a real WC Cloud projectId in `apps/web/src/config/wagmi.ts` (currently a placeholder — MetaMask/injected works, WC doesn't).
- [ ] **Subscription on-chain monitoring**: a background observer that watches `SubscriptionCreated`/`SubscriptionCancelled` events (currently the backend records the mirror via the API after the customer's on-chain activation).
- [ ] **Calendar monthly intervals**: the on-chain interval for monthly is 30-day approximation; the backend scheduler handles real calendar timing.
- [ ] **Refund merchant-paid-gas fallback UI**: if EIP-3009 is ever unsupported, the merchant pays gas directly (disclosed in the UI). Currently the relayer sponsors all refunds (EIP-3009 is supported).
- [ ] **Payment link public resolve** (`GET /l/:slug` → create checkout session): the route exists in the plan but the public resolve wasn't added to the frontend router (the real checkout uses the slug directly).
- [ ] **SDK build + publish**: `tsup` build to `dist/` + npm publish (currently the SDK is source-only in the monorepo).
- [ ] **Vitest tests** for the backend services (signature verification, state machine, GasGuard, idempotency, tenant isolation).

### Known limitations (hackathon MVP)
- Testnet only (Whitechain Sepolia). Not production-ready.
- Email stubbed. PayeeShield single key. Relayer key in `.env`. Webhook secret plaintext.
- Dashboard largely on the mock adapter (the real checkout is wired).
- Monthly interval = 30-day approximation on-chain.
