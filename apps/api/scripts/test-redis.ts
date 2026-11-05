import "../src/config";
import { Redis } from "ioredis";

async function main(): Promise<void> {
  let url = process.env.REDIS_URL;
  if (!url || url.length === 0) {
    throw new Error("REDIS_URL not set in .env");
  }
  // Force TLS: Upstash requires rediss://; if the pasted URL is redis://, upgrade it.
  if (url.startsWith("redis://")) {
    url = "rediss://" + url.slice("redis://".length);
    console.log("NOTE: upgraded redis:// to rediss:// (TLS) for Upstash.");
  }
  console.log("connecting to Redis (url length:", url.length, ")...");
  const redis = new Redis(url, { connectTimeout: 15000, maxRetriesPerRequest: 1 });
  redis.on("error", (e) => console.error("redis error event:", e.message));

  const ping = await redis.ping();
  console.log("PING:", ping);

  await redis.set("wcp:test", "hello-from-gateway");
  const val = await redis.get("wcp:test");
  console.log("SET/GET wcp:test =", val);
  await redis.del("wcp:test");

  const info = await redis.info("server");
  const versionLine = info.split("\n").find((l) => l.startsWith("redis_version:"));
  console.log(versionLine?.trim() ?? "(version unknown)");

  await redis.quit();
  console.log("Redis OK — connection working.");
}

main().catch((e) => {
  console.error("Redis test FAILED:", e.message);
  process.exit(1);
});
