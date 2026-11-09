import { createServer } from "node:http";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { attachRealtime } from "./config/realtime.js";

// This module is reused by a warm Vercel instance; never connect per request.
await connectDatabase();
const app = createApp();

// Vercel replaces forwarded headers at its edge. Trust that single proxy so
// Express can issue HTTPS-only cookies and identify the client for rate limits.
app.set("trust proxy", 1);
const server = createServer(app);
attachRealtime(server, app);

export default server;
