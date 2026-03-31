#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
# Run this ONCE to create all Azure resources.
# After this, use deploy-copilot.sh and deploy.sh for updates.
# ══════════════════════════════════════════════════════════════

RESOURCE_GROUP="zzttconsole"
SITE_NAME="zzttconsole"
COPILOT_NAME="zzttconsole-copilot"
COPILOT_PLAN="zzttconsole-copilot-plan"
REGISTRY="zzttconsole"
LOCATION="westus3"

echo "==> Creating Container Registry..."
az acr create -g "$RESOURCE_GROUP" -n "$REGISTRY" --sku Basic --location "$LOCATION"

echo "==> Creating B1 plan for copilot container..."
az appservice plan create -g "$RESOURCE_GROUP" -n "$COPILOT_PLAN" --is-linux --sku B1 --location "$LOCATION"

echo "==> Creating copilot App Service..."
az webapp create -g "$RESOURCE_GROUP" -n "$COPILOT_NAME" \
  -p "$COPILOT_PLAN" \
  --deployment-container-image-name mcr.microsoft.com/appsvc/staticsite:latest

echo "==> Enabling managed identity on copilot..."
COPILOT_PRINCIPAL=$(az webapp identity assign -g "$RESOURCE_GROUP" -n "$COPILOT_NAME" --query principalId -o tsv)

echo "==> Granting copilot managed identity ACR pull access..."
ACR_ID=$(az acr show -n "$REGISTRY" --query id -o tsv)
az role assignment create --assignee "$COPILOT_PRINCIPAL" --scope "$ACR_ID" --role AcrPull

echo "==> Configuring copilot to use managed identity for ACR..."
az webapp config set -g "$RESOURCE_GROUP" -n "$COPILOT_NAME" \
  --generic-configurations '{"acrUseManagedIdentityCreds": true}' > /dev/null

echo "==> Upgrading frontend plan to B1 (needed for managed identity + Easy Auth)..."
az appservice plan update -g "$RESOURCE_GROUP" -n "$SITE_NAME" --sku B1

echo ""
echo "══════════════════════════════════════"
echo "  Setup complete!"
echo "══════════════════════════════════════"
echo ""
echo "  Frontend:  $SITE_NAME (B1)"
echo "  Copilot:   $COPILOT_NAME (B1)"
echo "  Registry:  $REGISTRY.azurecr.io (MI pull, no passwords)"
echo ""
echo "  Next: ./deploy-copilot.sh"
