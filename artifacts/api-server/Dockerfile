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

# ── Step A: npm-install externalized packages FIRST, before any pnpm COPY ──
#
# esbuild externalises @google-cloud/* (and others) — see build.mjs external[].
# pnpm stores packages as a virtual symlink store: artifact-level symlinks
# use relative paths that break after Docker COPY (wrong directory depth).
# Root-workspace symlinks resolve correctly, but @google-cloud/storage is only
# installed at the artifact level, not hoisted.
#
# By running npm install here — in a completely empty /app with no node_modules
# yet — npm succeeds without the "Cannot read properties of null" arborist error
# that occurs when it encounters an existing pnpm-format node_modules tree.
# The installed packages land as real directories (not symlinks), so Node.js
# ESM resolution finds them reliably.
#
# The subsequent cp -rn steps skip these entries (destination already exists).
RUN echo '{"name":"sovereign-api","version":"1.0.0","private":true}' \
      > /app/package.json \
 && npm install --save \
      @google-cloud/storage@^7.19.0 \
      google-auth-library@^10.6.2 \
 && rm /app/package.json

# ── Step B: bundled output + migrations ─────────────────────────────────────
COPY --from=builder /workspace/artifacts/api-server/dist ./dist
COPY --from=builder /workspace/lib/db/migrations ./migrations

# ── Step C: pnpm root node_modules (pdfkit, fontkit, linebreak, etc.) ───────
# Root-workspace pnpm symlinks resolve correctly after COPY because the
# relative symlink ".pnpm/pkg@ver/..." has the same depth in both locations.
# Artifact-level symlinks (broken depth) are silently tolerated with || true;
# the packages we actually need are already in place from Step A.
COPY --from=builder /workspace/node_modules                 ./node_modules_ws
COPY --from=builder /workspace/artifacts/api-server/node_modules \
                    ./node_modules_art

RUN if [ -d ./node_modules_ws ] && [ "$(ls -A ./node_modules_ws 2>/dev/null)" ]; then \
      cp -rn ./node_modules_ws/. ./node_modules/ 2>/dev/null || true ; \
    fi && rm -rf ./node_modules_ws \
 && if [ -d ./node_modules_art ] && [ "$(ls -A ./node_modules_art 2>/dev/null)" ]; then \
      cp -rn ./node_modules_art/. ./node_modules/ 2>/dev/null || true ; \
    fi && rm -rf ./node_modules_art

# ── Step D: entrypoint ───────────────────────────────────────────────────────
COPY artifacts/api-server/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

CMD ["/docker-entrypoint.sh"]
