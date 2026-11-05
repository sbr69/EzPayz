import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { env, isProd } from "./config";
import { errorHandlerPlugin } from "./plugins/errorHandler";
import { authenticate } from "./plugins/auth";
import { idempotency } from "./plugins/idempotency";
import { healthRoutes } from "./routes/v1/health";
import { authRoutes } from "./routes/v1/auth";
import { merchantRoutes } from "./routes/v1/merchants";
import { apiKeyRoutes } from "./routes/v1/apiKeys";
import { paymentIntentRoutes } from "./routes/v1/paymentIntents";
import { checkoutRoutes } from "./routes/v1/checkout";

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
  app.decorate("idempotency", idempotency);
  await app.register(errorHandlerPlugin);

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(merchantRoutes, { prefix: "/v1/merchants" });
  await app.register(apiKeyRoutes, { prefix: "/v1/api-keys" });
  await app.register(paymentIntentRoutes, { prefix: "/v1/payment-intents" });
  await app.register(checkoutRoutes, { prefix: "/v1/checkout" });

  return app;
}
