import { publicClient, getRelayerWalletClient, getRelayerAccount, CHAIN } from "../web3/client";
import { SUBSCRIPTION_ABI } from "../web3/subscriptionAbi";
import { SUBSCRIPTION_CONTRACT_ADDRESS } from "../config/contracts";
import { env } from "../config";
import { prisma } from "../db/client";
import { emitEvent } from "./webhook";

/**
 * Gasless subscription activation via EIP-712 signatures.
 *
 * The customer signs TWO messages off-chain (via the checkout widget):
 * 1. EIP-2612 Permit — sets the ERC-20 allowance on USDT (gasless approve)
 * 2. EIP-712 createSubscriptionBySig — authorizes subscription creation
 *
 * The relayer submits both transactions and pays WBT gas. The customer never
 * submits a transaction or pays gas for subscription setup.
 *
 * PRD §11.4.1 — fully gasless subscription lifecycle.
 */

const USDT_PERMIT_TYPE = [
  { name: "owner", type: "address" },
  { name: "spender", type: "address" },
  { name: "value", type: "uint256" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
];

const CREATE_SUB_BY_SIG_TYPE = [
  { name: "subscriptionId", type: "bytes32" },
  { name: "payer", type: "address" },
  { name: "merchant", type: "address" },
  { name: "amount", type: "uint256" },
  { name: "intervalSeconds", type: "uint256" },
  { name: "maxChargePerCycle", type: "uint256" },
  { name: "cumulativeCap", type: "uint256" },
  { name: "nextDueTime", type: "uint256" },
  { name: "expiry", type: "uint256" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
];

/** Returns the EIP-712 typed data the customer must sign for the Permit (EIP-2612). */
export function getPermitTypedData(payer: string, spender: string, value: bigint, nonce: bigint, deadline: bigint) {
  return {
    domain: { name: "Tether USD", version: "1", chainId: env.WHITECHAIN_CHAIN_ID, verifyingContract: env.USDT_ADDRESS },
    types: { Permit: USDT_PERMIT_TYPE },
    primaryType: "Permit" as const,
    message: { owner: payer, spender, value, nonce, deadline },
  };
}

/** Returns the EIP-712 typed data the customer must sign for createSubscriptionBySig. */
export function getCreateSubBySigTypedData(
  subscriptionId: string, payer: string, merchant: string, amount: bigint,
  intervalSeconds: bigint, maxChargePerCycle: bigint, cumulativeCap: bigint,
  nextDueTime: bigint, expiry: bigint, nonce: bigint, deadline: bigint,
) {
  return {
    domain: { name: "SubscriptionContract", version: "1", chainId: env.WHITECHAIN_CHAIN_ID, verifyingContract: SUBSCRIPTION_CONTRACT_ADDRESS },
    types: { CreateSubscriptionBySig: CREATE_SUB_BY_SIG_TYPE },
    primaryType: "CreateSubscriptionBySig" as const,
    message: { subscriptionId, payer, merchant, amount, intervalSeconds, maxChargePerCycle, cumulativeCap, nextDueTime, expiry, nonce, deadline },
  };
}

/**
 * Relayer submits the Permit + createSubscriptionBySig transactions.
 * Returns the on-chain tx hashes.
 */
export async function activateSubscriptionBySig(opts: {
  payer: string;
  subscriptionId: string;
  merchant: string;
  amount: string;
  intervalSeconds: number;
  maxChargePerCycle: string;
  cumulativeCap: string;
  nextDueTime: number;
  expiry: number;
  permitSignature: string;
  permitDeadline: string;
  permitNonce: string;
  createSubSignature: string;
  createSubDeadline: string;
  createSubNonce: string;
}): Promise<{ permitTxHash: string; createSubTxHash: string }> {
  const walletClient = getRelayerWalletClient();
  const account = getRelayerAccount();
  const usdtAddress = env.USDT_ADDRESS as `0x${string}`;
  const subContract = SUBSCRIPTION_CONTRACT_ADDRESS as `0x${string}`;

  // Step 1: Submit the Permit (EIP-2612) — sets the ERC-20 allowance.
  // Split the 65-byte signature into v, r, s.
  const sig = opts.permitSignature.slice(2);
  const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
  const s = `0x${sig.slice(64, 128)}` as `0x${string}`;
  const v = parseInt(sig.slice(128, 130), 16);

  const permitTxHash = await walletClient.writeContract({
    chain: CHAIN,
    account,
    address: usdtAddress,
    abi: [{
      inputs: [
        { type: "address" }, { type: "address" }, { type: "uint256" },
        { type: "uint256" }, { type: "uint8" }, { type: "bytes32" }, { type: "bytes32" },
      ],
      name: "permit",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    }],
    functionName: "permit",
    args: [
      opts.payer as `0x${string}`,
      subContract,
      BigInt(opts.cumulativeCap),
      BigInt(opts.permitDeadline),
      v,
      r,
      s,
    ],
  });

  // Wait for the permit tx to be mined before creating the subscription.
  await publicClient.waitForTransactionReceipt({ hash: permitTxHash, confirmations: 1 });

  // Step 2: Submit createSubscriptionBySig.
  const createSubTxHash = await walletClient.writeContract({
    chain: CHAIN,
    account,
    address: subContract,
    abi: SUBSCRIPTION_ABI,
    functionName: "createSubscriptionBySig",
    args: [
      opts.subscriptionId as `0x${string}`,
      opts.payer as `0x${string}`,
      opts.merchant as `0x${string}`,
      BigInt(opts.amount),
      BigInt(opts.intervalSeconds),
      BigInt(opts.maxChargePerCycle),
      BigInt(opts.cumulativeCap),
      BigInt(opts.nextDueTime),
      BigInt(opts.expiry),
      BigInt(opts.createSubDeadline),
      opts.createSubSignature as `0x${string}`,
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash: createSubTxHash, confirmations: 1 });

  return { permitTxHash, createSubTxHash };
}

/**
 * Relayer submits cancelBySig.
 */
export async function cancelSubscriptionBySig(opts: {
  subscriptionId: string;
  payer: string;
  deadline: string;
  signature: string;
}): Promise<string> {
  const walletClient = getRelayerWalletClient();
  const account = getRelayerAccount();

  const txHash = await walletClient.writeContract({
    chain: CHAIN,
    account,
    address: SUBSCRIPTION_CONTRACT_ADDRESS as `0x${string}`,
    abi: SUBSCRIPTION_ABI,
    functionName: "cancelBySig",
    args: [
      opts.subscriptionId as `0x${string}`,
      opts.payer as `0x${string}`,
      BigInt(opts.deadline),
      opts.signature as `0x${string}`,
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
  return txHash;
}
