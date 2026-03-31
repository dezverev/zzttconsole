#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
# Builds and deploys the copilot container, configures auth.
# Run setup-azure.sh first if resources don't exist yet.
# ══════════════════════════════════════════════════════════════

SITE_NAME="zzttconsole"
COPILOT_NAME="zzttconsole-copilot"
RESOURCE_GROUP="zzttconsole"
REGISTRY="zzttconsole.azurecr.io"
IMAGE="copilot-cli"
TAG="latest"
ALLOWED_EMAIL="dbzverev@outlook.com"

cd "$(dirname "$0")/copilot"

# ── Build & push container (amd64 for Azure) ───────────────
echo "==> Building Docker image (linux/amd64)..."
docker build --platform linux/amd64 -t "$REGISTRY/$IMAGE:$TAG" .

echo "==> Pushing to ACR..."
az acr login --name zzttconsole
docker push "$REGISTRY/$IMAGE:$TAG"

echo "==> Updating copilot container..."
az webapp config container set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$COPILOT_NAME" \
  --container-image-name "$REGISTRY/$IMAGE:$TAG" \
  --container-registry-url "https://$REGISTRY"

az webapp config set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$COPILOT_NAME" \
  --generic-configurations '{"acrUseManagedIdentityCreds": true}' > /dev/null

# ── Env vars ───────────────────────────────────────────────
echo "==> Setting copilot env vars..."
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$COPILOT_NAME" \
  --settings \
    COPILOT_MODEL=gpt-5.4-mini \
    OPENAI_BASE_URL=https://api.openai.com/v1 \
    WEBSITES_PORT=8080

echo "==> Setting frontend env vars..."
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SITE_NAME" \
  --settings \
    COPILOT_URL="https://${COPILOT_NAME}.azurewebsites.net"

