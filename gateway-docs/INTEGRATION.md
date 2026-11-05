# INTEGRATION.md: Why Whitechain, Arkiv and Chainlink

> **Purpose.** Answer, honestly, the question *"why did you use X?"* for each sponsor, show which tracks we qualify for, and keep us from claiming more than we built.
>
> **Method.** For every integration we state (1) the product need, (2) what we do with it, (3) the **removal test**: what the product loses without it, (4) why not the obvious alternative, and (5) the honest weaknesses. If an integration fails the removal test it should be cut, not defended.

The product was designed from a real problem first (merchants and agents need a self-serve, non-custodial, gas-free way to get paid in USDT with verifiable records). The sponsors were then evaluated for fit. Where fit is weaker, this file says so.

---

## 0. Summary

| Sponsor | Role in the product | On the critical payment path? | Removal test |
|---|---|---|---|
| **Whitechain** | Settlement chain: USDT, `MerchantRegistry`, `GatewayRouter`, gasless EIP-3009 | **Yes** | Product ceases to exist |
| **Arkiv** | Public, expiring, queryable merchant profiles and offers; discovery for humans **and agents** | No | Lose open discovery without us as gatekeeper; lose self-expiring offers |
| **Chainlink CRE** | Decentralized fulfilment check that turns "paid" into "paid and delivered, or flagged" | No | Lose tamper-evident, neutral fulfilment verification and automatic exception raising |

Rule we enforce in code: **Arkiv and CRE can fail and checkout still works.**

---

## 1. Whitechain

### 1.1 The product need
Merchants need a place to receive **USDT** cheaply and quickly, with enough contract support to enforce the payout address and refund caps, and customers must not need the chain's gas token. Agents need to pay tiny amounts per call, which only works if each payment costs a fraction of a cent.

### 1.2 What we use
- Real test **USDT** (`0xcedf…5a7`) as the settlement asset.
- **`MerchantRegistry`** and **`GatewayRouter`** deployed and verified on Whitechain Sepolia (chain ID 1874).
- **EIP-3009** authorizations so the payer signs and the relayer pays **WBT** gas. *(Subject to gate G1.)*
- Plain EVM tooling (Foundry, viem), which keeps the code portable.

### 1.3 Why Whitechain, honestly
1. **A gap exists.** From our research: the established merchant option on the Whitechain side (WhitePay) is an exchange-run, account-based processor; the one public Whitechain x402 facilitator we found settles a *test credit token*, not USDT. A **self-serve, non-custodial, USDT gateway with contract-enforced rules** is not what we found. *(Research as of 31 Oct 2026; verify before claiming in public.)*
2. **Distribution and funding path.** Whitechain is positioned as an exchange-backed L2 (WhiteBIT / W Group) with a Builders Program that offers milestone-based funding and values verifiable on-chain activity. A gateway is exactly the kind of infrastructure that generates repeat, measurable on-chain usage.
3. **Cheap, fast settlement.** Their docs describe sub-cent fees and fast soft confirmations, which suits micropayments and agent traffic. *(Unverified on testnet; measure and report.)*
4. **Bridges for USDT.** Their Portal bridge connects Ethereum and Tron USDT to Whitechain, giving merchants a way to fund and exit. *(Not integrated in this build.)*
5. **Standard EVM.** Nothing we build locks us in; that lowers risk for merchants.

### 1.4 Why not another chain (honest)
Base, Arbitrum and others have **more users, more wallets and more mature x402 and USDC tooling**. A merchant who only wants reach would be better served there. Our argument for Whitechain is ecosystem-specific: there is an unfilled niche, a builder-funding path, and exchange-linked distribution. Because the code is plain EVM, a second chain is a configuration change plus a re-verification, which we state as a *future* option, not a current capability.

### 1.5 Removal test
Without Whitechain there is no USDT balance to settle, no registry/router, no verified receipts. **Fails removal test → it is essential.**

### 1.6 Weaknesses to admit
Smaller ecosystem and wallet base; single sequencer; slow native withdrawals to L1; testnet only; token EIP-3009 support unverified until G1.

