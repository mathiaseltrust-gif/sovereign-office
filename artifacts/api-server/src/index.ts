import http from "http";
import { URL } from "url";
import app from "./app";
import { logger } from "./lib/logger";
import { ensureDocRefColumns } from "./lib/doc-ref";
import { startDigestProcessor } from "./services/digest-processor";
import { startRedisSubscriber } from "./lib/sse-manager";
import { handleWsUpgrade } from "./lib/ws-manager";
import { resolveUserIdFromToken } from "./auth/entra";
import type { IncomingMessage } from "http";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureDocRefColumns().catch((err) => {
  logger.warn({ err }, "Could not initialize tribal document reference columns");
});

// Authority directory: baseline ingestion runs once at startup (non-blocking)
import("./routes/authority/sync").then(({ default: _syncRouter }) => {
  // Trigger a lightweight startup ingest for federal + CA structural agencies
  import("./lib/authority-startup-ingest").then(({ runStartupIngest }) => {
    runStartupIngest().catch((err: unknown) => {
      logger.warn({ err }, "Authority startup ingest failed (non-fatal)");
    });
  }).catch(() => { /* module not yet available — skip */ });
}).catch(() => { /* skip */ });

startRedisSubscriber();
startDigestProcessor();

async function resolveWsUserId(req: IncomingMessage): Promise<number | null> {
  try {
    const urlStr = `http://localhost${req.url ?? ""}`;
    const parsed = new URL(urlStr);
    const rawAuth =
      parsed.searchParams.get("authorization") ??
      (req.headers.authorization as string | undefined) ??
      "";
    return await resolveUserIdFromToken(rawAuth);
  } catch {
    return null;
  }
}

const server = http.createServer(app);

server.on("upgrade", (req, socket, head) => {
  const pathname = req.url?.split("?")[0] ?? "";
  if (pathname === "/api/messages/ws") {
    handleWsUpgrade(req, socket as import("net").Socket, head, resolveWsUserId);
  } else {
    socket.destroy();
  }
});

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening (HTTP + WebSocket)");
});
