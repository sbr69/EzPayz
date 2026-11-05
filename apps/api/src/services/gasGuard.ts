import { env } from "../config";
import { prisma } from "../db/client";

/**
 * GasGuard: pre-submission policy checks before the relayer pays WBT gas.
 * Minimal MVP checks here; expandable to per-tx gas ceilings, budgets, rate limits,
 * nonce/replay protection, emergency pause (PRD §16, FLOW §6.5, §16.1).
 */
export interface GasGuardContext {
  merchantId: string;
  chainId: number;
  token: string;
  to: string; // expected recipient (merchant payout)
  amount: string; // base units
  from: string; // payer
}

export async function gasGuardCheck(ctx: GasGuardContext): Promise<void> {
  if (ctx.chainId !== env.WHITECHAIN_CHAIN_ID) {
    throw { statusCode: 400, code: "gasguard_chain", message: `Unsupported chain ${ctx.chainId}` };
  }
  if (ctx.token.toLowerCase() !== env.USDT_ADDRESS.toLowerCase()) {
    throw { statusCode: 400, code: "gasguard_token", message: "Unsupported token" };
  }
  // Global + merchant relayer budgets (WBT). For MVP, just check the global budget exists + isn't paused.
  const globalBudget = await prisma.relayerBudget.findFirst({ where: { scope: "global" } });
  if (globalBudget?.paused) {
    throw { statusCode: 429, code: "gasguard_paused", message: "Relayer is paused" };
  }
  // Merchant active check
  const merchant = await prisma.merchant.findUnique({ where: { id: ctx.merchantId } });
  if (!merchant) {
    throw { statusCode: 404, code: "not_found", message: "Merchant not found" };
  }
  // (Further checks: per-tx gas ceiling via eth_estimateGas, per-merchant rate limits,
  //  authorization expiry window, nonce uniqueness — added as the gateway matures.)
}
