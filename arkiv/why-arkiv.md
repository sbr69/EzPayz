# Why Arkiv — and what we'd lose with Postgres

The question this file answers: *if the directory sat in our Postgres instead of Arkiv, what could people no longer do?* And the flip side: *what can people do with our Arkiv copy that they can't do with our API today?*

Short answer first, details after:

> **With Postgres only, discovery is a service we run. With Arkiv, discovery is data we publish.** A service can go down, rate-limit you, require an account, or disappear with the company. Published data on a chain just sits there, queryable by anyone with one HTTP call, until it expires.

## 1. The four concrete losses if this were only our Postgres

**Loss 1 — Independent queries.** Today every listing lives in our Neon Postgres behind our Fastify API. Any third party — another wallet app, a comparison site, an AI agent — would have to ask our API, which means: our uptime becomes their uptime, our rate limits become their limits, and our terms of service become their permission slip. An agent can't "register a JWT and agree to terms"; it needs one `curl` against a JSON-RPC endpoint. With Arkiv, the same filtered query runs from anywhere, forever, without us. This is the difference between *being allowed to look* and *being able to look*.

**Loss 2 — Expiry you don't have to trust.** Stale listings are the classic marketplace disease: the sale ended in March, the listing is still up in November. In Postgres, freshness would be a cron job **we promise to keep running** — a promise, not a property. On Arkiv, every entity has an `$expiresAt` and is simply *gone* after it — queries stop returning it, with no event, no job, no mercy. Our design leans into this: offers carry a 3-day heartbeat TTL that only stays alive while our worker keeps renewing genuinely-live offers ([schema.md](schema.md) §1). If we vanish, the directory evaporates within days instead of rotting forever. Try doing that with rows in a table.

**Loss 3 — Wallet attribution.** A Postgres row says "payTo: 0xAcme…" because we typed it into a row. An Arkiv entity *has an owner wallet* readable on every record, and only that wallet can modify it. Combined with our PayeeShield listing signature and the on-chain `MerchantRegistry` cross-check, a forged listing can exist on Arkiv but it can't get paid — the three checks are described in [README §4](README.md#4-how-a-listing-stays-trustworthy-discovery--enforcement). In a private database, "who wrote this row?" has no independent answer at all.

**Loss 4 — Composability.** A public, filterable, addressable dataset invites things we didn't plan: someone builds a Telegram bot over our offers; an agent framework indexes `kind = "x402"` routes; a researcher counts USDT prices by category. That only happens when the data is *queryable without negotiating with us*. Our API serving JSON to a whitelist doesn't get any of it.

## 2. What our Arkiv copy lets people do that the original source (our API) doesn't

- **Query without an account, key, or our cooperation** — one `curl` with `arkiv_query` ([README §8](README.md#8-how-to-verify-the-judge-version)); no sign-up, no API key tiers, no rate-limit negotiation beyond the node's.
- **Verify who published a listing** — `$owner` and `$creator` on every entity, checkable against the wallet published in our README, with no statement from us required.
- **See freshness instead of trusting it** — `$expiresAt` and `$updatedAt` are on the record; a client can refuse to show listings that are about to age out.
- **Build their own UI** over the same directory without asking us for an API key or paying us.
- **Keep a data escape hatch** — if the gateway shut down tomorrow, the directory keeps serving whoever reads it until entities expire, instead of disappearing with the backend.

## 3. What we kept off Arkiv, and why

Arkiv is public by design. So the split is simple: **public commercial metadata → Arkiv; everything else stays where it already is.**

| Stays on Arkiv | Stays off Arkiv (in Postgres / on Whitechain) |
|---|---|
| `merchant_profile`: name, category, country, website, payout wallet, gateway signature | Customer PII: names, emails, wallets, payment history |
| `offer`: kind, category, `priceBase`, deadline, `payTo`, checkout URL, listing signature | Payments, receipts, refunds, invoice details (privacy + they're settlement truth) |
| Nothing else. | Webhook secrets, signing keys, passwords |
| | The payout registry itself — **on Whitechain as `MerchantRegistry`** (see §4) |

Public chain data and commercial privacy don't mix: an entity is readable by every node forever. There's no "private attribute" to reach for, so the only safe design is to keep private things physically off the network. Settlement truth (what was actually paid, to whom, when) stays on Whitechain where it's enforced, and Postgres stays the private source of truth that our publisher sanitizes *from*.

## 4. The earlier idea we rejected: payout registry on Arkiv

Our first sketch put the merchant payout-address registry on Arkiv too — one nice public dataset. We moved it to a `MerchantRegistry` contract on Whitechain, because:

- The rule "pay the address the registry names" is **enforced at settlement time, on the settlement chain**. Arkiv is a separate chain with **no contract calls** — a registry there could be read but never *executed against*.
- The registry is the enforcement layer; Arkiv is the discovery layer. Putting enforcement on the discovery layer would make the anti-swap check depend on a chain that settlement can't reach.

The two stay cross-checked: an Arkiv listing *suggests* a `payTo`; the registry *decides* it; the relayer refuses to submit unless they agree.

## 5. Where Arkiv is genuinely the wrong tool (fairness section)

- Anything needing privacy, enrichment with PII, or SQL joins across private tables → Postgres, permanently.
- Anything needing atomic transactional consistency with payments → Postgres; the publisher is eventually-consistent by design (that's fine: worst case a listing lags by seconds or expires).
- If the product were *only* checkout and refunds, Arkiv would be dead weight — the removal test ("delete Arkiv: does checkout still work?" — yes, only discovery is lost) passes only because open discovery is a real feature here, not a payments dependency. If we run short on time at the hackathon, Arkiv is the first thing we cut rather than fake.
