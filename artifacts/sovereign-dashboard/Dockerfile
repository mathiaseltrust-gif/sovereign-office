# ============================================================================
# Sovereign Office — Sovereign Dashboard (static Vite build served by nginx)
# Build context: repo root
#   docker build -f artifacts/sovereign-dashboard/Dockerfile \
#     --build-arg BASE_PATH=/ -t sovereign-dashboard .
# ============================================================================

# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:22-slim AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY lib/db/package.json                        lib/db/
COPY lib/api-spec/package.json                  lib/api-spec/
COPY lib/api-zod/package.json                   lib/api-zod/
COPY lib/api-client-react/package.json          lib/api-client-react/
COPY artifacts/sovereign-dashboard/package.json artifacts/sovereign-dashboard/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS builder

# BASE_PATH must match the path prefix where the app is served.
# If served at the domain root set it to /
# If behind a reverse proxy at /sovereign/ set it to /sovereign/
ARG BASE_PATH=/
ARG VITE_API_URL=http://localhost:8080

ENV BASE_PATH=${BASE_PATH}
ENV VITE_API_URL=${VITE_API_URL}
ENV NODE_ENV=production
# Suppress Replit-only plugins (cartographer, dev-banner)
ENV REPL_ID=""

COPY tsconfig.base.json ./
COPY lib/               lib/
COPY artifacts/sovereign-dashboard/ artifacts/sovereign-dashboard/
COPY attached_assets/   attached_assets/

RUN pnpm --filter @workspace/sovereign-dashboard run build

# ── Stage 3: nginx static file server ────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /workspace/artifacts/sovereign-dashboard/dist/public \
                    /usr/share/nginx/html

# Minimal nginx config: serve static files, fallback to index.html for SPA routing
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    gzip on;\n\
    gzip_types text/plain text/css application/javascript application/json;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    location ~* \\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/sovereign-dashboard.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
