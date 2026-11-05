import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../db/client";
import type { MerchantApiKey, Environment } from "../db/generated";

const PREFIX = "wcp_"; // whitechain-pay

/** Generates a publishable + secret key pair. The secret is hashed at rest + shown once. */
export function generateApiKeyPair(): {
  publishable: string;
  secret: string;
  secretHash: string;
  secretLast4: string;
} {
  const publishable = PREFIX + "pub_" + randomBytes(16).toString("hex");
  const secret = PREFIX + "sec_" + randomBytes(24).toString("hex");
  const secretHash = createHash("sha256").update(secret).digest("hex");
  const secretLast4 = secret.slice(-4);
  return { publishable, secret, secretHash, secretLast4 };
}

export async function createApiKey(
  merchantId: string,
  name: string,
  environment: Environment
): Promise<{ record: MerchantApiKey; secretRevealedOnce: string }> {
  const { publishable, secret, secretHash, secretLast4 } = generateApiKeyPair();
  const record = await prisma.merchantApiKey.create({
    data: { merchantId, name, environment, publishable, secretHash, secretLast4, permissions: [], status: "active" },
  });
  return { record, secretRevealedOnce: secret };
}

export async function listApiKeys(merchantId: string): Promise<MerchantApiKey[]> {
  return prisma.merchantApiKey.findMany({ where: { merchantId }, orderBy: { createdAt: "desc" } });
}

export async function revokeApiKey(merchantId: string, id: string): Promise<void> {
  const res = await prisma.merchantApiKey.updateMany({
    where: { id, merchantId, status: "active" },
    data: { status: "revoked", revokedAt: new Date() },
  });
  if (res.count === 0) {
    throw { statusCode: 404, code: "not_found", message: "API key not found or already revoked" };
  }
}

/**
 * Resolves a publishable or secret key to its merchant + key type. Used by the auth
 * plugin to enforce scope: publishable keys are read-only (browser-safe), secret keys
 * have full write access. PRD §17.6, §23.1 — secrets are hashed at rest; lookup is by hash.
 */
export async function resolveApiKey(
  provided: string
): Promise<{ merchantId: string; environment: Environment; keyType: "publishable" | "secret" } | null> {
  const byPub = await prisma.merchantApiKey.findUnique({ where: { publishable: provided } });
  if (byPub && byPub.status === "active") {
    return { merchantId: byPub.merchantId, environment: byPub.environment, keyType: "publishable" };
  }
  const hash = createHash("sha256").update(provided).digest("hex");
  const bySecret = await prisma.merchantApiKey.findFirst({ where: { secretHash: hash, status: "active" } });
  if (bySecret) {
    return { merchantId: bySecret.merchantId, environment: bySecret.environment, keyType: "secret" };
  }
  return null;
}
