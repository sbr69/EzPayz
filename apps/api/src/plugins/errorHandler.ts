import type { FastifyInstance } from "fastify";

/**
 * Global error handler returning a structured error envelope:
 * { error: { code, message, requestId } }. PRD §17.6.
 * Thrown errors may carry `statusCode` + `code` (e.g. from auth/service helpers).
 * 5xx messages are hidden from the client (logged server-side).
 */
export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((err: unknown, req, reply) => {
    const e = err as { statusCode?: number; code?: string; message?: string };
    const statusCode = e.statusCode ?? 500;
    const code = e.code ?? (statusCode >= 500 ? "internal_error" : "error");
    const message = statusCode >= 500 ? "Internal server error" : (e.message ?? "error");
    req.log.error({ err, statusCode, code }, "request error");
    reply.code(statusCode).send({ error: { code, message, requestId: req.id } });
  });
}
