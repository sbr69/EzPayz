# How We Use Arkiv — filters, ownership, expiry, and what users actually see

The question this file answers: *do the things you filter on, who can edit each entity, and when it expires actually fit what your app does? And does each Arkiv feature you use change something a user sees?*

Our test for "yes" is strict: **every Arkiv feature below is load-bearing for a screen or a flow a user touches.** If a feature stopped working, a user-visible thing would break — nothing here is a write-only log or a checkbox.

Full field-level schema lives in [schema.md](schema.md); this file is the mapping to product behavior.

## 1. What we filter on ↔ what it's for

| Indexed filter | Where a user hits it |
|---|---|
| `kind = "x402"` + `priceBase < cap` (numeric) | **Demo agent** picks the cheapest paid API under its price cap before calling it (Phase A6, [README](README.md#phase-a6--x402-demo-an-agent-discovers-a-paid-api-on-arkiv-and-pays-est-6h)). This is the flagship filter: it's an *economic decision* made by software, from data. |
| `deadline > now` (numeric) | Every reader (the `/discover` page, `GET /v1/discover`, the agent) drops offers past their business expiry — the client itself enforces freshness, it doesn't trust us to. |
| `category = "…"` | `/discover` page category tabs — a human browsing "who accepts USDT for food?" |
| `merchantId = "…"` | "Everything from Acme" views on `/discover`; joins offers to their `merchant_profile`. |
| `chainId = 1874` | Guards every checkout link: only offers settleable on Whitechain Sepolia are shown today. |
| `$owner` / `$expiresAt` (entity fields) | The trust check (owner == published writer wallet) and the freshness chip ("expires in 2d · renewed 1h ago") rendered on every card. |
| `ORDER BY priceBase:dec ASC` | The agent's "cheapest first" and `/discover`'s sort. |

We deliberately **didn't** index display-only columns (`title`, `checkoutUrl`, `payeeShield`): indexes cost extra gas on every write, and nobody filters by them. That trade-off only exists because Arkiv makes storage costs explicit — Postgres hides it, which is exactly why its indexes get designed by habit instead of on purpose.

## 2. Who can edit each entity, and why that fits the app

- **Creator/owner:** one gateway publisher wallet (`ARKIV_WRITER_ADDRESS`, published in the README). It creates on offer-create/onboarding, patches on updates, deletes on opt-out, and is the only account that can renew.
- **Why single-owner fits:** merchants on our testnet build don't hold Arkiv gas (tGLM), and the listing payload carries the gateway's PayeeShield signature anyway — the signature is what clients trust, and only the signer of that signature should own the record. Single owner keeps signature and write-access in one place.
- **Why we rejected `permissionlessExtension`:** it would let *anyone* keep an entity's expiry alive. Useful for public-good records; wrong for price offers, where a stale price someone else kept alive is worse than an expired one.
- **Ownership we admit is imperfect:** merchants can't edit their own listings in this build — censorship of *edits* isn't possible but censorship of *publication* is (we run the only writer). The honest path forward is in [README §9](README.md#9-known-weaknesses-said-out-loud): fund merchants a gas stipend and `changeOwnership` entities to them post-hackathon.
- **Fraud resistance:** strangers *can* write fake entities (Arkiv is permissionless), but they can't get paid through them: listing signature + `$owner` + `MerchantRegistry.payout(merchantId)` must all agree ([README §4](README.md#4-how-a-listing-stays-trustworthy-discovery--enforcement)).

## 3. When entities expire — and what the user sees when they do

| Entity | Expiry | Renewal | What the user sees |
|---|---|---|---|
| `wcgateway.offer` | 3-day heartbeat TTL + `deadline` attribute (business expiry) | BullMQ worker hourly: `extendEntity` while the offer is live in Postgres **and** inside its deadline | Live offer → card with countdown chip. Worker stops (deactivated, deadline passed, gateway down) → card vanishes within ≤3 days *by itself*; meanwhile every reader filters `deadline > now`. |
| `wcgateway.merchant_profile` | 30-day TTL | Worker daily while merchant is active + wallet-verified | Merchant delisted → profile ages out; their offers become orphans the UI hides (join on `merchantId` fails). |

This is the part of Arkiv that changed our design, not just our storage: **staleness became a property of the record.** In Postgres, "the worker will clean it up" is a promise; on Arkiv, an unrenewed entity is *physically gone* — queries skip it, mutations fail on it. There is no stale-listing bug class left to write. (One real consequence: Arkiv emits no expiry event, so our worker polls instead of subscribing — noted in [friction.md](friction.md).)

## 4. Arkiv features we use → the user-visible thing each one changes

| Arkiv feature | User-visible result |
|---|---|
| Named schemas (`wcgateway.*`) + indexed attributes + `arkiv_query` | **`/discover` page** — a public merchant directory that renders *live from Arkiv* (browser SDK public client), no login. |
| Same query from our API's public client | **`GET /v1/discover`** — a server-side mirror of the identical Arkiv query for clients that can't run the SDK; it returns the query it ran in `x-arkiv-query` so it's auditable. |
| Numeric `dec` filter + `ORDER BY` | **The x402 agent demo** — an agent that finds a paid API under its budget and pays it. No Arkiv, no agent story. |
| `$owner` on entities | **Trust chip** on cards ("published by verified writer wallet") and the pre-payment owner check. |
| `$expiresAt` + heartbeat renewal | **Freshness chip** on cards; the guarantee that what you see was renewed hours ago, not scraped sometime. |
| Expiry (self-pruning) | **No ghost listings** — the failure mode "directory full of dead offers" can't occur even if we stop existing. |
| `patchEntity` / `deleteEntity` | Merchant edits a price → the listing updates in seconds; merchant opts out → gone immediately (expiry is only the safety net). |
| `extendEntity` from-now semantics | The heartbeat itself — each renewal buys another 3 days, so "renewed 1h ago" on the card is literally what the field says. |

## 5. What would visibly break if we swapped Arkiv for Postgres

`/discover` would become our API's private view (independent queries gone), the freshness chip would become a claim instead of a field, the agent's price query would need our API key, and stopping our servers would freeze the directory instead of letting it expire. Those are exactly the product behaviors we built the feature around — which is why the data layer is Arkiv.
