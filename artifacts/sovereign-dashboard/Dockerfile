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
RUN npm install -g pnpm@9 --quiet

WORKDIR /workspace

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY lib/db/package.json                        lib/db/
COPY lib/api-spec/package.json                  lib/api-spec/
COPY lib/api-zod/package.json                   lib/api-zod/
COPY lib/api-client-react/package.json          lib/api-client-react/
COPY artifacts/sovereign-dashboard/package.json artifacts/sovereign-dashboard/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --no-frozen-lockfile --shamefully-hoist

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS builder

ARG BASE_PATH=/
ARG VITE_API_URL=http://localhost:8080

ENV BASE_PATH=${BASE_PATH}
ENV VITE_API_URL=${VITE_API_URL}
ENV NODE_ENV=production
ENV PORT=5173
ENV REPL_ID=""

COPY tsconfig.base.json ./
COPY lib/               lib/
COPY artifacts/sovereign-dashboard/ artifacts/sovereign-dashboard/
COPY attached_assets/   attached_assets/

RUN pnpm --filter @workspace/sovereign-dashboard run build

# ── Stage 3: nginx static file server ────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /workspace/artifacts/sovereign-dashboard/dist/public \
                    /usr/share/nginx/html

ARG API_HOST=api:8080
ARG API_SCHEME=http

RUN printf "server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    gzip on;\n\
    gzip_types text/plain text/css application/javascript application/json;\n\
\n\
    # ✅ FIX: route Atlas traffic to atlas container\n\
    location /urban-indian-atlas/ {\n\
        proxy_pass http://atlas:80/;\n\
    }\n\
\n\
    # Proxy API\n\
    location /api/ {\n\
        proxy_pass         ${API_SCHEME}://${API_HOST}/api/;\n\
        proxy_ssl_verify   off;\n\
        proxy_ssl_server_name on;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header   Host ${API_HOST};\n\
        proxy_set_header   X-Real-IP \$remote_addr;\n\
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;\n\
        proxy_set_header   X-Forwarded-Proto \$scheme;\n\
        proxy_read_timeout 60s;\n\
    }\n\
\n\
    # SPA fallback\n\
    location / {\n\
        try_files \$uri \$uri/ /index.html;\n\
    }\n\
\n\
    # Cache static assets\n\
    location ~* \\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$ {\n\
        expires 1y;\n\
        add_header Cache-Control \"public, immutable\";\n\
    }\n\
}\n" > /etc/nginx/conf.d/sovereign-dashboard.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
