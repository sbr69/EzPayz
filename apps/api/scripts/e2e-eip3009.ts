// Phase 0.3 — EIP-3009 end-to-end verification against the required test USDT
// on Whitechain Sepolia. See docs/EIP3009_VERIFICATION.md.
//
// Modes:
//   - PROBE (default when TEST_PAYER_PRIVATE_KEY is unset): read-only structural
//     validation. Confirms the on-chain TRANSFER_WITH_AUTHORIZATION_TYPEHASH and
//     DOMAIN_SEPARATOR match the EIP-712 structure this gateway will sign. No
//     funds, no key, no transaction.
//   - FULL (when TEST_PAYER_PRIVATE_KEY + TEST_PAYER_ADDRESS are set in the
//     repo-root .env): signs a real TransferWithAuthorization, submits it (payer
//     self-pays WBT gas), verifies settlement, checks authorizationState flips
//     to Used, and confirms replay is rejected.
//
// Run: pnpm --filter @ezpayz/api exec tsx scripts/e2e-eip3009.ts

import { createPublicClient, createWalletClient, http, keccak256, encodeAbiParameters, encodePacked, formatUnits, parseUnits, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

// ---- load repo-root .env (does not fail if absent; probe mode then) ----
function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), "../../.env"), // run via pnpm --filter api (cwd = apps/api)
    path.resolve(process.cwd(), ".env"), // run from repo root
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      for (const line of fs.readFileSync(p, "utf8").split("\n")) {
        const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
      console.log(`[env] loaded ${p}`);
      return;
    }
  }
  console.log("[env] no .env found — running probe-only mode");
}
loadEnv();

const CHAIN_ID = 1874;
const RPC = "https://rpc.testnet.whitechain.io";
const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7" as `0x${string}`;

const CHAIN = defineChain({
  id: CHAIN_ID,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://explorer.testnet.whitechain.io" } },
});

const USDT_ABI = [
  { inputs: [], name: "name", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "DOMAIN_SEPARATOR", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "TRANSFER_WITH_AUTHORIZATION_TYPEHASH", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "address" }, { type: "bytes32" }], name: "authorizationState", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  {
    inputs: [
      { type: "address" }, { type: "address" }, { type: "uint256" },
      { type: "uint256" }, { type: "uint256" }, { type: "bytes32" }, { type: "bytes" },
    ],
    name: "transferWithAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const TYPEHASH_SOURCE = "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)";
const DOMAIN_TYPEHASH_SOURCE = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
const h = (s: string): `0x${string}` => `0x${Buffer.from(s, "utf8").toString("hex")}`;

