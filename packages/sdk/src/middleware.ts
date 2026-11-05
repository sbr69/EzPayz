import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a webhook signature (HMAC-SHA256) from the X-Whitechain-Signature header.
 * PRD §18.2. Use as Express/Fastify/Connect middleware or a standalone helper.
 */
export function verifyWebhookSignature(secret: string, payload: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Express-style middleware factory. Verifies the signature + attaches the parsed body.
 * Usage: app.post("/webhook", verifyWebhookMiddleware(secret), (req, res) => { req.whitechainEvent });
 */
export function verifyWebhookMiddleware(secret: string) {
  return (req: { headers: Record<string, string | string[] | undefined>; body: unknown; rawBody?: Buffer }, res: { status: (n: number) => { send: (b: unknown) => void }; whitechainVerified?: boolean }, next: () => void) => {
    const signature = req.headers["x-whitechain-signature"] as string | undefined;
    const raw = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body ?? {});
    if (!signature || !verifyWebhookSignature(secret, raw, signature)) {
      res.status(401).send({ error: "invalid_signature" });
      return;
    }
    res.whitechainVerified = true;
    next();
  };
}
