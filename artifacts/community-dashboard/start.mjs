import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const PORT = parseInt(process.env.PORT || "3000", 10);
const BASE_PATH = process.env.BASE_PATH || "/community-dashboard/";
const API_ORIGIN = `http://localhost:${process.env.API_PORT || "8080"}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".webp": "image/webp",
};

function proxyToApi(req, res, apiPath) {
  const target = new URL(apiPath + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""), API_ORIGIN);
  const options = {
    hostname: target.hostname,
    port: target.port || 8080,
    path: target.pathname + target.search,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${target.port || 8080}` },
  };

  const proxy = http.request(options, (apiRes) => {
    res.writeHead(apiRes.statusCode, apiRes.headers);
    apiRes.pipe(res);
  });

  proxy.on("error", (err) => {
    console.error("API proxy error:", err.message);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "API unavailable", detail: err.message }));
  });

  req.pipe(proxy);
}

const server = http.createServer((req, res) => {
  let url = req.url.split("?")[0];

  // Strip the base path prefix
  if (url.startsWith(BASE_PATH)) {
    url = "/" + url.slice(BASE_PATH.length);
  } else if (!url.startsWith("/")) {
    url = "/" + url;
  }

  // Proxy /api/* requests to the API server
  if (url.startsWith("/api/")) {
    proxyToApi(req, res, url);
    return;
  }

  let filePath = path.join(DIST, url === "/" ? "index.html" : url);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  const ct = MIME[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": ct,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
    });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Community Dashboard serving on http://0.0.0.0:${PORT}${BASE_PATH}`);
  console.log(`API calls proxied to ${API_ORIGIN}`);
});
