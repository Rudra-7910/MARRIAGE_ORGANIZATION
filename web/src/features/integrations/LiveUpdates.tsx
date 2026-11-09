import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";

export function LiveUpdates({ userId }: { userId: string }) {
  const cache = useQueryClient();
  useEffect(() => {
    // Vercel requires direct WebSockets rather than Socket.IO's HTTP polling.
    // Saved data still refreshes through the existing authorized polling queries.
    const socket = io({ withCredentials: true, transports: ["websocket"] });
    const privateKeys = [
      "wedding-dashboard",
      "wedding-setup",
      "planning",
      "wedding-team",
      "finance",
      "finance-summary",
      "guests",
      "invitation",
      "photos",
      "upload-link",
      "announcements",
    ];
    socket.on("connect", () => {
      void cache.invalidateQueries({ queryKey: ["auth-user"] });
      void cache.invalidateQueries({
        predicate: (query) =>
          privateKeys.includes(String(query.queryKey[0])) &&
          query.queryKey[1] === userId,
      });
    });
    socket.on("workspace:changed", (event: { resource: string }) => {
      let keys = privateKeys.filter((key) => key !== "invitation");
      if (event.resource === "finance") keys = ["finance", "finance-summary"];
      else if (event.resource === "guests") keys = ["guests"];
      void cache.invalidateQueries({
        predicate: (query) =>
          keys.includes(String(query.queryKey[0])) &&
          query.queryKey[1] === userId,
      });
    });
    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") {
        // Clear protected values immediately when the server removes access.
        void cache.resetQueries({
          predicate: (query) =>
            privateKeys.includes(String(query.queryKey[0])) &&
            query.queryKey[1] === userId,
        });
        void cache.invalidateQueries({ queryKey: ["auth-user"] });
        // A valid user may have changed roles. Reconnect through the authorization middleware.
        socket.connect();
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [cache, userId]);
  return null;
}
