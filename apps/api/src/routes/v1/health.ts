import type { FastifyInstance } from "fastify";
import { env } from "../../config";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ status: "ok" }));

  // PRD §17.5 — developer status: network/token/feature capabilities.
  app.get("/v1/status", async () => ({
    network: "whitechain-sepolia",
    chainId: env.WHITECHAIN_CHAIN_ID,
    token: { symbol: "USDT", address: env.USDT_ADDRESS, decimals: 6 },
    capabilities: { eip3009: true, eip2612: true, subscriptions: true },
    subscriptionContract: "0x0b8Da2EE37f3599141aFD500b1e2699D5A6bCdbB",
  }));
}
