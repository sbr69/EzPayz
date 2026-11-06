import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

export function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("Marketplace database is not configured");
  return neon(process.env.DATABASE_URL);
}

export function getDb() {
  return drizzle(getSql());
}