### 1.7 Draft for the required README line (edit after G1)
> **Why on-chain stablecoin settlement on Whitechain?** A card or bank rail cannot give a small merchant, an AI agent, and a customer the same three things at once: (1) instant, final USDT settlement straight into the merchant's own wallet with no processor balance in between, (2) a receipt and refund cap that anyone can verify on a public chain and that the gateway itself cannot override (the router only pays the registered payout and caps refunds on-chain), and (3) per-request machine payments of fractions of a cent, with the payer needing no gas token. Whitechain gives us cheap, fast EVM settlement of the specified USDT and a path to real usage through its ecosystem.

---

## 2. Arkiv

### 2.1 The product need
Two groups need to find each other without a gatekeeper:
- **Humans** browsing merchants who accept USDT.
- **Agents** that must programmatically discover paid APIs and their prices, then pay.

Listings should **disappear when stale** (an offer past its deadline, a service that stopped renewing) and should be **verifiably tied to the merchant** so nobody can swap in their own payout address.

### 2.2 What we use
- `merchant_profile` and `offer` entities, each with attributes for filtering (`kind`, `category`, `priceBase` numeric, `merchantId`) and a payload with a **PayeeShield listing signature**.
- Expiry = the offer's deadline or a renewal window; a worker renews live offers.
- A user-visible feature that **reads** Arkiv: `/discover` and `GET /v1/discover`, plus the demo agent discovering an x402 route by querying (`kind = "x402" AND priceBase < …`).
- Before payment, the client checks `offer.payTo == MerchantRegistry.payout(merchantId)` and the listing signature.

### 2.3 Why Arkiv rather than Postgres
If this were only our Postgres:
- Discovery would depend on **our API staying up and willing to serve** it; third parties and agents could not query it independently.
- Expiry would be a cron job we promise to run, not a property of the record.
- Nothing about the listing would be independently attributable to a wallet.

With Arkiv, anyone can run the same filtered query without asking us, listings **self-expire**, and entities are wallet-attributed. This is genuinely better for a *public directory* of offers.

### 2.4 What we kept off Arkiv, and why
Customer PII, payments, receipts, refunds, invoice details, secrets: public chain data and commercial privacy do not mix. Settlement truth stays on Whitechain and Postgres. See `docs/03-DATA-MODEL.md` §2.5.

### 2.5 Earlier idea we rejected
We first considered putting the **payout-address registry** on Arkiv. We moved it to `MerchantRegistry` on Whitechain because the rule must be enforced **at settlement time on the settlement chain**, and Arkiv has no contract calls and is a separate chain. Arkiv is the **discovery layer**; the registry is the **enforcement layer**. The two are cross-checked.

### 2.6 Removal test
Without Arkiv, checkout and refunds still work, but we lose open, independent, self-expiring discovery and the agent-discovery story. **Passes as a real feature, not a payments dependency.** If we run short on time, Arkiv is the first thing cut (and we drop that track rather than fake it).

