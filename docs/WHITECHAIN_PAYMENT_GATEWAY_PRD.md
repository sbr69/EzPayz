# EzPayz

## Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 30 October 2026  
**Status:** Scope confirmed for ETHGlobal hackathon MVP  
**Product category:** Non-custodial, business-agnostic stablecoin payment gateway  
**Primary network:** Whitechain Sepolia  
**Primary asset:** ETHGlobal-specified test USDT  
**Working product name:** Whitechain Payment Gateway (final brand name TBD)

---

## 1. Executive summary

Build a general-purpose, non-custodial USDT payment gateway on Whitechain that gives a business the tools it needs to get paid, from checkout through post-payment operations.

The product should work like a conventional payment gateway from the merchant's perspective: one merchant account, one dashboard, one SDK/API integration, and a set of payment products that can support e-commerce, SaaS, freelancers, agencies, digital services and API businesses. Merchants should not need to understand Whitechain, WBT gas mechanics or smart contracts to integrate the gateway.

The gateway will provide:

- One-time USDT checkout, payment links and QR payments.
- Invoice records and post-payment receipt emails.
- Merchant transaction history, customer records and analytics.
- Full and partial refunds initiated by the merchant.
- Payment confirmation, reconciliation and signed webhooks.
- Subscription plans and recurring billing with explicit spending authorization.
- A JavaScript/TypeScript SDK, React checkout widget, Node.js middleware and REST APIs.
- Gas-sponsored one-time checkout using EIP-3009 and a gateway-operated relayer, subject to verification that the required USDT contract supports EIP-3009.
- GasGuard controls to prevent relayer abuse and uncontrolled WBT expenditure.
- PayeeShield signed invoices to detect invoice tampering and payout-address substitution.
- DeliveryGuard fulfilment tracking and payment-exception handling.

The gateway is **non-custodial** for merchant payments: one-time payments and subscription charges transfer USDT directly to the merchant's configured wallet. The gateway does not pool or hold customer payment funds. Refunds are separate USDT transfers from the merchant's wallet to the payer.

The hackathon MVP must be demonstrated end to end on Whitechain Sepolia using the exact USDT contract specified by ETHGlobal. All features marked MVP in the agreed scope are included in the MVP requirements. Any technical dependency that cannot be verified—especially EIP-3009 support in the test USDT contract—must be treated as a release blocker, not silently replaced with a different mechanism.

## 2. Product vision and problem statement

### 2.1 Product vision

**Give a business everything it needs to get paid in USDT on Whitechain, from the first checkout to what happens after it.**

A separate merchant application should be able to integrate a usable payment flow in approximately 20 lines of application code, while the gateway handles payment creation, authorization, settlement tracking, notifications, customer records, refunds and recurring billing infrastructure.

### 2.2 Problem

Many crypto payment integrations expose only a wallet address or a basic transfer operation. A real merchant needs much more:

- A checkout experience customers can understand.
- A reliable way to create and share payment requests.
- Confirmation that the correct amount reached the correct wallet on the correct network.
- A way to manage customers, invoices, subscriptions and refunds.
- Reliable notifications to the merchant's own backend.
- Reconciliation when transactions are delayed, duplicated, underpaid or otherwise exceptional.
- A payment experience where the customer does not need WBT to pay gas for supported gasless flows.
- A developer integration that hides most blockchain-specific complexity.

### 2.3 Product positioning

The product is a **general-purpose USDT payment gateway**, not an e-commerce-only checkout, SaaS-only billing tool or AI-agent-only payment protocol.

It should expose a shared payment infrastructure through which different business models can use the same merchant account, SDK, REST API, dashboard and settlement layer.

## 3. Goals and non-goals

### 3.1 MVP goals

1. Let a merchant configure a Whitechain payout wallet and accept the specified test USDT.
2. Provide a customer-facing checkout that can complete a one-time payment without the customer paying WBT gas, using EIP-3009 and the gateway relayer where supported.
3. Transfer one-time payment funds directly from the payer to the merchant wallet.
4. Provide payment links and QR codes that open the same checkout flow.
5. Create invoice records and email a paid receipt after successful settlement.
6. Give merchants a dashboard for payments, refunds, invoices, customers, subscriptions and analytics.
7. Provide full and partial merchant-authorized refunds as separate transfers from the merchant wallet to the payer.
8. Provide recurring billing through a subscription contract using a bounded ERC-20 allowance and backend-triggered renewal execution.
9. Provide merchant webhooks with signatures, retries and idempotency.
10. Give developers a JavaScript/TypeScript SDK, React checkout widget, Node.js middleware and REST APIs.
11. Prevent the relayer from being drained through GasGuard policies and measurable spending limits.
12. Detect invoice tampering through PayeeShield signed invoice data.
13. Track fulfilment status without taking custody of payment funds or pretending to provide escrow.
14. Detect, classify and help resolve payment exceptions.
15. Satisfy the Whitechain Operate and Scale demonstration requirements.

### 3.2 Non-goals for the hackathon MVP

- Fiat conversion, bank payouts or INR settlement.
- Custody, pooled balances or an internal merchant balance ledger that holds customer funds.
- Cross-chain payments.
- x402 facilitator support.
- Public Arkiv registry or Arkiv-backed discovery.
- Chainlink CRE workflows.
- WhiteBIT or EzPayz integration.
- KYC, legal business verification or a claim that a wallet signature proves a business is legitimate.
- Multi-party procurement approvals.
- Trustless escrow or automatic dispute adjudication.
- A discoverable API marketplace.
- A production security audit or production-readiness claim.

## 4. Target users and personas

### 4.1 Merchant / business owner

A business that wants to accept USDT from customers. The merchant configures payout details, creates payment requests, views transactions, issues refunds, manages customers and configures webhooks.

### 4.2 Merchant developer

A developer integrating the gateway into a website, app, SaaS product or API. The developer uses the SDK, widget, Node.js middleware or REST API rather than writing custom Whitechain transaction logic.

### 4.3 Payer / customer

A person paying a merchant in USDT. The payer sees the merchant, amount, token, payment purpose and status. In the gasless one-time flow, the payer signs a payment authorization; the gateway relayer submits the transaction and pays WBT gas. The payer must not be asked to expose a seed phrase or pay WBT gas.

### 4.4 Subscription customer

A customer who explicitly authorizes recurring USDT charges under a stated schedule, per-cycle cap, total spending cap and expiry. The customer can cancel the subscription and revoke remaining ERC-20 allowance.

### 4.5 Gateway operator

The team operating merchant onboarding, API credentials, relayer infrastructure, WBT funding, monitoring, exception queues, email delivery and webhook delivery.

## 5. Product principles

