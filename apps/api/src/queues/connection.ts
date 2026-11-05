import IORedis from "ioredis";

// Single Redis connection for BullMQ. Upstash requires rediss:// (TLS).
let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    let url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL not set");
    if (url.startsWith("redis://")) url = "rediss://" + url.slice("redis://".length); // upgrade to TLS for Upstash
    connection = new IORedis(url, { connectTimeout: 15000, maxRetriesPerRequest: null, enableReadyCheck: false });
  }
  return connection;
}
