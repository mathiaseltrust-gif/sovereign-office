import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger";
import {
  askPublicHeritageGuide,
  allowPublicHeritageRequest,
  sanitizePublicHeritageHistory,
} from "../../lib/public-heritage-guide";
import {
  PUBLIC_MCP_PROFILE,
  PUBLIC_MCP_PROMPTS,
  PUBLIC_MCP_PROTOCOL_VERSION,
  PUBLIC_MCP_RESOURCES,
  PUBLIC_MCP_SERVER_INFO,
  PUBLIC_MCP_TOOLS,
  PUBLIC_OFFICE_RESOURCE,
} from "../../mcp/public-capabilities";

const router = Router();

type JsonRpcId = string | number | null;
type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

const HeritageToolInput = z.object({
  question: z.string().trim().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(1000),
  })).max(10).optional(),
});

function publicClientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined;
  return `mcp:${first || req.socket.remoteAddress || "unknown"}`;
}

function isModernRequest(req: Request, body: JsonRpcRequest): boolean {
  const header = req.header("MCP-Protocol-Version");
  const meta = body.params?._meta;
  const metaVersion =
    meta && typeof meta === "object"
      ? (meta as Record<string, unknown>)["io.modelcontextprotocol/protocolVersion"]
      : undefined;
  return header === PUBLIC_MCP_PROTOCOL_VERSION || metaVersion === PUBLIC_MCP_PROTOCOL_VERSION;
}

function expectedName(body: JsonRpcRequest): string | null {
  const params = body.params ?? {};
  if (body.method === "tools/call" || body.method === "prompts/get") {
    return typeof params.name === "string" ? params.name : null;
  }
  if (body.method === "resources/read") {
    return typeof params.uri === "string" ? params.uri : null;
  }
  return null;
}

function modernHeaderError(req: Request, body: JsonRpcRequest): string | null {
  if (!isModernRequest(req, body)) return null;

  const protocol = req.header("MCP-Protocol-Version");
  if (protocol !== PUBLIC_MCP_PROTOCOL_VERSION) {
    return `MCP-Protocol-Version must be ${PUBLIC_MCP_PROTOCOL_VERSION}`;
  }

  const methodHeader = req.header("Mcp-Method");
  if (!methodHeader || methodHeader !== body.method) {
    return "Mcp-Method header is missing or does not match the JSON-RPC method";
  }

  const name = expectedName(body);
  if (name !== null) {
    const nameHeader = req.header("Mcp-Name");
    if (!nameHeader || nameHeader !== name) {
      return "Mcp-Name header is missing or does not match the requested tool/resource/prompt";
    }
  }

  return null;
}

function serverMeta() {
  return {
    "io.modelcontextprotocol/serverInfo": PUBLIC_MCP_SERVER_INFO,
  };
}

function modernResult(result: Record<string, unknown>): Record<string, unknown> {
  return {
    resultType: "complete",
    ...result,
    _meta: {
      ...(typeof result._meta === "object" && result._meta ? result._meta : {}),
      ...serverMeta(),
    },
  };
}

