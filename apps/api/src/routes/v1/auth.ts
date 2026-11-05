import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerMerchant, loginMerchant } from "../../services/auth";

const registerSchema = z.object({
  businessEmail: z.string().email(),
  password: z.string().min(8),
  businessName: z.string().min(1),
});
const loginSchema = z.object({
  businessEmail: z.string().email(),
  password: z.string(),
});

function validationError(reply: import("fastify").FastifyReply, issues: { message: string }[]) {
  reply.code(400).send({
    error: { code: "validation_error", message: issues.map((i) => i.message).join("; ") },
  });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/register", async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      const { merchant, token } = await registerMerchant(app, parsed.data.businessEmail, parsed.data.password, parsed.data.businessName);
      return reply.code(201).send({ merchantId: merchant.id, token });
    } catch (e) {
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode) return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
      throw e;
    }
  });

  app.post("/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      const { merchant, token } = await loginMerchant(app, parsed.data.businessEmail, parsed.data.password);
      return reply.send({ merchantId: merchant.id, token });
    } catch (e) {
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode) return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
      throw e;
    }
  });
}