# ── Managed Identity: frontend → copilot ───────────────────
echo "==> Enabling managed identity on frontend..."
SITE_PRINCIPAL_ID=$(az webapp identity assign \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SITE_NAME" \
  --query principalId -o tsv)
echo "  Principal: $SITE_PRINCIPAL_ID"

# ── Entra ID: copilot app registration ─────────────────────
echo "==> Setting up Entra ID app for copilot..."
COPILOT_APP_ID=$(az ad app list --display-name "$COPILOT_NAME" --query "[0].appId" -o tsv 2>/dev/null || true)

if [ -z "$COPILOT_APP_ID" ] || [ "$COPILOT_APP_ID" = "None" ]; then
  echo "  Creating app registration..."
  COPILOT_APP_ID=$(az ad app create \
    --display-name "$COPILOT_NAME" \
    --sign-in-audience AzureADMyOrg \
    --query "appId" -o tsv)
  az ad app update --id "$COPILOT_APP_ID" --identifier-uris "api://${COPILOT_APP_ID}"
  echo "  Created: $COPILOT_APP_ID"
else
  echo "  Exists: $COPILOT_APP_ID"
fi

SECRET=$(az ad app credential reset --id "$COPILOT_APP_ID" --query "password" -o tsv)

az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SITE_NAME" \
  --settings COPILOT_APP_ID="api://${COPILOT_APP_ID}"

# ── Easy Auth: copilot (token validation, reject anonymous) ─
echo "==> Enabling Easy Auth on copilot..."
az webapp auth update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$COPILOT_NAME" \
  --enabled true \
  --action LoginWithAzureActiveDirectory \
  --aad-client-id "$COPILOT_APP_ID" \
  --aad-client-secret "$SECRET" \
  --aad-allowed-token-audiences "api://${COPILOT_APP_ID}" \
  --aad-token-issuer-url "https://login.microsoftonline.com/common/v2.0"

# ── Entra ID: frontend app registration ────────────────────
echo "==> Setting up Entra ID app for frontend..."
SITE_URI="https://${SITE_NAME}.azurewebsites.net"
SITE_APP_ID=$(az ad app list --display-name "${SITE_NAME}-auth" --query "[0].appId" -o tsv 2>/dev/null || true)

if [ -z "$SITE_APP_ID" ] || [ "$SITE_APP_ID" = "None" ]; then
  SITE_APP_ID=$(az ad app create \
    --display-name "${SITE_NAME}-auth" \
    --web-redirect-uris "${SITE_URI}/.auth/login/aad/callback" \
    --sign-in-audience AzureADandPersonalMicrosoftAccount \
    --query "appId" -o tsv)
  SITE_SECRET=$(az ad app credential reset --id "$SITE_APP_ID" --query "password" -o tsv)
  echo "  Created: $SITE_APP_ID"
else
  SITE_SECRET=$(az ad app credential reset --id "$SITE_APP_ID" --query "password" -o tsv)
  echo "  Exists: $SITE_APP_ID"
fi

# Enable ID token issuance (required for Easy Auth callback)
SITE_APP_OBJ_ID=$(az rest --method GET \
  --url "https://graph.microsoft.com/v1.0/applications?\$filter=appId eq '${SITE_APP_ID}'" \
  --query "value[0].id" -o tsv)
az rest --method PATCH \
  --url "https://graph.microsoft.com/v1.0/applications/$SITE_APP_OBJ_ID" \
  --body '{"web":{"implicitGrantSettings":{"enableIdTokenIssuance":true}}}'

# ── Easy Auth: frontend (Microsoft login) ──────────────────
echo "==> Enabling Easy Auth on frontend..."
az webapp auth update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SITE_NAME" \
  --enabled true \
  --action LoginWithAzureActiveDirectory \
  --aad-client-id "$SITE_APP_ID" \
  --aad-client-secret "$SITE_SECRET" \
  --aad-allowed-token-audiences "$SITE_URI" \
  --aad-token-issuer-url "https://login.microsoftonline.com/common/v2.0"

# ── Lock down to allowed user only ─────────────────────────
echo "==> Locking down to $ALLOWED_EMAIL..."
USER_ID=$(az ad signed-in-user show --query id -o tsv)

SITE_SP_ID=$(az ad sp list --filter "appId eq '${SITE_APP_ID}'" --query "[0].id" -o tsv 2>/dev/null || true)
if [ -z "$SITE_SP_ID" ] || [ "$SITE_SP_ID" = "None" ]; then
  SITE_SP_ID=$(az ad sp create --id "$SITE_APP_ID" --query id -o tsv)
fi

az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/$SITE_SP_ID/owners/\$ref" \
  --body "{\"@odata.id\":\"https://graph.microsoft.com/v1.0/users/$USER_ID\"}" 2>/dev/null || true

az rest --method PATCH \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/$SITE_SP_ID" \
  --body '{"appRoleAssignmentRequired":true}'

az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/$SITE_SP_ID/appRoleAssignments" \
  --body "{\"principalId\":\"$USER_ID\",\"resourceId\":\"$SITE_SP_ID\",\"appRoleId\":\"00000000-0000-0000-0000-000000000000\"}" 2>/dev/null || true

# ── Restart ────────────────────────────────────────────────
echo "==> Restarting copilot..."
az webapp restart -g "$RESOURCE_GROUP" -n "$COPILOT_NAME"

# ── Summary ────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════"
echo "  Deploy complete!"
echo "══════════════════════════════════════"
echo ""
echo "  Frontend:  ${SITE_URI}"
echo "  Copilot:   https://${COPILOT_NAME}.azurewebsites.net"
echo "  Auth:      Locked to $ALLOWED_EMAIL"
echo ""
echo "  Next steps:"
echo "    1. ./deploy.sh                    # deploy frontend"
echo "    2. Set OpenAI key (if not already set):"
echo "       az webapp config appsettings set -g $RESOURCE_GROUP -n $COPILOT_NAME \\"
echo "         --settings OPENAI_API_KEY=sk-..."
