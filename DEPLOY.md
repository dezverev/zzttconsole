# Deployment Guide

## Architecture

```
Browser → Entra ID login → zzttconsole (frontend + /api/copilot proxy)
                                ↓ managed identity token
                           zzttconsole-copilot (container, Easy Auth)
                                ↓
                           OpenAI API
```

- **zzttconsole** — Node.js App Service (B1). Serves the static site and proxies `/api/copilot` to the copilot container using managed identity.
- **zzttconsole-copilot** — Docker container App Service (B1). Runs the GitHub Copilot SDK, calls OpenAI. Locked down with Easy Auth (rejects anonymous requests).
- **zzttconsole.azurecr.io** — Azure Container Registry. Copilot pulls images via managed identity (no passwords).
- **Auth** — Microsoft Entra ID. Frontend requires login, restricted to `dbzverev@outlook.com`. Copilot only accepts managed identity tokens from the frontend.

## Prerequisites

- Azure CLI (`az`) logged in
- Docker running (Docker Desktop or colima)
- An OpenAI API key

## First-Time Setup

```bash
# 1. Create all Azure resources (run once)
./setup-azure.sh

# 2. Deploy copilot container + configure auth
./deploy-copilot.sh

# 3. Deploy frontend
./deploy.sh

# 4. Set OpenAI API key on the copilot container
az webapp config appsettings set -g zzttconsole -n zzttconsole-copilot \
  --settings OPENAI_API_KEY=sk-proj-...
```

## Updating

```bash
# Changed copilot code (copilot/src/*):
./deploy-copilot.sh

# Changed frontend code (matrixsite/*):
./deploy.sh

# Both:
./deploy-copilot.sh && ./deploy.sh
```

## Local Development

```bash
# Start copilot server (uses LM Studio on localhost:1234 by default)
cd copilot
cp .env.example .env        # edit with your settings
npx tsx src/server.ts        # starts on port 8080

# Or use OpenAI locally:
OPENAI_BASE_URL=https://api.openai.com/v1 OPENAI_API_KEY=sk-... \
  COPILOT_MODEL=gpt-5.4-mini npx tsx src/server.ts

# Start frontend (in another terminal)
cd matrixsite
COPILOT_URL=http://localhost:8080 node server.js  # starts on port 8081

# CLI mode (no server needed)
cd copilot
npx tsx src/cli.ts "your prompt here"
```

Open `http://localhost:8081`, press `~` for the console, type `copilot hello`.
Or open `vim` and type `:copilot write hello world in python`.

## Costs

| Resource | SKU | ~Cost/month |
|----------|-----|-------------|
| App Service Plan (frontend) | B1 | $13 |
| App Service Plan (copilot) | B1 | $13 |
| Container Registry | Basic | $5 |
| **Total** | | **~$31** |

Plus OpenAI API usage.

## Troubleshooting

**Container won't start (Application Error)**
```bash
# Check logs
az webapp log tail -g zzttconsole -n zzttconsole-copilot

# Verify image architecture (must be amd64)
az acr manifest list-metadata -r zzttconsole -n copilot-cli

# Force restart
az webapp stop -g zzttconsole -n zzttconsole-copilot
az webapp start -g zzttconsole -n zzttconsole-copilot
```

**Empty response from copilot**
- First request after cold start may timeout. Retry.
- Check the frontend logs: `az webapp log tail -g zzttconsole -n zzttconsole`
- Verify OPENAI_API_KEY is set: `az webapp config appsettings list -g zzttconsole -n zzttconsole-copilot --query "[?name=='OPENAI_API_KEY']"`

**Auth callback stuck**
- Ensure ID token issuance is enabled (deploy-copilot.sh handles this)
- Clear cookies or use incognito

**ACR pull fails**
- Managed identity needs AcrPull role (setup-azure.sh handles this)
- Verify: `az webapp config show -g zzttconsole -n zzttconsole-copilot --query acrUseManagedIdentityCreds`
- Never use admin credentials — always managed identity