1. **Merchant-first integration:** One integration should support multiple payment products and business models.
2. **Non-custodial settlement:** Payment funds go directly to the merchant wallet; the gateway does not take custody of payer funds.
3. **Explicit authorization:** The payer sees who receives funds, how much is being paid, and what recurring authority is being granted.
4. **No payer WBT for gas in the gasless checkout path:** The gateway relayer pays WBT gas for supported one-time EIP-3009 payments.
5. **Never infer payment from the browser:** Backend chain verification is authoritative.
6. **No duplicate charges:** Idempotency must apply to API creation, relayer submission, subscription renewal, refunds and webhook processing.
7. **Private customer data stays off-chain:** Customer PII must not be written to public blockchain storage.
8. **Clear separation of MVP and future work:** Future integrations must not be presented as implemented capabilities.

## 6. Confirmed scope matrix

### 6.1 Core payment gateway — MVP

| Feature | Scope |
|---|---|
| USDT checkout on Whitechain | One-time checkout using the official ETHGlobal test USDT contract on Whitechain Sepolia. |
| Payment links and QR payments | Generate shareable links and QR codes that open a hosted checkout. |
| Invoice generation and email delivery | Create invoice records; send a paid invoice/receipt email after successful settlement. |
| Full and partial refunds | Merchant-authorized USDT transfers from merchant wallet to payer wallet. |
| Payment confirmation and webhooks | Verify chain settlement server-side and deliver signed webhook events. |
| Merchant dashboard, transactions and analytics | Manage payment activity and merchant operations. |
| Developer SDK, APIs and documentation | JavaScript/TypeScript SDK, React widget, Node.js middleware and REST API. |
| Merchant-isolated customer records | Each merchant can access only its own customer records. |
| Hourly, daily and monthly billing; usage-based billing | Subscription contract and backend scheduler, with explicit allowance and spend limits. |

### 6.2 Security and advanced payments — MVP

| Feature | Scope |
|---|---|
| x402 support | Future; excluded from MVP. |
| Gasless transaction sponsorship | MVP for one-time checkout through EIP-3009 + relayer, subject to token compatibility. |
| GasGuard | MVP relayer funding controls, budgets, allowlists, rate limits and abuse protection. |
| PayeeShield | MVP merchant-signed invoice payloads and payment-address tampering detection. |
| Verified merchant/vendor identities | Future; no KYC/business-verification claim in MVP. |
| Procurement Mode | Future multi-person approval workflows. |
| DeliveryGuard | MVP fulfilment tracking and evidence records; no escrow or custody. |
| Payment Exception Intelligence | MVP rules-based detection, classification, reconciliation and recovery actions. |

### 6.3 External ecosystem integrations — Future

| Integration | Future scope |
|---|---|
| Arkiv | Searchable merchant registry, expiring payment offers and selected invoice metadata. Public data only; no customer PII. |
| Chainlink CRE | Payment-triggered workflows connecting verified Whitechain events to external business systems/APIs. |
| WhiteBIT | Potential USDT-to-fiat conversion/off-ramp, conditional on network deposit support, business API access, jurisdiction and commercial eligibility. |
| EzPayz | Potential interoperability, only if supported APIs and a meaningful integration path are confirmed. |

### 6.4 Other future capabilities

- Multi-chain payment acceptance.
- Discoverable API/service marketplace.
- Enterprise B2B payments and reconciliation.
- x402 facilitator endpoints and agent/API payment workflows.
- More extensive business identity verification and procurement controls.
- More advanced automated dispute and delivery workflows.

## 7. Supported network and token configuration

### 7.1 Hackathon network

