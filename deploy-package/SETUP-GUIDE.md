# Sovereign Office — Azure Deployment Guide

**Your infrastructure is already provisioned. This guide gets the app live on your VM.**

| What | Where |
|---|---|
| Azure VM | `20.83.210.26` |
| Container Registry | `sovereignoffice.azurecr.io` |
| Database | `tribalpostgres-db.postgres.database.azure.com` |

---

## Two paths — pick one

### Path A — GitHub Actions (recommended, fully automatic)

Every push to `main` builds all four images, pushes them to your ACR, and deploys to your VM automatically. Set it up once, then every code change deploys itself.

**You need 7 GitHub repository secrets** (Settings → Secrets and variables → Actions → New repository secret):

| Secret name | Value |
|---|---|
| `ACR_REGISTRY` | `sovereignoffice.azurecr.io` |
| `ACR_USERNAME` | `sovereignoffice` |
| `ACR_PASSWORD` | `16Ef4DDsKUCPWasmGFNNoEUjDnTYWcfrJnVdEfiRNxyNtwZphI6jJQQJ99CEACYeBjFEqg7NAAACAZCROBYv` |
| `DEPLOY_HOST` | `20.83.210.26` |
| `DEPLOY_USER` | `azureuser` (or whatever user you SSH in as) |
| `DEPLOY_SSH_KEY` | Your VM's private SSH key (the full PEM file contents) |
| `DEPLOY_PATH` | `/opt/sovereign-office` (or wherever you want files on the VM) |

And one **repository variable** (Settings → Variables → Actions):

| Variable name | Value |
|---|---|
| `VITE_API_URL` | `http://20.83.210.26:8080` |

**First-time VM prep** — before the first deploy, SSH into your VM and run:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Create deploy directory and .env file
sudo mkdir -p /opt/sovereign-office
sudo chown $USER:$USER /opt/sovereign-office
cd /opt/sovereign-office
```

Then copy `.env.vm` from this folder to `/opt/sovereign-office/.env` on the VM:

```bash
scp deploy-package/.env.vm azureuser@20.83.210.26:/opt/sovereign-office/.env
```

Fill in the two `FILL_IN` placeholders in that `.env` (SESSION_SECRET and AZURE_ENTRA_CLIENT_SECRET — see below).

Once the secrets are set and the VM is prepped, push any commit to `main` and GitHub Actions does the rest.

---

### Path B — Manual first deployment (bootstrap script)

Use this if you want to start the app right now without setting up GitHub Actions.

```bash
# On your local machine — copy files to VM
scp deploy-package/.env.vm azureuser@20.83.210.26:/tmp/.env
scp deploy-package/docker-compose.prod.yml azureuser@20.83.210.26:/tmp/
scp deploy-package/vm-bootstrap.sh azureuser@20.83.210.26:/tmp/

# SSH into the VM
ssh azureuser@20.83.210.26

# Run the bootstrap
cd /tmp
chmod +x vm-bootstrap.sh
./vm-bootstrap.sh
```

The script installs Docker, pulls all 4 images from ACR, and starts everything. Takes about 5 minutes.

---

## Two values you still need to fill in

Before either path works, fill these two placeholders in `.env.vm`:

### 1. SESSION_SECRET

Get this from your Replit project → Tools → Secrets → SESSION_SECRET.  
Copy the full value (it's a 128-character hex string).

### 2. AZURE_ENTRA_CLIENT_SECRET

⚠️ The value `355884d8-e37b-4a05-ad0d-818050712056` is the **Secret ID**, not the secret **value**.

To get the real value:
1. Go to [Azure Portal](https://portal.azure.com) → App Registrations
2. Open your app (`9d408980-8fbf-4384-a712-436e70480eb9`)
3. Click **Certificates & secrets** → **Client secrets**
4. Look at the **Value** column (NOT Secret ID)
5. If the value is hidden (shows `***`), create a new secret and copy its value immediately — Azure never shows it again after you navigate away

---

## After the VM is running — set the SSO redirect URI

In **Azure Portal → App Registrations → your app → Authentication → Redirect URIs**, add:

```
http://20.83.210.26:8080/api/auth/callback
```

---

## Verify it's working

```bash
# SSH into your VM
ssh azureuser@20.83.210.26

# Check all containers are running
docker compose -f /opt/sovereign-office/docker-compose.prod.yml ps

# Test the API
curl http://localhost:8080/api/healthz
# Expected: {"ok":true}
```

Open in a browser:
- `http://20.83.210.26:3001` → Sovereign Dashboard (Microsoft SSO login)
- `http://20.83.210.26:3002` → Trust Dashboard
- `http://20.83.210.26:3003` → Community Dashboard

---

## Updating after a code change (Path A)

Just push to `main`. GitHub Actions builds and deploys automatically.

## Updating after a code change (Path B — manual)

```bash
ssh azureuser@20.83.210.26
cd /opt/sovereign-office
echo "ACR_PASSWORD_HERE" | docker login sovereignoffice.azurecr.io -u sovereignoffice --password-stdin
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Container exits immediately | `docker compose -f docker-compose.prod.yml logs api` |
| Microsoft login redirect fails | Check redirect URI in Azure Portal matches `http://20.83.210.26:8080/api/auth/callback` |
| Database connection refused | Confirm `DATABASE_URL` in .env has the correct Azure PostgreSQL hostname |
| Port not reachable | Check Azure VM Network Security Group allows inbound on 8080, 3001, 3002, 3003 |
| Images not found in ACR | Ensure GitHub Actions ran successfully, or re-run vm-bootstrap.sh |
