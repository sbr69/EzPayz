import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createApiKey, listApiKeys, revokeApiKey } from "../../services/apiKey";

const createSchema = z.object({
  name: z.string().min(1),
  environment: z.enum(["testnet", "mainnet"]).default("testnet"),
});

export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/api-keys — create a publishable + secret pair. The secret is shown ONCE.
  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") },
      });
    }
    const { record, secretRevealedOnce } = await createApiKey(req.merchantId!, parsed.data.name, parsed.data.environment);
    return reply.code(201).send({
      id: record.id,
      name: record.name,
      publishable: record.publishable,
      secretLast4: record.secretLast4,
      secret: secretRevealedOnce, // shown once; never stored in the clear
      environment: record.environment,
    });
  });

  // GET /v1/api-keys — list keys (secrets never returned).
  app.get("/", { preHandler: [app.authenticate] }, async (req) => {
    const keys = await listApiKeys(req.merchantId!);
    return {
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        publishable: k.publishable,
        secretLast4: k.secretLast4,
        status: k.status,
        environment: k.environment,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
      })),
    };
  });

  // POST /v1/api-keys/:id/revoke
  app.post("/:id/revoke", { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    try {
      await revokeApiKey(req.merchantId!, id);
      return reply.send({ revoked: true });
    } catch (e) {
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode) {
        return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw e;
    }
  });
}
