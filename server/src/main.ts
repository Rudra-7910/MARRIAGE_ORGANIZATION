import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { logger } from "./config/logger.js";
import { attachRealtime } from "./config/realtime.js";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";

async function exitAfterDisconnect(exitCode: number) {
  try {
    await disconnectDatabase();
  } catch {
    console.error("[database] Could not close the connection cleanly.");
  }
  process.exit(exitCode);
}

async function startServer() {
  if (
    env.isProduction &&
    !existsSync(path.resolve(import.meta.dirname, "../../web/dist/index.html"))
  ) {
    throw new Error(
      "The frontend build is missing. Run npm run build before starting production.",
    );
  }
  // Start HTTP only after MongoDB and the required indexes are ready.
  await connectDatabase();

  const app = createApp();
  const server = createServer(app);
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  const io = attachRealtime(server, app);
  let stopping = false;

  server.on("error", async () => {
    console.error(
      "[server] Could not listen. Check HOST/PORT and whether the port is occupied.",
    );
    await exitAfterDisconnect(1);
  });

  server.listen(env.port, env.host, async () => {
    console.info(`[server] Running at http://${env.host}:${env.port}`);
  });

  function shutdown() {
    if (stopping) return;
    stopping = true;
    console.info("[server] Closing HTTP and database connections.");

    // Avoid hanging forever if a client keeps a connection open.
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();

    io.close(async () => {
      await exitAfterDisconnect(0);
    });
    server.closeIdleConnections();
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch(async (error: unknown) => {
  logger.error(
    { errorType: error instanceof Error ? error.name : "UnknownError" },
    "Startup failed. Check the build, MongoDB connectivity and indexes.",
  );
  await exitAfterDisconnect(1);
});
