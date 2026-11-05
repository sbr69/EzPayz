# 10 · Risks, gates and open questions

Use this file as the **single source of truth for what is verified**. Update it whenever a gate is tested.

## 1. Gates

| ID | Question | Why it matters | If it fails | Status | Evidence |
|---|---|---|---|---|---|
| G1 | Does `0xcedf…5a7` implement EIP-3009 `transferWithAuthorization` (and what ABI/domain)? | Gasless checkout, refunds, x402 all depend on it | Stop. Options: ERC-2612 `permit` if present (payer then needs `transferFrom` via a spender contract, still gasless for payer); smart-account + paymaster; or change idea. Never fake it | ☐ unverified | |
| G1b | Does it support `bytes signature` overload or only `v,r,s`? | Router ABI | Adapt router | ☐ | |
| G1c | Decimals, name, version, domain separator | Amount math, EIP-712 | n/a | ☐ | |
| G2 | MetaMask and a fallback wallet can sign typed data on chain 1874 | Payer UX | Add chain, use fallback wallet, or WalletConnect | ☐ | |
| G3 | Does CRE support Whitechain Sepolia (reads, writes)? Which triggers and languages? | CRE design | HTTP-only workflow + simulation; read events from supported chain or via gateway API | ☐ | |
| G4 | Arkiv SDK works, funding needed, expiry semantics, query syntax | Arkiv design | Use JSON-RPC; adjust schema | ☐ | |
| G5 | x402 EVM "exact" payload, nonce rules, current package APIs | Facilitator | Follow the spec exactly | ☐ | |
| G6 | Whitechain confirmation/"safe"/"finalized" exposure via RPC on Sepolia | Confirmation policy | Use block confirmations; disclose | ☐ | |
| G7 | Explorer contract verification method | Qualification | Try Blockscout-compatible or manual flattened upload | ☐ | |
| G8 | Is a Whitechain payout EOA signing refunds via EIP-3009 workable in the dashboard wallet flow? | Refund UX | Manual refund fallback | ☐ | |
| G9 | ETHGlobal rules: how many sponsor prizes/tracks per team; one project in both Whitechain tracks? | Submission | Choose tracks | ☐ | |

## 2. Product and business risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Scope too large | High | Cut line in 07; milestone M1 recording |
| Looks like a generic gateway | Medium | Lead with agents + non-custodial + contract-enforced rules |
| Another team ships a Whitechain x402 facilitator | Medium | Ours uses real USDT, shares limits/dashboard, ties into discovery; do not claim "first" |
| No real merchants or agents | High | Be honest: demo merchants are ours; seek 2–3 pilots after the event |
| Two chains/tokens (WBT + Arkiv testnet) complicate ops | Medium | Isolate Arkiv in a worker; never on critical path |
| Gas costs of sponsorship at scale | Medium | Budgets now; fee or prepaid gas later |
| Legal/regulatory (esp. India and cross-border crypto) | High for production | Testnet only; legal review before any pilot with real money |
| Single sequencer / finality assumptions | Medium | Confirmation policy; disclose |

## 3. Open questions (add more)

- Hackathon deadline and team size?
- Who owns the merchant owner wallet in the demo (a dedicated test wallet)?
- Do we publish an npm package or keep it workspace-only for the hackathon?
- Final product name?

## 4. Claims we must not make

- "First x402 on Whitechain."
- "Fully gasless" without qualifying that a wallet signature is still required.
- "Secure" or "audited."
- "WhiteBIT/EzPayz integrated."
- "Escrow" or "delivery guaranteed."
- Anything marked ☐ above as if it works.
