# 11 · Submission checklist and templates

Re-read the live prize pages before submitting; requirements can change.

## 1. Global

- [ ] Public GitHub repo, open-source license (`LICENSE`).
- [ ] Commit history shows steady progress, with the first commit after the event started.
- [ ] README: setup, architecture, current limitations (see §2).
- [ ] `AI_USAGE.md`: how AI tools were used (ETHGlobal requires disclosure).
- [ ] Demo video 2–4 minutes showing **each party**: merchant, payer, agent.
- [ ] Project submitted to the three partner prizes (Whitechain, Arkiv, Chainlink) and tracks selected.
- [ ] Fresh-clone test: a stranger can run it from the README.

## 2. README outline

1. What it is (one paragraph) and screenshots/GIF.
2. **Why on-chain stablecoin settlement on Whitechain** (from `INTEGRATION.md` §1.7).
3. Quick start (env, faucet funding, `pnpm i`, `pnpm dev`, demo-store, demo-agent).
4. Architecture diagram (from `02-ARCHITECTURE.md`).
5. **Deployed contracts** (addresses + explorer links, verified).
6. **Proof of payment in the required USDT:** explorer tx link(s) for checkout, refund, x402.
7. Arkiv: writer wallet(s) + **one runnable query** + link to `/arkiv/*.md`.
8. CRE: how to run the simulation, sample output.
9. The "~20 lines" integration snippet and its line count.
10. **Current limitations** (honest list).
11. Links: video, docs, feedback.

## 3. Whitechain (Operate + Scale)

- [ ] Contracts deployed on Sepolia 1874 and verified on the explorer.
- [ ] ≥1 payment in `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` through the main flow; explorer link in README. (Not a self-minted token.)
- [ ] "Why on-chain stablecoin settlement on Whitechain / what a regular rail couldn't do" line in README.
- [ ] Separate demo app integrates in ≈20 lines; merchant **and** customer views in the demo.
- [ ] Extra credit: refund and/or export.
- [ ] Scale: payer flow with **zero crypto steps visible** (no WBT, no chain knowledge); explain who pays gas, how the relayer gets WBT, what stops draining; agent actually pays.
- [ ] `WHITECHAIN_FEEDBACK.md` (template below).

## 4. Arkiv (Build on Arkiv)

- [ ] Built from scratch at the event; public repo; open-source license; AI-use statement.
- [ ] Writes to Arkiv's current testnet via `@arkiv-network/sdk` (or JSON-RPC).
- [ ] A user-visible feature reads data from Arkiv.
- [ ] README: writer wallet address(es) and one query judges can run.
- [ ] `/arkiv/schema.md`, `/arkiv/friction.md`, `/arkiv/reach.md`, `/arkiv/why-arkiv.md`, `/arkiv/how-you-use-arkiv.md`.
- [ ] Each answers its criterion's questions with links, numbers or runnable queries.
- [ ] Not just a write-only log; SDK actually used for reads.

## 5. Chainlink (CRE)

- [ ] CRE workflow in `workflows/cre/` that integrates a chain with an external API/system.
- [ ] Successful `cre workflow simulate` (or live deploy), log saved in `workflows/cre/SIMULATION.md`.
- [ ] Workflow meaningfully used: its output creates the `not_fulfilled` exception in the dashboard.
- [ ] README states clearly what is simulated vs deployed.

## 6. Templates

### 6.1 `WHITECHAIN_FEEDBACK.md`
```md
# Whitechain feedback
Team / date / what we built (2 lines).

## What worked
- (e.g., RPC stability, faucet speed, EIP-3009 on the test USDT, explorer verification)

## Where we got stuck
- Symptom → what we expected → what happened → how we resolved it → time lost

## What the docs were missing
- (e.g., EIP-3009 support on the test USDT; finality timings on Sepolia; CRE/x402 notes; explorer verification steps)

## Suggestions
- 3 concrete requests, ordered by impact.
```

### 6.2 `/arkiv/schema.md`
```md
# Schema
## Entities
| Type | Owner | Key attributes (queried) | Payload | Expiry |
|---|---|---|---|---|
| sg.merchant_profile | publisher wallet 0x… | merchantId, category, chainId | displayName, website, listingSig | 30 days, renewed |
| sg.offer | publisher wallet 0x… | merchantId, kind, category, priceBase(number) | endpoint, payTo, title, listingSig | offer deadline / 7 days renewed |
## Who can edit
Only the publisher wallet; listings carry the merchant's signature; consumers verify payTo against MerchantRegistry.
## Queries we run
(list exact queries used by /discover and demo-agent)
```

### 6.3 `/arkiv/friction.md`
```md
# Friction and feedback
## What to improve today
- Item: what got in our way / what we wished existed
## Something broke
- Expected → Actual → Steps to reproduce → Environment (SDK version, date)
```

### 6.4 `/arkiv/reach.md`
```md
# Reach
Who is it for, and would they use it? (named personas, any pilots, any messages sent)
Can they try it today? (URL, test steps)
Will we keep building after Mumbai? (concrete next steps, dates)
```

### 6.5 `/arkiv/why-arkiv.md`
```md
# Why Arkiv
If we swapped Arkiv for Postgres, users would lose: (open independent queries, self-expiring offers, wallet attribution…)
What we kept off Arkiv and why: (PII, receipts, invoices, secrets)
```

### 6.6 `/arkiv/how-you-use-arkiv.md`
```md
# How we use Arkiv
Filters we use and why they match user behavior
Who can edit each entity and why
Expiry choices and renewal
For each Arkiv feature: what the user sees change
```

### 6.7 `AI_USAGE.md`
```md
# AI usage
Tools used (assistant/IDE), for what (docs drafting, scaffolding, test generation),
what was reviewed and verified by a human, what was written without AI.
```

### 6.8 `workflows/cre/SIMULATION.md`
```md
# CRE simulation
Command run, date, CLI version, output (paste), what the output proves, what is not covered.
```

## 7. Demo video (2–4 min). Shot list

See `01-PRODUCT.md` §10. Show **three** parties: merchant, payer, agent. Include: wallet with no WBT, explorer link, tampered invoice rejected, refund cap, x402 payment, `/discover` from Arkiv, CRE simulation flagging an exception, and an on-screen limitations slide.

## 8. Final 30-minute freeze

1. Fund the relayer; check budgets.
2. Fresh clone, install, run.
3. Click every README link.
4. Confirm contract verification on the explorer.
5. Re-run the demo path once.
6. Submit; save confirmation.
