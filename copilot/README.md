# Copilot Container

AI assistant powered by the [GitHub Copilot SDK](https://github.com/github/copilot-sdk), deployed as a Docker container on Azure App Service.

## How It Works

The container runs a Node.js HTTP server that accepts prompts via `POST /ask` and returns AI responses. On startup, it clones this repo so skills and MCP tools are always loaded from the latest commit — no rebuild needed for skill changes.

### Startup Flow

```
Container starts
  → entrypoint.sh configures SSH with deploy key
  → Clones/pulls dezverev/zzttconsole to /repo/zzttconsole
  → Symlinks dist/ and node_modules/ from the Docker image
  → cd into repo's copilot/ dir
  → Runs node dist/server.js
```

### Architecture

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
./deploy-copilot.sh
```

This builds the Docker image (linux/amd64), pushes to ACR, updates the container, and configures auth.

## Logs

```bash
az webapp log tail -g zzttconsole -n zzttconsole-copilot
```

Look for `==> Cloning zzttconsole...` or `==> Pulling latest...` to confirm the repo was loaded on startup.
