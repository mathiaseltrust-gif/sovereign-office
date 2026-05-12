# ============================================================================
# Sovereign Office — API Server
# Build context: repo root
#   docker build -f artifacts/api-server/Dockerfile -t sovereign-api .
# ============================================================================

# ── Stage 1: install all workspace dependencies ──────────────────────────────
FROM node:22-slim AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9 --quiet

WORKDIR /workspace

# Copy manifests first so Docker layer cache is reused when source changes
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy every package.json so pnpm can resolve workspace: references
COPY lib/db/package.json                 lib/db/
COPY lib/api-spec/package.json           lib/api-spec/
COPY lib/api-zod/package.json            lib/api-zod/
COPY lib/api-client-react/package.json   lib/api-client-react/
COPY artifacts/api-server/package.json   artifacts/api-server/

# Copy generated SQL migrations (produced by drizzle-kit generate — no live DB needed)
COPY lib/db/migrations                   lib/db/migrations/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --no-frozen-lockfile

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS builder

COPY tsconfig.base.json ./
COPY lib/    lib/
COPY artifacts/api-server/  artifacts/api-server/

# esbuild bundles lib/* inline; no separate lib build step required.
RUN pnpm --filter @workspace/api-server run build

# ── Stage 3: production image ─────────────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Copy the bundled output (esbuild writes dist/index.mjs + dist/migrate.mjs + pino worker files)
COPY --from=builder /workspace/artifacts/api-server/dist ./dist

# Copy SQL migrations so drizzle migrator can apply them at startup
COPY --from=builder /workspace/lib/db/migrations ./migrations

# Copy node_modules: esbuild externalises pdfkit and its text-rendering deps
# (fontkit, linebreak, unicode-*) so they must be present at runtime.
COPY --from=builder /workspace/node_modules                 ./node_modules
COPY --from=builder /workspace/artifacts/api-server/node_modules \
                    ./node_modules_local

# Merge artifact-level node_modules if pnpm placed anything there
RUN if [ -d ./node_modules_local ] && [ "$(ls -A ./node_modules_local 2>/dev/null)" ]; then \
      cp -rn ./node_modules_local/. ./node_modules/ ; \
    fi && rm -rf ./node_modules_local

# Install packages that esbuild externalises (cannot inline due to .proto / native file loading).
# These must be present as real npm packages at runtime — not pnpm symlinks.
RUN npm install --no-save \
      @google-cloud/storage \
      google-auth-library

# Entrypoint: run migrations then start the server
COPY artifacts/api-server/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

CMD ["/docker-entrypoint.sh"]
