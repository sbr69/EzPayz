import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../../db/client";
import { MerchantRepository } from "../../db/repositories/merchant";
import { env } from "../../config";

const profileUpdateSchema = z.object({
  businessName: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  website: z.string().url().optional(),
  businessEmail: z.string().email().optional(),
  supportEmail: z.string().email().optional(),
  description: z.string().optional(),
  logoText: z.string().max(2).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  payoutWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  walletVerified: z.boolean().optional(),
  notificationPrefs: z.record(z.string(), z.unknown()).optional(),
});

const verifySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
  challenge: z.string().min(1),
  verificationToken: z.string().min(1),
});

export async function merchantRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/merchants/me — the authenticated merchant's own record (tenant root).
  app.get("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    const repo = new MerchantRepository(prisma, req.merchantId!);
    const merchant = await repo.me();
    if (!merchant) {
      return reply.code(404).send({ error: { code: "not_found", message: "Merchant not found" } });
    }
    // Never expose the password hash.
    const { passwordHash, ...safe } = merchant;
    return reply.send({ merchant: safe });
  });

  // PATCH /v1/merchants/me — update merchant profile (display name, logo, support email, branding, payout wallet).
  app.patch("/me", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    // If payout wallet is being changed (and walletVerified is not explicitly set to true),
    // reset walletVerified (must re-verify). This allows the wallet/verify endpoint to
    // set walletVerified=true without a subsequent PATCH resetting it.
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.payoutWallet && parsed.data.walletVerified !== true) {
      data.walletVerified = false;
      data.walletVerifiedAt = null;
    }
    const merchant = await prisma.merchant.update({
      where: { id: req.merchantId! },
      data: data as never,
    });
    const { passwordHash, ...safe } = merchant;
    return reply.send({ merchant: safe });
  });

  // GET /v1/merchants/wallet/challenge — generates a one-time challenge for wallet verification.
  // The merchant's wallet signs this challenge via personal_sign. PRD §8.1.
  app.get("/wallet/challenge", { preHandler: [app.authenticate] }, async (req) => {
    const challenge = "ezpayz-verify-" + randomBytes(16).toString("hex");
    // Store the challenge as a signed token (no DB column needed — verify by signature + expiry).
    const exp = Math.floor(Date.now() / 1000) + 300; // 5 min
    const token = Buffer.from(JSON.stringify({ merchantId: req.merchantId!, challenge, exp })).toString("base64url");
    const hmac = (await import("node:crypto")).createHmac("sha256", env.JWT_SECRET).update(token).digest("base64url");
    return { challenge, verificationToken: `${token}.${hmac}`, message: `Sign this message to verify wallet ownership: ${challenge}` };
  });

  // POST /v1/merchants/wallet/verify — verifies the merchant controls the wallet by checking the signature.
  app.post("/wallet/verify", { preHandler: [app.authenticate, app.requireSecretKey] }, async (req, reply) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "validation_error", message: parsed.error.issues.map((i) => i.message).join("; ") } });
    }
    const { wallet, signature, challenge, verificationToken } = parsed.data;

    // Verify the verification token (ensures the challenge was issued by us + hasn't expired).
    const tokenParts = (verificationToken ?? "").split(".");
    if (tokenParts.length !== 2) {
      return reply.code(400).send({ error: { code: "invalid_challenge", message: "Invalid or expired verification token" } });
    }
    const [body, sig] = tokenParts;
    const expectedSig = (await import("node:crypto")).createHmac("sha256", env.JWT_SECRET).update(body).digest("base64url");
    if (sig !== expectedSig) {
      return reply.code(400).send({ error: { code: "invalid_challenge", message: "Invalid verification token" } });
    }
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { merchantId: string; challenge: string; exp: number };
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return reply.code(400).send({ error: { code: "challenge_expired", message: "Verification challenge expired" } });
      }
      if (payload.merchantId !== req.merchantId!) {
        return reply.code(403).send({ error: { code: "forbidden", message: "Challenge was not issued for this merchant" } });
      }
      if (payload.challenge !== challenge) {
        return reply.code(400).send({ error: { code: "challenge_mismatch", message: "Challenge does not match the verification token" } });
      }
    } catch {
      return reply.code(400).send({ error: { code: "invalid_challenge", message: "Invalid verification token payload" } });
    }

    // Recover the signer from the personal_sign signature.
    const messageToSign = `Sign this message to verify wallet ownership: ${challenge}`;
    try {
      const { recoverMessageAddress } = await import("viem");
      const signer = await recoverMessageAddress({
        message: messageToSign,
        signature: signature as `0x${string}`,
      });
      if (signer.toLowerCase() !== wallet.toLowerCase()) {
        return reply.code(403).send({ error: { code: "signature_mismatch", message: "Signature does not match the provided wallet address" } });
      }
    } catch {
      return reply.code(400).send({ error: { code: "invalid_signature", message: "Could not recover signer from signature" } });
    }

    // Mark wallet as verified + set it as the payout wallet.
    await prisma.merchant.update({
      where: { id: req.merchantId! },
      data: { payoutWallet: wallet, walletVerified: true, walletVerifiedAt: new Date() },
    });
    return reply.send({ verified: true, wallet });
  });
}
