import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { env, isProd } from "./config";
import { errorHandlerPlugin } from "./plugins/errorHandler";
import { authenticate, requireSecretKey } from "./plugins/auth";
import { idempotency } from "./plugins/idempotency";
import { mountMcp } from "./plugins/mcp";
import { healthRoutes } from "./routes/v1/health";
import { authRoutes } from "./routes/v1/auth";
import { merchantRoutes } from "./routes/v1/merchants";
import { apiKeyRoutes } from "./routes/v1/apiKeys";
import { paymentIntentRoutes } from "./routes/v1/paymentIntents";
import { checkoutRoutes } from "./routes/v1/checkout";
import { webhookRoutes } from "./routes/v1/webhooks";
import { paymentLinkRoutes } from "./routes/v1/paymentLinks";
import { invoiceRoutes } from "./routes/v1/invoices";
import { exceptionRoutes } from "./routes/v1/exceptions";
import { fulfilmentRoutes } from "./routes/v1/fulfilment";
import { analyticsRoutes } from "./routes/v1/analytics";
import { planRoutes } from "./routes/v1/plans";
import { subscriptionRoutes } from "./routes/v1/subscriptions";
import { usageRoutes } from "./routes/v1/usage";
import { refundRoutes } from "./routes/v1/refunds";
import { customerRoutes } from "./routes/v1/customers";
import { gasGuardRoutes } from "./routes/v1/gasGuard";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: isProd ? "info" : "debug" },
    genReqId: () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  });

  await app.register(helmet);
  await app.register(cors, { origin: true }); // dev: allow all; tighten on the deployed frontend origin.
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(sensible);
  await app.register(jwt, { secret: env.JWT_SECRET });

  app.decorate("authenticate", authenticate);
  app.decorate("requireSecretKey", requireSecretKey);
  app.decorate("idempotency", idempotency);
  await app.register(errorHandlerPlugin);

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(merchantRoutes, { prefix: "/v1/merchants" });
  await app.register(apiKeyRoutes, { prefix: "/v1/api-keys" });
  await app.register(paymentIntentRoutes, { prefix: "/v1/payment-intents" });
  await app.register(checkoutRoutes, { prefix: "/v1/checkout" });
  await app.register(webhookRoutes, { prefix: "/v1/webhooks" });
  await app.register(paymentLinkRoutes, { prefix: "/v1/payment-links" });
  await app.register(invoiceRoutes, { prefix: "/v1/invoices" });
  await app.register(exceptionRoutes, { prefix: "/v1/exceptions" });
  await app.register(fulfilmentRoutes, { prefix: "/v1/fulfilment" });
  await app.register(analyticsRoutes, { prefix: "/v1/analytics" });
  await app.register(planRoutes, { prefix: "/v1/plans" });
  await app.register(subscriptionRoutes, { prefix: "/v1/subscriptions" });
  await app.register(usageRoutes, { prefix: "/v1/usage" });
  await app.register(refundRoutes, { prefix: "/v1/refunds" });
  await app.register(customerRoutes, { prefix: "/v1/customers" });
  await app.register(gasGuardRoutes, { prefix: "/v1/gas-guard" });

  // MCP server — Streamable HTTP at /mcp (for remote MCP clients).
  await mountMcp(app);

  return app;
}
