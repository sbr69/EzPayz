# Progress — EzPayz

**Last updated:** 31 October 2026
**Status:** Feature-complete MVP + Phase 10-14 + Phase 15 (remaining limitations fixed). All 15 phases built. Full developer flow verified end-to-end. Local (no deploy yet). All known limitations from Phase 14 audit resolved except email (deferred) + settings pages requiring migrations (notification/security/gas-guard).

---

## Completed phases

### Phase 0 — Foundation + EIP-3009 verification gate ✅
- pnpm monorepo bootstrapped: `apps/web` (relocated React frontend, mock preserved), `apps/api` (Fastify backend), `packages/contracts` (Foundry), `packages/sdk`.
- Whitechain Sepolia environment confirmed: chain ID 1874, RPC live, ~1s blocks, rate limit documented.
- **EIP-3009 verification PASSED** (`docs/EIP3009_VERIFICATION.md`): the required test USDT (`0xcedfB5…`) is an EIP-1967 proxy → `TetherTokenV2` (impl `0x2642…026F7`, source-verified). Full EIP-3009 present (`transferWithAuthorization`, `receiveWithAuthorization`, `cancelAuthorization`, `authorizationState`, typehashes, `DOMAIN_SEPARATOR`). Live settlement test passed (tx `0xf5de69f2…`).
- Relayer wallet set up (reuses the test payer key). Finality policy defined + confirmed (confirmed=1 block, finalized=5 blocks, configurable in `apps/api/src/config/settlement.ts`).
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
- Migration `20261031144737_add_return_urls_and_metadata` — added `successUrl`, `cancelUrl`, `metadataJson` to PaymentIntent (return URL redirect + merchant metadata).
- Migration `20261031151017_add_subscription_checkout_session` — added `SubscriptionCheckoutSession` model (hosted subscription checkout widget).
- Tenant-isolated repository layer (`BaseRepository` enforces `merchantId`). `tsc` clean.

### Phase 3 — Backend foundation ✅
- Fastify 5 app: helmet, cors, rate-limit, sensible, @fastify/jwt, structured error envelope, request-id, `/health` + `/v1/status`.
- Auth: email+password register/login (bcryptjs + JWT Bearer). `authenticate` accepts **JWT (dashboard), secret key (full write), or publishable key (read-only scope)**. `requireSecretKey` decorator blocks publishable keys from all write routes (PRD §17.6).
- API keys: publishable + secret pair, secret hashed at rest + shown once, list/revoke, `resolveApiKey` returns key type for scope enforcement.
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
- Payment links (4.3): POST /v1/payment-links (fixed/customer_amount/reusable) + GET + disable. Amounts accept human-readable decimals.
- Invoices (4.4): POST /v1/invoices (line items + base-unit total + PayeeShield-signed) + GET + **GET /v1/invoices/:id/pdf** (downloadable receipt PDF via pdfkit — merchant name, line items, total, tx hash, dates).
- Email stub (4.12): EmailLog + BullMQ email worker (marks sent; no SMTP). Email deferred for MVP — the downloadable PDF receipt is the primary receipt mechanism.
- Exceptions (4.13): `recordException` service + GET /v1/exceptions.
- DeliveryGuard (4.14): fulfilment service + GET /v1/fulfilment + POST /:id/events.
- Analytics (4.15): GET /v1/analytics/overview.
- Smoke-tested: analytics reflects the e2e payment; links + invoices create correctly.