async function main() {
  const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC) });

  const [name, symbol, decimals, domainSep, typehashOnChain] = await Promise.all([
    publicClient.readContract({ address: USDT, abi: USDT_ABI, functionName: "name" }),
    publicClient.readContract({ address: USDT, abi: USDT_ABI, functionName: "symbol" }),
    publicClient.readContract({ address: USDT, abi: USDT_ABI, functionName: "decimals" }),
    publicClient.readContract({ address: USDT, abi: USDT_ABI, functionName: "DOMAIN_SEPARATOR" }),
    publicClient.readContract({ address: USDT, abi: USDT_ABI, functionName: "TRANSFER_WITH_AUTHORIZATION_TYPEHASH" }),
  ]) as [string, string, number, `0x${string}`, `0x${string}`];

  console.log("=== USDT on-chain ===");
  console.log("name:", name);
  console.log("symbol:", symbol);
  console.log("decimals:", decimals);
  console.log("DOMAIN_SEPARATOR:", domainSep);
  console.log("TRANSFER_WITH_AUTHORIZATION_TYPEHASH:", typehashOnChain);

  const typehashComputed = keccak256(h(TYPEHASH_SOURCE));
  console.log("typehash computed:", typehashComputed);
  const typehashMatch = typehashComputed.toLowerCase() === domainSep.toLowerCase(); // placeholder, fixed below
  const typehashOk = typehashComputed.toLowerCase() === typehashOnChain.toLowerCase();
  console.log("typehash match (computed vs on-chain):", typehashOk);

  // Brute-force the EIP-712 domain (name x version) against the on-chain DOMAIN_SEPARATOR.
  const domainTypehash = keccak256(h(DOMAIN_TYPEHASH_SOURCE));
  let domainFound: { name: string; version: string } | null = null;
  for (const version of ["1", "2"]) {
    const candidate = keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }, { type: "address" }],
        [domainTypehash, keccak256(h(String(name))), keccak256(h(version)), BigInt(CHAIN_ID), USDT],
      ),
    );
    if (candidate.toLowerCase() === domainSep.toLowerCase()) {
      domainFound = { name: String(name), version };
      break;
    }
  }
  console.log("domain match (name+version):", domainFound ?? "NOT FOUND — inspect verified contract source");

  const payerKey = process.env.TEST_PAYER_PRIVATE_KEY;
  const payerAddr = process.env.TEST_PAYER_ADDRESS;
  if (!payerKey || !payerAddr) {
    console.log("\n[probe] read-only structural validation complete.");
    console.log("[probe] typehash ok:", typehashOk);
    console.log("[probe] domain ok:", !!domainFound);
    console.log("[probe] Set TEST_PAYER_PRIVATE_KEY + TEST_PAYER_ADDRESS in repo-root .env to run the full e2e test.");
    process.exit(typehashOk && domainFound ? 0 : 2);
  }

  // ---- FULL e2e ----
  const pk = /^0[xX]/.test(payerKey) ? payerKey : `0x${payerKey}`;
  const realAccount = privateKeyToAccount(pk as `0x${string}`);
  if (realAccount.address.toLowerCase() !== payerAddr.toLowerCase()) {
    throw new Error(`TEST_PAYER_ADDRESS (${payerAddr}) does not match the address derived from TEST_PAYER_PRIVATE_KEY (${realAccount.address}).`);
  }
  const recipient = (process.env.TEST_RECIPIENT_ADDRESS || payerAddr) as `0x${string}`;
  const walletClient = createWalletClient({ account: realAccount, chain: CHAIN, transport: http(RPC) });

  const [payerBal, recipientBalBefore, nativeBal] = await Promise.all([
    publicClient.readContract({ address: USDT, abi: USDT_ABI, functionName: "balanceOf", args: [payerAddr as `0x${string}`] }),
    publicClient.readContract({ address: USDT, abi: USDT_ABI, functionName: "balanceOf", args: [recipient] }),
    publicClient.getBalance({ address: payerAddr as `0x${string}` }),
  ]) as [bigint, bigint, bigint];

  console.log("\n=== balances ===");
  console.log("payer USDT:", formatUnits(payerBal, decimals));
  console.log("recipient USDT (before):", formatUnits(recipientBalBefore, decimals));
  console.log("payer WBT:", formatUnits(nativeBal, 18));

  if (payerBal < parseUnits("0.01", decimals)) {
    throw new Error(`Payer has insufficient test USDT for the 0.01 USDT test transfer (balance: ${formatUnits(payerBal, decimals)} USDT).`);
  }
  if (nativeBal === 0n) {
    throw new Error("Payer has 0 WBT for gas. Claim WBT from the faucet first.");
  }
  if (!domainFound) {
    throw new Error("EIP-712 domain not matched — refusing to sign. Inspect the verified contract source for the real name/version.");
  }

  const PREFLIGHT = process.argv.includes("--preflight");
  if (PREFLIGHT) {
    console.log("\n=== PREFLIGHT (no transaction will be submitted) ===");
    console.log("from (payer):", payerAddr);
    console.log("to (recipient):", recipient, recipient.toLowerCase() === payerAddr.toLowerCase() ? "(self-transfer — no funds lost)" : "");
    console.log("value: 0.01 USDT (10000 base units, decimals=" + decimals + ")");
    console.log("authorization: TransferWithAuthorization (validAfter=now-60s, validBefore=now+600s, random nonce)");
    console.log("gas payer: payer (self-submits, pays WBT gas)");
    console.log("EIP-712 domain:", domainFound);
    console.log("=== End preflight. Re-run without --preflight to submit the real transaction. ===");
    process.exit(0);
  }

  const value = parseUnits("0.01", decimals);
  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(now - 60);
  const validBefore = BigInt(now + 600);
  const nonce = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;

  const domain = { name: domainFound.name, version: domainFound.version, chainId: CHAIN_ID, verifyingContract: USDT } as const;
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  } as const;
  const message = { from: payerAddr as `0x${string}`, to: recipient, value, validAfter, validBefore, nonce };

  const stateBefore = (await publicClient.readContract({ address: USDT, abi: USDT_ABI, functionName: "authorizationState", args: [payerAddr as `0x${string}`, nonce] })) as number;
  console.log("\nauthorizationState before:", stateBefore, "(expect 0 = Unused)");

  const signature = await walletClient.signTypedData({ domain, types, primaryType: "TransferWithAuthorization", message });
  console.log("signature:", signature, `(${signature.length / 2 - 1} bytes)`);

  const txHash = await walletClient.writeContract({ address: USDT, abi: USDT_ABI, functionName: "transferWithAuthorization", args: [payerAddr as `0x${string}`, recipient, value, validAfter, validBefore, nonce, signature] });
  console.log("tx submitted:", txHash);
  console.log("explorer:", `https://explorer.testnet.whitechain.io/tx/${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("receipt status:", receipt.status, "gasUsed:", receipt.gasUsed.toString());
  const transferLog = receipt.logs.find((l) => l.address.toLowerCase() === USDT.toLowerCase());
  console.log("USDT Transfer event log present:", !!transferLog);

  const recipientBalAfter = (await publicClient.readContract({ address: USDT, abi: USDT_ABI, functionName: "balanceOf", args: [recipient] })) as bigint;
  console.log("recipient USDT (after):", formatUnits(recipientBalAfter, decimals));

  const stateAfter = (await publicClient.readContract({ address: USDT, abi: USDT_ABI, functionName: "authorizationState", args: [payerAddr as `0x${string}`, nonce] })) as number;
  console.log("authorizationState after:", stateAfter, "(expect nonzero = Used)");

  let replayReverted = false;
  let replayError = "";
  try {
    await walletClient.writeContract({ address: USDT, abi: USDT_ABI, functionName: "transferWithAuthorization", args: [payerAddr as `0x${string}`, recipient, value, validAfter, validBefore, nonce, signature] });
  } catch (e) {
    replayReverted = true;
    replayError = (e as Error).message.slice(0, 200);
  }
  console.log("replay rejected:", replayReverted, "(expect true)");
  if (replayError) console.log("replay error:", replayError);

  const ok = receipt.status === "success" && stateAfter !== stateBefore && replayReverted;
  console.log("\n=== EIP-3009 E2E RESULT:", ok ? "PASS" : "FAIL", "===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
