import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { getDb } from "../src/lib/server/db";
import { products } from "../src/lib/server/schema";
import { isItemPrice } from "../src/lib/domain";

// Next 16 removed the named @next/env export — load .env manually.
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
const catalog: (typeof products.$inferInsert)[] = JSON.parse(await readFile(new URL("./catalog.json", import.meta.url), "utf8"));
if (catalog.length !== 12 || catalog.some((item) => !isItemPrice(item.price))) {
  throw new Error("Expected 12 listings priced below 10 USDT");
}
await getDb().insert(products).values(catalog).onConflictDoNothing({ target: products.slug });
console.log("Seeded marketplace catalog");
