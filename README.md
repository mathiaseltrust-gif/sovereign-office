# Sovereign Office of the Chief Justice & Trustee

A self-hosted platform comprising three services:

| Service | Description | Default port |
|---|---|---|
| **API Server** | Node.js + Express REST API, PostgreSQL via Drizzle ORM | `8080` |
| **Sovereign Dashboard** | Office management SPA (Vite + React) | `3001` |
| **Trust Dashboard** | Trust instruments SPA (Vite + React) | `3002` |

All three services are containerised and wired together with Docker Compose.

---

## Quick start (local development)

```bash
cp .env.example .env
# Fill in SESSION_SECRET, SERVICE_KEY, and Azure Entra variables

docker compose up --build
```

See [DEPLOY.md](DEPLOY.md) for the full deployment guide including Azure setup,
database migration, TLS configuration, and CI/CD.

---

## Type checking

Run the workspace-wide type check before pushing:

```bash
pnpm run typecheck
```

This checks all packages (API server, community dashboard, trust dashboard, sovereign dashboard) in one pass. The `build` script gates on this check, so type errors will block a build — catching regressions before they ship.

---

## CI/CD — automated deployments

Every push to `main` triggers the GitHub Actions pipeline at
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Pipeline overview

```
Push to main
     │
     ▼
┌─────────────────────────────┐
│  Job 1: build-and-push      │  GitHub-hosted runner
│                             │
│  Build & push to ACR:       │
│    sovereign-api:<sha>      │
│    sovereign-dashboard:<sha>│
│    trust-dashboard:<sha>    │
│  (also tagged :latest)      │
└────────────┬────────────────┘
             │ images pushed
             ▼
┌─────────────────────────────┐
│  Job 2: deploy              │  environment: production
│                             │
│  SSH → Azure VM             │
│  1. git pull origin main    │
│  2. docker compose pull     │
│  3. Rolling restart:        │
│       api  (health-checked) │
│       sovereign dashboard   │
│       trust dashboard       │
│  4. docker image prune      │
└─────────────────────────────┘
```

Each image receives two tags:

- `:<8-char-git-sha>` — immutable; use this to roll back to an exact commit.
- `:latest` — floating; always points at the most recent successful build and
  also serves as a layer cache source to keep build times short.

If two pushes race, the concurrency lock (`deploy-main`) cancels the older run
so the VM always ends up on the newest code.

### GitHub repository secrets required

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `ACR_REGISTRY` | ACR login server — e.g. `sovereignoffice.azurecr.io` |
| `ACR_USERNAME` | ACR admin username or service-principal client ID |
| `ACR_PASSWORD` | ACR admin password or service-principal client secret |
| `DEPLOY_HOST` | Public IP or hostname of the Azure VM |
| `DEPLOY_USER` | SSH login user (e.g. `azureuser`) |
| `DEPLOY_SSH_KEY` | Full PEM-encoded private SSH key |
| `DEPLOY_PATH` | Absolute path to the repo on the VM (e.g. `/home/azureuser/sovereign-office`) |

Optional repository variable (not a secret):

| Variable | Description |
|---|---|
| `VITE_API_URL` | Public URL of the API (e.g. `https://api.yourdomain.com`) — baked into the dashboard builds |

For full setup instructions (creating the ACR, SSH key generation, pointing
docker-compose at ACR images, protecting the production environment) see
[DEPLOY.md § 11](DEPLOY.md#11-cicd--automated-deployments-via-github-actions).

### Rolling back

```bash
# On the Azure VM — replace <sha> with the 8-char tag from the Actions log
IMAGE_TAG=<sha> docker compose up -d --no-deps --no-build api sovereign trust
```

---

## Repository structure

```
.
├── artifacts/
│   ├── api-server/          # Node.js API — Dockerfile, src/, build.mjs
│   ├── sovereign-dashboard/ # Sovereign Office SPA — Vite + React
│   └── trust-dashboard/     # Trust Instruments SPA — Vite + React
├── lib/
│   ├── db/                  # Drizzle ORM schema & client
│   ├── api-spec/            # OpenAPI spec (source of truth)
│   ├── api-zod/             # Zod validators generated from spec
│   └── api-client-react/    # React Query hooks generated from spec
├── .github/workflows/
│   └── deploy.yml           # CI/CD pipeline
├── docker-compose.yml       # Local dev + production compose file
├── .env.example             # Template — copy to .env and fill in values
└── DEPLOY.md                # Full deployment & operations guide
```
