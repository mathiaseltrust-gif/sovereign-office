import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

const ALLOWED = new Set([
  "people",
  "families",
  "events",
  "places",
  "sources",
  "citations",
  "media",
  "notes",
  "repositories",
  "tags",
]);

let cachedToken: string | null = null;
let cachedUntil = 0;

const baseUrl = () => (process.env.GRAMPS_API_URL || "http://127.0.0.1:5010").replace(/\/$/, "");

async function getToken() {
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;

  const username = process.env.GRAMPS_USERNAME;
  const password = process.env.GRAMPS_PASSWORD;

  if (!username || !password) {
    throw new Error("Missing GRAMPS_USERNAME or GRAMPS_PASSWORD");
  }

  const r = await fetch(`${baseUrl()}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!r.ok) throw new Error(`Gramps token failed: ${r.status}`);

  const j = await r.json() as { access_token: string };
  cachedToken = j.access_token;
  cachedUntil = Date.now() + 12 * 60 * 1000;
  return cachedToken;
}

function asyncRoute(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

async function proxy(req: Request, res: Response) {
  const resource = String(req.params.resource || "");
  if (!ALLOWED.has(resource)) {
    res.status(404).json({ error: "Unsupported Gramps resource" });
    return;
  }

  const token = await getToken();
  const query = new URLSearchParams(
    Object.fromEntries(
      Object.entries(req.query).flatMap(([k, v]) =>
        typeof v === "string" ? [[k, v]] : Array.isArray(v) ? v.map(s => [k, String(s)]) : []
      )
    )
  ).toString();
  const handle = req.params.handle ? `/${encodeURIComponent(String(req.params.handle))}` : "";
  const url = `${baseUrl()}/api/${resource}/${handle}${query ? `?${query}` : ""}`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await r.text();
  res.status(r.status).type(r.headers.get("content-type") || "application/json").send(text);
}

router.get("/health", requireAuth, asyncRoute(async (_req, res) => {
  await getToken();
  res.json({ status: "ok", source: "gramps", baseUrl: baseUrl() });
}));

router.get("/timeline", requireAuth, asyncRoute(async (req, res) => {
  req.params.resource = "events";
  await proxy(req, res);
}));

router.get("/map", requireAuth, asyncRoute(async (req, res) => {
  req.params.resource = "places";
  await proxy(req, res);
}));

router.get("/:resource", requireAuth, asyncRoute(proxy));
router.get("/:resource/:handle", requireAuth, asyncRoute(proxy));

export default router;
