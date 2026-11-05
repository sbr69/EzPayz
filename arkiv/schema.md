# Arkiv Schema — `wcgateway.merchant_profile` + `wcgateway.offer`

> **Status:** target schema for the build. If a column changes during the build, update the table here the same day — judges read this file to run queries.

Arkiv is a **shared** database: every project writes into the same network. Our two **named schemas** tag our entities with an indexed `arkiv.schema` attribute, so a query through `wcgateway.offer` never sees anyone else's records (and vice versa). Both schemas are owned and written by one publisher wallet.

- Network: **Rabdi testnet** (chain ID `7794095`, 2-second blocks, gas token `tGLM`)
- RPC: `https://rpc.rabdi.db-chain.testnet.arkiv.network` (free access key from [hub.arkiv.network/access-keys](https://hub.arkiv.network/access-keys))
- Writer wallet: *fill during build* → `ARKIV_WRITER_ADDRESS = 0xTODO…`
- SDK: `@arkiv-network/sdk` (`defineSchema` from `@arkiv-network/sdk/schema`)

Rules we followed: **index only what we filter on** (an index costs extra gas on every write), max 32 columns per schema (31 for named ones), payload ≤ 128 KiB (ours are ~1 KB JSON).

---

## 1. `wcgateway.offer` — a thing you can buy

One entity per live offer: a one-time item (from PaymentLink/Product), a subscription plan, or an x402 paid-API route.

| Column | Type | Indexed? | Why / what filters use it |
|---|---|---|---|
| `merchantId` | `str` | ✅ | Every per-merchant view: "everything from Acme". Cross-joins the profile + the registry. |
| `kind` | `str` | ✅ | `one_time` \| `subscription` \| `x402`. The demo agent filters `kind = str('x402')`. |
| `category` | `str` | ✅ | Human browsing on `/discover` (e.g. `saas`, `food`, `api`). |
| `priceBase` | `dec` | ✅ | **Numeric price in USDT human units** (`"10.00"` = 10 USDT). Agent filters `priceBase < dec(5)`; `/discover` price slider. `dec` so sub-cent API prices like `0.01` work. |
| `deadline` | `u64` | ✅ | Unix seconds — the **business** expiry (sale ends, price valid until). Clients filter `deadline > u64(now)`; the renewal worker stops extending past it. |
| `payTo` | `addr` | ✅ | Payout wallet this offer names. Always cross-checked against `MerchantRegistry.payout(merchantId)` before payment (see [README §4](README.md#4-how-a-listing-stays-trustworthy-discovery--enforcement)). |
| `chainId` | `u64` | ✅ | `1874` (Whitechain Sepolia). Lets a future multi-chain gateway filter per settlement chain. |
| `title` | `str` | — | Display only. |
| `currency` | `str` | — | `"USDT"` (display; `priceBase` already implies it). |
| `payeeShield` | `str` | — | The gateway's **EIP-712 listing signature** over the payload hash. Verified by clients before payment. |
| `checkoutUrl` | `str` | — | Where to pay: hosted checkout slug (`/checkout/:slug`) or the x402 endpoint URL. |
| `version` | `str` | — | Schema payload version (`"1"`), so clients can evolve parsing safely. |

**Payload** (JSON, non-indexed, ~1 KB): full human-readable detail — long description, terms, image reference, the raw PayeeShield payload that `payeeShield` signs. Built with `jsonToPayload`.

```json
{
  "description": "INR reference rate API, per-call billing",
  "terms": "Data is indicative; no warranty.",
  "media": { "logo": "swarm:..." },
  "payeeShieldPayload": { "type": "offer", "merchantId": "acme", "priceBase": "0.01", "payTo": "0xAcme…", "nonce": "0x…" }
}
```

### Expiry design for offers (two layers on purpose)

1. **Heartbeat TTL (the `$expiresAt` on the entity):** short — **3 days** — and renewed by our worker (`extendEntity`) roughly hourly while the offer is genuinely live in Postgres. If the gateway stops (shut down, merchant deactivated, bug), the listing **disappears on its own within 3 days**. No cron promise, no stale ghost listings. (`extendEntity` durations count from *now*, which is exactly the heartbeat we want.)
2. **Business deadline (the `deadline` attribute):** filterable by anyone — `deadline > u64(now)`. A listing can be heartbeat-alive but already past its business deadline; clients filter it out, and the worker stops renewing those, so layer 1 cleans them up within one TTL.

We considered one-shot `ExpirationTime.atDate(deadline)` instead. Rejected: if the gateway died mid-sale, a far-future deadline would keep a dead merchant's listing visible for months. The heartbeat makes **staleness a property of the record, not a promise we make**.

**Owner:** the gateway publisher wallet (merchants don't hold Arkiv testnet gas in this build). Only the owner can patch/extend/delete — we deliberately did **not** set `permissionlessExtension`, so nobody can keep a stale offer alive for us. Honest limitation: this also means we could be pressured to unpublish; see [README §9](README.md#9-known-weaknesses-said-out-loud).

---

## 2. `wcgateway.merchant_profile` — the storefront card

One entity per active merchant. Offers join to it via `merchantId`.

| Column | Type | Indexed? | Why / what filters use it |
|---|---|---|---|
| `merchantId` | `str` | ✅ | Join key to offers + registry lookup. |
| `category` | `str` | ✅ | Directory browsing by vertical. |
| `payoutWallet` | `addr` | ✅ | The wallet clients expect the registry to return — a third check that a listing wasn't swapped. |
| `displayName` | `str` | — | Display only. |
| `country` | `str` | — | Display only (coarse; no PII). |
| `website` | `str` | — | Public merchant URL. |
| `registryAddress` | `addr` | — | Which MerchantRegistry contract to check `payout()` on (future-proof for redeploys). |
| `signature` | `str` | — | Gateway EIP-712 signature over the profile payload (same trust pattern as offers). |
| `version` | `str` | — | Payload version. |

**Expiry:** 30-day TTL, renewed daily while the merchant is active (`walletVerified && onboardingComplete`). Deactivation or abandonment → the profile ages out within 30 days, no deletion job required (though we `deleteEntity` immediately on opt-out).

---

## 3. Queries that answer real questions

Raw JSON-RPC (runs with plain `curl`, no SDK — see the README §8 for the copy-paste version):

```text
# Agent: cheapest x402 paid APIs under 5 USDT, still inside their deadline
arkiv.schema = str('wcgateway.offer') AND kind = str('x402') AND priceBase < dec(5)
  AND deadline > u64(1798761600) ORDER BY priceBase:dec ASC

# Human: everything Acme sells, soonest-deadline first
arkiv.schema = str('wcgateway.offer') AND merchantId = str('acme') ORDER BY deadline:u64 ASC

# Browser: food merchants with live offers (join done client-side on merchantId)
arkiv.schema = str('wcgateway.merchant_profile') AND category = str('food')

# Ops: our own entities that expire within 1 day (43,200 blocks) — pre-renewal check
arkiv.schema = str('wcgateway.offer') AND $expiresAt < u64(CURRENT_BLOCK + 43200)
```

Same first query through the SDK:

```ts
import { and, eq, lte, asc } from "@arkiv-network/sdk/query";
import { dec } from "@arkiv-network/sdk/schema";

const { entities } = await arkivRead
  .select({ $key: true, $owner: true, $expiresAt: true, priceBase: true, payTo: true, checkoutUrl: true })
  .from(Offer)
  .where(and(eq("kind", "x402"), lte("priceBase", dec("5"))))
  .orderBy(asc("priceBase"))
  .fetch();
```

Notes on the query language that bit us (kept here so nobody re-learns them): values are typed — `str('x402')`, `dec(5)`, `u64(1798761600)`; a bare number is an `i32` and **won't match a `dec` column**; comparisons only see **indexed** columns; `AND` binds tighter than `OR`.

---

## 4. Who owns what, and when it expires (summary table)

| Entity | Owner | Created by | Expires when | Renewed by |
|---|---|---|---|---|
| `wcgateway.offer` | gateway publisher wallet | publisher (on offer create/update) | heartbeat: 3-day TTL; business: `deadline` attribute | worker hourly (`extendEntity`) while live & inside deadline |
| `wcgateway.merchant_profile` | gateway publisher wallet | publisher (on onboarding complete) | 30-day TTL | worker daily while merchant active |

Post-build ownership path: hand each merchant a funded testnet wallet and `changeOwnership(entityKey, merchantWallet)` so merchants hold their own listings — tracked in [reach.md](reach.md) "after Mumbai".
