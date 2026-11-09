import type { Server as HttpServer } from "node:http";
import type { Application, Request, RequestHandler } from "express";
import { Server, type Socket } from "socket.io";
import {
  allowedOrigins,
  createSessionMiddleware,
} from "../modules/auth/auth.session.js";
import { User } from "../modules/auth/user.model.js";
import {
  Wedding,
  canOrganize,
  roleFor,
} from "../modules/weddings/wedding.models.js";

// Socket events contain invalidation hints only. Data still comes from authorized REST APIs.
export function attachRealtime(server: HttpServer, app: Application) {
  const io = new Server(server, {
    maxHttpBufferSize: 20000,
    cors: { origin: allowedOrigins, credentials: true },
    allowRequest: (req, done) =>
      done(
        null,
        !req.headers.origin || allowedOrigins.includes(req.headers.origin),
      ),
  });
  io.engine.use(
    createSessionMiddleware() as Parameters<typeof io.engine.use>[0],
  );
  async function authorize(socket: Socket, reload = false) {
    const req = socket.request as Request;
    if (reload) {
      await new Promise<void>((resolve, reject) =>
        req.session.reload((error) => (error ? reject(error) : resolve())),
      );
    }
    const userId = req.session?.userId;
    if (!userId) throw new Error("Sign in to receive wedding updates.");
    const user = await User.findById(userId).select("+sessionVersion");
    if (
      !user ||
      (user.sessionVersion || 0) !== (req.session.sessionVersion || 0)
    )
      throw new Error("Sign in to receive wedding updates.");
    const wedding = await Wedding.findOne({ "members.userId": userId }).select(
      "createdBy members",
    );
    if (!wedding) throw new Error("Wedding access is required.");
    const role = roleFor(wedding, userId);
    if (!role) throw new Error("Wedding access was removed.");
    return { userId, weddingId: wedding.id, role, sessionId: req.sessionID };
  }
  io.use(async (socket, next) => {
    try {
      socket.data = await authorize(socket);
      next();
    } catch {
      next(new Error("Wedding access is required."));
    }
  });
  io.on("connection", (socket) => {
    void socket.join("session:" + socket.data.sessionId);
    void socket.join("user:" + socket.data.userId);
    void socket.join("wedding:" + socket.data.weddingId + ":team");
    if (canOrganize(socket.data.role))
      void socket.join("wedding:" + socket.data.weddingId + ":organizers");
  });
  let checking = false;
  async function revalidate(weddingId?: string) {
    // Recheck the database-backed session, not the handshake's stale user/role snapshot.
    for (const socket of io.sockets.sockets.values()) {
      if (weddingId && socket.data.weddingId !== weddingId) continue;
      try {
        const access = await authorize(socket, true);
        if (
          access.weddingId !== socket.data.weddingId ||
          access.role !== socket.data.role
        )
          socket.disconnect(true);
      } catch {
        socket.disconnect(true);
      }
    }
  }
  const timer = setInterval(() => {
    if (checking) return;
    checking = true;
    void revalidate().finally(() => {
      checking = false;
    });
  }, 15000);
  timer.unref();
  server.once("close", () => clearInterval(timer));
  app.locals.realtime = {
    disconnectUser: (userId: string) =>
      io.in("user:" + userId).disconnectSockets(true),
    disconnectSession: (sessionId: string) =>
      io.in("session:" + sessionId).disconnectSockets(true),
    changed: async (
      userId: string | undefined,
      path: string,
      weddingId?: string,
    ) => {
      let currentWeddingId = weddingId;
      if (!currentWeddingId && userId) {
        const wedding = await Wedding.findOne({
          "members.userId": userId,
        }).select("_id");
        currentWeddingId = wedding?.id;
      }
      if (!currentWeddingId) return;
      if (path.includes("members") || path.includes("team-invites"))
        await revalidate(currentWeddingId);
      const privateChange =
        path.includes("/budget") ||
        path.includes("/guests") ||
        path.includes("/upload-links") ||
        path.includes("/uploads");
      const room =
        "wedding:" +
        currentWeddingId +
        (privateChange ? ":organizers" : ":team");
      let resource = "workspace";
      if (path.includes("/budget")) resource = "finance";
      else if (path.includes("/guests")) resource = "guests";
      io.to(room).emit("workspace:changed", { resource });
    },
  };
  return io;
}

// Mounted once: publish after a successful database-backed mutation has responded.
export const publishChanges: RequestHandler = (req, res, next) => {
  const path = req.originalUrl.split("?")[0];
  res.once("finish", () => {
    if (
      res.statusCode >= 400 ||
      ["GET", "HEAD", "OPTIONS"].includes(req.method)
    )
      return;
    const realtime = req.app.locals.realtime;
    if (!realtime) return;
    if (path.endsWith("/logout")) {
      realtime.disconnectSession(req.sessionID);
      return;
    }
    if (req.session?.userId || res.locals.weddingId) {
      void realtime
        .changed(req.session?.userId, path, res.locals.weddingId)
        .catch(() => console.error("[realtime] Could not publish an update."));
    }
  });
  next();
};
