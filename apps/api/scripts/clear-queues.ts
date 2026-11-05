import "../src/config";
import { Queue } from "bullmq";
import { getRedisConnection } from "../src/queues/connection";

async function main(): Promise<void> {
  for (const name of ["relayer", "webhook", "email", "scheduler"]) {
    const q = new Queue(name, { connection: getRedisConnection() });
    await q.obliterate({ force: true }).catch(() => {});
    await q.clean(0, 1000, "failed").catch(() => {});
    await q.clean(0, 1000, "completed").catch(() => {});
    await q.clean(0, 1000, "wait").catch(() => {});
    await q.clean(0, 1000, "active").catch(() => {});
    await q.clean(0, 1000, "delayed").catch(() => {});
    console.log("cleared queue:", name);
    await q.close();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
