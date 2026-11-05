import { recoverTypedDataAddress } from "viem";
import { publicClient } from "../web3/client";
import { USDT_ABI } from "../web3/abi";
import { env } from "../config";
import { prisma } from "../db/client";
import { gasGuardCheck } from "./gasGuard";

// EIP-712 domain for the USDT TransferWithAuthorization (confirmed in Phase 0 e2e).
const USDT_DOMAIN = {
  name: "Tether USD",
  version: "1",
  chainId: env.WHITECHAIN_CHAIN_ID,
  verifyingContract: env.USDT_ADDRESS as `0x${string}`,
} as const;

const TRANSFER_WITH_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export interface AuthorizationData {
  from: string;
  to: string;
  value: string; // base units
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string;
}

/**
 * Validates a payer-signed EIP-3009 TransferWithAuthorization against the intent.
 * PRD §10.2, FLOW §6.4. Returns the verified authorization bound to the intent.
 */
export async function validateAndBindAuthorization(opts: {
  paymentIntentId: string;
  merchantId: string;
  expectedTo: string; // merchant payout wallet
  expectedAmount: string; // base units
  auth: AuthorizationData;
}): Promise<{ ok: true }> {
  const { auth } = opts;

  // 1. Recover the signer from the EIP-712 typed signature; must equal `from`.
  const signer = await recoverTypedDataAddress({
    domain: USDT_DOMAIN,
    types: TRANSFER_WITH_AUTH_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: auth.from as `0x${string}`,
      to: auth.to as `0x${string}`,
      value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce: auth.nonce as `0x${string}`,
    },
    signature: auth.signature as `0x${string}`,
  });
  if (signer.toLowerCase() !== auth.from.toLowerCase()) {
    throw { statusCode: 400, code: "invalid_signature", message: "Signature does not recover to the payer" };
  }

  // 2. authorizationState(from, nonce) must be Unused (0).
  const state = (await publicClient.readContract({
    address: env.USDT_ADDRESS as `0x${string}`,
    abi: USDT_ABI,
    functionName: "authorizationState",
    args: [auth.from as `0x${string}`, auth.nonce as `0x${string}`],
  })) as number;
  if (state !== 0) {
    throw { statusCode: 400, code: "authorization_used", message: "Authorization already used or pending" };
  }

  // 3. Bind to the intent: amount, recipient, token, chain must match.
  if (auth.to.toLowerCase() !== opts.expectedTo.toLowerCase()) {
    throw { statusCode: 400, code: "recipient_mismatch", message: "Authorization recipient does not match the merchant payout wallet" };
  }
  if (auth.value !== opts.expectedAmount) {
    throw { statusCode: 400, code: "amount_mismatch", message: "Authorization amount does not match the intent" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(auth.validBefore) < now) {
    throw { statusCode: 400, code: "authorization_expired", message: "Authorization validBefore has passed" };
  }

  // 4. GasGuard pre-submission checks.
  await gasGuardCheck({
    merchantId: opts.merchantId,
    chainId: env.WHITECHAIN_CHAIN_ID,
    token: env.USDT_ADDRESS,
    to: auth.to,
    amount: auth.value,
    from: auth.from,
  });

  return { ok: true };
}

/** Marks the intent authorized + records the authorization ref. */
export async function markAuthorized(paymentIntentId: string, nonce: string): Promise<void> {
  await prisma.paymentIntent.update({
    where: { id: paymentIntentId },
    data: { status: "authorized", authorizationRef: nonce },
  });
}
