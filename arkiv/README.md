# Arkiv — Open Discovery Layer for the Gateway

**TL;DR:** The gateway already moves USDT on Whitechain. What it cannot do today is let *other people and other software* find our merchants without asking us. Arkiv fixes that. We publish two kinds of public records — `merchant_profile` and `offer` — to Arkiv's testnet, where **anyone** (a human, a browser app, or an AI agent) can filter them with SQL-like queries, **without an account, a key, or our API being up**. Every record carries an **owner wallet** and an **expiry**, so stale offers disappear by themselves and nobody can forge a listing that points at their own payout address.

This folder is both:

1. **The build plan** — how we wire Arkiv into the gateway, phase by phase (see [Phase plan](#phase-plan) below).
2. **The track submission pack** — one file per judged criterion:

| File | Judged criterion |
|---|---|
| [`schema.md`](schema.md) | Our entities, fields we query on, who owns them, when they expire |
| [`why-arkiv.md`](why-arkiv.md) | Why Arkiv and not just Postgres — what users would lose |
| [`how-you-use-arkiv.md`](how-you-use-arkiv.md) | Filters, ownership, expiry ↔ what the app actually does |
| [`reach.md`](reach.md) | Who this is for and whether they'd use it |
| [`friction.md`](friction.md) | Honest feedback for the Arkiv team |
| [`swarm.md`](swarm.md) | Arkiv + Swarm bonus plan (optional add-on) |

**Target track:** 🧩 Build on Arkiv (from scratch) — the Arkiv integration is written new at the hackathon; the existing gateway is the settlement backend it plugs into.

---

## 1. The problem, in plain words

A payment gateway is useless if nobody can find the merchant. Today, discovery on our platform looks like this:

- A **human** who wants to spend USDT has to *already know* which stores accept it. There is no public directory — our Postgres has the data, but only our dashboard shows it, and only after login.
- An **AI agent** that wants to find and call a paid API has *no way at all*. It can't log in to a dashboard. It needs machine-readable listings with a price, an endpoint, and a way to check they're genuine.

Both groups are blocked by the same thing: **we are the gatekeeper**. Discovery depends on our API staying up, staying willing to serve it, and staying honest.

## 2. What Arkiv is (30-second version)

Arkiv is a **shared database for Ethereum people**. You don't rent a table on someone's server — the data lives on a chain, and you talk to it with a normal wallet, a transaction, and a JSON-RPC endpoint (same tooling as Ethereum).

The facts that matter for us:

- A record is called an **entity**: a payload (JSON blob) plus up to 32 **attributes** (typed, and some can be *indexed* = filterable).
- Every entity has an **owner wallet** (only the owner can edit/extend/delete it) and an **expiry block** (after it, the entity is simply *gone* — queries stop returning it, no cron job needed).
- Anyone can **query** indexed attributes with a SQL-like language: `kind = str('x402') AND priceBase < dec(5)`.
- Reads need no account. Writes cost gas (tGLM on the Rabdi testnet — free from a faucet).

One honest caveat (their docs say it first): it's *public* — anyone can write anything. So we design for trust, see §4.

## 3. What we publish to Arkiv

Two entity types, written through two named schemas (tags keep our records separate from everyone else's on the shared network):

| Entity | Schema tag | What it is | Expire logic |
|---|---|---|---|
| `merchant_profile` | `wcgateway.merchant_profile` | Public storefront card: display name, category, country, website, payout wallet | 30-day TTL, renewed daily while the merchant is active |
| `offer` | `wcgateway.offer` | A thing you can buy: one-time item, subscription plan, or an x402 paid API route, with `priceBase` (numeric) and `payTo` | Short heartbeat TTL (3 days) renewed while live; `deadline` attribute = the business expiry anyone can filter on |

Full field tables: [`schema.md`](schema.md). The payload holds the richer JSON (description, terms, the gateway's **PayeeShield listing signature**) and is capped at 128 KiB by Arkiv anyway — our payloads are ~1 KB.

**What we never publish:** customer PII, payments, receipts, refunds, invoice details, secrets. Arkiv is public by design; settlement truth stays on Whitechain, private data stays in Postgres. (See [`why-arkiv.md`](why-arkiv.md), "What we kept off Arkiv".)

## 4. How a listing stays trustworthy (discovery ≠ enforcement)

Arkiv is public, so a scammer could write a fake "Acme Store" entity pointing at their own wallet. Three independent checks stop the money from ever following a forged listing:

```
                    ARKIV (discovery)                     WHITECHAIN (enforcement)
   ┌──────────────────────────────────────┐      ┌─────────────────────────────────────┐
   │ offer entity                         │      │ MerchantRegistry contract           │
   │  kind="x402", priceBase=1.00         │      │  payout(merchantId) ⇒ 0xAcme…       │
   │  payTo=0xAcme…  merchantId="acme"    │      │  (source of truth for who gets paid)│
   │  payeeShield=<gateway EIP-712 sig>   │      └─────────────────────────────────────┘
   └──────────────────────────────────────┘
        │              │                        │
        ▼              ▼                        ▼
   1. VERIFY        2. VERIFY                3. ENFORCE at settlement
   signature        entity $owner ==         checkout refuses to relay unless
   (PayeeShield)    published writer         payTo == MerchantRegistry.payout(merchantId)
                    wallet (in README)       == the payTo on the listing
```

1. **Listing signature (PayeeShield):** the gateway EIP-712-signs every listing payload. A client verifies the signature before paying — a stranger can *write* a fake entity, but can't *sign* one.
2. **Owner check:** all genuine entities come from one published writer wallet (`$owner` is readable on every entity; the wallet is in the README). Anything else = not ours.
3. **Registry cross-check:** we deploy a small `MerchantRegistry` contract **on Whitechain** mapping `merchantId → payoutWallet`. Before payment, the client (and our checkout service) requires `offer.payTo == MerchantRegistry.payout(merchantId)`. Settlement is on Whitechain, so enforcement is on Whitechain — Arkiv has no contract calls and is a separate chain. **Discovery layer ≠ enforcement layer; the two are cross-checked.**

An earlier idea put the payout registry *on Arkiv*. We rejected it: a rule enforced at settlement time must live where settlement happens. (More in [`why-arkiv.md`](why-arkiv.md).)

## 5. Architecture

```
                        ┌──────────────────────── OUR STACK ────────────────────────┐
                        │                                                           │
   Merchant onboard ───►│  apps/api (Fastify)  ──►  Postgres (private source of     │
   Plan/Product/Link ──►│        │                   truth: PII, payments, invoices) │
   x402 route live  ───►│        │ publisher service (sanitized projection only)      │
                        │        ▼                                                   │
                        │   BullMQ worker ── extendEntity() heartbeat renewal        │
                        └────────┼───────────────────────────────────────────────────┘
                                 │ writes (wallet txns, tGLM gas)
                                 ▼
                    ┌─────────────────────────┐
                    │   ARKIV Rabdi testnet   │   merchant_profile + offer entities
                    │   public, self-expiring │   $owner + $expiresAt on every record
                    └────────┬────────────────┘
                             │ reads (no account needed)
        ┌────────────────────┼─────────────────────────────┐
        ▼                    ▼                             ▼
  /discover page        GET /v1/discover             demo agent script
  (browser SDK          (our API proxies the         (queries kind="x402"
   queries Arkiv        SAME Arkiv query —            AND priceBase < cap,
   directly)            it does NOT serve its         verifies, pays USDT)
                        own Postgres copy)
```

Key property: **every reader path reads Arkiv itself.** Our API is one reader among many, not the source. If our API dies, the directory stays queryable for as long as the entities are alive — and if *everything* dies, the entities expire on their own.

## 6. Why Arkiv rather than Postgres (short version)

If this were only our Postgres:

- Discovery depends on our API staying up and willing to serve it; third parties and agents **cannot query it independently**.
- Expiry would be a cron job **we promise to run**, not a property of the record.
- Nothing about a listing would be **independently attributable** to a wallet.

With Arkiv, anyone can run the same filtered query without asking us, listings self-expire, and entities are wallet-attributed. Full argument: [`why-arkiv.md`](why-arkiv.md).

## 7. Phase plan

All Arkiv work is new code written at the hackathon. Phases are ordered so a **user-visible Arkiv-reading feature** exists early (that's a hard track requirement), with enforcement and the agent demo after. Estimates assume two devs, roughly 2 days total.

> **Fill during build:** after each phase, drop the proof (tx hash / explorer link / screenshot path) next to the phase below.

### Phase A0 — Setup: wallet, gas, access key (est. 1h)

**Goal:** everything needed to write one test entity.

- [ ] Create publisher wallet; fund with tGLM from the faucet — https://hub.arkiv.network/faucet
- [ ] Get a free RPC access key — https://hub.arkiv.network/access-keys (public RPC is heavily rate-limited)
- [ ] Add env vars to `.env.example` + `.env`:
  - `ARKIV_PRIVATE_KEY` (publisher wallet), `ARKIV_ACCESS_KEY`, `ARKIV_RPC_URL=https://rpc.rabdi.db-chain.testnet.arkiv.network`, `ARKIV_CHAIN_ID=7794095`, `ARKIV_WRITER_ADDRESS` (derived; goes in the README)
  - `MERCHANT_REGISTRY_ADDRESS` (filled in Phase A5)
- [ ] `pnpm --filter @ezpayz/api add @arkiv-network/sdk` (brings viem peers — already in the stack)
- [ ] Smoke script `apps/api/scripts/arkiv-hello.ts`: create one throwaway entity, read it back, delete it.

**Done when:** `tsx scripts/arkiv-hello.ts` prints an entity key and a live `$expiresAt` block.

> **Fill during build:** writer wallet `0x…` · hello-entity tx `0x…` (explorer: https://rabdi.explorer.arkiv.network)

### Phase A1 — Schemas + Arkiv client module (est. 2h)

**Goal:** typed, reusable Arkiv layer inside the API app.

- [ ] `apps/api/src/arkiv/schema.ts` — `defineSchema("wcgateway.merchant_profile", …)` and `defineSchema("wcgateway.offer", …)`; only the columns we actually filter on are `.indexed()` (indexes cost gas on every write). Full tables in [`schema.md`](schema.md).
- [ ] `apps/api/src/arkiv/client.ts` — `createPublicClient` / `createWalletClient` from `@arkiv-network/sdk` with `rabdi({ accessKey: env.ARKIV_ACCESS_KEY })`; export `arkivRead` (public, used by routes/agent) and `arkivWrite` (wallet, used by publisher/worker).
- [ ] `apps/api/scripts/arkiv-query-demo.ts` — **the judge-runnable query** (see §8), committed and passing. (Lives inside the `api` workspace so the SDK resolves; reads via the public client, no key needed.)

**Done when:** `pnpm --filter @ezpayz/api exec tsx scripts/arkiv-query-demo.ts` returns live entities from Rabdi.

### Phase A2 — Publisher: Postgres → Arkiv projection (est. 4h)

**Goal:** one service turns private rows into sanitized public entities, idempotently.

- [ ] Prisma migration: `ArkivListing` model (one row per published offer: `merchantId, kind, category, title, priceBase, payTo, deadline, sourceKind/sourceId, arkivEntityKey, active, publishedAt`) + `arkivProfileKey` on `Merchant`. Arkiv entity keys must be stored — we need them to `extendEntity`/`patchEntity`/`deleteEntity`.
- [ ] `apps/api/src/arkiv/publisher.ts`:
  - `publishMerchant(merchantId)` → create-or-patch `merchant_profile` (create → store key; later → `patchEntity`)
  - `publishOffer(listingId)` / `unpublishOffer(listingId)` (`deleteEntity` on deactivate — expiry is the safety net, deletion is the primary path)
  - Listing payload = sanitized JSON + **PayeeShield listing signature** (reuse `services/payeeShield.ts` EIP-712 domain with a `listing` type)
- [ ] Wire triggers: merchant onboarding complete + profile `PATCH` → publish profile; plan/product/payment-link create/update/deactivate → publish/unpublish offer.
- [ ] `apps/api/scripts/arkiv-backfill.ts` — publishes the two seed merchants (Acme, Globex) + demo offers so the demo doesn't depend on clicking through onboarding.

**Done when:** entities visible on the explorer; re-running the backfill patches instead of duplicating.

> **Fill during build:** profile entity key `0x…` · offer entity key `0x…` · explorer links.

### Phase A3 — Renewal worker: expiry as a property, not a promise (est. 2h)

**Goal:** live listings stay alive **only** while we keep renewing them — and they die by themselves when we stop.

- [ ] BullMQ repeatable job `arkiv-renew` (hourly) in `apps/api/src/worker.ts`:
  - every `active` listing → `extendEntity({ entityKey, expiration: ExpirationTime.fromDays(3) })` (duration counts from *now* — that's the heartbeat we want)
  - every active merchant → extend profile TTL to 30 days
  - offers past their business `deadline` are **not** renewed (skipped + marked inactive)
- [ ] Nothing else needed for expiry: if the worker stops, entities vanish within ≤3 days on their own. Arkiv emits no expiry event and needs none — absence of renewal *is* the signal.

**Done when:** manually expiring an offer in Postgres → its entity disappears from queries within one TTL; killing the worker does the same within 3 days.

### Phase A4 — User-visible readers: `/discover` page + `GET /v1/discover` (est. 4h) ⭐ track requirement

**Goal:** at least one feature users *see* that reads its data from Arkiv.

- [ ] `apps/api/src/routes/v1/discover.ts` — **public** (no auth) `GET /v1/discover?kind=&category=&maxPrice=&q=`. It validates filters and runs the **same query against Arkiv** (server-side public client) — it deliberately does not serve a Postgres copy.
- [ ] `/discover` page in `apps/web` — merchant + offer directory. Reads Arkiv **directly from the browser** via the SDK public client (access key with an Origins allowlist), with `GET /v1/discover` as fallback. Cards show name, category, price, and the *expiry state* (`$expiresAt` rendered as "renewed 2h ago · expires in 2d") — making Arkiv's lifecycle visible to users.
- [ ] Merchant cards link to real checkout (`/checkout/:slug`) — discovery converts to payment through the existing PayeeShield flow.

**Done when:** a fresh browser with no gateway login sees live listings served from Arkiv; filters map to `where()` clauses (proof in the route's response header, e.g. `x-arkiv-query`).

> **Fill during build:** demo URL / screenshots.

### Phase A5 — MerchantRegistry on Whitechain + checkout cross-check (est. 4h)

**Goal:** enforcement where settlement happens; nobody can swap a payout address via a listing.

- [ ] `packages/contracts/src/MerchantRegistry.sol` — `mapping(bytes32 merchantId => address payout)`; writes by the gateway admin (merchants are wallet-verified at onboarding, FLOW §9) with an event; Foundry tests; deploy + verify on Whitechain Sepolia (same flow as SubscriptionContract).
- [ ] `apps/api/src/web3/registry.ts` — `payoutOf(merchantId)` via viem.
- [ ] Cross-check in `services/authorize.ts` (step 3.5, fail-closed): `auth.to == intent.payoutWallet == registry.payoutOf(merchantId)` — a listing in Arkiv can *suggest* a payTo, but settlement only follows the registry.
- [ ] Client-side: the checkout widget + demo agent also verify `offer.payTo == MerchantRegistry.payout(merchantId)` and the listing signature before asking the payer to sign.

**Done when:** e2e — tamper test: patch an offer's `payTo` via a *different* wallet to a scam address → signature + owner + registry checks all reject it; payment never relays.

> **Fill during build:** `MerchantRegistry` address `0x…` (verified on Blockscout) + tamper-test tx link.

### Phase A6 — x402 demo: an agent discovers a paid API on Arkiv and pays (est. 6h)

**Goal:** the second half of the product need — **agents** finding paid APIs programmatically, with prices, and paying.

- [ ] `apps/api/src/routes/v1/x402.ts` — one genuinely paid endpoint, e.g. `GET /v1/x402/fx-rate?pair=USDT-INR`:
  - without payment → HTTP `402` with terms JSON (price in USDT base units, `payTo`, nonce, expiry) — a PayeeShield-signed payment request
  - with a signed EIP-3009 `X-PAYMENT` → the existing relayer + observer settle it, then the endpoint returns the data + tx hash
- [ ] Publish it as an offer: `kind = "x402"`, `priceBase = 0.01`, `checkoutUrl = <endpoint URL>`.
- [ ] `apps/api/scripts/x402-demo-agent.ts` — the demo agent, ~80 lines:
  1. `select().from(Offer).where(and(eq("kind","x402"), lte("priceBase", dec(cap))))` **on Arkiv**
  2. verify listing signature + `$owner` + `payTo == registry.payout(merchantId)`
  3. sign + pay 0.01 USDT gaslessly (EIP-3009)
  4. call the endpoint → data. No gateway account, no dashboard, no human.
- [ ] MCP nicety: expose `discover_offers` as a tool in `packages/mcp` so Claude/Cursor agents can run the same Arkiv query natively.

**Done when:** the script runs end-to-end on camera: query → verify → pay → 200.

### Phase A7 — Submission pack + polish (est. 3h)

- [ ] README root section: **writer wallet address(es) + one runnable query** (track requirement) — placeholders below in §8.
- [ ] Fill every `> **Fill during build:**` marker in this folder.
- [ ] `friction.md` breakage log completed with real repro steps.
- [ ] Open-source license confirmed at repo root; AI-use disclosure written (ETHGlobal rules).
- [ ] Demo video: `/discover` browsing → agent discovering + paying the x402 route → tamper test.

**Done when:** a judge can run §8 without reading anything else.

## 8. How to verify (the judge version)

**Writer wallet(s)** — *fill during build, then copy into the root README:*

> `ARKIV_WRITER_ADDRESS = 0xTODO…` (publisher of all `wcgateway.*` entities)

**One runnable query — raw JSON-RPC, no SDK needed:**

```bash
# Finds x402 paid-API offers under 5 USDT that are still within their deadline,
# cheapest first. Requires no account — reads are permissionless.
curl "https://rpc.rabdi.db-chain.testnet.arkiv.network/$ARKIV_ACCESS_KEY" \
  -H "content-type: application/json" \
  --data @- <<'EOF'
{
  "jsonrpc": "2.0", "id": 1, "method": "arkiv_query",
  "params": [
    "arkiv.schema = str('wcgateway.offer') AND kind = str('x402') AND priceBase < dec(5) AND deadline > u64(1798761600) ORDER BY priceBase:dec ASC",
    { "select": { "key": true, "attributes": true }, "limit": "0xa" }
  ]
}
EOF
```

(Access key optional — omit `/$ARKIV_ACCESS_KEY` for the public RPC; it's just rate-limited. `deadline` is unix seconds; the constant above is 2027-01-01 UTC — bump it or drop that clause at judging time.)

**Same query through the SDK (committed as `apps/api/scripts/arkiv-query-demo.ts`):**

```ts
import { and, eq, lte, asc } from "@arkiv-network/sdk/query";

const { entities } = await arkivRead
  .select({ $key: true, $owner: true, $expiresAt: true, kind: true, priceBase: true, payTo: true, checkoutUrl: true })
  .from(Offer)
  .where(and(eq("kind", "x402"), lte("priceBase", dec("5"))))
  .orderBy(asc("priceBase"))
  .fetch();
```

**Also verifiable:** explorer https://rabdi.explorer.arkiv.network (entity by key), and the `/discover` page in the running app.

## 9. Known weaknesses (said out loud)

- **Single publisher wallet.** Entities are owned by *our* wallet in this build (merchants don't hold Arkiv testnet gas), so only we can edit or renew. Listing signatures limit forgery but not censorship — we can be pressured to unpublish, and if we vanish, listings expire within days instead of being renewed by merchants themselves. Post-hackathon: hand merchants a tiny gas stipend and `changeOwnership` each entity, or use `permissionlessExtension` per merchant. We deliberately did **not** turn on `permissionlessExtension` now — it would let strangers keep stale offers alive forever.
- **One more chain.** Rabdi is a separate chain and token (tGLM): another faucet, another key, another dependency.
- **No contract calls on Arkiv, no expiry events.** Enforcement lives on Whitechain by design; expiry is poll-and-renew, not an event we subscribe to.
- **Public data only.** Everything on Arkiv is readable by everyone — that's the point, but it means merchants who don't want to be listed must opt out, and we must keep PII off by construction.

## 10. Other tracks we considered (and why this one)

- **Mirror something Ethereum depends on** — attractive, but it's a data-import project (republishable licensed dataset + import script), not a payments product. Our offering *is* the directory itself; we're not mirroring someone else's dataset. Not entered.
- **Node tooling** — runs next to an Arkiv node, unrelated to the gateway's product. Not entered.
- **Arkiv + Swarm bonus ($500, stacks on top)** — compatible with this plan; merchant media (logos, product images) can live on Swarm with references inside our entities. Plan and required evidence: [`swarm.md`](swarm.md). We select it only if the core track work is green first.

## 11. Where everything lives

```
arkiv/
  README.md             ← you are here: plan + phase gates
  schema.md             ← entity tables, indexed columns, owner, expiry rules
  why-arkiv.md          ← the Postgres counterfactual, kept-off list, rejected idea
  how-you-use-arkiv.md  ← filters/ownership/expiry ↔ user-visible features
  reach.md              ← audience, try-it-today, after-Mumbai plan
  friction.md           ← feedback for the Arkiv team (live during build)
  swarm.md              ← Swarm bonus plan (optional)
apps/api/src/arkiv/     ← schema.ts · client.ts · publisher.ts        (Phase A1–A2)
apps/api/src/routes/v1/discover.ts · x402.ts                             (Phase A4, A6)
apps/api/src/worker.ts  ← arkiv-renew repeatable job                     (Phase A3)
packages/contracts/src/MerchantRegistry.sol                              (Phase A5)
apps/api/scripts/arkiv-query-demo.ts                                      (Phase A1)
```
