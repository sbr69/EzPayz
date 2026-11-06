import type { FastifyInstance } from "fastify";
import { recoverTypedDataAddress } from "viem";
import { publicClient, getRelayerWalletClient, getRelayerAccount, CHAIN } from "../../web3/client";
import { USDT_ABI } from "../../web3/abi";
import { env } from "../../config";
import { prisma } from "../../db/client";
import { emitEvent } from "../../services/webhook";
import { gasGuardCheck } from "../../services/gasGuard";
import { formatBaseUnits } from "../../utils/amount";

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

interface PaymentPayload {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string;
}

interface PaymentRequirements {
  scheme: string;
  network: string;
  payTo: string;
  maxAmountRequired: string;
  asset: string;
  description?: string;
}

/**
 * x402 Facilitator endpoints for Whitechain Sepolia.
 *
 * Implements the x402 facilitator interface (verify + settle + supported) using
 * EIP-3009 TransferWithAuthorization for gasless payments. AI agents sign
 * authorizations off-chain; the EzPayz relayer submits on-chain (pays WBT gas).
 *
 * Merchants authenticate with their EzPayz secret API key. The facilitator
 * identifies the merchant, verifies the payment, and settles via the relayer.
 * PRD §Phase 2 — x402 programmatic payments.
 */
export async function x402Routes(app: FastifyInstance): Promise<void> {
  // GET /v1/x402/supported — returns supported networks, schemes, and tokens.
  app.get("/supported", async () => {
    return {
      schemes: ["exact"],
      networks: [`eip155:${env.WHITECHAIN_CHAIN_ID}`],
      assets: {
        [`eip155:${env.WHITECHAIN_CHAIN_ID}`]: {
          address: env.USDT_ADDRESS,
          symbol: "USDT",
          decimals: 6,
        },
      },
      facilitator: "EzPayz",
      version: "1.0.0",
    };
  });

  // POST /v1/x402/verify — verifies an EIP-3009 payment payload.
  // Called by the merchant's x402 middleware before serving content.
  app.post("/verify", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = req.body as { paymentPayload: PaymentPayload; paymentRequirements: PaymentRequirements };
    if (!body?.paymentPayload || !body?.paymentRequirements) {
      return reply.code(400).send({ isValid: false, error: "paymentPayload and paymentRequirements are required" });
    }

    const { paymentPayload: auth, paymentRequirements: requirements } = body;

    try {
      // 1. Verify the EIP-3009 signature — signer must match `from`.
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
        return reply.send({ isValid: false, error: "Signature does not recover to the payer" });
      }

      // 2. Check authorizationState(from, nonce) is Unused (0).
      const state = (await publicClient.readContract({
        address: env.USDT_ADDRESS as `0x${string}`,
        abi: USDT_ABI,
        functionName: "authorizationState",
        args: [auth.from as `0x${string}`, auth.nonce as `0x${string}`],
      })) as number;

      if (state !== 0) {
        return reply.send({ isValid: false, error: "Authorization already used or pending" });
      }

      // 3. Verify the payment matches the requirements.
      if (auth.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
        return reply.send({ isValid: false, error: "Payment recipient does not match payTo" });
      }
      if (BigInt(auth.value) < BigInt(requirements.maxAmountRequired)) {
        return reply.send({ isValid: false, error: "Payment value is less than required" });
      }
      const now = Math.floor(Date.now() / 1000);
      if (Number(auth.validBefore) < now) {
        return reply.send({ isValid: false, error: "Authorization has expired" });
      }

      return reply.send({ isValid: true });
    } catch (e) {
      return reply.code(400).send({ isValid: false, error: (e as Error).message });
    }
  });

  // POST /v1/x402/settle — settles the payment via the relayer.
  // Called by the merchant's x402 middleware after serving content.
  app.post("/settle", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const body = req.body as { paymentPayload: PaymentPayload; paymentRequirements: PaymentRequirements };
    if (!body?.paymentPayload) {
      return reply.code(400).send({ success: false, error: "paymentPayload is required" });
    }

    const { paymentPayload: auth } = body;
    const merchantId = req.merchantId!;

    try {
      // GasGuard check
      await gasGuardCheck({
        merchantId,
        chainId: env.WHITECHAIN_CHAIN_ID,
        token: env.USDT_ADDRESS,
        to: auth.to,
        amount: auth.value,
        from: auth.from,
      });

      // Submit transferWithAuthorization via relayer
      const walletClient = getRelayerWalletClient();
      const txHash = await walletClient.writeContract({
        chain: CHAIN,
        account: getRelayerAccount(),
        address: env.USDT_ADDRESS as `0x${string}`,
        abi: USDT_ABI,
        functionName: "transferWithAuthorization",
        args: [
          auth.from as `0x${string}`,
          auth.to as `0x${string}`,
          BigInt(auth.value),
          BigInt(auth.validAfter),
          BigInt(auth.validBefore),
          auth.nonce as `0x${string}`,
          auth.signature as `0x${string}`,
        ],
      });

      // Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      const settled = receipt.status === "success";

      // Record the payment
      const payment = await prisma.paymentIntent.create({
        data: {
          merchantId,
          description: body.paymentRequirements?.description ?? "x402 payment",
          amount: auth.value,
          token: "USDT",
          network: "whitechain-sepolia",
          kind: "one_time",
          payoutWallet: auth.to,
          status: settled ? "succeeded" : "failed",
          txRef: txHash,
          payerWallet: auth.from,
          settledAt: settled ? new Date() : undefined,
          receivedAmount: settled ? auth.value : undefined,
          checkoutUrl: "",
          authorizationRef: auth.nonce,
        },
      });

      await prisma.relayerTransaction.create({
        data: { merchantId, operation: "x402_payment", txRef: txHash, status: settled ? "confirmed" : "failed", paymentId: payment.id },
      });

      // Emit webhook
      await emitEvent({
        merchantId,
        type: settled ? "payment.succeeded" : "payment.failed",
        resourceId: payment.id,
        payload: { id: payment.id, amount: auth.value, txRef: txHash, displayAmount: formatBaseUnits(auth.value), source: "x402" },
      });

      return reply.send({
        success: settled,
        txHash,
        paymentId: payment.id,
        network: `eip155:${env.WHITECHAIN_CHAIN_ID}`,
        explorerUrl: settled ? `https://explorer.testnet.whitechain.io/tx/${txHash}` : undefined,
      });
    } catch (e) {
      return reply.code(400).send({ success: false, error: (e as Error).message });
    }
  });
}
