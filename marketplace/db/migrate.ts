import { readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { getSql } from "../src/lib/server/db";

// Next 16 removed the named @next/env export — load .env manually.
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
const sql = getSql();
await sql`CREATE TABLE IF NOT EXISTS marketplace_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
const applied = new Set((await sql`SELECT name FROM marketplace_migrations`).map((row) => row.name));
const dir = new URL("./", import.meta.url);
for (const name of (await readdir(dir)).filter((name) => /^\d+-.+\.sql$/.test(name)).sort()) {
  if (applied.has(name)) continue;
  const statements = (await readFile(new URL(name, dir), "utf8")).split(";").map((part) => part.trim()).filter(Boolean);
  await sql.transaction([
    sql`INSERT INTO marketplace_migrations (name) VALUES (${name})`,
    ...statements.map((statement) => sql.query(statement)),
  ]);
  console.log("Applied", name);
}
