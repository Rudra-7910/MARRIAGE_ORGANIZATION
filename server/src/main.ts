import { createServer } from "node:http";
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
  // Start HTTP only after MongoDB and the required indexes are ready.
  await connectDatabase();

  const app = createApp();
  const server = createServer(app);
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

    server.close(async () => {
      await exitAfterDisconnect(0);
    });
    server.closeIdleConnections();
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch(async () => {
  console.error(
    "[startup] Server could not start. Check MongoDB connectivity and the required database indexes.",
  );
  await exitAfterDisconnect(1);
});
