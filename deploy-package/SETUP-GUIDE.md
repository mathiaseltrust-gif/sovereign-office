# Sovereign Office — Azure Deployment Setup Guide

**Five services, one command to deploy.  
Estimated time: 30–45 minutes (most of it waiting for Azure to provision).**

---

## What you're deploying

| Service | What it does | Port |
|---|---|---|
| **API Server** | All backend logic, authentication, AI, database | 8080 |
| **Sovereign Dashboard** | Sovereign Office staff portal (Microsoft SSO login) | 3001 |
| **Trust Dashboard** | Trust instruments management portal | 3002 |
| **Community Dashboard** | Family & community public portal | 3003 |
| **PostgreSQL** | Database (or use Azure Database for PostgreSQL) | 5432 |

---

## Before you start — what you need

- [ ] An **Azure account** with permission to create resources
- [ ] **Azure CLI** installed on your local machine ([download](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli))
- [ ] **Docker** installed on your local machine ([download](https://docs.docker.com/get-docker/))
- [ ] The **source code** cloned from your repository
- [ ] Your **Azure Entra (Active Directory) App Registration** already created with:
  - Client ID
  - Client Secret
  - Tenant ID
- [ ] Your **Azure OpenAI** resource already created with:
  - Endpoint URL
  - API Key
  - Deployment name (e.g. `gpt-4o`)

> **You do NOT need Node.js on the server.** Everything runs in Docker.

---

## Step 1 — Fill in your .env file

Copy `.env.template` to `.env` in this folder:

```bash
cp .env.template .env
```

Open `.env` and fill in the values marked **← FILL IN**. Everything else has safe defaults.

The required values are:

```
AZURE_ENTRA_TENANT_ID       ← from Azure Portal → App Registrations → your app
AZURE_ENTRA_CLIENT_ID       ← from Azure Portal → App Registrations → your app
AZURE_ENTRA_CLIENT_SECRET   ← from Azure Portal → Certificates & secrets
AZURE_OPENAI_ENDPOINT       ← from Azure Portal → your OpenAI resource
AZURE_OPENAI_API_KEY        ← from Azure Portal → your OpenAI resource → Keys
AZURE_OPENAI_DEPLOYMENT     ← name you gave your model (e.g. gpt-4o)
SESSION_SECRET              ← generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
SERVICE_KEY                 ← generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 2 — Provision Azure resources (one script)

This creates the Container Registry and (optionally) an Azure VM.  
Run from this folder:

```bash
bash 1-provision-azure.sh
```

The script will:
1. Log you into Azure
2. Create a Resource Group
3. Create an Azure Container Registry (ACR) to store your Docker images
4. Print the ACR login server, username, and password — **paste these into your .env**

> If you already have an ACR, skip this and just set `ACR_REGISTRY` in your .env.

---

## Step 3 — Build and push Docker images (one script)

This builds all 4 application images and uploads them to your ACR.  
Run from the **root of the cloned source repository** (not this folder):

```bash
bash /path/to/this/folder/2-build-push.sh
```

This takes 5–15 minutes the first time. Subsequent runs are faster (Docker caches layers).

---

## Step 4 — Deploy to your server

Copy these files to your Azure VM (or any Linux server with Docker):

```bash
scp .env docker-compose.prod.yml 3-vm-deploy.sh azureuser@YOUR-VM-IP:~/sovereign-office/
```

SSH into your VM and run:

```bash
ssh azureuser@YOUR-VM-IP
cd ~/sovereign-office
bash 3-vm-deploy.sh
```

The script installs Docker (if needed), pulls your images, and starts everything.

---

## Step 5 — Set Microsoft SSO redirect URIs

In **Azure Portal → App Registrations → your app → Authentication → Redirect URIs**, add:

```
http://YOUR-VM-IP:8080/api/auth/callback
```

Replace `YOUR-VM-IP` with your actual server IP or domain name.  
If you have a domain with HTTPS, use `https://yourdomain.com/api/auth/callback`.

---

## Step 6 — Verify everything is working

```bash
# On your VM:
docker compose -f docker-compose.prod.yml ps        # all 4 services should be "running"
curl http://localhost:8080/api/healthz              # should return {"ok":true}
```

Open in a browser:
- `http://YOUR-VM-IP:3001` → Sovereign Dashboard (login with Microsoft)
- `http://YOUR-VM-IP:3002` → Trust Dashboard
- `http://YOUR-VM-IP:3003` → Community Dashboard

---

## Common issues

| Problem | Fix |
|---|---|
| `EADDRINUSE` port conflict | Run `sudo fuser -k 8080/tcp 3001/tcp 3002/tcp 3003/tcp` then redeploy |
| Database migration not applied | Run `docker compose -f docker-compose.prod.yml exec api node dist/migrate.mjs` |
| Microsoft login redirect fails | Check redirect URI in Azure Portal matches your server URL exactly |
| Images not found in ACR | Re-run `2-build-push.sh` and confirm `ACR_REGISTRY` in .env is correct |
| Container exits immediately | Run `docker compose -f docker-compose.prod.yml logs api` to see the error |

---

## Updating after a code change

On your local machine (in the source repo):

```bash
bash /path/to/deploy-folder/2-build-push.sh        # rebuild and push new images
```

On your VM:

```bash
docker compose -f docker-compose.prod.yml pull      # pull new images
docker compose -f docker-compose.prod.yml up -d     # restart with new images
```

---

## Using Azure Database for PostgreSQL instead of the built-in container

1. Create an Azure Database for PostgreSQL Flexible Server in the Azure Portal
2. Set `DATABASE_URL` in your .env to the connection string Azure gives you:
   ```
   postgresql://adminuser@yourserver:Password123@yourserver.postgres.database.azure.com:5432/sovereign_office?sslmode=require
   ```
3. In `docker-compose.prod.yml`, the `postgres` service is already commented out for this case — just leave `USE_AZURE_DB=true` in your .env

---

*For help, check the full `DEPLOY.md` in the source repository.*
