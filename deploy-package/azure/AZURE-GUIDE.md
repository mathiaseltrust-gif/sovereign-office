# Sovereign Office — Azure Container Apps Deployment

No Docker. No VM. No local tools. Everything runs through Azure's managed cloud.

---

## What you need

- Access to [portal.azure.com](https://portal.azure.com)
- That's it.

---

## Deploy in 3 steps

### Step 1 — Open Azure Cloud Shell

Go to [portal.azure.com](https://portal.azure.com) and click the **Cloud Shell** icon at the top of the page (looks like `>_`). Select **Bash** if asked.

### Step 2 — Upload the deploy script

In the Cloud Shell toolbar, click the **Upload** button (↑ icon) and upload the file:

```
deploy-container-apps.sh
```

### Step 3 — Run it

```bash
bash deploy-container-apps.sh
```

That's it. The script runs for about 3–5 minutes and prints your live HTTPS URLs at the end.

---

## What gets created in Azure

| Resource | Name | Type |
|---|---|---|
| Resource Group | `sovereign-office-rg` | Container for all resources |
| Container Apps Environment | `sovereign-office-env` | Managed runtime |
| API Server | `sovereign-api` | Container App |
| Sovereign Dashboard | `sovereign-dashboard` | Container App |
| Trust Dashboard | `trust-dashboard` | Container App |
| Community Dashboard | `community-dashboard` | Container App |

All apps get **free managed HTTPS** certificates automatically (`*.azurecontainerapps.io`).

---

## One required step after deploy — Microsoft Login

To make the Microsoft SSO login button work, you must add a Redirect URI.

The script prints the exact URL to add at the end. It will look like:

```
https://sovereign-api.XXXXXXX.eastus.azurecontainerapps.io/api/auth/callback
```

**Where to add it:**

1. Go to [portal.azure.com](https://portal.azure.com)
2. Search for **App registrations**
3. Open your app: `Sovereign Office` (client ID: `9d408980-8fbf-4384-a712-436e70480eb9`)
4. Click **Authentication** in the left menu
5. Under **Redirect URIs**, click **Add URI**
6. Paste the URL printed by the deploy script
7. Click **Save**

---

## Your live URLs

After the script runs, you'll see output like:

```
API Server:          https://sovereign-api.abc123.eastus.azurecontainerapps.io
Sovereign Dashboard: https://sovereign-dashboard.abc123.eastus.azurecontainerapps.io
Trust Dashboard:     https://trust-dashboard.abc123.eastus.azurecontainerapps.io
Community Dashboard: https://community-dashboard.abc123.eastus.azurecontainerapps.io
```

---

## Updating after a code change

When new images are pushed to ACR, just re-run the same script from Cloud Shell:

```bash
bash deploy-container-apps.sh
```

The script is idempotent — it updates existing apps instead of creating duplicates.

---

## Checking status from Cloud Shell

```bash
# See all running container apps
az containerapp list --resource-group sovereign-office-rg -o table

# See live logs from the API
az containerapp logs show --name sovereign-api --resource-group sovereign-office-rg --follow

# Check revision status
az containerapp revision list --name sovereign-api --resource-group sovereign-office-rg -o table
```

---

## Stopping / removing everything

```bash
# Stop all apps (keeps config, stops billing for compute)
az containerapp revision deactivate --revision <revision-name> --resource-group sovereign-office-rg

# Remove everything permanently
az group delete --name sovereign-office-rg --yes --no-wait
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Script fails at resource group | Make sure you're logged into the right subscription in Cloud Shell |
| API shows 503 | Check logs: `az containerapp logs show --name sovereign-api -g sovereign-office-rg` |
| Microsoft login redirect error | Add the Redirect URI shown by the script (see above) |
| Dashboard shows blank page | Wait 30 seconds for the API to pass its health check, then reload |
| ACR pull fails | The ACR credentials are pre-filled in the script — they should work as-is |