### 2.7 Weaknesses to admit
- Entities are owned by our publisher wallet in this build (merchants don't hold Arkiv testnet gas), so only we can edit or renew them. Listing signatures limit forgery but not censorship.
- Arkiv testnet is a separate chain and token; one more operational dependency.
- No contract logic on Arkiv; no expiry event, so we poll.
- Public data only. Merchants who don't want to be listed can opt out.

### 2.8 Eligibility notes
Track: **Build on Arkiv (from scratch)**. Needs: built from scratch at the event; writes to Arkiv testnet with `@arkiv-network/sdk` or JSON-RPC; at least one user-visible feature reads Arkiv data; README lists writer wallet(s) and one runnable query; `/arkiv/schema.md`, `friction.md`, `reach.md`, `why-arkiv.md`, `how-you-use-arkiv.md`; open-source license; AI-use disclosure. Not counted: SDK installed but unused, or Arkiv as a write-only log. One Arkiv track prize per team.

---

## 3. Chainlink CRE

### 3.1 The product need
Payment proves the customer paid, not that the merchant delivered. Merchants and customers both benefit from an **automatic, neutral check** that flags orders not fulfilled by a deadline, **without us (the gateway) being the only party asserting it**.

### 3.2 What we use
A CRE workflow `fulfilment-watch`:
1. **Trigger:** cron (and, if supported on Whitechain, a `PaymentSettled` log trigger).
2. **Read:** get payments past their fulfilment deadline from our API (and, where possible, confirm the settlement on-chain).
3. **External call:** HTTP GET each merchant's fulfilment endpoint (`/orders/:reference/status`). Multiple nodes execute and reach consensus on the result.
4. **Report:** `{paymentId, status: fulfilled | not_fulfilled | unreachable, evidenceHash}` → our API (and on-chain write-back if supported).
5. **Effect:** `not_fulfilled` creates an exception and a **suggested refund**. The merchant must approve; we never refund automatically.

This integrates a blockchain with an external API and system, which is what the CRE track asks for.

### 3.3 Why CRE rather than a cron job in our backend
- **Neutrality:** a cron job on our server means *we* say "not fulfilled". A CRE workflow is executed by a decentralized network with consensus on the HTTP result, and can attest the outcome on-chain. Merchants and customers need not trust only our word.
- **Same code path for any external system:** accounting, ERP, shipping or an LLM check can be added as steps without new infrastructure.
- **Tamper-evidence:** the `evidenceHash` in the report lets anyone check which response was observed.

### 3.4 Removal test
Without the workflow, merchants still get paid, but "paid and not delivered" is detected only by the customer complaining or by a trusted cron in our backend. **Passes, but it is an enhancement, not essential.** The workflow must be genuinely wired to the dashboard so a judge can see the exception appear.

### 3.5 Weaknesses to admit (say them before they're asked)
- The merchant's fulfilment endpoint is **merchant-controlled**. CRE proves what it *observed*, not that goods were really delivered. We do not claim escrow or delivery guarantees.
- CRE support for Whitechain Sepolia is **unverified (gate G3)**. If unsupported we run the workflow in **simulation** (sufficient to qualify) against our API, and describe on-chain write-back as future work.
- Added complexity for a $1.5k track; if schedule slips, cut it.

### 3.6 Eligibility notes
Track: **Best workflow with CRE.** Needs: build, simulate or deploy a CRE workflow used as an orchestration layer in the project; integrates at least one blockchain with an external API/system/data source/LLM/agent; successful simulation via CRE CLI (or live deploy); meaningfully used. Keep the simulation output (screenshot or log) in the repo.

*We are **not** using CCIP, Data Feeds or Data Streams. Do not claim them.*

---

## 4. Tracks and prizes (from the brief; re-check live)

| Sponsor track | Prize pool | Fit | Core requirements we must meet |
|---|---|---|---|
| **Whitechain · Operate** (stablecoin payments for business) | $5,000 (2,500 / 1,500 / 1,000) | **Strong** | Drop-in piece added by a *separate demo app* in ~20 lines; merchant and customer views; verified contracts on 1874; ≥1 payment in the **real USDT** with explorer link; "why onchain stablecoin settlement" README line; public repo with steady commits; 2–4 min video with each party; `WHITECHAIN_FEEDBACK.md`. Extra credit: refunds, exports |
| **Whitechain · Scale** (payments nobody notices) | $3,000 (2,000 / 1,000) | **Strong** (gasless checkout + x402) | Zero crypto steps visible for the payer; explain how business pays gas, how relayer gets WBT, what stops draining; real payments |
| **Arkiv · Build on Arkiv** | $4,000 (3,000 / 1,000) | **Medium-strong** if discovery works | See §2.8 |
| **Chainlink · Best workflow with CRE** | $1,500 | **Medium** | See §3.6 |
| Whitechain · Tokenize | n/a | Not a fit | |
| Arkiv · Mirror | n/a | Not a fit (requires mirroring existing public data) | |
| Arkiv + Swarm bonus | $1,000 | Not planned | Would need real Swarm use (e.g., encrypted receipt bundles); skip unless time allows |
| Chainlink · CCIP | n/a | Not used | |

### Whitechain "won't place" check
| Won't place | Our status |
|---|---|
| Pay button that sends a plain transfer | We enforce payout, nonce binding, one-shot settlement and refund caps **in `GatewayRouter`** |
| Tipping jars, bill splitters, custodial bridges | No |
| Payroll, escrow, revenue splits on their own | No |
| Payer signs a tx that costs them gas | No: signature only |
| AI chats that never pay anyone | Agent pays real USDT over x402 |

### Rules to confirm (gate G9)
- ETHGlobal says Arkiv's prizes count as **one** partner prize among a team's **three** picks. Whitechain + Arkiv + Chainlink = three partners. Confirm whether entering both Whitechain tracks consumes one or two picks.
- Arkiv requires **built from scratch at the event**. Start the repo fresh; prior planning documents are not code, but disclose them. Commit history must show the build happening during the event.
- Prize amounts and requirements may change; re-read the live pages before submitting.

---

## 5. Judge Q&A (rehearse these)

**Q: Why Whitechain and not Base or Arbitrum?**
A: Those have more users and mature tooling, and if reach were the goal we'd go there. We chose Whitechain because there's an unfilled niche for a non-custodial, USDT-native gateway, an exchange-linked distribution path and a builder program. The code is plain EVM, so porting is a re-verification, not a rewrite. We haven't tested other chains.

**Q: Isn't this just a payment link app?**
A: Payment links are one surface. The router enforces the payout address and refund caps on-chain, binds each authorization to one invoice, and the same account settles human checkouts and agent x402 calls with shared gas limits.

**Q: What stops someone draining your relayer?**
A: An allowlist of one contract and three functions, signature and balance validation plus simulation before sending, per-merchant/per-payer/global budgets, rate limits, a circuit breaker and a pause switch. Attackers can't move anyone's funds; at worst they trigger bounded sponsored gas.

**Q: How does the relayer get WBT?**
A: Testnet faucet today. On mainnet we'd buy WBT and recover cost through per-transaction fees or merchant-prepaid gas budgets. That commercial policy isn't decided.

**Q: What if your server is hacked and shows the wrong address?**
A: The router pays only the address in `MerchantRegistry`, which only the merchant's owner wallet can change. PayeeShield also makes checkout flag mismatches.

**Q: Is it really gasless for the payer?**
A: For gas, yes: they sign one typed-data message. They still need a wallet and USDT. We don't claim to remove wallet interaction.

**Q: Why Arkiv instead of Postgres?**
A: For *public discovery*: anyone, including agents, can query listings without our API, listings expire by themselves, and entities are wallet-attributed. Settlement data and PII are not on Arkiv. Honest limit: entities are owned by our publisher wallet in this build.

**Q: What happens if Arkiv or CRE is down?**
A: Nothing on the payment path changes. Discovery degrades, fulfilment status stays "unknown".

**Q: Why CRE and not a cron job?**
A: A cron job makes us the only voice saying "not delivered". CRE runs the HTTP check across a decentralized network with consensus and can attest the result. The merchant's endpoint is still merchant-controlled, so we do not claim proof of delivery.

**Q: Does it hold customer funds? Is it escrow?**
A: No. Payer → merchant wallet directly. Not escrow; refunds are separate transfers from the merchant wallet, capped on-chain.

**Q: Who is this for, and will you keep building?**
A: Small online businesses and API providers that want USDT revenue without a processor account, plus agent developers who need to pay for APIs. Next: find 2–3 pilot merchants, run a small mainnet pilot, apply to the Builders Program with real metrics. *(Plans, not commitments; say only what you will do.)*

**Q: What's the business model?**
A: Per-settlement fee, gas-budget subscriptions, premium reconciliation, white-label. These are assumptions; we have no revenue evidence.

**Q: What didn't you finish?**
A: Answer from the README's "Current limitations", which must be true. Examples: EOA-only payout wallets, key storage not in KMS, no subscriptions, no fiat off-ramp.

---

## 6. Integration integrity checklist (before submitting)

- [ ] For each sponsor, I can state the removal test result in one sentence.
- [ ] Every claim in README and video is backed by a tx hash, query output, simulation log or test.
- [ ] No sponsor feature is described as working if its gate is still ☐.
- [ ] Arkiv: a user-visible feature reads from it; README has writer wallet(s) and a runnable query.
- [ ] CRE: simulation log saved; workflow output visibly changes the dashboard.
- [ ] Whitechain: explorer link to a payment in the required USDT; verified contracts; feedback file is honest.
- [ ] "Current limitations" in README matches §§1.6, 2.7, 3.5 here.
