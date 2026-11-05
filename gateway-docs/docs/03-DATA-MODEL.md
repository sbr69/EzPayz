# 03 · Data model

Two stores, with a hard rule: **PII only in Postgres. Arkiv and chain data are public.**

## 1. Postgres (authoritative off-chain state)

Conventions: `id` is a prefixed random string (`pi_…`, `mer_…`); amounts are `numeric(78,0)` base units stored as strings in APIs; all tables have `created_at`, `updated_at`; every merchant-owned table has `merchant_id` (indexed, part of every query).

### 1.1 Tables

| Table | Key columns | Notes |
|---|---|---|
| `merchants` | `id`, `name`, `owner_wallet`, `payout_wallet`, `registry_tx`, `status`, `fulfilment_url`, `fulfilment_deadline_hours`, `public_listing` | `owner_wallet` controls `MerchantRegistry`; payout must be an EOA |
| `api_keys` | `id`, `merchant_id`, `kind(secret/publishable)`, `hash`, `last4`, `revoked_at` | Show secret once; store hash only |
| `signing_keys` | `id`, `merchant_id`, `address`, `kms_ref`, `status`, `rotated_at` | PayeeShield per-merchant delegated key; address registered on-chain |
| `customers` | `id`, `merchant_id`, `email`, `wallet`, `metadata` | PII. Unique on `(merchant_id, email)` |
| `payment_intents` | `id`, `merchant_id`, `customer_id?`, `amount`, `token`, `chain_id`, `recipient`, `status`, `expires_at`, `reference`, `idempotency_key`, `invoice_payload`, `invoice_sig`, `intent_hash` | Unique `(merchant_id, idempotency_key)` |
| `authorizations` | `id`, `intent_id`, `payer`, `valid_after`, `valid_before`, `nonce`, `sig_hash`, `state` | Unique `(token, payer, nonce)`; never stores raw sig after submission if avoidable |
| `onchain_txs` | `id`, `chain_id`, `tx_hash`, `log_index`, `kind`, `from`, `to`, `amount`, `block_number`, `status`, `confirmations` | Unique `(chain_id, tx_hash, log_index)` |
| `payments` | `id`, `intent_id`, `merchant_id`, `payer`, `amount`, `refunded_amount`, `tx_id`, `succeeded_at`, `source(checkout/link/x402)` | Created when observer confirms |
| `payment_links` | `id`, `merchant_id`, `slug`, `mode(fixed/range)`, `amount_min/max`, `description`, `expires_at`, `active` | |
| `invoices` | `id`, `merchant_id`, `intent_id`, `number`, `status`, `receipt_sent_at` | Post-payment receipt record |
| `refunds` | `id`, `payment_id`, `merchant_id`, `amount`, `to`, `reason`, `mode(router/manual)`, `status`, `tx_id`, `idempotency_key` | Cap: sum(succeeded) ≤ payment.amount |
| `x402_resources` | `id`, `merchant_id`, `route`, `price`, `description`, `active` | What the middleware advertises |
| `x402_settlements` | `id`, `merchant_id`, `resource_id`, `payer`, `amount`, `tx_id`, `status` | Also writes a `payments` row with `source=x402` |
| `fulfilments` | `id`, `payment_id`, `merchant_id`, `status`, `source(merchant/cre)`, `evidence_hash`, `checked_at`, `customer_note`, `internal_note` | Customer-visible vs internal fields separated at API layer |
| `exceptions` | `id`, `merchant_id`, `resource_type/id`, `type`, `severity`, `detail`, `suggested_action`, `status` | Types in §1.3 |
| `outbox_events` | `id`, `merchant_id`, `type`, `payload`, `status`, `attempts`, `next_attempt_at` | Transactional outbox |
| `webhook_endpoints` | `id`, `merchant_id`, `url`, `secret_hash`, `active` | Secret shown once |
| `webhook_deliveries` | `id`, `event_id`, `endpoint_id`, `attempt`, `status_code`, `error`, `at` | |
| `relayer_ledger` | `id`, `merchant_id?`, `tx_hash`, `gas_used`, `gas_price`, `cost_wbt`, `payment_id?` | Feeds budgets |
| `relayer_budgets` | `scope(global/merchant)`, `merchant_id?`, `window`, `limit_wbt`, `used_wbt` | |
| `audit_log` | `id`, `merchant_id?`, `actor`, `action`, `detail`, `at` | No secrets |
| `arkiv_entities` | `id`, `merchant_id`, `entity_key`, `kind`, `expires_at_block/time`, `last_renewed_at` | Our index of what we published |

