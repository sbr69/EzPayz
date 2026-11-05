# Arkiv Feedback — friction.md

> **Status: live during the build.** Sections 1 and 3 are feedback from designing against the docs (written before our first write, so nothing here is a fake bug report). Section 2 is the runtime log — every real breakage during the build gets an entry with a repro. Where an entry says *fill during build*, it becomes real evidence or gets deleted.

## 1. What got in our way at design time (from the docs, before writing code)

1. **The public RPC is deliberately rate-limited, and the access key is a third credential to manage.** Every other chain we use (Whitechain Sepolia) takes a plain RPC URL. Arkiv needs a hub-generated access key (`hub.arkiv.network/access-keys`), passed as URL path, `X-API-KEY`, or Bearer — *and* it's one key per wallet per network with a monthly cost-unit quota. For judges re-running our query that's a sign-up in the middle of a "permissionless reads" story. (It works without a key — just slowly.)
2. **Lifetimes are in blocks, not time.** `ExpirationTime.fromDays(30)` converts at an assumed 2 s/block, so a "30-day" entity is only as long as block time holds; `fromSeconds(3)` throws outright (not a multiple of 2 s). Our renewal worker therefore renews *early and often* instead of trusting the conversion — workable, but "expires at date X" being approximate surprised us; `atDate()` rounding helps.
3. **No expiry event.** We wanted to subscribe to "entity expired" to mirror deletions into Postgres. Arkiv's docs are upfront: *no event on expiry; poll `$expiresAt`*. So our worker polls both directions (renew what's alive, drop what's dead). A webhook/expiry event stream would remove a whole job from every mirroring integration.
4. **No contract calls, and no cross-chain reads.** Our enforcement check needs `MerchantRegistry.payout()` on Whitechain while the listing lives on Arkiv — the client must read two chains to trust one listing. We accept it (see [why-arkiv.md](why-arkiv.md) §4) but a documented cross-chain read primitive (or a CCIP-read-style callback) would make "discovery layer + enforcement chain" architectures much simpler.
5. **Query types are strict and the error is at the boundary.** `score = i32(4)` silently matches nothing if the column is `dec`; indexed-ness is enforced at write time via schema, but a raw `arkiv_query` string has no schema behind it — a judge mistyping `dec('5')` vs `dec(5)` (string vs bare) gets an empty result or a parse error with no lint. The TS SDK catches this at compile time (great — `InvalidPredicateError`); the raw language has no equivalent guard.
6. **32-attribute ceiling per entity** (31 for named schemas, since the tag takes one). We fit comfortably (13 + 9), but a "listing + 20 optional tags" design would hit it fast, and `arkiv.schema` counting against the limit is easy to forget when planning.

## 2. Runtime breakage log — *fill during build*

Format per entry: **what we expected → what happened → exact repro → what would have prevented it.**

| # | When | Expected | Happened | Repro (command/steps) | Suggestion |
|---|---|---|---|---|---|
| 1 | — | — | — | — | — |

Known constraints we're *expecting* to interact with (pre-logged so we remember to come back): faucet throughput at hackathon-hour; rate limits on the shared public RPC during demo day; `EntityTooLargeError` if a payload crosses 128 KiB (our payloads are ~1 KB, so we expect to never see it).

## 3. What we'd wish for (the "make building easier" list)

Ordered by how much time it would have saved us:

1. **Expiry events / webhook** — see 1.3. One feature, removes an entire polling worker from every integration that mirrors Arkiv.
2. **A "try it" query playground** — a public web console for `arkiv_query` against the testnet (like Sourcify's mirror page, but interactive). It would make judge-verification of *any* track project a click instead of a curl, and would have answered our raw-syntax questions (1.5) in seconds.
3. **Cross-chain read primitive** — see 1.4. Even a documented pattern (Oracle-adapter recipe) would help.
4. **SDK upsert helper** — our publisher's create-or-patch-or-delete dance (store entity key in Postgres, `patchEntity` if present, create if not, `deleteEntity` on off) is a universal shape for "DB as source of truth, Arkiv as public mirror." A `walletClient.upsertEntity(schema, naturalKey, values, { ttl })` with deterministic keys (`NO_SALT`) would collapse it.
5. **Human-readable expiry in reads** — `$expiresAt` is a block number; every UI recomputes "expires in 2 days" from block timing. Returning the resolved timestamp (the SDK already knows block time) would save every reader the math.
6. **Schema versioning story** — when we add a column to `wcgateway.offer`, old entities don't have it. `onMismatch: "skip"` handles reads, but a documented migration recipe (re-create vs patch) would be welcome.

## 4. What we liked (so the feedback isn't only a wish list)

- **The trust-model docs are honest.** "Anyone can write anything — filter by owner or unique schema tag" is in the fundamentals page, which is exactly why we designed signature+owner+registry checks instead of discovering it in production.
- **`$owner` + expiry on every entity** collapsed two hard problems (attribution and staleness) into two fields we didn't have to build.
- **The SDK is typed end-to-end** — schema columns, `dec()`/`u64()` value wrappers, compile-time filter checks. For a hackathon, that's the difference between "should work" and "does work."
- **Viem compatibility** — our whole stack (FE+BE) already runs viem; Arkiv clients were a drop-in, not a new ecosystem.
