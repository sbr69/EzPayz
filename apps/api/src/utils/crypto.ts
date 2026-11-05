import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for secrets stored at rest.
 * Used for webhook signing secrets — the secret must be decryptable (unlike API key hashes)
 * because it's needed to sign webhook deliveries.
 *
 * The encryption key is read from ENCRYPTION_KEY env var (32 bytes, hex-encoded).
 * If not set, falls back to JWT_SECRET (not ideal for production, but works for MVP).
 */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? "dev-only-encryption-key-32b!";
  // Derive a 32-byte key from the input (handles arbitrary-length secrets).
  const buf = Buffer.from(raw);
  if (buf.length >= 32) return buf.subarray(0, 32);
  // Pad to 32 bytes if shorter.
  const padded = Buffer.alloc(32);
  buf.copy(padded);
  return padded;
}

/** Encrypts a plaintext string → "enc:<iv>:<tag>:<ciphertext>" (all hex). */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypts an "enc:..." string back to plaintext. Returns the input as-is if not encrypted. */
export function decrypt(stored: string): string {
  if (!stored?.startsWith("enc:")) return stored; // plaintext fallback (legacy data)
  const parts = stored.split(":");
  if (parts.length !== 4) throw new Error("Invalid encrypted format");
  const key = getKey();
  const iv = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");
  const ciphertext = Buffer.from(parts[3], "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
