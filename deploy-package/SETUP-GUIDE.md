# Sovereign Office — Azure Deployment Guide

| What | Where |
|---|---|
| Azure VM | `20.83.210.26` |
| Container Registry | `sovereignoffice.azurecr.io` |
| Database | `tribalpostgres-db.postgres.database.azure.com` |

---

## One-command install (plug and play)

SSH into your VM, then paste this single block. It does everything — installs
Docker, writes all config, pulls all 4 images, runs database migrations, and
starts all services automatically.

```bash
ssh azureuser@20.83.210.26
```

Once you're in, run:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/your-org/sovereign-office/main/deploy-package/sovereign-install.sh)
```

**— OR —** if you don't have the repo on GitHub yet, copy `sovereign-install.sh`
to the VM and run it:

```bash
# From your local machine
scp deploy-package/sovereign-install.sh azureuser@20.83.210.26:~/

# Then SSH in and run it
ssh azureuser@20.83.210.26
bash ~/sovereign-install.sh
```

The script takes about 3–5 minutes on first run (image pulls). You'll see
progress at each step and a summary of live URLs at the end.

---

## What the install script does

| Step | Action |
|---|---|
| 1 | Install Docker (skipped if already installed) |
| 2 | Create `/opt/sovereign-office/` |
| 3 | Write `.env` with all credentials pre-filled |
| 4 | Write `docker-compose.prod.yml` |
| 5 | Open firewall ports 8080, 3001, 3002, 3003 |
| 6 | Log in to `sovereignoffice.azurecr.io` |
| 7 | Pull all 4 images |
| 8 | Start all services |
| 9 | Auto-apply database migrations (first boot only) |
| 10 | Health-check the API and print live URLs |

---

## After install — your services

| Service | URL |
|---|---|
| API Server | http://20.83.210.26:8080 |
| Sovereign Dashboard | http://20.83.210.26:3001 |
| Trust Dashboard | http://20.83.210.26:3002 |
| Community Dashboard | http://20.83.210.26:3003 |

---

## One-time Azure Portal step (Microsoft SSO)

In **Azure Portal → App Registrations → your app → Authentication → Redirect URIs**, add:

```
http://20.83.210.26:8080/api/auth/callback
```

Without this, the Microsoft login button will redirect to an error page.

---

## Updating after a code change

```bash
ssh azureuser@20.83.210.26
cd /opt/sovereign-office
echo "16Ef4DDsKUCPWasmGFNNoEUjDnTYWcfrJnVdEfiRNxyNtwZphI6jJQQJ99CEACYeBjFEqg7NAAACAZCROBYv" | \
  docker login sovereignoffice.azurecr.io -u sovereignoffice --password-stdin
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## Useful commands on the VM

```bash
# Live logs from all services
docker compose -f /opt/sovereign-office/docker-compose.prod.yml logs -f

# Logs from API only
docker compose -f /opt/sovereign-office/docker-compose.prod.yml logs -f api

# Status of all containers
docker compose -f /opt/sovereign-office/docker-compose.prod.yml ps

# Restart everything
docker compose -f /opt/sovereign-office/docker-compose.prod.yml restart

# Stop everything
docker compose -f /opt/sovereign-office/docker-compose.prod.yml down

# Test API health
curl http://localhost:8080/api/healthz
```

---

## Automatic CI/CD via GitHub Actions (optional)

Once connected to GitHub, every push to `main` auto-builds and auto-deploys.
See `.github/workflows/deploy.yml`. Add these secrets to your GitHub repo
(Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ACR_REGISTRY` | `sovereignoffice.azurecr.io` |
| `ACR_USERNAME` | `sovereignoffice` |
| `ACR_PASSWORD` | *(from Replit Secrets)* |
| `DEPLOY_HOST` | `20.83.210.26` |
| `DEPLOY_USER` | `azureuser` |
| `DEPLOY_SSH_KEY` | *(full PEM private key for the VM)* |
| `DEPLOY_PATH` | `/opt/sovereign-office` |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| API exits immediately | `docker compose -f docker-compose.prod.yml logs api` |
| Microsoft login fails | Add redirect URI in Azure Portal (see above) |
| Dashboard shows blank | API health check not passing yet — wait 30 s and reload |
| Port not reachable | Check Azure VM Network Security Group — allow inbound 8080, 3001, 3002, 3003 |
| Database errors on boot | Check `DATABASE_URL` in `.env` — host must end in `.postgres.database.azure.com` |
