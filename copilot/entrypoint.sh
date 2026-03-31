#!/bin/sh
set -e

# If a deploy key is provided, configure SSH for GitHub access
if [ -n "$DEPLOY_KEY" ]; then
  mkdir -p ~/.ssh
  echo "$DEPLOY_KEY" > ~/.ssh/id_ed25519
  chmod 600 ~/.ssh/id_ed25519
  ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
  git config --global user.name "zzttconsole-copilot"
  git config --global user.email "copilot@zzttconsole"

  REPO_DIR="/repo/zzttconsole"
  if [ -d "$REPO_DIR/.git" ]; then
    echo "==> Pulling latest zzttconsole..."
    git -C "$REPO_DIR" pull
  else
    echo "==> Cloning zzttconsole..."
    mkdir -p /repo
    git clone git@github.com:dezverev/zzttconsole.git "$REPO_DIR"
  fi

  # Run from the repo so skills/ and config are loaded from the latest commit
  echo "==> Running copilot from repo..."
  cd "$REPO_DIR/copilot"
  ln -sf /app/node_modules node_modules
  ln -sf /app/dist dist
fi

exec node dist/server.js
