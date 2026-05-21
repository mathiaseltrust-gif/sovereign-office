/**
 * Dev watch script — esbuild context watch + auto-restart.
 * Rebuilds the bundle whenever src/ changes, then kills and relaunches
 * the node process automatically. No nodemon required.
 *
 * Usage: pnpm --filter @workspace/api-server run dev:watch
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { context as esbuildContext } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(artifactDir, "dist");

let serverProcess = null;
let restarting = false;

function startServer() {
  if (restarting) return;
  restarting = true;

  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }

  setTimeout(() => {
    restarting = false;
    serverProcess = spawn(
      "node",
      ["--enable-source-maps", path.join(distDir, "index.mjs")],
      {
        stdio: "inherit",
        cwd: artifactDir,
        env: { ...process.env, NODE_ENV: "development" },
      }
    );
    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[watch] Server exited with code ${code} — waiting for next rebuild`);
      }
    });
  }, 150); // small debounce so the file is fully flushed
}

const EXTERNALS = [
  "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas",
  "bcrypt", "argon2", "fsevents", "re2", "farmhash", "xxhash-addon",
  "bufferutil", "utf-8-validate", "ssh2", "cpu-features", "dtrace-provider",
  "isolated-vm", "lightningcss", "pg-native", "oracledb",
  "mongodb-client-encryption", "nodemailer", "handlebars", "knex",
  "typeorm", "protobufjs", "onnxruntime-node",
  "@tensorflow/*", "@prisma/client", "@mikro-orm/*", "@grpc/*", "@swc/*",
  "@aws-sdk/*", "@azure/*", "@opentelemetry/*", "@google-cloud/*",
  "@google/*", "googleapis", "firebase-admin", "@parcel/watcher",
  "@sentry/profiling-node", "@tree-sitter/*", "aws-sdk",
  "classic-level", "dd-trace", "ffi-napi", "grpc", "hiredis",
  "kerberos", "leveldown", "miniflare", "mysql2", "newrelic", "odbc",
  "piscina", "realm", "ref-napi", "rocksdb", "sass-embedded",
  "sequelize", "serialport", "snappy", "tinypool", "usb",
  "workerd", "wrangler", "zeromq", "zeromq-prebuilt",
  "playwright", "puppeteer", "puppeteer-core", "electron",
  "pdfkit", "fontkit", "linebreak", "unicode-properties", "unicode-trie",
  "@react-email/render",
];

const BANNER = {
  js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
};

console.log("[watch] Cleaning dist and starting initial build…");
await rm(distDir, { recursive: true, force: true }).catch(() => {});

const ctx = await esbuildContext({
  entryPoints: [
    path.resolve(artifactDir, "src/index.ts"),
    path.resolve(artifactDir, "src/migrate.ts"),
    path.resolve(artifactDir, "src/seed.ts"),
  ],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: distDir,
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  external: EXTERNALS,
  sourcemap: "linked",
  plugins: [
    esbuildPluginPino({ transports: ["pino-pretty"] }),
    {
      name: "restart-on-rebuild",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length === 0) {
            console.log("[watch] Rebuild complete — restarting server");
            startServer();
          } else {
            console.error(`[watch] Build failed with ${result.errors.length} error(s) — server not restarted`);
          }
        });
      },
    },
  ],
  banner: BANNER,
});

await ctx.watch();
console.log("[watch] Watching src/ for changes — server will auto-restart on each rebuild");

process.on("SIGINT", async () => {
  console.log("\n[watch] Shutting down…");
  await ctx.dispose();
  if (serverProcess) serverProcess.kill("SIGTERM");
  process.exit(0);
});