| Setting | Value |
|---|---|
| Network | Whitechain Sepolia |
| Chain ID | `1874` |
| RPC URL | `https://rpc.testnet.whitechain.io` |
| Block explorer | `https://explorer.testnet.whitechain.io/` |
| Faucet | `https://faucet.testnet.whitechain.io/` |
| Native gas token | WBT |
| Required test USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` |

These values are based on the current ETHGlobal Whitechain qualification page and Whitechain developer guide. Confirm the configuration again before final deployment because hackathon instructions and network endpoints can change.

### 7.2 Token configuration rules

- The required test USDT contract must be used for the main payment demo. A team-created test token does not satisfy the stated qualification requirement.
- Read and validate token decimals from the contract; do not hardcode assumed decimals.
- Use integer/base-unit arithmetic for all amounts. Do not use floating-point arithmetic for token values.
- Confirm the token's `transfer`, `approve`, `allowance` and `transferFrom` behavior.
- Confirm whether the exact test USDT contract implements the EIP-3009 methods and domain/signature scheme needed by the one-time gasless flow.
- Do not claim that EIP-3009 works on the required test USDT until its ABI and behavior have been verified with integration tests.
- All testnet USDT and WBT have no monetary value.

## 8. Merchant experience requirements

### 8.1 Merchant onboarding

A merchant must be able to:

1. Create a merchant account.
2. Connect or register a payout wallet address.
3. Configure the supported network and token for the test environment.
4. Create API credentials for server-side integration.
5. Configure a webhook endpoint and view its signing secret once at creation.
6. Configure notification email details.
7. View the gateway's testnet status and integration instructions.

The MVP registers a merchant wallet; it does not certify the legal identity of the business or provide KYC verification.

### 8.2 Merchant dashboard

The dashboard must provide the following areas:

- **Overview:** gross USDT received, successful payments, pending payments, refunds, active subscriptions and payment failure/exception counts.
- **Payments:** searchable payment history with amount, status, payer, merchant payout address, token, network, created time and transaction hash.
- **Payment links:** create, copy, disable and inspect links; view payment status.
- **Invoices:** create and inspect invoices, view paid status and email receipt activity.
- **Customers:** merchant-scoped customer records and payment/subscription history.
- **Subscriptions:** plans, active subscriptions, next billing time, authorization limits, renewal history and cancellation status.
- **Refunds:** create full or partial refunds, inspect refund status and transaction hash.
- **Products/services:** basic merchant catalog entries to support reusable checkout items and subscription plans.
- **Developers:** API keys, SDK quickstart, webhook endpoint configuration and delivery logs.
- **Analytics:** payment volume, success/failure rates, refund totals and subscription renewals.
- **Exceptions:** underpaid, overpaid, duplicate, expired, failed, unconfirmed and notification-failure cases with recommended actions.

### 8.3 Merchant customer-data isolation

- Every customer, invoice, payment, subscription, refund, webhook and analytics record must be scoped to a merchant ID.
- Authorization checks must occur on the backend for every read and write.
- A merchant must never be able to retrieve another merchant's customer details by changing an ID in a URL or API request.
- Store customer PII off-chain in the application database.
- Public on-chain transfers expose wallet addresses and amounts; the gateway must not imply that blockchain payments are private.

## 9. Payer experience requirements

### 9.1 Checkout page

The checkout page must clearly show:

- Merchant display name and available brand mark.
- Invoice/order reference and payment description.
- Exact USDT amount.
- Merchant payout identity/address in a human-readable verification view.
- Whitechain network context, token identity and expiry where applicable.
- A clear payment action and payment status.
- Error messages for expired, invalid, already-paid or unavailable requests.

The customer must not need WBT for gas in the supported EIP-3009 one-time gasless payment flow. The customer signs a typed payment authorization; this is a wallet signature, not a gas-paying blockchain transaction. The gateway must never request a seed phrase.

The MVP does not include a selected embedded-wallet provider. Therefore, the actual wallet connection/signing UX depends on the supported wallet provider chosen during implementation. Do not claim that the MVP eliminates all wallet prompts unless an embedded wallet or comparable abstraction is implemented and tested.

### 9.2 Payment-link and QR behavior

- Each link resolves to a gateway-hosted checkout page.
- QR codes encode the payment URL, not a raw wallet transfer instruction.
- A payment link may be configured as fixed-amount or amount-editable only where the merchant explicitly enables it.
- The checkout must display the exact invoice amount and payout wallet before authorization.
- Expired or disabled links must not accept payment through the checkout UI.
- If an on-chain payment reaches the merchant after the request expires due to an already-signed authorization or race condition, it must be detected and surfaced as an exception rather than silently discarded.

## 10. One-time payment flow: EIP-3009 + relayer

### 10.1 Confirmed architecture

1. Merchant creates a payment intent through the dashboard, SDK or REST API.
2. Gateway stores the payment intent and generates a hosted checkout URL or widget session.
3. Payer opens the checkout and reviews merchant, amount, token, network and destination.
4. Payer signs an EIP-712 typed `TransferWithAuthorization` message for the exact USDT amount and merchant wallet.
5. The authorization includes a validity window and unique nonce.
6. The client sends the signed authorization to the gateway backend.
7. Backend validates payment intent state, amount, token, chain ID, destination, authorization expiry and nonce state.
8. GasGuard evaluates the relayer policy and budget.
9. Relayer submits the token's EIP-3009 authorization transaction and pays WBT gas.
10. USDT transfers directly from payer to merchant wallet.
11. Backend observes the transaction and verifies the token transfer, correct sender, recipient, amount, token contract and chain.
12. Once the configured settlement-confidence threshold is met, the payment is marked successful.
13. Gateway emits webhook events, updates the dashboard and emails the paid receipt.

### 10.2 Required security checks

- Verify EIP-712 domain name/version, chain ID and verifying contract against the actual token contract.
- Verify signature recovery resolves to the payer address.
- Check `validAfter` and `validBefore`.
- Check unique nonce/authorization has not already been consumed.
- Bind the authorization to the exact merchant payout address, token and amount.
- Use short authorization validity windows appropriate to checkout.
- Prevent a signed authorization from being reused across payment intents.
- Check the payment intent is still eligible for settlement before relayer submission.
- Do not mark a payment successful solely because the relayer RPC returned a transaction hash.

### 10.3 EIP-3009 compatibility gate

The exact ETHGlobal test USDT contract's EIP-3009 compatibility is **not verified in this PRD**. Before implementing the gasless path, the team must inspect the deployed contract's verified source/ABI (if available), test the required methods and domain separator, and run an end-to-end authorization test on Whitechain Sepolia.

If the required token does not implement compatible EIP-3009 behavior, the selected one-time-payment architecture cannot be claimed as working. The team must raise this as a blocking technical issue and explicitly choose an alternative authorization design with the track requirements in mind. Do not silently replace the required test USDT or describe an ERC-20 allowance flow as EIP-3009.

## 11. Automatic subscriptions and usage-based billing

### 11.1 Confirmed architecture

Recurring billing uses a dedicated subscription smart contract with bounded ERC-20 allowance. It is separate from the EIP-3009 one-time payment flow.

1. Merchant creates a subscription plan with amount or usage pricing, billing interval, per-cycle maximum charge, total spending limit and expiry.
2. Customer reviews the terms and explicitly opts into the subscription.
3. Customer calls `approve(subscriptionContract, approvedTotalAmount)` on the USDT token contract. The approved amount must be bounded; infinite approval is prohibited.
4. Customer creates/activates the subscription record in the subscription contract.
5. Contract stores payer, merchant, token, billing interval, maximum charge per cycle, cumulative spending limit, expiry, next due time and cancellation state.
6. Backend scheduler identifies subscriptions due for renewal.
7. Backend computes the renewal amount from the plan or metered usage and submits a charge request through the relayer.
8. Subscription contract validates the subscription state, due time, merchant recipient, period identifier, per-cycle cap, cumulative remaining limit and expiry.
9. Contract executes `transferFrom(payer, merchant, chargeAmount)` so USDT goes directly to the merchant wallet.
10. Contract updates cumulative spend and the next billing time, and emits a renewal event.
11. Backend verifies settlement, updates subscription/payment records and emits webhooks.

### 11.2 Authorization model

- The customer approves the subscription contract as ERC-20 spender.
- The allowance amount must not exceed the customer's stated cumulative spending authorization.
- The contract's own accounting must separately enforce the per-cycle and cumulative limits; token allowance alone does not implement billing intervals or business rules.
- Do not use unlimited allowances.
- Use safe allowance-update practices; when changing a nonzero allowance, consider resetting it to zero before setting a new value where required by token behavior.
- The subscription contract must never permit an arbitrary recipient. The recipient is the merchant wallet bound to the subscription.

### 11.3 Important cancellation and allowance-revocation distinction

Cancellation and ERC-20 allowance revocation are separate operations:

- The customer calls the subscription contract's `cancel(subscriptionId)` function. The contract marks the subscription inactive immediately and rejects all future charges.
- The subscription contract cannot normally call the USDT token's `approve(customer, 0)` on behalf of the customer. ERC-20 allowance is controlled by the token holder.
- Therefore, after cancellation, the customer must separately call `approve(subscriptionContract, 0)` from their own wallet to revoke any unused allowance, unless a separately verified token-specific signature/revocation mechanism is implemented.
- The dashboard must clearly explain this distinction and provide a direct revoke-allowance action where possible.
- Cancellation must stop future scheduled charges even if the customer has not yet revoked the leftover allowance.

### 11.4 Gas payer responsibilities

| Transaction | Gas payer in MVP |
|---|---|
| One-time EIP-3009 authorization submission | Gateway relayer; payer signs typed data but does not submit a gas-paying transaction. |
| Initial subscription token approval | Customer normally pays WBT gas. |
| Subscription creation/activation | Customer normally pays WBT gas unless a compatible sponsored mechanism is separately implemented. |
| Automatic subscription renewal | Gateway relayer pays WBT gas. |
| Subscription cancellation | Customer normally pays WBT gas. |
| Allowance revocation (`approve(0)`) | Customer normally pays WBT gas. |
| Merchant refund | Merchant-authorized; relayer sponsorship is conditional on verified support and implementation. Otherwise merchant submits and pays WBT gas. |

The subscription setup and cancellation path is **not fully gasless in the MVP**. Do not market it as a no-transaction/no-WBT experience. The Whitechain Scale demo should use the one-time EIP-3009 flow to demonstrate the payer gasless experience unless gasless subscription setup is separately implemented.

### 11.5 Subscription contract invariants

The contract must enforce:

- Only active subscriptions can be charged.
- Charge time must be at or after the scheduled due time.
- A billing period cannot be charged more than once.
- Charge amount cannot exceed the configured per-cycle maximum.
- Cumulative charges cannot exceed the spending limit.
- Subscription cannot be charged after expiry.
- Payout recipient is fixed to the merchant address recorded at subscription creation, unless the customer explicitly reauthorizes a changed destination.
- Cancelled subscriptions cannot be charged.
- Reentrancy protection and checks-effects-interactions ordering.
- Events for subscription creation, charge, failure (where recorded), cancellation and relevant state updates.
- A failed renewal must not incorrectly advance the next billing period or increase cumulative spend.

### 11.6 Usage-based billing

- Merchant configures a pricing rule (for example, price per unit) and billing period.
- Gateway records usage measurements off-chain with timestamps, source and calculation details.
- At billing time, backend calculates the requested amount and supplies the period ID and amount to the contract.
- Contract enforces the customer's per-cycle and cumulative spending limits.
- Customer can inspect period usage and charge history in the dashboard/receipt.
- MVP usage metering is based on merchant-provided application usage data; it is not an independent oracle proving the usage occurred.
- If usage exceeds the authorized cap, the gateway must not charge above the cap. It should mark the balance as cap-exceeded / requires customer action.

### 11.7 Renewal failure behavior

- Record failure reason (allowance exhausted, allowance revoked, insufficient balance, subscription cancelled, expired, cap exceeded, relayer failure, RPC failure or contract rejection).
- Do not repeatedly submit a failing transaction without backoff and a retry policy.
- Do not charge multiple missed cycles in a single catch-up transaction by default.
- Notify merchant and customer through the configured channels where appropriate.
- Allow merchant-defined retry policy only within the existing authorization terms.

## 12. Refund management

### 12.1 Refund model

Refunds are not reversals of the original blockchain transaction. A refund is a new USDT transfer from the merchant wallet to the original payer address.

### 12.2 Requirements

- Merchant can issue a full or partial refund from the dashboard or API.
- Refund is linked to the original payment and invoice/order reference.
- Total refunded amount cannot exceed the original settled amount less prior successful refunds.
- Merchant wallet must have sufficient USDT balance.
- Refund destination defaults to original payer address; changing it requires explicit merchant confirmation and should be flagged as higher risk.
- Refund request is idempotent.
- A refund is not marked successful until the outgoing USDT transfer is confirmed on-chain.
- Refund record includes amount, reason, merchant initiator, destination, timestamp, transaction hash and status.
- Customer receives a refund notification/receipt after successful settlement.

### 12.3 Refund gas handling

The merchant must authorize the refund. If the token's EIP-3009 implementation supports merchant-signed transfer authorization, the gateway may submit it through the relayer and sponsor gas. If this is not supported or not implemented, the merchant sends the refund transaction directly and pays WBT gas. The final implementation path must be made explicit in the UI; the MVP must not imply a refund has been submitted when only a refund request has been recorded.

## 13. Invoices, receipts and PayeeShield

### 13.1 Invoice lifecycle

- Merchant creates an invoice record with line items/description, amount, token, payout address, invoice ID, due/expiry time and customer email (where supplied).
- Invoice can be associated with a payment link or checkout session.
- On successful payment settlement, invoice status becomes paid and the gateway emails a paid invoice/receipt to the customer.
- Failed, pending, expired and cancelled states must be represented accurately.
- The agreed MVP email behavior is **post-payment receipt email**. Pre-payment invoice email/reminders are not required unless separately added.

### 13.2 PayeeShield: signed invoice integrity

PayeeShield protects the payment request against tampering; it does not certify the legal legitimacy of the merchant.

- Create a canonical invoice payload containing at least merchant ID, invoice ID, chain ID, token contract, amount, payout wallet, issue/expiry times and nonce.
- Merchant authorizes/signs the invoice payload using a merchant-controlled signing key/wallet.
- Use EIP-712 typed data or an equivalently explicit domain-separated signature scheme.
- The checkout verifies the signature and ensures the displayed amount, token, chain and payout address exactly match the signed payload.
- Reject or flag altered invoice data, invalid signatures, mismatched chain/token, expired invoices and replayed invoice nonces.
- Payout-address changes must invalidate or version outstanding signed invoice payloads; old invoices must not silently redirect to the new address.
- Show a clear warning if signature verification fails.
- Keep signing keys separate from relayer keys. The gateway must not have the merchant's private key.

### 13.3 Email behavior

- Send paid receipt only after verified settlement.
- Email should include merchant identity, invoice/order reference, amount/token, network, paid timestamp, transaction hash/explorer link and refund/support reference.
- Never include API secrets, signing secrets, wallet seed phrases or private keys.
- Email delivery failure must not change on-chain payment status; it creates a notification exception and is retried.

## 14. DeliveryGuard: fulfilment tracking (not escrow)

### 14.1 MVP definition

DeliveryGuard provides a structured link between a payment and a merchant's fulfilment process. It does not hold funds, control payment release or guarantee delivery.

### 14.2 Requirements

- Merchant can associate an order/service fulfilment record with a payment or invoice.
- Supported statuses: not_started, processing, fulfilled, cancelled, return_requested and refund_initiated/refunded where relevant.
- Merchant can add timestamped fulfilment updates and evidence references (for example, shipment reference, delivery confirmation or completion note).
- Customer can see relevant fulfilment status from the receipt/order link, without seeing internal merchant-only notes.
- Merchant can initiate a refund from the fulfilment view, but the refund remains a separate merchant-authorized transfer.
- Any evidence uploaded to the system must be stored off-chain; only public references or hashes may be considered for future on-chain anchoring.

### 14.3 Explicit limitation

DeliveryGuard is not escrow, does not independently verify real-world delivery, and does not automatically seize or release funds. A merchant-provided delivery update is a merchant assertion unless supported by an independent evidence source.

## 15. Payment Exception Intelligence

MVP implementation is rules-based and deterministic. AI-based decisions are not required.

### 15.1 Exceptions to detect

- Underpaid payment.
- Overpaid payment.
- Duplicate payment to the same intent/invoice.
- Payment made after invoice/payment-link expiry.
- Transaction submitted but not confirmed within the configured threshold.
- Failed or reverted transaction.
- Payment received at an unexpected recipient/token/chain.
- Duplicate relayer submission or repeated API request.
- Webhook endpoint unavailable or repeatedly failing.
- Receipt email delivery failure.
- Subscription renewal failure.
- Refund requested but not settled.

### 15.2 Required behavior

- Reconcile observed token transfers against payment intents and invoices.
- Identify the reason for the exception and affected payment.
- Provide a status, severity, timestamp and recommended next action.
- Automatically retry safe infrastructure operations such as webhook/email delivery using bounded retry policies.
- Do not automatically refund or redirect funds without merchant authorization.
- Preserve a complete audit trail of detection, actions, retries and operator overrides.

## 16. Gas sponsorship and GasGuard

### 16.1 Relayer role

The gateway operates a relayer wallet funded with WBT. For supported one-time EIP-3009 payments, the relayer submits the signed authorization transaction and pays Whitechain gas. The USDT transfer itself goes directly from payer to merchant.

The gateway relayer is a gas payer, not a custodian of payer USDT.

### 16.2 GasGuard requirements

- Allowlist supported chain ID, token contract, target contract/function and transaction types.
- Validate signature, expiry, amount, recipient and nonce before submission.
- Enforce a per-transaction gas ceiling.
- Enforce global daily/weekly relayer budgets.
- Enforce per-merchant sponsorship budgets and configurable limits.
- Enforce per-payer rate limits and checkout limits.
- Reject repeated authorizations and duplicate payment intents.
- Simulate/estimate transactions where supported before broadcasting.
- Apply rate limiting, abuse detection and circuit breakers.
- Monitor relayer WBT balance and trigger low-balance alerts.
- Provide a safe manual pause switch for relayer operations.
- Keep relayer private keys out of source control and frontend code; use a secret manager/KMS or, for hackathon-only testing, a restricted environment secret with clear limitations.
- Record gas paid, transaction hash, associated payment and sponsorship budget usage.
- Do not expose a generic endpoint through which arbitrary users can submit arbitrary transactions using the relayer.

### 16.3 WBT funding and cost accounting

- The gateway operator funds the relayer with WBT for the hackathon MVP.
- The relayer is the actual on-chain gas payer for gasless one-time payments and scheduled subscription charges.
- GasGuard attributes gas usage to the merchant/payment for reporting and budget enforcement.
- The commercial policy for whether merchants reimburse or are charged for sponsored gas is not specified yet; the hackathon MVP may use a gateway-funded sponsorship budget.
- The dashboard must show the sponsorship policy and remaining budget/limits where relevant.

## 17. Developer experience and integration surfaces

### 17.1 Supported surfaces

1. JavaScript/TypeScript npm SDK.
2. React checkout widget.
3. Node.js backend middleware.
4. REST APIs for payment intents, payment links, invoices, refunds, customers and subscriptions.
5. Webhooks for payment settlement, refunds and subscription lifecycle events.

### 17.2 Integration objective

A separate demo merchant application should be able to add checkout in approximately 20 lines of application code, excluding account creation and environment configuration.

### 17.3 Illustrative integration (API names are provisional)

```ts
import { WhitechainPay } from "@whitechain-pay/sdk";

