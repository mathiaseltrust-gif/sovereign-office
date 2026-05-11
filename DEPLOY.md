# Deployment Guide — Sovereign Office of the Chief Justice & Trustee

This guide covers deploying the system to a self-hosted Linux server or Azure VM
running Docker. All three services (API, Sovereign Dashboard, Trust Dashboard) are
containerised and wired together with Docker Compose.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone the repository](#2-clone-the-repository)
3. [Configure environment variables](#3-configure-environment-variables)
4. [Set up Azure App Registration redirect URIs](#4-set-up-azure-app-registration-redirect-uris)
5. [Database — export from Replit, restore to Azure](#5-database--export-from-replit-restore-to-azure)
6. [Run with Docker Compose](#6-run-with-docker-compose)
7. [Verify every service is reachable](#7-verify-every-service-is-reachable)
8. [Apply database schema (fresh install)](#8-apply-database-schema-fresh-install)
9. [Reverse proxy & TLS (recommended)](#9-reverse-proxy--tls-recommended)
10. [Updating the application](#10-updating-the-application)

---

## 1. Prerequisites

Install these on your Azure Linux VM (Ubuntu 22.04 LTS or later recommended):

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in after this

# Verify
docker --version          # Docker Engine 26+
docker compose version    # Docker Compose v2.27+
```

> **Node.js / pnpm are NOT required on the host.** All builds happen inside Docker.

---

## 2. Clone the repository

```bash
git clone https://github.com/<your-org>/sovereign-office.git
cd sovereign-office
```

---

## 3. Configure environment variables

```bash
cp .env.example .env
nano .env          # or use any editor
```

Fill in every `REQUIRED` variable. The table below summarises what each one does:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | 64-byte hex string — signs session JWTs |
| `SERVICE_KEY` | Yes | 32-byte hex string — internal API auth |
| `APP_URL` | Yes | Public URL of the API server (no trailing slash) |
| `AZURE_ENTRA_TENANT_ID` | Yes | Azure AD tenant ID |
| `AZURE_ENTRA_CLIENT_ID` | Yes | Azure AD application (client) ID |
| `AZURE_ENTRA_CLIENT_SECRET` | Yes | Azure AD client secret |
| `AZURE_OPENAI_ENDPOINT` | If AI used | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | If AI used | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | If AI used | Deployed model name (e.g. `gpt-4o`) |
| `LOG_LEVEL` | No | Default: `info` |
| `M365_SERVICE_KEY` | No | Only needed for M365 service integration |

**Generating secrets:**

```bash
# SESSION_SECRET (64-byte)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# SERVICE_KEY (32-byte)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Using Azure Database for PostgreSQL instead of the bundled postgres container:**

```
DATABASE_URL=postgresql://<user>@<server>:<password>@<server>.postgres.database.azure.com:5432/sovereign_office?sslmode=require
```

Remove (or comment out) the `postgres` service and `db_data` volume from
`docker-compose.yml` when pointing to an external database.

---

## 4. Set up Azure App Registration redirect URIs

In the **Azure Portal → Azure Active Directory → App Registrations → your app →
Authentication**, add the following redirect URIs for your production domain:

| Type | URI |
|---|---|
| Web (SSO login callback) | `https://api.yourdomain.com/api/auth/entra/callback` |
| SPA (front-channel logout) | `https://sovereign.yourdomain.com` |
| SPA (front-channel logout) | `https://trust.yourdomain.com` |

Replace `yourdomain.com` with your actual domain (or public IP and port).

Also add `https://api.yourdomain.com` to the **CORS allowed origins** section if
your Azure AD app exposes an API.

---

## 5. Database — export from Replit, restore to Azure

### 5a. Export from Replit

In the Replit shell:

```bash
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file=sovereign_office_export.dump
```

Download `sovereign_office_export.dump` from the Replit Files panel.

### 5b. Restore to Azure Database for PostgreSQL

```bash
# Create the target database first (skip if it already exists)
psql "$TARGET_DATABASE_URL" -c "CREATE DATABASE sovereign_office;"

# Restore
pg_restore \
  --dbname="$TARGET_DATABASE_URL" \
  --no-owner \
  --no-acl \
  --verbose \
  sovereign_office_export.dump
```

> `pg_restore` is included in the `postgresql-client` package.
> `sudo apt-get install -y postgresql-client`

### 5c. Verify row counts after restore

```bash
psql "$TARGET_DATABASE_URL" -c "\dt"
psql "$TARGET_DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
psql "$TARGET_DATABASE_URL" -c "SELECT COUNT(*) FROM family_lineage;"
```

---

## 6. Run with Docker Compose

```bash
# Build all images and start in the background
docker compose up --build -d

# Follow logs across all services
docker compose logs -f

# Check service status
docker compose ps
```

Expected output of `docker compose ps`:

```
NAME                STATUS          PORTS
sovereign-api       running (healthy)   0.0.0.0:8080->8080/tcp
sovereign-dashboard running             0.0.0.0:3001->80/tcp
sovereign-trust     running             0.0.0.0:3002->80/tcp
sovereign-postgres  running (healthy)   0.0.0.0:5432->5432/tcp
```

---

## 7. Verify every service is reachable

```bash
# API health check
curl -sf http://localhost:8080/api/health && echo "API OK"

# Sovereign Dashboard (should return HTML)
curl -sf -o /dev/null -w "%{http_code}" http://localhost:3001/
# → 200

# Trust Dashboard
curl -sf -o /dev/null -w "%{http_code}" http://localhost:3002/
# → 200
```

If running behind a reverse proxy, replace `localhost` with your domain.

---

## 8. Apply database schema (fresh install)

If you are starting with an **empty database** (no pg_restore), run Drizzle's schema
push to create all tables:

```bash
# Run against the live DATABASE_URL from inside the api container
docker compose exec api \
  node -e "
    const { execSync } = require('child_process');
    execSync('pnpm --filter @workspace/db run push', { stdio: 'inherit' });
  "
```

Alternatively, from a host machine with Node 22 and pnpm installed:

```bash
pnpm install
DATABASE_URL="<your-connection-string>" pnpm --filter @workspace/db run push
```

> The `push` command uses `drizzle-kit push` which applies schema changes
> directly to the target database — no migration files are needed.

---

## 9. Reverse proxy & TLS (recommended)

For production, place **nginx** or **Azure Application Gateway** in front of the
three services. A minimal nginx reverse proxy config:

```nginx
# /etc/nginx/sites-available/sovereign-office

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name sovereign.yourdomain.com;
    # ... ssl certs ...
    location / { proxy_pass http://127.0.0.1:3001; }
}

server {
    listen 443 ssl;
    server_name trust.yourdomain.com;
    # ... ssl certs ...
    location / { proxy_pass http://127.0.0.1:3002; }
}
```

Get free TLS certificates with Certbot:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com -d sovereign.yourdomain.com -d trust.yourdomain.com
```

---

## 10. Updating the application

```bash
git pull origin main

# Rebuild and restart (zero-downtime roll of each service one at a time)
docker compose up --build -d --no-deps api
docker compose up --build -d --no-deps sovereign
docker compose up --build -d --no-deps trust

# If the database schema changed, push new schema
docker compose exec api \
  sh -c 'DATABASE_URL=$DATABASE_URL pnpm --filter @workspace/db run push'
```

---

## Architecture overview

```
Internet
   │
   ▼
[nginx / Azure App Gateway]  ← TLS termination
   │
   ├── api.yourdomain.com  → :8080  sovereign-api (Node.js + Express)
   │                                     │
   │                                     └── PostgreSQL (Azure DB or local)
   │
   ├── sovereign.yourdomain.com → :3001  sovereign-dashboard (nginx static)
   │
   └── trust.yourdomain.com     → :3002  trust-dashboard (nginx static)
```

---

## Environment variables quick reference

See [`.env.example`](.env.example) for the full list with descriptions.

---

*Last updated: May 2026*
