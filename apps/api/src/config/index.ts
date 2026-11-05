import { z } from "zod";
import path from "node:path";
import fs from "node:fs";

// Load repo-root .env into process.env (dev convenience). In production, the host
// (Render) sets env vars directly, so this is a no-op there.
function loadEnvFile(): void {
  const candidates = [
    path.resolve(process.cwd(), "../../.env"), // run via pnpm --filter api (cwd = apps/api)
    path.resolve(process.cwd(), ".env"), // run from repo root
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      // Last definition wins within the .env file (handles duplicates); host env vars still take precedence.
      const fileEnv: Record<string, string> = {};
      for (const line of fs.readFileSync(p, "utf8").split("\n")) {
        const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
        if (m) fileEnv[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
      }
      for (const [k, v] of Object.entries(fileEnv)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
      return;
    }
  }
}
loadEnvFile();

// JWT_SECRET: fall back to a dev default if unset/empty/too-short. Production must set a strong value.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  process.env.JWT_SECRET = "dev-insecure-jwt-secret-change-me";
}

// PAYEESHIELD_SIGNING_KEY: dev default (anvil key #0) if unset/invalid. Testnet-only; prod must set a real key.
if (!process.env.PAYEESHIELD_SIGNING_KEY || !/^0x[a-fA-F0-9]{64}$/.test(process.env.PAYEESHIELD_SIGNING_KEY)) {
  process.env.PAYEESHIELD_SIGNING_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  DATABASE_URL: z.string(),
  WHITECHAIN_RPC_URL: z.string().default("https://rpc.testnet.whitechain.io"),
  WHITECHAIN_CHAIN_ID: z.coerce.number().default(1874),
  USDT_ADDRESS: z.string().default("0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7"),
});

if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET === "dev-insecure-jwt-secret-change-me") {
  console.error("JWT_SECRET must be set to a strong value in production");
  process.exit(1);
}

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
  );
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
