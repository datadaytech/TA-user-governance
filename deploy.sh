#!/bin/bash
# Deploy script for TA-user-governance
# Bumps version, deploys to Splunk, restarts container

APP_DIR="/Users/steve/TA-user-governance"
APP_CONF="$APP_DIR/default/app.conf"

# Get current version and build
CURRENT_VERSION=$(grep "^version" "$APP_CONF" | cut -d'=' -f2 | tr -d ' ')
CURRENT_BUILD=$(grep "^build" "$APP_CONF" | cut -d'=' -f2 | tr -d ' ')

# Increment build number
NEW_BUILD=$((CURRENT_BUILD + 1))

# Increment patch version (1.2.2 -> 1.2.3)
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

echo "Updating version: $CURRENT_VERSION (build $CURRENT_BUILD) -> $NEW_VERSION (build $NEW_BUILD)"

# Update app.conf
sed -i '' "s/^build = .*/build = $NEW_BUILD/" "$APP_CONF"
sed -i '' "s/^version = .*/version = $NEW_VERSION/" "$APP_CONF"

echo "Backing up lookups from container..."
docker cp splunk-dev:/opt/splunk/etc/apps/TA-user-governance/lookups /tmp/gov_lookups_backup 2>/dev/null || true

echo "Deploying to Splunk..."
docker cp "$APP_DIR" splunk-dev:/opt/splunk/etc/apps/
docker exec -u root splunk-dev chown -R splunk:splunk /opt/splunk/etc/apps/TA-user-governance

echo "Restoring lookups..."
if [ -d "/tmp/gov_lookups_backup" ]; then
  docker cp /tmp/gov_lookups_backup/. splunk-dev:/opt/splunk/etc/apps/TA-user-governance/lookups/
  docker exec -u root splunk-dev chown -R splunk:splunk /opt/splunk/etc/apps/TA-user-governance/lookups
  rm -rf /tmp/gov_lookups_backup
  echo "✓ Lookups preserved"
fi

echo "Restarting Splunk container..."
docker restart splunk-dev

echo "Waiting for Splunk to be ready..."
count=0
while [ $count -lt 30 ]; do
  health=$(docker inspect --format='{{.State.Health.Status}}' splunk-dev 2>/dev/null)
  if [ "$health" = "healthy" ]; then
    echo "✓ Deployed v$NEW_VERSION (build $NEW_BUILD)"
    echo "URL: http://splunk.local"
    exit 0
  fi
  sleep 3
  count=$((count + 1))
done
echo "Warning: Splunk health check timeout, but container may still be starting..."