### 1.2 Required constraints and indexes

- Unique idempotency per merchant and endpoint.
- `refunds`: partial unique index preventing two `submitted` refunds on one payment at once.
- Row-level scoping helper in the data layer: every repository function takes `merchantId` explicitly. Cross-tenant access has a dedicated test.
- `onchain_txs` unique on log identity so the observer is idempotent.

### 1.3 Exception types (MVP)

`underpaid`, `overpaid`, `duplicate_payment`, `expired_but_paid`, `tx_failed`, `webhook_failing`, `email_failed`, `not_fulfilled` (from CRE), `refund_unsettled`.

## 2. Arkiv entities (public, expiring, wallet-attributed)

> Arkiv facts below are **from the docs we read and must be re-verified against `https://docs.arkiv.network` before coding**: entities are owned by a wallet, carry attributes you can filter with SQL-like queries, have a payload, and expire at a block you choose. Numeric attributes support range filters; string-typed numbers do not. There are no contract calls on Arkiv, and no expiry event, so track expiry yourself.

### 2.1 Ownership decision (Proposed)

The **gateway publisher wallet** owns the entities. Each entity's payload contains a **PayeeShield listing signature** from the merchant's delegated signing key, and `merchantId`. Consumers verify the signature and check `payTo` against `MerchantRegistry`. This avoids requiring merchants to hold Arkiv testnet gas tokens.

Trade-off: only the gateway can edit or renew entities. Document this as a limitation. A future version lets merchants own their entities directly.

### 2.2 `merchant_profile`

| Field | Where | Notes |
|---|---|---|
| `type` = `"sg.merchant_profile"` | attribute | |
| `merchantId` | attribute (string) | |
| `merchantWallet` / `registry` | attribute | `MerchantRegistry` address + chain ID |
| `category` | attribute | enum string e.g. `saas`, `data`, `design`, `hosting` |
| `chainId` | attribute (number) | 1874 |
| `displayName`, `website`, `description` | payload JSON | Public, no PII |
| `listingSig`, `signer` | payload JSON | PayeeShield signature |
| **Expiry** | | 30 days; renewed by worker |

### 2.3 `offer`

| Field | Where | Notes |
|---|---|---|
| `type` = `"sg.offer"` | attribute | |
| `merchantId`, `offerId` | attribute | |
| `kind` | attribute | `checkout` or `x402` |
| `category` | attribute | for filtering |
| `priceBase` | attribute (**number**) | USDT base units, enables `<` / `>` queries |
| `token` | attribute | USDT address |
| `endpoint` | payload | Checkout URL or x402 route |
| `payTo` | payload | Must equal registered payout |
| `title`, `description` | payload | |
| `listingSig` | payload | |
| **Expiry** | | Offer's own deadline, or 7 days for evergreen offers (renewed) |

### 2.4 Example queries (syntax to verify in Arkiv docs)

```text
type = "sg.offer" AND kind = "x402" AND category = "data" AND priceBase < 50000
type = "sg.offer" AND merchantId = "mer_123"
type = "sg.merchant_profile" AND category = "hosting"
```

### 2.5 What is kept off Arkiv, and why

| Data | Reason |
|---|---|
| Customer emails, names, order contents | PII; Arkiv is public |
| Payment intents, receipts, refunds | Settlement truth is on Whitechain + Postgres |
| API keys, signing keys, webhook secrets | Secrets |
| Invoice details | Commercially sensitive; only offers (public by choice) are listed |

The required Arkiv files (`/arkiv/schema.md` etc.) are templated in `11-SUBMISSION-CHECKLIST.md`.