function sendRpc(
  req: Request,
  res: Response,
  id: JsonRpcId | undefined,
  result: Record<string, unknown>,
  modern: boolean,
  status = 200,
): void {
  const payload = {
    jsonrpc: "2.0",
    id: id ?? null,
    result: modern ? modernResult(result) : result,
  };

  const accept = String(req.headers.accept ?? "");
  if (modern && accept.includes("text/event-stream")) {
    res.status(status);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.send(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
    return;
  }

  res.status(status).json(payload);
}

function sendError(
  req: Request,
  res: Response,
  id: JsonRpcId | undefined,
  code: number,
  message: string,
  status = 400,
  data?: unknown,
): void {
  const error = data === undefined ? { code, message } : { code, message, data };
  const payload = { jsonrpc: "2.0", id: id ?? null, error };
  const accept = String(req.headers.accept ?? "");

  if (accept.includes("text/event-stream")) {
    res.status(status);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.send(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
    return;
  }

  res.status(status).json(payload);
}

function toolText(value: unknown) {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

router.get("/status", (_req, res) => {
  res.json({
    online: true,
    phase: "visitor_media_phase_0",
    protocolVersion: PUBLIC_MCP_PROTOCOL_VERSION,
    endpoint: "/api/mcp",
    profile: PUBLIC_MCP_PROFILE,
    tools: PUBLIC_MCP_TOOLS.map(tool => tool.name),
    resources: PUBLIC_MCP_RESOURCES.map(resource => resource.uri),
    prompts: PUBLIC_MCP_PROMPTS.map(prompt => prompt.name),
  });
});

router.post("/", async (req, res) => {
  const body = req.body as JsonRpcRequest;

  if (!body || Array.isArray(body) || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    sendError(req, res, body?.id, -32600, "Invalid JSON-RPC request");
    return;
  }

  const modern = isModernRequest(req, body);
  const headerProblem = modernHeaderError(req, body);
  if (headerProblem) {
    sendError(req, res, body.id, -32020, "HeaderMismatch", 400, { detail: headerProblem });
    return;
  }

  // Notifications have no id. The public Phase 0 server has no notification side effects.
  if (body.id === undefined) {
    res.status(202).end();
    return;
  }

  try {
    switch (body.method) {
      case "server/discover": {
        sendRpc(req, res, body.id, {
          supportedVersions: [PUBLIC_MCP_PROTOCOL_VERSION, "2025-11-25"],
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          instructions:
            "Public Visitor / Media gateway. Use only the advertised public tools and resources. Internal records and Office actions are intentionally unavailable.",
          ttlMs: 300_000,
          cacheScope: "public",
        }, true);
        return;
      }

      case "initialize": {
        const requested = typeof body.params?.protocolVersion === "string"
          ? body.params.protocolVersion
          : "2025-11-25";
        sendRpc(req, res, body.id, {
          protocolVersion: requested,
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: PUBLIC_MCP_SERVER_INFO,
          instructions:
            "Public Visitor / Media gateway. Internal records and Office actions are not exposed.",
        }, false);
        return;
      }

      case "ping": {
        sendRpc(req, res, body.id, {}, modern);
        return;
      }

      case "tools/list": {
        sendRpc(req, res, body.id, {
          tools: PUBLIC_MCP_TOOLS,
          ttlMs: 300_000,
          cacheScope: "public",
        }, modern);
        return;
      }

      case "tools/call": {
        const name = body.params?.name;
        const args = body.params?.arguments;

        if (typeof name !== "string") {
          sendError(req, res, body.id, -32602, "Tool name is required");
          return;
        }

        if (name === "public.get_capabilities") {
          sendRpc(req, res, body.id, toolText(PUBLIC_MCP_PROFILE), modern);
          return;
        }

        if (name === "public.get_office_info") {
          sendRpc(req, res, body.id, toolText(PUBLIC_OFFICE_RESOURCE), modern);
          return;
        }

        if (name === "public.ask_heritage_guide") {
          const parsed = HeritageToolInput.safeParse(args ?? {});
          if (!parsed.success) {
            sendError(req, res, body.id, -32602, "Invalid Heritage Guide arguments", 400, parsed.error.flatten());
            return;
          }

          const key = publicClientKey(req);
          if (!allowPublicHeritageRequest(key)) {
            sendRpc(req, res, body.id, {
              ...toolText("Too many requests. Please wait a moment before asking another question."),
              isError: true,
            }, modern, 200);
            return;
          }

          const history = sanitizePublicHeritageHistory(parsed.data.history ?? []);
          logger.info(
            { ipKey: key, chars: parsed.data.question.length },
            "Public MCP Heritage Guide request",
          );

          const reply = await askPublicHeritageGuide(parsed.data.question, history);
          sendRpc(req, res, body.id, toolText(reply), modern);
          return;
        }

        sendError(req, res, body.id, -32602, `Unknown public MCP tool: ${name}`);
        return;
      }

      case "resources/list": {
        sendRpc(req, res, body.id, {
          resources: PUBLIC_MCP_RESOURCES,
          ttlMs: 300_000,
          cacheScope: "public",
        }, modern);
        return;
      }

      case "resources/read": {
        const uri = body.params?.uri;
        if (uri === "sovereign-office://public/capabilities") {
          sendRpc(req, res, body.id, {
            contents: [{
              uri,
              mimeType: "application/json",
              text: JSON.stringify(PUBLIC_MCP_PROFILE, null, 2),
            }],
            ttlMs: 300_000,
            cacheScope: "public",
          }, modern);
          return;
        }
        if (uri === "sovereign-office://public/office") {
          sendRpc(req, res, body.id, {
            contents: [{
              uri,
              mimeType: "application/json",
              text: JSON.stringify(PUBLIC_OFFICE_RESOURCE, null, 2),
            }],
            ttlMs: 300_000,
            cacheScope: "public",
          }, modern);
          return;
        }
        sendError(req, res, body.id, -32602, "Unknown public MCP resource");
        return;
      }

      case "prompts/list": {
        sendRpc(req, res, body.id, {
          prompts: PUBLIC_MCP_PROMPTS,
          ttlMs: 300_000,
          cacheScope: "public",
        }, modern);
        return;
      }

      case "prompts/get": {
        if (body.params?.name !== "heritage-research-guide") {
          sendError(req, res, body.id, -32602, "Unknown public MCP prompt");
          return;
        }
        const rawArgs = body.params?.arguments;
        const topic =
          rawArgs && typeof rawArgs === "object" && typeof (rawArgs as Record<string, unknown>).topic === "string"
            ? String((rawArgs as Record<string, unknown>).topic).trim()
            : "";
        if (!topic) {
          sendError(req, res, body.id, -32602, "Prompt argument 'topic' is required");
          return;
        }
        sendRpc(req, res, body.id, {
          description: "A careful first-step heritage research prompt.",
          messages: [{
            role: "user",
            content: {
              type: "text",
              text:
                `Help me build a careful first-step research plan for this ancestry or family-history question: ${topic}. Start with known family facts, living elders, primary records, locations, dates, and source verification. Do not determine tribal status for me and do not assume private Office records are available.`,
            },
          }],
        }, modern);
        return;
      }

      default:
        sendError(req, res, body.id, -32601, `Method not found: ${body.method}`);
    }
  } catch (error) {
    logger.error({ err: error, method: body.method }, "Public MCP request failed");
    sendError(req, res, body.id, -32603, "Internal MCP error", 500);
  }
});

export default router;
