# Copilot Container

AI assistant powered by the [GitHub Copilot SDK](https://github.com/github/copilot-sdk), deployed as a Docker container on Azure App Service.

## Azure Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │              Microsoft Entra ID              │
                    │         (login restricted to allowed         │
                    │          Microsoft account only)             │
                    └──────────┬──────────────────┬───────────────┘
                               │ auth             │ auth
                               ▼                  ▼
┌──────────┐    ┌──────────────────────┐    ┌──────────────────────────┐
│          │    │   zzttconsole (B1)   │    │  zzttconsole-copilot (B1)│
│  Browser │───▶│   Node.js frontend   │───▶│  Docker container        │
│          │    │   serves static site │    │  Copilot SDK + OpenAI    │
│          │    │   proxies /api/copilot│    │                          │
└──────────┘    └──────────────────────┘    └──────────┬───────────────┘
                         │                             │
                         │ managed identity             │ managed identity
                         │ token for copilot            │ for ACR pull
                         ▼                              ▼
                                                ┌──────────────────┐
                                                │ zzttconsole.     │
                                                │ azurecr.io (Basic)│
                                                │ Container Registry│
                                                └──────────────────┘
```

### Azure Resources

| Resource | Type | SKU | Purpose |
|----------|------|-----|---------|
| `zzttconsole` | App Service | B1 | Frontend — static site + `/api/copilot` proxy |
| `zzttconsole-copilot` | App Service (container) | B1 | Copilot — runs the Docker image |
| `zzttconsole` | Container Registry | Basic | Stores the copilot Docker image |
| `zzttconsole-auth` | Entra ID app registration | — | Frontend login (Microsoft account) |
| `zzttconsole-copilot` | Entra ID app registration | — | Copilot token validation |

### Authentication Flow

The system uses two layers of Entra ID authentication to lock everything down:

1. **Browser → Frontend**: Easy Auth requires Microsoft login, restricted to a single allowed account. Unauthenticated requests get redirected to the login page.

2. **Frontend → Copilot**: The frontend App Service has a managed identity. It acquires a token scoped to the copilot's app registration (`api://<copilot-app-id>`) and passes it in the proxy request. The copilot has Easy Auth enabled and rejects any request without a valid token.

No passwords or shared secrets are used for service-to-service auth — it's all managed identity.

### Container Registry

The copilot container image is stored in `zzttconsole.azurecr.io`. The copilot App Service pulls images using its managed identity with the `AcrPull` role — no admin credentials or passwords.

```bash
# Build, push, and deploy
./deploy-copilot.sh

# What it does:
#   docker build --platform linux/amd64 → zzttconsole.azurecr.io/copilot-cli:latest
#   docker push → ACR
#   az webapp config container set → point App Service to new image
#   az webapp restart
```

### GitHub Repo Access

The copilot container has an SSH deploy key (ed25519) with write access to `dezverev/zzttconsole`. The private key is stored as the `DEPLOY_KEY` app setting in Azure. On startup, `entrypoint.sh` writes it to `~/.ssh/id_ed25519` and clones the repo.

This gives the copilot the ability to:
- Pull the latest skills and config on every restart
- Push commits back to the repo (self-modification)

### Cost

| Resource | ~Cost/month |
|----------|-------------|
| App Service Plan (frontend, B1) | $13 |
| App Service Plan (copilot, B1) | $13 |
| Container Registry (Basic) | $5 |
| **Total infrastructure** | **~$31** |

Plus OpenAI API usage.

### Setup Scripts

| Script | When to run | What it does |
|--------|-------------|--------------|
| `setup-azure.sh` | Once | Creates resource group, ACR, app service plans, managed identities, role assignments |
| `deploy-copilot.sh` | On code changes | Builds Docker image, pushes to ACR, configures auth + env vars, restarts |
| `deploy.sh` | On frontend changes | Zips and deploys `matrixsite/` to the frontend App Service |

## How It Works

The container runs a Node.js HTTP server that accepts prompts via `POST /ask` and returns AI responses. On startup, it clones this repo so skills and MCP tools are always loaded from the latest commit — no rebuild needed for skill changes.

### Container Startup Flow

```
Container starts
  → entrypoint.sh configures SSH with deploy key
  → Clones/pulls dezverev/zzttconsole to /repo/zzttconsole
  → Symlinks dist/ and node_modules/ from the Docker image
  → cd into repo's copilot/ dir
  → Runs node dist/server.js
```

### Request Flow

```
POST /ask { "prompt": "..." }
  → server.ts
  → client.ts (createSession with skills + MCP servers)
  → Copilot SDK → OpenAI API
       ↕
  MCP servers (stdio subprocesses)
```

## Skills

Skills are markdown files in `skills/*/SKILL.md` that teach the copilot how to behave. They're loaded via `skillDirectories: ["./skills"]` in the session config.

| Skill | Description |
|-------|-------------|
| `general` | Default coding assistant behavior |
| `weather` | Chains geocode → weather MCP tools for location-based weather queries |

To add a skill, create `skills/<name>/SKILL.md` with frontmatter:

```markdown
---
name: my-skill
description: What it does
---

Instructions for the copilot...
```

Push to main and restart the container — it pulls the latest on startup.

## MCP Servers

MCP (Model Context Protocol) servers expose tools the copilot can call. They run as stdio subprocesses and communicate via JSON-RPC.

### open-meteo

Provides two tools using the free [Open-Meteo API](https://open-meteo.com/) (no API key required):

- **`geocode`** — Look up a location by name, returns lat/lng
- **`weather`** — Get current weather for a lat/lng (temperature, humidity, wind, conditions)

Source: `src/mcp-weather.ts`

### Adding an MCP Server

1. Create the server in `src/` (implement JSON-RPC over stdin/stdout)
2. Register it in `client.ts` under `mcpServers`:

```typescript
mcpServers: {
  "my-server": {
    type: "local",
    command: "node",
    args: ["dist/my-server.js"],
    tools: ["*"],
  },
},
```

## API

### `POST /ask`

```json
{ "prompt": "What's the weather in Tokyo?" }
```

Response:

```json
{ "response": "Currently in Tokyo, Japan it's 68°F..." }
```

### `GET /health`

Returns `{ "status": "ok" }`.

## Environment Variables

Set on the Azure App Service as app settings:

| Variable | Description | Default |
|----------|-------------|---------|
| `COPILOT_MODEL` | Model name | `gpt-5.4-mini` |
| `OPENAI_BASE_URL` | OpenAI-compatible API endpoint | `http://localhost:1234/v1` |
| `OPENAI_API_KEY` | API key for the provider | — |
| `DEPLOY_KEY` | SSH private key for GitHub repo access | — |
| `PORT` | Server listen port | `8080` |

## Self-Updating

The copilot has read/write access to this repo via its deploy key. Skills, MCP servers, and config can be updated by pushing to main — changes take effect on the next container restart.

The container **cannot** rebuild itself. Code changes to `src/` still require `./deploy-copilot.sh` to rebuild the Docker image.

## Local Development

```bash
cd copilot
cp .env.example .env    # configure model + API key
npm install
npx tsx src/server.ts    # starts on port 8080

# Or CLI mode:
npx tsx src/cli.ts "what's the weather in Berlin?"
```

## Deploying

```bash
# Everything (copilot code changed):
./deploy-copilot.sh && ./deploy.sh

# Just copilot:
./deploy-copilot.sh

# Just frontend:
./deploy.sh
```

## Logs

```bash
az webapp log tail -g zzttconsole -n zzttconsole-copilot
```

Look for `==> Cloning zzttconsole...` or `==> Pulling latest...` to confirm the repo was loaded on startup.

## Troubleshooting

```bash
# Container won't start
az webapp log tail -g zzttconsole -n zzttconsole-copilot

# Verify image architecture (must be amd64)
az acr manifest list-metadata -r zzttconsole -n copilot-cli

# Force restart
az webapp restart -g zzttconsole -n zzttconsole-copilot

# Check env vars
az webapp config appsettings list -g zzttconsole -n zzttconsole-copilot

# Verify ACR pull is using managed identity
az webapp config show -g zzttconsole -n zzttconsole-copilot --query acrUseManagedIdentityCreds
```
