# Whitechain Feedback

Honest notes on building a non-custodial USDT payment gateway on Whitechain Sepolia.

## What worked well

- **EIP-3009 on the test USDT is fully functional.** The TetherTokenV2 (behind an EIP-1967 proxy) implements `transferWithAuthorization`, `receiveWithAuthorization`, `cancelAuthorization`, `authorizationState`, AND exposes the typehashes (`TRANSFER_WITH_AUTHORIZATION_TYPEHASH()` etc.) + `DOMAIN_SEPARATOR()` on-chain. This made the gasless one-time payment + sponsored refund flows clean to build + verify. The gasless e2e settled a real 0.01 USDT transfer with the relayer paying WBT gas.
- **Fast finality.** ~1 second/block on Sepolia meant settlement confirmation was quick (5 blocks ≈ 5s for `finalized`).
- **Blockscout explorer + API.** The v2 API (`/api/v2/smart-contracts/{address}`) returned the verified ABI + metadata, which let us confirm the EIP-3009 interface + the proxy→implementation relationship programmatically. Source verification via the flattened-code endpoint worked once `evm_version` was included.
- **EVM compatibility.** Standard viem/wagmi tooling worked out of the box (no Whitechain-specific SDK needed). The chain definition is a one-liner `defineChain({ id: 1874, ... })`.

## What was difficult / docs gaps

- **The faucet dispenses WBT only** (no test USDT). The required test USDT (`0xcedfB5…`) has no public CLI faucet + `mint` is owner-only. We had to source test USDT from the account owner. A public test-USDT faucet (or a mintable test token) would make onboarding much smoother.
- **The faucet API deprecated regional databases** (Upstash, not Whitechain — but it affected us). The regional Redis creation endpoint returns "regional db creation is deprecated"; the docs didn't surface the global-database flow clearly. (We created the Redis DB via the console.)
- **Blockscout verification via `forge verify-contract --verifier blockscout` didn't work** — foundry's blockscout verifier hits an etherscan-style `getabi` call this Blockscout version rejects ("Unknown API v2 action"). We verified via the flattened-code curl endpoint instead (with `evm_version` included — without it, the bytecode didn't match).
- **The whitechain-dev skill's `nonce(address)` reference** — the actual function on TetherTokenV2 is `nonces(address)` (plural); the canonical EIP-3009 replay check is `authorizationState(address,bytes32)`. Minor, but worth correcting in docs.
- **No embedded wallet / account abstraction** on Whitechain (yet) — the gasless flow relies on the payer having an external EVM wallet (MetaMask) to sign the EIP-3009 authorization. This is fine for the current flow but limits UX for wallet-less payers.

## Suggestions

1. **Add a public test-USDT faucet** (or make the test USDT mintable for test accounts). This is the single biggest friction for anyone building against the required test token.
2. **Document the `evm_version` requirement** for Blockscout source verification (paris vs the default).
3. **Clarify the Upstash/Redis regional→global transition** if it affects Whitechain builders using Upstash.
4. **Consider an account-abstraction / paymaster flow** for truly wallet-less checkout (the current EIP-3009 relayer is gasless for the payer but still requires a signer wallet).

## Overall

Building a full payment gateway (one-time + recurring + refunds + webhooks + SDK) on Whitechain was straightforward once the EIP-3009 + ERC-20 behavior was confirmed. The chain is fast, EVM-compatible, and the USDT's EIP-3009 support is excellent for gasless payment flows. The main friction was sourcing test USDT — everything else (contracts, RPC, explorer) worked well.
