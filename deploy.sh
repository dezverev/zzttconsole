#!/usr/bin/env bash
set -euo pipefail

APP_NAME="zzttconsole"
RESOURCE_GROUP="zzttconsole"
SOURCE_DIR="matrixsite"
ZIP_FILE="deploy.zip"

cd "$(dirname "$0")"

echo "==> Packaging $SOURCE_DIR..."
rm -f "$ZIP_FILE"
cd "$SOURCE_DIR"
zip -r "../$ZIP_FILE" . -x '*.DS_Store' '*.md' 'island-data.json' 'node_modules/*' '*.test.js' 'package-lock.json'
cd ..

echo "==> Deploying to Azure App Service: $APP_NAME..."
az webapp deploy \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --src-path "$ZIP_FILE" \
  --type zip \
  --clean true

rm -f "$ZIP_FILE"

echo "==> Done! Site: https://${APP_NAME}.azurewebsites.net"
