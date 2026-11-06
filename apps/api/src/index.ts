import { buildApp } from "./app";
import { env } from "./config";
import "./worker"; // Start background workers (relayer, webhook, scheduler) in the same process

async function start(): Promise<void> {
  const app = await buildApp();
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`EzPayz API + workers listening on :${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