const pay = new WhitechainPay({
  publishableKey: process.env.NEXT_PUBLIC_WCP_KEY!,
});

// Client-side React example (illustrative API)
<WhitechainCheckout
  paymentIntentId={paymentIntent.id}
  onSuccess={(receipt) => showConfirmation(receipt)}
  onError={(error) => showPaymentError(error)}
/>
```

Server-side creation and secret-key operations must be performed from the merchant backend, never from browser code. The final SDK package name, exact API and component props are implementation decisions, not an existing published SDK.

### 17.4 SDK responsibilities

- Create/retrieve payment intents through the merchant backend.
- Render or mount the checkout widget.
- Handle payer authorization handoff without exposing relayer secrets.
- Provide typed responses and structured errors.
- Support idempotency keys for create/submit operations.
- Avoid treating browser callback success as authoritative settlement; backend webhook/status query remains authoritative.

### 17.5 REST API surface (proposed)

The following is a proposed resource model. Exact path names and JSON schemas may be refined during implementation.

| Resource | Example operations |
|---|---|
| Payment intents | `POST /v1/payment-intents`, `GET /v1/payment-intents/:id` |
| Checkout sessions | `POST /v1/checkout-sessions`, `GET /v1/checkout-sessions/:id` |
| Payment links | `POST /v1/payment-links`, `GET /v1/payment-links/:id`, disable link |
| Invoices | `POST /v1/invoices`, `GET /v1/invoices/:id` |
| Refunds | `POST /v1/refunds`, `GET /v1/refunds/:id` |
| Customers | `POST /v1/customers`, `GET /v1/customers/:id`, list customers |
| Products/plans | CRUD for merchant-owned product and subscription plan definitions |
| Subscriptions | `POST /v1/subscriptions`, `GET /v1/subscriptions/:id`, `POST /v1/subscriptions/:id/cancel` |
| Usage | Record usage events and retrieve usage/billing summaries |
| Webhooks | Create/update endpoint, inspect delivery attempts and replay eligible events |
| Developer status | Supported network/token/feature capability information |

### 17.6 API requirements

- Secret API keys are server-side only; publishable keys may be used by the browser where needed.
- All write operations support idempotency keys.
- Validate merchant ownership for every resource.
- Use consistent pagination, filtering and timestamp formats.
- Return structured errors with stable error codes.
- Never return private key material or raw relayer secrets.
- Rate-limit sensitive endpoints.
- Use versioned API routes.

## 18. Webhook requirements

### 18.1 MVP event types

- `payment.created`
- `payment.pending`
- `payment.succeeded`
- `payment.failed`
- `payment.expired`
- `payment.underpaid`
- `payment.overpaid`
- `payment.duplicate_detected`
- `refund.created`
- `refund.succeeded`
- `refund.failed`
- `invoice.paid`
- `subscription.created`
- `subscription.renewal_succeeded`
- `subscription.renewal_failed`
- `subscription.cancelled`
- `fulfilment.updated`

### 18.2 Delivery and security

- Sign every webhook payload with a per-endpoint secret (HMAC-SHA-256 or another documented standard).
- Include event ID, creation time, merchant ID, resource ID and schema version.
- Include a replay-protection timestamp or equivalent.
- Retry non-2xx responses with exponential backoff and a bounded retry window.
- Record each attempt, response status and last error.
- Provide replay from the dashboard for eligible events.
- Consumers must be able to deduplicate by event ID.
- Webhook delivery must be asynchronous and must not block chain settlement processing.

## 19. High-level system architecture

### 19.1 Components

| Component | Responsibility |
|---|---|
| Merchant dashboard | Merchant onboarding, payment operations, customer records, subscriptions, refunds, analytics and settings. |
| Hosted checkout / React widget | Customer-facing payment experience. |
| JavaScript/TypeScript SDK | Merchant integration wrapper and typed client utilities. |
| Node.js backend | REST API, authentication, authorization, business logic and orchestration. |
| Payment service | Payment-intent creation, status transitions and reconciliation mapping. |
| Invoice service | Invoice records, signed invoice payloads and paid receipt generation. |
| Relayer service | Validate and submit authorized transactions; manage WBT gas spending. |
| GasGuard policy engine | Sponsorship allowlists, budgets, rate limits and circuit breakers. |
| Subscription contract | Enforce allowance-backed recurring charges and spending limits. |
| Subscription scheduler | Identify due subscriptions and request contract charges. |
| Chain observer/indexer | Monitor token transfers, contract events, receipts and confirmations. |
| Refund service | Create and track merchant-authorized refund transfers. |
| Exception service | Detect and manage payment, webhook and notification exceptions. |
| Webhook dispatcher | Signed asynchronous event delivery with retry and replay. |
| Email service | Paid receipts and refund/renewal notifications. |
| Application database | Store merchant data, customers, invoices, intents, subscriptions, logs and webhook state. Database vendor is TBD. |
| Secret management | Protect API secrets, relayer signer and webhook secrets. |

### 19.2 Data flow overview

```text
Merchant application / store
          |
          | SDK / React widget / REST API
          v
