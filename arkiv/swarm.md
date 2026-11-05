# Arkiv + Swarm Bonus — Plan (`/arkiv/swarm.md`)

> **Status: planned, optional.** We select the Swarm bonus **only if the core Build-on-Arkiv track work (Phases A0–A5) is green first** — a half-wired bonus would endanger the main prize, and the bonus explicitly stacks on top of a track prize. Everything below is the plan we execute in a single sitting (~3–4 h) if we go for it; `> Fill` markers become real values during the build.

The one-sentence integration: **heavier public listing assets (merchant logos, product images, catalog exports) live on Swarm; the Arkiv entity stays a lightweight, filterable record whose payload carries the Swarm reference.**

## 1. What goes where

| Data | Stored on | Why |
|---|---|---|
| `merchant_profile` / `offer` entities (attributes + small JSON payload + signature) | **Arkiv** | Must be queryable (filters, numeric price search) and self-expiring. Arkiv's 128 KiB payload cap would allow small blobs, but queries never needed them. |
| Merchant logo, product images, long description page (HTML/PDF) | **Swarm** | Media blobs — no filter ever touches them; Swarm gives them decentralized, link-able persistence without bloating entities. |
| Per-merchant **catalog export** (all offers as one JSON) | **Swarm** | One-swallow read for aggregators that want everything from a merchant without paging through entities. Regenerated on every publish. |

**Entity field that holds the Swarm reference:** `mediaRef` (added to both schemas, `str`, non-indexed) holding the Swarm reference (bzz hash) — e.g. `"bzz://<reference>"` for the profile logo / offer image, and `catalogRef` on `merchant_profile` for the catalog export. The mapping is one-directional and public: entity → reference.

**Encryption note (the trap the bonus brief warns about):** an encrypted Swarm reference *contains its key* — putting one on a public Arkiv entity would publish the plaintext. Our bonus content is all **public** (logos, catalog JSON), so references go on-chain as-is. If we ever add buyer-private media, the encryption key stays off Arkiv (delivered out-of-band), and the encrypted reference only appears in a *private* channel — never in an entity.

## 2. Upload / read mechanics

- Bee node: local Bee (light node) against the Swarm testnet; upload via the Bee HTTP API (`POST /bzz?name=…`), *fill during build: which Bee/service we actually used*.
- Postage stamp: buy one batch (`POST /stamps/amount/depth`), reuse it for all uploads. **Fill:** batch ID `…` · wallet that bought it `0x…` (the gateway publisher wallet) · who funded it (team wallet).
- `mediaRef` values are written by the publisher (Phase A2 code path) right after upload, before `createEntity`/`patchEntity` — so an entity and its media go live together.

## 3. Files in the repo (will exist if we ship the bonus)

| File | Role |
|---|---|
| `apps/api/src/swarm/client.ts` | Bee HTTP client: upload (returns reference), download (verify), pin/refresh |
| `apps/api/src/swarm/publish.ts` | Renders logo/image/catalog-export → uploads → returns `mediaRef`/`catalogRef` |
| `apps/api/src/arkiv/publisher.ts` | Writes the references into the entities (one extra field on the existing path) |

## 4. Steps to run one upload + one read ourselves

1. `bee start` (config in `apps/api/src/swarm/README.md` — *fill during build*), fund postage batch: `curl -X POST localhost:1633/stamps/100000000/18`
2. Upload: `pnpm --filter api exec tsx src/swarm/publish.ts --merchant acme` → prints the reference
3. Read: open `https://gateway.ethswarm.org/bzz/<reference>` (or `GET localhost:1633/bzz/<reference>`) → the logo renders
4. Verify the chain: `arkiv_query` for the merchant profile → its payload contains `"mediaRef": "bzz://<same reference>"`

**Fill during build:** actual reference (one entity key + the Swarm reference it points to, with a link that opens), batch ID, Bee endpoint, and the demo-video timestamp where Swarm is used.

## 5. Friction (Swarm side)

Filled after the build if we attempt it — current expectation: postage-batch economics on testnet and running a light Bee on a hackathon laptop are the two known annoyances.
