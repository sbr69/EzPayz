import { recoverTypedDataAddress } from "viem";
import { publicClient, getRelayerWalletClient, getRelayerAccount, CHAIN } from "../web3/client";
import { USDT_ABI } from "../web3/abi";
import { env } from "../config";
import { prisma } from "../db/client";
import { emitEvent } from "./webhook";

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

/**
 * Refunds: a new USDT transfer merchant → original payer, authorized by the merchant
 * via EIP-3009 TransferWithAuthorization (relayer sponsors gas). PRD §12, FLOW §11.
 */
export async function createRefund(opts: { merchantId: string; paymentId: string; amount: string; reason: string }) {
  const payment = await prisma.paymentIntent.findFirst({ where: { id: opts.paymentId, merchantId: opts.merchantId } });
  if (!payment) throw { statusCode: 404, code: "not_found", message: "Payment not found" };
  if (!["succeeded", "overpaid", "partially_refunded"].includes(payment.status)) {
    throw { statusCode: 400, code: "not_refundable", message: "Payment is not in a refundable state" };
  }
  const alreadyRefunded = BigInt(payment.refundedAmount || "0");
  if (BigInt(opts.amount) > BigInt(payment.amount) - alreadyRefunded) {
    throw { statusCode: 400, code: "exceeds_refundable", message: "Refund exceeds the remaining refundable amount" };
  }
  return prisma.refund.create({
    data: { merchantId: opts.merchantId, paymentId: opts.paymentId, amount: opts.amount, reason: opts.reason, status: "awaiting_authorization", gasSponsored: true },
  });
}

export interface RefundAuth {
  from: string; to: string; value: string; validAfter: string; validBefore: string; nonce: string; signature: string;
}

export async function validateRefundAuthorization(opts: {
  merchantPayoutWallet: string;
  originalPayer: string;
  refundAmount: string;
  auth: RefundAuth;
}): Promise<{ ok: true }> {
  const { auth } = opts;
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
  if (signer.toLowerCase() !== opts.merchantPayoutWallet.toLowerCase()) {
    throw { statusCode: 400, code: "invalid_signature", message: "Signature does not recover to the merchant payout wallet" };
  }
  if (auth.from.toLowerCase() !== opts.merchantPayoutWallet.toLowerCase()) {
    throw { statusCode: 400, code: "from_mismatch", message: "Authorization from must be the merchant payout wallet" };
  }
  if (auth.to.toLowerCase() !== opts.originalPayer.toLowerCase()) {
    throw { statusCode: 400, code: "to_mismatch", message: "Authorization to must be the original payer" };
  }
  if (auth.value !== opts.refundAmount) {
    throw { statusCode: 400, code: "amount_mismatch", message: "Authorization value must equal the refund amount" };
  }
  const state = (await publicClient.readContract({
    address: env.USDT_ADDRESS as `0x${string}`,
    abi: USDT_ABI,
    functionName: "authorizationState",
    args: [auth.from as `0x${string}`, auth.nonce as `0x${string}`],
  })) as number;
  if (state !== 0) {
    throw { statusCode: 400, code: "authorization_used", message: "Authorization already used" };
  }
  return { ok: true };
}

export async function relayAndSettleRefund(job: {
  refundId: string; merchantId: string; from: string; to: string; value: string;
  validAfter: string; validBefore: string; nonce: string; signature: string; paymentId: string;
}): Promise<{ txHash: string; settled: boolean }> {
  const walletClient = getRelayerWalletClient();
  const txHash = await walletClient.writeContract({
    chain: CHAIN,
    account: getRelayerAccount(),
    address: env.USDT_ADDRESS as `0x${string}`,
    abi: USDT_ABI,
    functionName: "transferWithAuthorization",
    args: [job.from as `0x${string}`, job.to as `0x${string}`, BigInt(job.value), BigInt(job.validAfter), BigInt(job.validBefore), job.nonce as `0x${string}`, job.signature as `0x${string}`],
  });
  await prisma.refund.update({ where: { id: job.refundId }, data: { status: "submitted", txRef: txHash } });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, confirmations: 1 });
  const transferLog = receipt.logs.find((l) => l.address.toLowerCase() === env.USDT_ADDRESS.toLowerCase());
  const settled = receipt.status === "success" && !!transferLog;

  if (settled) {
    await prisma.refund.update({ where: { id: job.refundId }, data: { status: "succeeded", settledAt: new Date() } });
    const refund = await prisma.refund.findUnique({ where: { id: job.refundId } });
    const payment = await prisma.paymentIntent.findUnique({ where: { id: job.paymentId } });
    if (refund && payment) {
      const newRefunded = (BigInt(payment.refundedAmount || "0") + BigInt(refund.amount)).toString();
      await prisma.paymentIntent.update({
        where: { id: job.paymentId },
        data: { refundedAmount: newRefunded, status: newRefunded === payment.amount ? "refunded" : "partially_refunded" },
      });
    }
    await emitEvent({ merchantId: job.merchantId, type: "refund.succeeded", resourceId: job.refundId, payload: { refundId: job.refundId, paymentId: job.paymentId, amount: job.value, txRef: txHash } });
  } else {
    await prisma.refund.update({ where: { id: job.refundId }, data: { status: "failed" } });
    await emitEvent({ merchantId: job.merchantId, type: "refund.failed", resourceId: job.refundId, payload: { refundId: job.refundId, txRef: txHash } });
  }
  return { txHash, settled };
}
