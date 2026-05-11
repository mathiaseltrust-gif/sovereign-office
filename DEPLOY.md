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
11. [CI/CD — automated deployments via GitHub Actions](#11-cicd--automated-deployments-via-github-actions)

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
| `SOVEREIGN_DASHBOARD_URL` | Yes | Full URL of the Sovereign Dashboard (e.g. `https://sovereign.yourdomain.com`) — used by the API to redirect users after Microsoft login |
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

When pointing to an external database, edit `docker-compose.yml` to:
1. Remove (or comment out) the `postgres` service and the `db_data` volume.
2. Also remove the `depends_on` block from the `api` service (or Compose will fail
   because the `postgres` service no longer exists):
   ```yaml
   # Remove or comment out these lines from the api service:
   # depends_on:
   #   postgres:
   #     condition: service_healthy
   ```

---

## 4. Set up Azure App Registration redirect URIs

In the **Azure Portal → Azure Active Directory → App Registrations → your app →
Authentication**, add the following redirect URIs for your production domain:

| Type | URI |
|---|---|
| Web (SSO login callback) | `https://api.yourdomain.com/api/auth/microsoft/callback` |
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
# API health check (endpoint is /api/healthz)
curl -sf http://localhost:8080/api/healthz && echo "API OK"

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

If you are starting with an **empty database** (no pg_restore), use Drizzle's
schema push to create all tables. The runtime API image does not include pnpm or
workspace source, so this step runs on the **host machine** (or a separate
migration step) using the cloned repository.

### Prerequisites for this step

```bash
# Install Node 22 on the host (if not already present)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm@latest

# Install workspace dependencies from the repo root
pnpm install
```

### Push schema

```bash
DATABASE_URL="postgresql://<user>:<pass>@<host>:5432/sovereign_office?sslmode=require" \
  pnpm --filter @workspace/db run push
```

> `pnpm run push` calls `drizzle-kit push`, which introspects the TypeScript
> schema files in `lib/db/src/schema/` and applies the corresponding DDL
> directly to the target database — no migration files are generated or needed.

### Verify tables were created

```bash
psql "$DATABASE_URL" -c "\dt"
```

You should see tables including `users`, `family_lineage`, `trust_instruments`,
`delegations`, `trust_filings`, etc.

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

# If the database schema changed, push new schema from the host machine.
# The runtime API image does not include pnpm or workspace source,
# so run this from the cloned repo directory on the host:
DATABASE_URL="postgresql://<user>:<pass>@<host>:5432/sovereign_office?sslmode=require" \
  pnpm --filter @workspace/db run push
```

---

## 11. CI/CD — automated deployments via GitHub Actions

The repository ships with a GitHub Actions pipeline at
`.github/workflows/deploy.yml` that turns every push to `main` into a live
deployment — no SSH or manual `docker compose` commands required.

### How it works

```
Push to main
     │
     ▼
┌─────────────────────────────┐
│  Job 1: build-and-push      │   runs on GitHub-hosted runner
│                             │
│  1. Checkout code           │
│  2. Set up Docker Buildx    │
│  3. docker login → ACR      │
│  4. Build & push:           │
│       sovereign-api:sha     │
│       sovereign-api:latest  │
│       sovereign-dashboard:* │
│       trust-dashboard:*     │
└────────────┬────────────────┘
             │ success
             ▼
┌─────────────────────────────┐
│  Job 2: deploy              │   environment: production
│                             │
│  SSH into Azure VM          │
│  1. git pull origin main    │
│  2. docker compose pull     │
│  3. Rolling restart:        │
│       api   (waits healthy) │
│       sovereign             │
│       trust                 │
│  4. docker image prune      │
└─────────────────────────────┘
```

Each image is tagged with both a short Git SHA (immutable, safe to roll back to)
and `latest` (floating, always points at the newest build). The `latest` tag is
also used as a build cache source so subsequent builds are fast.

The pipeline uses a concurrency lock (`deploy-main`) — if a second push arrives
while a deploy is in progress the in-flight run is cancelled and replaced by the
newer one, ensuring the server always ends up on the latest code.

### One-time setup

#### 1. Create an Azure Container Registry

```bash
az acr create \
  --resource-group <your-rg> \
  --name sovereignoffice \
  --sku Basic \
  --admin-enabled true
```

Note the **Login server** — it will look like `sovereignoffice.azurecr.io`.

#### 2. Retrieve ACR credentials

```bash
az acr credential show --name sovereignoffice
# outputs: username + two passwords — copy either password
```

#### 3. Authorise the VM to pull from ACR (on the VM)

```bash
# Log in once so docker compose pull works without a password on the VM
docker login sovereignoffice.azurecr.io \
  --username <acr-username> \
  --password <acr-password>
```

#### 4. Point docker-compose.yml at the ACR images

Edit `docker-compose.yml` on the VM (and in the repo) so each service uses a
pre-built image instead of a `build:` block:

```yaml
services:
  api:
    image: sovereignoffice.azurecr.io/sovereign-api:latest
    # remove the build: block
    ...

  sovereign:
    image: sovereignoffice.azurecr.io/sovereign-dashboard:latest
    # remove the build: block
    ...

  trust:
    image: sovereignoffice.azurecr.io/trust-dashboard:latest
    # remove the build: block
    ...
```

#### 5. Add GitHub repository secrets

In your GitHub repository go to **Settings → Secrets and variables → Actions →
New repository secret** and add each of the following:

| Secret name | Value |
|---|---|
| `ACR_REGISTRY` | `sovereignoffice.azurecr.io` |
| `ACR_USERNAME` | ACR admin username (from step 2) |
| `ACR_PASSWORD` | ACR admin password (from step 2) |
| `DEPLOY_HOST` | Public IP or hostname of the Azure VM |
| `DEPLOY_USER` | SSH login user (e.g. `azureuser`) |
| `DEPLOY_SSH_KEY` | Full PEM-encoded **private** SSH key |
| `DEPLOY_PATH` | Absolute path to repo on the VM (e.g. `/home/azureuser/sovereign-office`) |

Optionally add a **repository variable** (not secret — it's not sensitive):

| Variable name | Value |
|---|---|
| `VITE_API_URL` | Public URL of the API server (e.g. `https://api.yourdomain.com`) |

#### 6. Create the SSH key pair (if you don't already have one)

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key -N ""

# Copy the public key to the VM
ssh-copy-id -i ~/.ssh/deploy_key.pub azureuser@<vm-ip>

# Paste the contents of ~/.ssh/deploy_key (private key) into the DEPLOY_SSH_KEY secret
cat ~/.ssh/deploy_key
```

#### 7. Protect the `production` environment (recommended)

The `deploy` job runs in the `production` GitHub Environment. In **Settings →
Environments → production** you can add:

- **Required reviewers** — a human must approve before the VM is touched.
- **Deployment branches** — restrict deploys to `main` only.

### Verifying a deployment

After a push to `main`, open the **Actions** tab in GitHub. You will see:

1. **Build & Push Docker images** — watch each image compile and upload to ACR.
2. **Rolling restart on Azure VM** — the SSH log shows each service restarting
   and the final `docker compose ps` confirms everything is `running`.

To verify manually on the VM:

```bash
docker compose ps          # all services should show "running"
docker compose logs --tail 50 api
curl -sf http://localhost:8080/api/healthz && echo "API OK"
```

### Rolling back to a previous version

Every successful build pushes an immutable `:<git-sha>` tag. To roll back:

```bash
# On the VM — replace <sha> with the 8-char tag from the GitHub Actions log
IMAGE_TAG=<sha> docker compose up -d --no-deps --no-build api sovereign trust
```

The `IMAGE_TAG` variable is read by `docker-compose.yml` at start time, so this
single command pins all three services to the chosen build without editing any
files. After verifying the rollback is stable you can set `IMAGE_TAG=<sha>` in
your `.env` file to make it persist across reboots.

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
