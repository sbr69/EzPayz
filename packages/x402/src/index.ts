/**
 * @ezpayz/x402 — x402 payment middleware for EzPayz.
 *
 * Accept gasless USDT payments from AI agents on Whitechain Sepolia via HTTP 402.
 * AI agents sign EIP-3009 TransferWithAuthorization (gasless), the EzPayz facilitator
 * verifies + settles via the relayer.
 *
 * Quick start:
 *   import { ezPayzPaymentMiddleware } from "@ezpayz/x402";
 *   app.use(ezPayzPaymentMiddleware({
 *     facilitatorUrl: "https://ezpayz-api.onrender.com/v1/x402",
 *     secretKey: "wcp_sec_...",
 *     routes: {
 *       "GET /api/data": { price: "0.01", payTo: "0xYourWallet" }
 *     }
 *   }));
 */

export interface EzPayzRouteConfig {
  /** Price in USD (e.g., "0.01" = $0.01). Converted to USDT base units (6 decimals). */
  price: string;
  /** Merchant's payout wallet address (where USDT arrives). */
  payTo: string;
  /** Description of the resource (shown to the AI agent in the 402 response). */
  description?: string;
  /** MIME type of the response. */
  mimeType?: string;
}

export interface EzPayzMiddlewareConfig {
  /** EzPayz facilitator URL (e.g., "https://ezpayz-api.onrender.com/v1/x402"). */
  facilitatorUrl: string;
  /** Merchant's EzPayz secret API key. */
  secretKey: string;
  /** Routes to protect with x402 payments. */
  routes: Record<string, EzPayzRouteConfig>;
}

/** USDT on Whitechain Sepolia — 6 decimals. */
export const USDT_DECIMALS = 6;
export const WHITECHAIN_CHAIN_ID = 1874;
export const WHITECHAIN_NETWORK = `eip155:${WHITECHAIN_CHAIN_ID}`;
export const USDT_ADDRESS = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";

/** Converts a USD price string (e.g., "0.01") to base units (e.g., "10000"). */
export function priceToBaseUnits(price: string): string {
  const usd = parseFloat(price);
  if (isNaN(usd) || usd <= 0) throw new Error(`Invalid price: ${price}`);
  return BigInt(Math.floor(usd * 1e6)).toString();
}

/** Generates x402 payment requirements for a route. */
export function generatePaymentRequirements(route: EzPayzRouteConfig) {
  return {
    scheme: "exact",
    network: WHITECHAIN_NETWORK,
    payTo: route.payTo,
    maxAmountRequired: priceToBaseUnits(route.price),
    asset: USDT_ADDRESS,
    description: route.description ?? "API access",
    mimeType: route.mimeType ?? "application/json",
  };
}

/**
 * Payment middleware for Express/Connect-style servers.
 *
 * When a request arrives without a valid payment, responds with 402 + payment requirements.
 * When a request includes a payment (X-PAYMENT header), verifies it via the EzPayz facilitator.
 * If valid, calls next() to serve the content. After the response, settles the payment.
 */
export function ezPayzPaymentMiddleware(config: EzPayzMiddlewareConfig) {
  const { facilitatorUrl, secretKey, routes } = config;

  return function (req: any, res: any, next: any) {
    const method = req.method.toUpperCase();
    const path = req.path || req.url?.split("?")[0] || "";
    const routeKey = `${method} ${path}`;
    const routeConfig = routes[routeKey] ?? routes[`${method} ${path}/`];

    if (!routeConfig) {
      return next();
    }

    const paymentHeader = req.headers["x-payment"];
    if (!paymentHeader) {
      // No payment — return 402 with payment requirements
      const requirements = generatePaymentRequirements(routeConfig);
      res.statusCode = 402;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("X-PAYMENT-REQUIREMENTS", JSON.stringify(requirements));
      return res.end(JSON.stringify({
        error: "Payment Required",
        x402Version: 1,
        accepts: [requirements],
      }));
    }

    // Payment present — verify via facilitator
    const paymentPayload = JSON.parse(typeof paymentHeader === "string" ? paymentHeader : paymentHeader[0]);
    const requirements = generatePaymentRequirements(routeConfig);

    fetch(`${facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secretKey}` },
      body: JSON.stringify({ paymentPayload, paymentRequirements: requirements }),
    })
      .then((verifyRes) => verifyRes.json())
      .then((verifyBody) => {
        if (!verifyBody.isValid) {
          res.statusCode = 402;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("X-PAYMENT-REQUIREMENTS", JSON.stringify(requirements));
          return res.end(JSON.stringify({ error: "Payment verification failed", detail: verifyBody.error }));
        }

        // Payment valid — serve content, then settle
        // Wrap res.end to intercept the response completion
        const originalEnd = res.end.bind(res);
        res.end = function (...args: any[]) {
          originalEnd(...args);

          // Settle the payment asynchronously after serving content
          fetch(`${facilitatorUrl}/settle`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${secretKey}` },
            body: JSON.stringify({ paymentPayload, paymentRequirements: requirements }),
          }).catch((e) => console.error("[x402] Settlement failed:", e.message));
        };

        next();
      })
      .catch((e) => {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Facilitator error", detail: e.message }));
      });
  };
}

/**
 * Fastify plugin version of the x402 payment middleware.
 *
 * Usage:
 *   import Fastify from "fastify";
 *   import { ezPayzFastifyPlugin } from "@ezpayz/x402";
 *   const app = Fastify();
 *   await app.register(ezPayzFastifyPlugin, { facilitatorUrl, secretKey, routes });
 */
export const ezPayzFastifyPlugin = {
  name: "@ezpayz/x402",
  async register(app: any, opts: EzPayzMiddlewareConfig) {
    app.addHook("onRequest", async (req: any, reply: any) => {
      const method = req.method.toUpperCase();
      const path = req.url.split("?")[0];
      const routeKey = `${method} ${path}`;
      const routeConfig = opts.routes[routeKey];

      if (!routeConfig) return;

      const paymentHeader = req.headers["x-payment"];
      if (!paymentHeader) {
        const requirements = generatePaymentRequirements(routeConfig);
        reply.code(402);
        reply.header("X-PAYMENT-REQUIREMENTS", JSON.stringify(requirements));
        reply.header("Content-Type", "application/json");
        return reply.send({ error: "Payment Required", x402Version: 1, accepts: [requirements] });
      }

      const paymentPayload = JSON.parse(typeof paymentHeader === "string" ? paymentHeader : paymentHeader[0]);
      const requirements = generatePaymentRequirements(routeConfig);

      const verifyRes = await fetch(`${opts.facilitatorUrl}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.secretKey}` },
        body: JSON.stringify({ paymentPayload, paymentRequirements: requirements }),
      });
      const verifyBody = await verifyRes.json();

      if (!verifyBody.isValid) {
        reply.code(402);
        reply.header("X-PAYMENT-REQUIREMENTS", JSON.stringify(requirements));
        return reply.send({ error: "Payment verification failed", detail: verifyBody.error });
      }

      // Settle after response is sent
      app.addHook("onResponse", async () => {
        await fetch(`${opts.facilitatorUrl}/settle`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.secretKey}` },
          body: JSON.stringify({ paymentPayload, paymentRequirements: requirements }),
        }).catch((e: any) => req.log.error(`[x402] Settlement failed: ${e.message}`));
      });
    });
  },
};
