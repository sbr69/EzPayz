import IORedis from "ioredis";

// Upstash requires rediss:// (TLS). Upgrade if needed.
function getRedisUrl(): string {
  let url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not set");
  if (url.startsWith("redis://")) url = "rediss://" + url.slice("redis://".length);
  return url;
}

// Common connection options for Upstash reliability.
const REDIS_OPTS = {
  connectTimeout: 15000,
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
  keepAlive: 30000, // send keepalive every 30s — prevents Upstash from closing idle connections
  reconnectOnError(err: Error): boolean {
    // Reconnect on these errors instead of silently dying
    const targets = ["READONLY", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"];
    return targets.some((t) => err.message.includes(t));
  },
};

// Shared connection for Queue (producer side — non-blocking, safe to share).
let queueConnection: IORedis | null = null;
export function getRedisConnection(): IORedis {
  if (!queueConnection) {
    queueConnection = new IORedis(getRedisUrl(), REDIS_OPTS);
  }
  return queueConnection;
}

// Dedicated connection for each Worker (consumer side — blocking BRPOPLPUSH).
// BullMQ requires each Worker to have its own connection to avoid blocking-read conflicts.
export function createWorkerConnection(): IORedis {
  return new IORedis(getRedisUrl(), REDIS_OPTS);
}