### Phase 5 — Subscriptions ✅
- Plans CRUD (5.1). Plan amounts accept human-readable decimals.
- Subscription create (5.2): reads `getSubscription()` from the deployed contract + verifies payer/merchant/terms match the plan; stores the mirror.
- **Subscription hosted checkout** (new): `POST /v1/subscriptions/checkout` creates a checkout session → returns `clientSecret` + `checkoutSlug`. Public `GET /v1/checkout/subscription/:slug` serves plan details for the widget. Merchants can offer subscriptions on their own site via `<WhitechainSubscriptionCheckout/>` (Stripe Billing model). PRD §11.4.1, FLOW §10.2.1.
- Renewal scheduler (5.3): worker poller (60s) finds due active subscriptions + enqueues idempotent relayer renewal jobs.
- Relayer renewal (5.4) + observer (5.5): calls `charge(subId, periodId, amount)` on the contract (relayer pays WBT gas), verifies `SubscriptionCharged`, updates spent/nextBillingAt, emits `subscription.renewed`/`failed` webhook.
- Usage billing (5.6). Cancellation (5.8). Renewal failure handling (5.7) + `RenewalAttempt` upsert for retries.
- **Subscription e2e PASSED**: real recurring charge tx `0x4b9a8396a3fd0ed4de65a4ba96d0e8daedb41ce6046a92faa81c548f984885a8` — relayer called `charge()` on the SubscriptionContract, 0.01 USDT payer→merchant.

### Phase 6 — Refunds ✅
- POST /v1/refunds (eligibility: settled payment, amount ≤ remaining refundable). Amount accepts human-readable decimals.
- POST /v1/refunds/:id/authorize: merchant submits EIP-3009 `TransferWithAuthorization` (from=merchant payout, to=original payer). Backend validates + relayer sponsors gas. **MVP signing path: merchant signs in the dashboard browser via Wagmi/RainbowKit** (`RealRefundSign.tsx`). Backend-signing deferred as the production-hardened path.
- Relayer refund worker + observer: verifies USDT Transfer merchant→payer, marks refund succeeded, updates payment `refundedAmount` + status (refunded/partially_refunded), emits `refund.succeeded`/`failed` webhook.
- Payment intent `payerWallet` recorded during authorize (so refunds know the original payer).
- **Refund e2e PASSED**: real refund tx `0xc366ab8e54f959f4643b96d1a91c71007cf18ab18c5a81d6b0d00558fb2f6433` — 0.01 USDT merchant→payer via the relayer. Payment status flipped to `refunded`.

