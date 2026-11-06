import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { getDb } from "../src/lib/server/db";
import { products } from "../src/lib/server/schema";
import { isItemPrice } from "../src/lib/domain";

loadEnvConfig(process.cwd());
const catalog: (typeof products.$inferInsert)[] = JSON.parse(await readFile(new URL("./catalog.json", import.meta.url), "utf8"));
if (catalog.length !== 12 || catalog.some((item) => !isItemPrice(item.price))) {
  throw new Error("Expected 12 listings priced below 10 USDT");
}
await getDb().insert(products).values(catalog).onConflictDoNothing({ target: products.slug });
console.log("Seeded marketplace catalog");