Whitechain Payment Gateway (Node.js)
  |        |         |          |
  |        |         |          +--> Email + Webhook services
  |        |         +------------> Database / Customer records
  |        +----------------------> Subscription scheduler
  +-------------------------------> GasGuard + Relayer
                                      |
                                      v
                              Whitechain Sepolia
                          USDT token / Subscription contract
                                      |
                                      v
                            Chain observer / reconciler
                                      |
                                      v
                        Payment state / Dashboard / Webhooks

One-time payment: payer USDT -> merchant wallet (EIP-3009 authorization)
Subscription: payer USDT -> merchant wallet (contract transferFrom)
Refund: merchant USDT -> payer wallet (new merchant-authorized transfer)
```

### 19.3 Data persistence

A relational database is recommended for transactional application records, but the database vendor/schema implementation is not yet selected. The database must support merchant-level tenancy, unique constraints for idempotency, durable webhook jobs, scheduler jobs and auditable status transitions.

## 20. Smart-contract requirements

### 20.1 One-time payments

- Use the specified USDT token's EIP-3009 method if and only if compatibility is verified.
- No custom custody contract is required for direct one-time payout.
- Relayer submits the signed authorization to the token contract.
- Token transfer must directly credit the merchant wallet.

### 20.2 Subscription contract

The subscription contract should expose equivalent functionality to:

- Create/register a subscription with payer, merchant, token, amount/pricing config reference, billing interval, max charge per cycle, cumulative spending cap, expiry and first due time.
- Charge a subscription for a specific billing period using `transferFrom`.
- Cancel a subscription.
- Read subscription terms and status.
- Emit creation, charge, cancellation and state-change events.

The exact ABI is a technical design deliverable. Contract behavior must enforce the invariants in Section 11.5.

### 20.3 Contract security requirements

- Reentrancy protection where applicable.
- Checks-effects-interactions ordering.
- Strict role and caller authorization for charging.
- No arbitrary payout recipient supplied by untrusted callers.
- No unlimited allowance UX or default unlimited spender approvals.
- Explicit token allowlist; no arbitrary user-supplied token contract in MVP.
- Pause/emergency stop for subscription charging.
- Safe failure behavior; failed transfer must not update billing state as successful.
- Events sufficient for backend reconciliation.
- Unit tests, integration tests, invariant tests and deployment verification.
- Independent security review is recommended before any mainnet use; hackathon testing is not an audit.

## 21. Payment state model

Suggested payment states:

- `created`
- `requires_authorization`
- `authorized`
- `submitted`
- `pending_confirmation`
- `succeeded`
- `underpaid`
- `overpaid`
- `expired`
- `failed`
- `cancelled`
- `partially_refunded`
- `refunded`
- `exception`

State transitions must be validated server-side. The system must not move a payment from `succeeded` back to `pending` due to a webhook retry or stale client request. A payment may become `exception` when reconciliation identifies a mismatch, but the underlying on-chain transfer record remains immutable.

## 22. Core data entities

At minimum, the application data model must represent:

| Entity | Important fields (illustrative) |
|---|---|
| Merchant | merchant ID, display name, status, payout wallet, network, created time |
| Merchant API key | key ID, merchant ID, hashed secret, permissions, status, created/last-used time |
| Customer | customer ID, merchant ID, email/contact fields, wallet address if supplied, metadata |
| Product/service | product ID, merchant ID, name, description, price/pricing model, status |
| Payment intent | payment ID, merchant ID, customer ID, amount, token, chain, recipient, status, expiry, idempotency key |
| Checkout session | session ID, payment ID, hosted URL/slug, expiry, status |
| Payment link | link ID, merchant ID, payment/plan reference, URL slug, QR data, active/expiry state |
| Invoice | invoice ID, merchant ID, customer ID, amount, currency/token, recipient, status, signed payload, timestamps |
| On-chain transaction | chain ID, tx hash, token contract, from, to, amount, block number, receipt status |
| Refund | refund ID, merchant ID, original payment ID, amount, recipient, reason, status, tx hash |
| Subscription plan | plan ID, merchant ID, interval, pricing model, amount or rate, cycle cap, expiry policy |
| Subscription | subscription ID, payer, merchant, token, contract ID, allowance cap, per-cycle cap, cumulative cap, expiry, next due time, status |
| Usage record | usage ID, subscription ID, period ID, units, rate, calculated amount, source metadata |
| Fulfilment record | fulfilment ID, merchant ID, payment/order reference, status, evidence reference, timestamps |
| Webhook endpoint | endpoint ID, merchant ID, URL, secret reference, active state |
| Webhook event/delivery | event ID, merchant ID, type, payload reference, attempt count, response status, next retry |
| Exception | exception ID, merchant ID, resource ID, type, severity, explanation, suggested action, resolution status |
| Relayer budget | budget ID, merchant ID/global scope, max spend, current usage, time window, policy state |

All merchant-owned records must enforce tenant isolation. Exact schema, indexes and database technology are implementation decisions.

## 23. Security, privacy and operational requirements

### 23.1 Security

- Never collect or store payer/merchant seed phrases or private keys.
- Relayer key must be server-side and separated from merchant/customer keys.
- Use secure secret storage; do not commit keys to Git.
- Authenticate merchant API keys and enforce least privilege.
- Hash API secrets at rest where possible; show secret only once.
- Validate chain ID and token contract on every transaction path.
- Verify all signatures server-side.
- Apply idempotency across payment submission and renewal processing.
- Use per-merchant and global rate limits.
- Protect webhook endpoints and verify their signatures.
- Enforce strict merchant data isolation.
- Log security-relevant events without logging secrets or full signature material unnecessarily.
- Provide a relayer pause/circuit-breaker control.

### 23.2 Privacy

- Keep email addresses, names, order descriptions and other customer PII off-chain.
- Store only the minimum data required for payment operation.
- Do not put private customer records in Arkiv in future integrations.
- Explain that wallet addresses, token transfers and transaction amounts are publicly observable on-chain.
- Restrict customer record visibility to the owning merchant.

### 23.3 Reliability

- Chain event processing must be retryable and idempotent.
- Use a configurable confirmation/finality policy and handle chain reorgs or replaced transactions.
- Maintain durable job state for subscription schedules, email and webhooks.
- Never rely on a single browser callback to mark a payment as successful.
- Track RPC availability, relayer status, WBT balance, queue depth, webhook delivery and email delivery.
- Provide operator alerts for stuck transactions, low relayer balance and repeated failures.

### 23.4 Performance and scale

Hackathon performance targets are implementation targets, not guarantees:

- Checkout initialization should respond quickly enough for a normal interactive checkout.
- Payment state should update promptly after the configured chain confirmation condition is met.
- Dashboard lists should support pagination and server-side filtering.
- Webhook/email tasks should be asynchronous and not block the payment request.
- The application must remain correct when the same webhook, scheduler job or authorization payload is received more than once.

## 24. Acceptance criteria

A feature is accepted only when it is demonstrated through the actual application and/or automated test, not merely represented by a static UI.

### 24.1 Whitechain payment qualification

- [ ] Deploy all required contracts to Whitechain Sepolia (chain ID `1874`).
- [ ] Verify deployed contracts on the Whitechain explorer.
- [ ] Complete at least one successful payment using the exact ETHGlobal test USDT contract `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`.
- [ ] Include the transaction/explorer link in the project README.
- [ ] Explain why the product uses on-chain stablecoin settlement on Whitechain and what a conventional payment rail does not provide for the demonstrated flow.

### 24.2 One-time checkout

- [ ] Merchant can create a payment intent.
- [ ] Checkout displays correct merchant, amount, token, chain and recipient.
- [ ] Payer can sign the required authorization without paying WBT gas.
- [ ] Relayer successfully submits the authorization and pays WBT gas.
- [ ] USDT reaches the merchant wallet directly.
- [ ] Backend verifies the transfer before marking payment successful.
- [ ] A duplicate authorization or request cannot cause a duplicate charge.

### 24.3 Developer integration

- [ ] A separate demo app integrates the checkout widget/SDK in approximately 20 lines of application code, excluding configuration and merchant account setup.
- [ ] Node.js backend can create payment intents and verify status.
- [ ] REST API supports payment links and invoices.
- [ ] Webhook signature can be verified by the demo merchant app.

### 24.4 Merchant/customer views

- [ ] Demo includes both merchant dashboard and payer checkout.
- [ ] Merchant sees payment status and transaction details.
- [ ] Payer sees successful payment confirmation/receipt.
- [ ] Merchant A cannot retrieve Merchant B customer data or payments.

### 24.5 Refund

- [ ] Merchant can issue a full refund.
- [ ] Merchant can issue a partial refund.
- [ ] Refund goes from merchant wallet to payer wallet.
- [ ] Refund amount cannot exceed the remaining refundable payment amount.
- [ ] Refund is marked successful only after chain settlement is verified.

### 24.6 Subscription

- [ ] Customer sees interval, max cycle charge, cumulative limit, expiry and merchant before approval.
- [ ] Customer approves only a bounded allowance to the subscription contract.
- [ ] Contract rejects charges over the per-cycle or cumulative cap.
- [ ] Backend scheduler triggers a due renewal.
- [ ] Relayer pays WBT gas for renewal.
- [ ] USDT transfers directly from customer to merchant.
- [ ] The same billing period cannot be charged twice.
- [ ] Cancellation prevents future charges.
- [ ] UI explains that unused allowance requires a separate customer-signed `approve(0)` transaction unless a supported alternative is implemented.

### 24.7 GasGuard

- [ ] Relayer rejects unsupported chain/token/contract/function calls.
- [ ] Per-transaction and per-merchant sponsorship limits are enforced.
- [ ] Duplicate and expired authorizations are rejected.
- [ ] Rate limits and pause controls are demonstrable.
- [ ] Relayer WBT balance and gas usage are visible to the operator.

### 24.8 PayeeShield

- [ ] A valid signed invoice passes verification.
- [ ] A modified recipient address fails verification.
- [ ] Modified amount/token/chain or expired invoice payload fails verification.
- [ ] Invalid invoices cannot proceed to authorization submission.

### 24.9 DeliveryGuard and exception handling

- [ ] Merchant can update fulfilment status for a paid order.
- [ ] Customer-visible and merchant-only notes are separated.
- [ ] Underpayment, overpayment, duplicate payment and expired payment cases are detected.
- [ ] Webhook/email delivery failures are recorded and retried.
- [ ] The system does not automatically refund funds without merchant authorization.

## 25. Hackathon demo plan

The demo must show both merchant and payer views and should be designed to fit the required 2–4 minute video.

Recommended sequence:

1. Show merchant dashboard and configured payout wallet.
2. Create a payment for a product/service or invoice.
3. Show the generated payment link/QR.
4. Open checkout as the customer and review merchant, amount and token.
5. Complete the EIP-3009 typed authorization; show that the customer does not pay WBT gas.
6. Show the gateway relayer transaction on Whitechain Sepolia and the USDT transfer directly to the merchant wallet.
7. Show the merchant payment marked successful, the webhook received by the demo app and the paid receipt email.
8. Demonstrate PayeeShield rejecting a tampered payout address.
9. Demonstrate one post-payment feature: issue a partial refund **or** run a subscription setup/renewal, depending on the reliability of the implementation.
10. Show GasGuard budget/limits and at least one rejected unsafe relayer request.

The strict Whitechain track qualification also requires a public repository with steady commit history, setup/architecture/current limitations in the README, and a `WHITECHAIN_FEEDBACK.md` file.

## 26. Future roadmap (not MVP)

### Phase 2 — x402 programmatic payments

- Implement x402-compatible facilitator operations (`/verify`, `/settle`, `/supported`) according to the supported x402 version and payment scheme.
- Allow API providers to charge per request in USDT.
- Support conventional merchant checkout and x402 through the same merchant account and settlement records.
- Add spending policies and facilitator abuse controls.
- Do not describe x402 as required for ordinary hourly or recurring billing; conventional gateway billing can implement those flows independently.

### Phase 2 — Arkiv

Potential use cases:

- Public/searchable merchant registry or merchant-published payment offers.
- Expiring, queryable payment offers and selected invoice metadata.
- Wallet-owned entity records where ownership, queryability and expiry matter to the user experience.
- A user-facing feature must read/query Arkiv data; writing payment logs to Arkiv alone is insufficient for the Arkiv track.
- Keep customer PII, emails, private invoice data and secrets off Arkiv. Arkiv entities are public and time-scoped; only sanitized/public metadata should be considered.
- Prepare schema documentation: entity fields, query filters, owner and expiry rules. Include the queries judges can run if entering the Arkiv track.

### Phase 2 — Chainlink CRE

Potential workflow:

1. Trigger on a verified Whitechain payment or subscription event, or on a scheduled event.
2. Read/verify the on-chain payment state.
3. Call an external merchant API or business system (for example, order fulfilment or accounting).
4. Apply business rules and return a meaningful workflow result.
5. Optionally write a verified status or callback to a supported chain/system.

For a Chainlink CRE track entry, build and simulate or deploy a real CRE workflow that integrates at least one blockchain with an external API/system/data source and is meaningfully used by the product. A normal webhook service is not automatically a CRE integration.

### Phase 2 — WhiteBIT off-ramp

- Investigate WhiteBIT business APIs, deposit support and institutional on/off-ramp services.
- Verify whether the exact Whitechain USDT asset/network is accepted directly or requires a supported bridge/transfer route.
- Confirm withdrawal currencies, jurisdictions, KYC/business eligibility, fees, limits, settlement times and API access.
- Do not promise fiat conversion until a supported route and commercial access are confirmed.
- INR settlement for Indian merchants is not assumed.

### Phase 2 — EzPayz interoperability

- Investigate whether EzPayz exposes partner APIs or integration mechanisms that can be used by this gateway.
- Do not assume EzPayz supports x402 or Whitechain settlement without official technical confirmation.
- Build only where the integration provides an actual user or merchant benefit and does not duplicate the gateway's core payment flow.

### Phase 3 — broader platform capabilities

- Verified merchant/vendor identity and trust registry.
- Procurement Mode with multi-person approvals and transaction policies.
- Cross-chain payment acceptance and routing.
- Discoverable API/service marketplace.
- Enterprise B2B payment operations and reconciliation.
- Advanced delivery evidence, dispute workflows and optional conditional settlement, subject to a separate custody/escrow design and legal review.

## 27. Risks, dependencies and unresolved implementation decisions

The product scope is confirmed, but the following engineering and operational decisions must be resolved during implementation. They are not assumptions of existing capability.

| Priority | Risk / dependency | Required action |
|---|---|---|
| P0 blocker | Test USDT may not implement EIP-3009. | Inspect deployed contract ABI/source and run a complete typed-authorization test. If unsupported, stop and choose an approved alternative before claiming gasless EIP-3009. |
| P0 blocker | Test USDT decimals and transfer behavior are not verified here. | Query token metadata and test exact base-unit transfers. |
| P0 blocker | Subscription allowance and `transferFrom` behavior must work on the exact token. | Run allowance, transferFrom, revoke and boundary-condition tests. |
| P0 blocker | Whitechain Sepolia RPC, explorer and deployment configuration may change. | Confirm official endpoints and chain ID immediately before deployment. |
| P1 | No embedded wallet provider has been selected. | Select wallet-connect/signing approach; verify typed-data signing compatibility and checkout usability. |
| P1 | Subscription setup/cancellation is not gasless under the selected standard allowance architecture. | Make this explicit in UX and demo; do not promise fully gasless subscriptions. |
| P1 | ERC-20 allowance revocation cannot normally be performed by the subscription contract for the customer. | Provide an explicit customer-signed revoke-allowance action. |
| P1 | Relayer economic model is not finalized. | Define gateway sponsorship budget and future merchant reimbursement/fee policy. |
| P1 | Refund relayer path is conditional. | Decide whether refunds use merchant-signed EIP-3009 authorization through relayer or merchant-submitted transactions. |
| P1 | Database, email provider, hosting, monitoring and key-management providers are not selected. | Select implementations without changing the product requirements. |
| P1 | Chain confirmation/finality policy needs configuration. | Set a chain-aware policy and test delayed, replaced and reorged transactions. |
| P2 | Legal/compliance scope for production merchants and fiat off-ramp is unresolved. | Complete jurisdictional and business-partner review before production launch. |
| P2 | Production contract security is unaudited. | Obtain independent review/audit before mainnet use with real funds. |

## 28. Release and launch criteria

The hackathon MVP is ready for demonstration when:

- The required Whitechain Sepolia contract deployments are verified.
- At least one real test-USDT payment is settled on Whitechain Sepolia and linked in the README.
- Core payer and merchant flow works end to end.
- The relayer's WBT funding and GasGuard protections are visible and explained.
- Payment is direct to merchant wallet and the gateway is non-custodial for payment funds.
- The demo proves at least one post-payment operation (refund or renewal) if stable enough to show.
- The SDK/widget integration is usable by a separate demo application.
- Dashboard and customer checkout are both shown.
- Repository setup, architecture, current limitations and contract addresses are documented.
- Repository shows progress through meaningful commits rather than a single final upload.
- A 2–4 minute demo video is prepared.
- `WHITECHAIN_FEEDBACK.md` is included.

A hackathon demo passing these criteria does not imply production readiness. Production launch additionally requires contract audits, key-management hardening, uptime/monitoring, formal incident response, compliance assessment, business terms, support operations and tested mainnet integrations.

## 29. Documentation and external references

The following sources define external standards, chain configuration and hackathon requirements. They should be rechecked before implementation and submission.

1. [ETHGlobal Mumbai — Whitechain prizes and qualification requirements](https://ethglobal.com/events/mumbai/prizes)
2. [Whitechain — Start Building on Whitechain](https://whitechain.io/blog/start-building-on-whitechain)
3. [Whitechain developer documentation](https://docs.whitechain.io/)
4. [Whitechain Sepolia explorer](https://explorer.testnet.whitechain.io/)
5. [Whitechain Sepolia faucet](https://faucet.testnet.whitechain.io/)
6. [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
7. [ERC-20 token standard](https://eips.ethereum.org/EIPS/eip-20)
8. [OpenZeppelin ERC-20 documentation](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20)
9. [Arkiv fundamentals](https://docs.arkiv.network/start-here/fundamentals/)
10. [Chainlink CRE overview](https://docs.chain.link/cre/overview)
11. [x402 protocol](https://www.x402.org/)

---

## Appendix A — Decisions captured from product scoping

| Decision | Confirmed choice |
|---|---|
| Product type | General-purpose payment gateway, business-agnostic |
| Settlement | Non-custodial; USDT transfers directly to merchant wallet |
| One-time payment | EIP-3009 + gateway relayer; compatibility gate applies |
| Recurring billing | Subscription contract + bounded ERC-20 allowance + backend scheduler + relayer |
| Per-cycle and total limits | Explicit maximum charge per cycle and cumulative spending limit |
| Expiry/cancellation | Subscription expiry and immediate cancellation; customer separately revokes remaining allowance |
| Gas payer | Gateway relayer for one-time EIP-3009 payment and recurring renewal; customer normally pays initial approval and cancellation gas |
| Refund | Merchant-authorized transfer from merchant wallet to payer; full and partial |
| DeliveryGuard | Fulfilment tracking only, no custody or escrow |
| Invoices/email | Generate invoice records; email paid receipt after successful settlement |
| Developer surfaces | JavaScript/TypeScript npm SDK, React checkout widget, Node.js middleware, REST API, webhooks |
| Merchant/customer model | One merchant account supports multiple business types; customer records isolated per merchant |
| Hackathon scope | Every selected MVP feature is in MVP scope; future items are separately documented |
| Future integrations | x402, Arkiv, Chainlink CRE, WhiteBIT, EzPayz, multi-chain, API marketplace and enterprise features |

## Appendix B — Explicit limitations to preserve in demos and documentation

- EIP-3009 support in the required test USDT contract must be verified; it is not assumed.
- A typed-data signature is still a payer authorization interaction even though it does not require the payer to submit a gas-paying transaction.
- The selected recurring model requires an initial ERC-20 approval transaction, normally paid in WBT by the customer.
- Subscription cancellation stops future contract charges, but the customer must separately revoke leftover token allowance unless a verified alternative is built.
- The gateway does not custody payment funds.
- Refunds are new transfers from the merchant wallet, not reversals.
- DeliveryGuard is not escrow and does not independently prove fulfilment.
- WhiteBIT fiat conversion, EzPayz interoperability, Arkiv and Chainlink CRE are future integrations and are not represented as available in the MVP.
- Testnet tokens have no monetary value; successful testnet demonstration is not proof of production readiness.