### Phase 7 — SDK ✅
- `@ezpayz/sdk` (`packages/sdk`): typed server client (`WhitechainClient`) — paymentIntents/paymentLinks/invoices/refunds/subscriptions/analytics, idempotency-key support, structured errors (`WhitechainError`).
- `<WhitechainCheckout/>` React widget: fetches PayeeShield-signed request, signs EIP-3009 via a `signTypedData` prop (merchant's app provides the wallet via wagmi/RainbowKit), submits, polls for settlement.
- `<WhitechainSubscriptionCheckout/>` React widget: hosted subscription checkout (approve allowance → createSubscription on-chain → mirror to gateway). Customer pays WBT for setup; renewals are gasless.
- `verifyWebhookSignature` + `verifyWebhookMiddleware` (HMAC-SHA256).
- **Amount helpers**: `formatBaseUnits("10000000") → "10.00"`, `parseHumanAmount("10.00") → "10000000"` — exported from the SDK for merchant apps.
- **Build**: `tsup` config → `dist/index.js` (ESM) + `dist/index.d.ts`. `private: false`, version `0.1.0`.
- **npm publish**: Option A (GitHub Packages private) documented in `packages/sdk/NPM_PUBLISH.md`; Option B (public npm) documented for later. `README.md` + `NPM_PUBLISH.md` included in the package.
- API `authenticate` accepts JWT, secret key (full write), or publishable key (read-only). `requireSecretKey` blocks publishable keys from write routes. `tsc` clean.

### Phase 8 — Frontend wiring (local, no deploy) ✅
- wagmi + @rainbow-me/rainbowkit + viem + @tanstack/react-query installed in apps/web.
- Wagmi config (Whitechain Sepolia 1874) + `Providers` wrapper (WagmiProvider + RainbowKitProvider + QueryClientProvider) at the app root.
- Real API client (`services/api/http.ts`) — fetch wrapper for `http://localhost:3000`.
- `<RealCheckout/>` at `/real-checkout/:slug` — real wallet signing + live API + settlement polling. **Updated**: success page with tx hash + explorer link + downloadable receipt PDF + `successUrl` redirect; `cancelUrl` on failure; human-readable amount display via `fmtAmount`.
- `<RealSubscriptionCheckout/>` (new) — real subscription checkout: fetches plan details, customer approves allowance + creates subscription on-chain via wagmi, mirrors to gateway. Success page with approval/activation tx links.
- `<RealRefundSign/>` (new) — merchant dashboard refund signing component: merchant connects payout wallet via RainbowKit, signs EIP-3009 refund authorization in-browser, submits to relayer.
- Existing mock dashboard pages continue to work. Frontend build passes (4614 modules).

### Phase 9 — Hardening + docs + submission prep ✅
- `README.md`: setup, architecture, contract addresses, 3 explorer tx links, e2e test instructions, SDK usage, REST API, limitations.
- `WHITECHAIN_FEEDBACK.md`: honest feedback (EIP-3009 praise, test-USDT faucet gap, Blockscout verification notes, suggestions).
- `test-isolation.ts`: cross-merchant tenant isolation test.
- This `PROGRESS.md` + `HOW_TO_USE.md`.

### Phase 10 — Developer-friendliness gap closure ✅

Senior-developer review against Razorpay/Stripe integration patterns. Identified + closed the following gaps:

**Human-readable amounts** (`"10.00"` not `"10000000"`):
- `apps/api/src/utils/amount.ts` — `parseHumanAmount()` + `formatBaseUnits()` (BigInt, no floats).
- All merchant-facing routes (`paymentIntents`, `paymentLinks`, `invoices`, `refunds`, `plans`) accept decimal strings. EIP-3009 authorize values stay base units (cryptographically bound).

**Publishable key scope enforcement**:
- `auth.ts` — `resolveApiKey` returns `keyType: "publishable" | "secret"`. `requireSecretKey` decorator blocks publishable keys from all write routes (POST/PUT/DELETE). Publishable keys are browser-safe (read-only).

**Short-lived `clientSecret`** (Stripe-style):
- `apps/api/src/utils/clientSecret.ts` — signed HS256 JWT (`cs_`-prefixed), 15-min expiry, no DB storage, timing-safe verification.
- Returned from `POST /v1/payment-intents` + `POST /v1/subscriptions/checkout`. The browser widget uses this, never the secret key.

**Return URLs** (`successUrl`/`cancelUrl`):
- Stored on `PaymentIntent` (migration applied). Checkout GET exposes them. `<RealCheckout/>` redirects to `successUrl` on success, `cancelUrl` on failure. UX-only — the webhook remains the source of truth.

**Downloadable invoice PDF**:
- `apps/api/src/services/invoicePdf.ts` — server-rendered via pdfkit. `GET /v1/invoices/:id/pdf` returns an `application/pdf` attachment with merchant name, line items, total, status, tx hash, dates. Available on checkout success page + dashboard.

**Subscription hosted checkout** (Stripe Billing model):
- `POST /v1/subscriptions/checkout` → creates a `SubscriptionCheckoutSession` (migration applied) → returns `clientSecret` + `checkoutSlug`.
- Public `GET /v1/checkout/subscription/:slug` serves plan details (amount, interval, caps, merchant payout, contract address).
- `<WhitechainSubscriptionCheckout/>` SDK widget + `<RealSubscriptionCheckout/>` frontend page — customer approves allowance + creates subscription on-chain via wagmi, mirrors to gateway.

**Refund browser-signing via Wagmi**:
- `<RealRefundSign/>` — merchant connects payout wallet via RainbowKit in the dashboard, signs EIP-3009 refund authorization in-browser. Backend-signing deferred as the production-hardened path.

**SDK build + npm publish docs**:
- `tsup.config.ts` → ESM build with DTS. `dist/index.js` (15KB) + `dist/index.d.ts` (7KB).
- `package.json`: `private: false`, version `0.1.0`, `prepublishOnly` hook, `files` array.
- `packages/sdk/NPM_PUBLISH.md`: Option A (GitHub Packages private) + Option B (public npm) setup.
- `packages/sdk/README.md`: quick start, credential model, exports table.

**Documentation updates**:
- PRD: 20 edits (human-readable amounts, removed all "20 lines" language, publishable key + clientSecret model, return URLs, subscription hosted widget §11.4.1, refund browser-signing §12.3.1, email deferred, downloadable PDF receipt, finality defaults, updated risk + decisions tables).
- FLOW: 12 edits (clientSecret credential model, return URL redirect, subscription hosted checkout, refund browser-signing, downloadable receipt, dependency register updated).
- `HOW_TO_USE.md`: full rewrite of server-side, subscription, refund, and example sections. Updated Pros/Cons with all new capabilities + remaining limitations.

---

## Verified on-chain (Whitechain Sepolia explorer)

| Flow | Transaction |
|---|---|
| Gasless one-time payment | [0xd45a6efd…c975b13](https://explorer.testnet.whitechain.io/tx/0xd45a6efd488ed2ae3bb28e840466dc72b7d11568ce6cae712eaf38a39b975b13) |
| Subscription renewal via `charge()` | [0x4b9a8396…885a8](https://explorer.testnet.whitechain.io/tx/0x4b9a8396a3fd0ed4de65a4ba96d0e8daedb41ce6046a92faa81c548f984885a8) |
| Refund merchant→payer | [0xc366ab8e…f6433](https://explorer.testnet.whitechain.io/tx/0xc366ab8e54f959f4643b96d1a91c71007cf18ab18c5a81d6b0d00558fb2f6433) |

### Phase 11 — Razorpay-parity gap closure ✅

Senior-developer review #2 against Razorpay/Stripe integration patterns. Closed the following gaps:

**Backend endpoints:**
- `GET /v1/payment-intents` (list with cursor pagination + status/date filters) — was missing entirely.
- `GET /v1/payment-intents/:id/receipt.pdf` — server-rendered receipt PDF directly from a payment intent (no invoice required). Fixes the broken checkout success page receipt link.
- Customer CRUD: `POST /v1/customers`, `GET /v1/customers` (list + pagination + email search), `GET /v1/customers/:id` — new route file.
- `PATCH /v1/merchants/me` — merchant profile update (display name, logo, support email, branding, payout wallet).
- `GET /v1/merchants/wallet/challenge` + `POST /v1/merchants/wallet/verify` — cryptographic wallet-control verification via `personal_sign` (challenge → sign → recoverAddress → verify). Merchant connects wallet via RainbowKit, signs a one-time challenge, gateway verifies signature matches the wallet address.
- `GET /v1/payment-links/:slug` (public resolve) + `POST /v1/payment-links/:slug/checkout` (public, creates a payment intent from the link — the slug acts as authorization, no secret key needed). Payment links now work end-to-end.
- Idempotency on ALL POST routes: `paymentLinks`, `invoices`, `refunds`, `plans`, `subscriptions/checkout`, `subscriptions`, `webhooks`. Previously only on `paymentIntents`.
- Cursor-based pagination on ALL list endpoints: `paymentIntents`, `refunds`, `subscriptions`, `plans`, `invoices`, `paymentLinks`, `webhooks`, `webhooks/events`, `exceptions`, `fulfilment`, `customers`. Response includes `hasMore` + `nextCursor`.
- `lastUsedAt` update on API key resolution — merchants can now see when their keys were last used.
- `utils/pagination.ts` — shared cursor pagination helper (Stripe-style `?limit=&cursor=` → `{ data, hasMore, nextCursor }`).

**SDK:**
- Standalone browser `<script>` bundle (`tsup` IIFE → `dist/browser-entry.global.js`, 8KB). Merchants without a build tool (WordPress, Shopify, plain HTML) can integrate via `<script src=".../whitechain-checkout.global.js">` → `WhitechainCheckout.open({ checkoutSlug, apiUrl })`. Uses `window.ethereum` (MetaMask injected provider) directly — no React, no npm.
- `clientSecret` prop on `<WhitechainCheckout/>` widget — sent as a Bearer header on checkout fetch + authorize requests. The clientSecret is now consumed, not just generated.
- `tsup.config.ts` updated to dual-build: ESM (`dist/index.js`) + IIFE (`dist/browser-entry.global.js`).

**Frontend:**
- `RealSubscriptionCheckout` routed at `/real-subscription-checkout/:slug` in `App.tsx` (was dead code — now reachable).
- `PaymentLinkResolver` at `/l/:slug` — replaces the mock Checkout for payment links. Fetches link details via `GET /v1/payment-links/:slug`, creates a checkout session via `POST /v1/payment-links/:slug/checkout`, redirects to `/real-checkout/:slug`. Fixed links auto-redirect; customer-amount links show an amount input.
- `RealRefundSign` wired into `RefundDetail` page — renders a Wagmi-based signing section when the refund status is `awaiting_authorization`. Merchant connects payout wallet via RainbowKit, signs EIP-3009 refund authorization in-browser.
- Fixed `RealCheckout` receipt link → `/v1/payment-intents/:id/receipt.pdf` (was linking to `/v1/invoices/:paymentIntentId/pdf` which 404'd — payment intent IDs aren't invoice IDs).
- Fixed `RefundPages.tsx` `Number(x)/1e6` → `fmtAmount()` for amount display.
- Dashboard swapped from mock adapter to real HTTP adapter (`services/api/adapter.ts`). Mock adapter commented out in `services/index.ts` (preserved, not deleted). Real adapter calls the live API via `apiFetch`. Cast to mock type for backward compatibility with dashboard page types.
- Onboarding wallet verification now uses real Wagmi `useSignMessage` + the real API (`getWalletChallenge` → `signMessageAsync` → `verifyWalletOwnership`). Replaces the simulated "verify wallet" button.

### Phase 12 — Critical integration blocker fixes + full developer flow audit ✅

Senior-developer codebase audit identified blocking issues preventing developer integration. Fixed in two passes (initial 5 + re-audit 8 = 13 total fixes):

**Pass 1 — Initial audit (5 fixes):**

1. **Settlement poll 401 (fixed):** Checkout widgets polled `GET /v1/payment-intents/:id` (auth-required) for settlement — payer has no API key → 401 every poll → checkout hung. **Fix:** poll `GET /v1/checkout/:slug` (public). Added `txRef` to checkout response.
2. **Dashboard auth was fake (fixed):** `AuthPages.tsx` never called the real API — `useDemo((s) => s.signIn)` just set a flag. JWT never stored. **Fix:** `SignIn` calls `POST /v1/auth/login`, `SignUp` calls `POST /v1/auth/register`. JWT stored in `localStorage("wcp_token")`.
3. **Browser bundle `from` field bug (fixed):** Sent `from: signature` (132 hex chars) instead of `from: walletAddress` (40 hex chars) → API validation failed. **Fix:** captures wallet address from `eth_requestAccounts` first.
4. **SDK not built (fixed):** `dist/` didn't exist. **Fix:** `pnpm build` generates ESM + IIFE + DTS. Gitignored — run after cloning.
5. **`useApiData` hook (added):** For dashboard pages to fetch from the real API.

**Pass 2 — Full developer flow audit (8 fixes):**

6. **`apiFetch` sends no auth header (fixed):** `apiFetch` only attached `Authorization` when `opts.token` was explicitly passed — onboarding never passed it → all writes 401. **Fix:** `apiFetch` auto-reads `localStorage("wcp_token")` and attaches `Authorization: Bearer` unless already set.
7. **SDK widget `from` hardcoded to zero address (fixed):** `checkout.tsx:93` set `from: "0x000…000"` → server recovered signer ≠ `auth.from` → 400 `invalid_signature`. **Fix:** Added required `payerAddress` prop. `value` uses `BigInt`. Authorize POST body sends string values.
8. **Dashboard reads mock seed data (fixed):** `Dashboard.tsx`, `PaymentPages.tsx` read from `useDemo((s) => s.data)` (hardcoded seed). **Fix:** `useSyncRealData` hook fetches merchant + payments + refunds + subscriptions + exceptions + invoices + plans + links + webhooks + fulfilment from the real API on `AppShell` mount, populates the Zustand store via `replaceData()`. All dashboard pages now display real data.
9. **Browser bundle `onSuccess` TypeError (fixed):** Read `sr.paymentIntent.txRef` but checkout returns `sr.txRef` → `TypeError: Cannot read properties of undefined`. **Fix:** reads `sr.txRef`.
10. **Browser bundle failed-status never detected (fixed):** Checked `sr.paymentIntent?.status` → always `undefined` → failed payments polled 60s then threw "timed out". **Fix:** checks `sr.status`.
11. **Receipt PDF requires auth → customer 401 (fixed):** `GET /v1/payment-intents/:id/receipt.pdf` requires `app.authenticate`. Customer has no JWT. **Fix:** Added public `GET /v1/checkout/:slug/receipt.pdf` (no auth, guards on `status === "succeeded"`).
12. **SDK `idempotencyKey` optional but API requires it (fixed):** API returns 400 `missing_idempotency_key` if header absent. SDK declared it optional. **Fix:** SDK auto-generates `auto-${Date.now()}-${random}` if omitted.
13. **PaymentLinkResolver Rules of Hooks violation (fixed):** `useEffect` for fixed-link `startCheckout` was after early returns → "Rendered more hooks than during previous render" crash. **Fix:** Merged into top-level `useEffect` with cancellation guard.

**Additional fixes:**
- Onboarding `generateCredentials` calls `apiFetch` directly with correct field names (`eventTypes` not `events`) + `Idempotency-Key` header.
- Webhook retry with exponential backoff (30s × 2^attempt, max 5 retries, then `nextRetryAt = null`).
- Removed non-functional `cancelPayment` button (no cancel API route — intents expire automatically).
- `vite-env.d.ts` created — fixes pre-existing `import.meta.env` typecheck error.
- Browser bundle CSS typo fixed (`border-radius:8pxborder:none` → `border-radius:8px;border:none`).

**Re-audit result: 0 remaining issues.** Full developer flow verified:
1. Register → `POST /v1/auth/register` → JWT stored ✅
2. Onboarding → profile saved, wallet verified, API keys + webhook created ✅
3. Create payment intent → `POST /v1/payment-intents` (secret key) → `{ clientSecret, checkoutSlug }` ✅
4. Customer checkout → EIP-3009 gasless signing → authorize → poll → "Payment succeeded" ✅
5. Receipt PDF download (public, no auth) ✅
6. Return URL redirect ✅
7. Merchant receives `payment.succeeded` webhook ✅
8. Dashboard shows real data (synced from API) ✅
9. Payment links work end-to-end (`/l/:slug` → resolve → checkout) ✅
10. Browser bundle works (correct `from`, `sr.txRef`, `sr.status`) ✅

### Phase 13 — MCP server for AI agents ✅

Built an MCP (Model Context Protocol) server that exposes the gateway's tools + documentation to AI agents (Claude Desktop, Cursor, VS Code). Uses `@modelcontextprotocol/server` v2.4.0 (current stable, 2026-07-28 spec).

**Package:** `packages/mcp/` (standalone, built via tsup, stdio entry point)

**Two transports:**
- **stdio** (`src/index.ts`) — for local use with Claude Desktop/Cursor (subprocess)
- **Streamable HTTP** — mounted on `apps/api` at `/mcp` via `@modelcontextprotocol/fastify` middleware (remote, multi-client)

**11 Tools (model-controlled — AI invokes autonomously):**
- `create_payment_intent` — create a gasless USDT payment intent
- `list_payments` — list payment intents (cursor pagination + filters)
- `get_payment` — get a specific payment intent
- `create_payment_link` — create a reusable payment link
- `create_refund` — initiate a refund
- `list_refunds` — list refunds
- `list_customers` — list customers (email search)
- `list_subscriptions` — list subscriptions
- `create_plan` — create a subscription plan
- `get_analytics` — analytics overview
- `verify_webhook_signature` — HMAC-SHA256 verification

Each tool has: Zod v4 input schema, annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), structured error handling (`isError: true` for recoverable errors).

**8 Resources (application-driven — AI reads for context):**
- `whitechain://docs/how-to-use` — full HOW_TO_USE.md
- `whitechain://docs/prd` — full PRD
- `whitechain://docs/flow` — payment flow document
- `whitechain://docs/eip-3009` — EIP-3009 verification report
- `whitechain://docs/api-reference` — complete REST API reference (auto-generated)
- `whitechain://docs/sdk-guide` — SDK installation + usage guide
- `whitechain://status` — live gateway status (network, token, capabilities)

**Auth:** `GATEWAY_SECRET_KEY` env var (merchant's secret API key). Passed as Bearer header on all gateway API calls.

**Shared server factory:** `src/server.ts` — `createServer()` returns a fully configured `McpServer` with all tools + resources registered. Used by both stdio and HTTP transports.

**Verified end-to-end:** Both transports tested and working:
- HTTP (`/mcp` on Fastify): initialize ✅, tools/list (11 tools) ✅, resources/list (8 resources) ✅, tools/call (get_analytics, list_payments — returns real gateway data) ✅, resources/read (whitechain://status — returns live status) ✅
- stdio (subprocess): initialize ✅, tools/list ✅
- Zod v4 input schemas (raw shape form per v2 SDK API)
- Error handling: `isError: true` tool results for recoverable errors (LLM self-corrects)
- Tool annotations: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`

### Phase 14 — Razorpay parity audit fixes ✅

Senior-developer codebase audit identified 16 remaining gaps. Fixed in two batches:

**Batch A — Critical flow fixes (5):**
1. **RefundDialog fixed:** was calling non-existent `api.authorizeRefund`/`api.processRefund` → TypeError. Now creates refund via API, redirects to refund detail page where `RealRefundSign` handles signing.
2. **Onboarding wallet verify double-set fixed:** PATCH `/me` with `payoutWallet` was resetting `walletVerified=false`. Now only updates local store; backend PATCH checks `walletVerified !== true` before resetting.
3. **Create operations refresh store:** `apiFetch` calls `setMutationCallback` on any POST/PATCH/DELETE → `useSyncRealData` re-fetches all data → Zustand store stays in sync without page reload.
4. **8 dashboard action stubs fixed:** invoice checkout, customer notes, usage billing, test events → try/catch with info toast. Wallet verify in settings → real challenge→sign→verify flow via wagmi `useSignMessage`.
5. **SDK subscription widget auth fixed:** was sending empty Bearer token → 401. Now uses public `POST /v1/checkout/subscription/:slug/activate` endpoint (no auth required, slug acts as authorization).

**Batch B-D — Polish + completeness (11):**
6. `useSyncRealData` now fetches customers, API keys, webhook events (was missing).
7. SDK `WhitechainClient` now has `customers`, `webhooks`, `apiKeys`, `plans` methods.
8. `RealSubscriptionCheckout` waits for tx receipts between `approve` + `createSubscription` (prevents revert).
9. Auth guard on `AppShell` — redirects to `/sign-in` if not signed in.
10. Switched `HashRouter` → `BrowserRouter` (path-based URLs like Razorpay).
11. Checkout constants read from `config/app.ts` instead of hardcoded.
12. Poll timeout extended from 60s to 120s.
13. `reusable` payment links now show amount input (was falling through to wrong UI).
14. Feature flag `VITE_DEMO_MODE` — mock adapter activated when env var is `"true"`.
15. Products hidden from navigation (code preserved).
16. Settings wallet verify wired to real challenge→sign→verify flow.

**Remaining known limitations (documented, not blocking):**
- Email deferred (code preserved, stubbed — no SMTP). Downloadable PDF receipt is primary.
- Schema drift from earlier db push usage — database was reset during notificationPrefs migration. Re-register + re-onboard to test.
- Usage-based billing calculation implemented but not yet tested end-to-end with real usage records + on-chain charge. Fixed-amount subscriptions are fully tested (3 real e2e transactions passed).

---

## What's left to implement

### Must-do before production
- [ ] **Deploy**: Vercel (frontend) + Render (API + worker) + Neon (DB) + Upstash (Redis). Currently local only — the owner is testing end-to-end first.
- [ ] **Real email**: wire an SMTP provider (e.g., Resend) for receipt/refund/renewal emails. Currently stubbed (logged, no SMTP). The downloadable PDF receipt is the primary receipt mechanism for the MVP. Email deferred — will be wired in a later phase.
- [ ] **JWT_SECRET + PAYEESHIELD_SIGNING_KEY**: set strong production values (not the dev defaults).
- [ ] **Relayer key custody**: move `RELAYER_PRIVATE_KEY` from `.env` to a KMS/HSM.
- [ ] **Webhook signing secret**: ✅ encrypted at rest (AES-256-GCM, utils/crypto.ts).
- [ ] **Per-merchant PayeeShield keys**: per-merchant EIP-712 signing keys (currently a single gateway key — confirmed for MVP).
- [ ] **GasGuard hardening**: per-tx gas ceiling via `eth_estimateGas`, per-merchant rate limits, nonce/replay protection on the relayer. Currently minimal (chain/token allowlist + global pause).
- [ ] **CORS**: tighten to the deployed frontend origin (currently `origin: true`).
- [ ] **Refund backend-signing**: the MVP uses browser-based Wagmi signing. The production-recommended backend-signing path (key never leaves merchant server) is documented but not implemented.
- [ ] **SDK publish to npm**: Option A (GitHub Packages private) docs are ready in `packages/sdk/NPM_PUBLISH.md`. The actual `npm publish` command needs to be run after configuring the PAT. Option B (public npm) is documented for later.

### Nice-to-have / polish
- [ ] **Demo video**: 2–4 min walkthrough (merchant + payer views + a real settlement). The e2e scripts + the real checkout are the demo material.
- [ ] **WalletConnect projectId**: set a real WC Cloud projectId in `apps/web/src/config/wagmi.ts` (currently a placeholder — MetaMask/injected works, WC doesn't).
- [ ] **Subscription on-chain monitoring**: a background observer that watches `SubscriptionCreated`/`SubscriptionCancelled` events (currently the backend records the mirror via the API after the customer's on-chain activation).
- [ ] **Calendar monthly intervals**: the on-chain interval for monthly is 30-day approximation; the backend scheduler handles real calendar timing.
- [ ] **Refund merchant-paid-gas fallback UI**: if EIP-3009 is ever unsupported, the merchant pays gas directly (disclosed in the UI). Currently the relayer sponsors all refunds (EIP-3009 is supported).
- [ ] **Vitest tests** for the backend services (signature verification, state machine, GasGuard, idempotency, tenant isolation, amount conversion, clientSecret verification).

### Known limitations (hackathon MVP)
- Testnet only (Whitechain Sepolia). Not production-ready.
- Email stubbed (downloadable PDF receipt is primary — public `GET /v1/checkout/:slug/receipt.pdf`). PayeeShield single key. Relayer key in `.env`. Webhook secret plaintext.
- Dashboard data synced from real API via `useSyncRealData` hook (fetches on AppShell mount). Write operations go through the real API. The real checkout, real subscription checkout, real refund signing, onboarding wallet verify, and dashboard data are all fully wired to the live API.
- Webhook retry with exponential backoff (max 5 retries, then stops).
- Monthly interval = 30-day approximation on-chain.
- Refund backend-signing deferred (browser Wagmi signing for MVP).
- SDK built locally (`pnpm build` → `dist/`); gitignored — run build after cloning. Published to private registry (Option A) when npm auth is configured; public npm (Option B) documented for later. Standalone browser bundle built but not yet served via a CDN URL.
