import { env } from "../config";
import { prisma } from "../db/client";
import { publicClient, getRelayerWalletClient, getRelayerAccount, CHAIN } from "../web3/client";
import { USDT_ABI } from "../web3/abi";
import type { RelayPaymentJob } from "../queues";
import { emitEvent } from "./webhook";

/**
 * Relayer + observer (combined for the e2e): submits transferWithAuthorization
 * (relayer pays WBT gas), waits for the receipt, verifies the USDT Transfer event,
 * and settles the payment. PRD §10.1, §10.2, FLOW §6.5, §6.6.
 *
 * The plan separates relayer (submit) from observer (verify) for reorg-handling +
 * scalability; for the MVP e2e this single flow is correct + simpler.
 */
export async function relayAndSettle(job: RelayPaymentJob): Promise<{ txHash: string; settled: boolean }> {
  const walletClient = getRelayerWalletClient();
  const value = BigInt(job.value);

  // 1. Submit transferWithAuthorization (relayer pays WBT gas).
  const txHash = await walletClient.writeContract({
    chain: CHAIN,
    account: getRelayerAccount(),
    address: env.USDT_ADDRESS as `0x${string}`,
    abi: USDT_ABI,
    functionName: "transferWithAuthorization",
    args: [
      job.from as `0x${string}`,
      job.to as `0x${string}`,
      value,
      BigInt(job.validAfter),
      BigInt(job.validBefore),
      job.nonce as `0x${string}`,
      job.signature as `0x${string}`,
    ],
  });

  await prisma.paymentIntent.update({
    where: { id: job.paymentIntentId },
    data: { txRef: txHash, status: "submitted" },
  });
  await prisma.relayerTransaction.create({
    data: { merchantId: job.merchantId, operation: "payment_relay", txRef: txHash, status: "submitted", paymentId: job.paymentIntentId },
  });

  // 2. Wait for the receipt + verify the USDT Transfer event (observer).
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
  const transferLog = receipt.logs.find(
    (l) => l.address.toLowerCase() === env.USDT_ADDRESS.toLowerCase()
  );
  const settled = receipt.status === "success" && !!transferLog;

  await prisma.paymentIntent.update({
    where: { id: job.paymentIntentId },
    data: {
      status: settled ? "succeeded" : "failed",
      settledAt: settled ? new Date() : undefined,
      receivedAmount: settled ? job.value : undefined,
      failureReason: settled ? undefined : "transaction reverted or no Transfer event",
    },
  });
  await prisma.relayerTransaction.updateMany({
    where: { txRef: txHash },
    data: { status: settled ? "confirmed" : "failed" },
  });

  // Emit webhook event (transactional outbox + signed dispatch via the webhook queue).
  await emitEvent({
    merchantId: job.merchantId,
    type: settled ? "payment.succeeded" : "payment.failed",
    resourceId: job.paymentIntentId,
    payload: { id: job.paymentIntentId, amount: job.value, txRef: txHash, status: settled ? "succeeded" : "failed" },
  });

  return { txHash, settled };
}
