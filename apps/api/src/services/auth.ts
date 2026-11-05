import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import type { Merchant } from "../db/generated";

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** PRD §8.1 — register a new merchant (the tenant root). Email must be unique. */
export async function registerMerchant(
  app: FastifyInstance,
  businessEmail: string,
  password: string,
  businessName: string
): Promise<{ merchant: Merchant; token: string }> {
  const existing = await prisma.merchant.findUnique({ where: { businessEmail } });
  if (existing) {
    throw { statusCode: 409, code: "email_taken", message: "Email already registered" };
  }
  const passwordHash = await hashPassword(password);
  const merchant = await prisma.merchant.create({
    data: { businessEmail, businessName, displayName: businessName, passwordHash, payoutWallet: "" },
  });
  const token = (app as unknown as { jwt: { sign: (p: Record<string, unknown>) => string } }).jwt.sign({ sub: merchant.id });
  return { merchant, token };
}

/** PRD §8.1 — login with email + password, returns a JWT. */
export async function loginMerchant(
  app: FastifyInstance,
  businessEmail: string,
  password: string
): Promise<{ merchant: Merchant; token: string }> {
  const merchant = await prisma.merchant.findUnique({ where: { businessEmail } });
  if (!merchant || !merchant.passwordHash) {
    throw { statusCode: 401, code: "invalid_credentials", message: "Invalid email or password" };
  }
  const ok = await verifyPassword(password, merchant.passwordHash);
  if (!ok) {
    throw { statusCode: 401, code: "invalid_credentials", message: "Invalid email or password" };
  }
  const token = (app as unknown as { jwt: { sign: (p: Record<string, unknown>) => string } }).jwt.sign({ sub: merchant.id });
  return { merchant, token };
}
