import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { logger } from "./logger";

interface AuthedSocket extends WebSocket {
  userId?: number;
  isAlive?: boolean;
}

const wss = new WebSocketServer({ noServer: true });
const userSockets = new Map<number, Set<AuthedSocket>>();

function addSocket(userId: number, socket: AuthedSocket) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(socket);
}

function removeSocket(userId: number, socket: AuthedSocket) {
  userSockets.get(userId)?.delete(socket);
  if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
}

export function pushWsEvent(userId: number, event: object): void {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const payload = JSON.stringify(event);
  for (const sock of sockets) {
    if (sock.readyState === WebSocket.OPEN) {
      try { sock.send(payload); } catch { /* closed */ }
    }
  }
}

// Heartbeat — drop stale connections every 30s
setInterval(() => {
  for (const sockets of userSockets.values()) {
    for (const sock of sockets) {
      if (!sock.isAlive) { sock.terminate(); continue; }
      sock.isAlive = false;
      sock.ping();
    }
  }
}, 30_000);

export function handleWsUpgrade(
  req: IncomingMessage,
  socket: import("net").Socket,
  head: Buffer,
  resolveUserId: (req: IncomingMessage) => Promise<number | null>,
): void {
  wss.handleUpgrade(req, socket, head, async (ws: AuthedSocket) => {
    const userId = await resolveUserId(req);
    if (!userId) {
      ws.close(1008, "Unauthorized");
      return;
    }
    ws.userId = userId;
    ws.isAlive = true;
    addSocket(userId, ws);
    wss.emit("connection", ws, req);
    logger.debug({ userId }, "WS client connected");

    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("close", () => {
      removeSocket(userId, ws);
      logger.debug({ userId }, "WS client disconnected");
    });
    ws.on("error", (err) => {
      logger.warn({ err, userId }, "WS socket error");
    });

    ws.send(JSON.stringify({ type: "connected", userId }));
  });
}
