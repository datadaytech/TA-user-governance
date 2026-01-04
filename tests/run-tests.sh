#!/bin/bash
# Functional test runner for TA-user-governance
# Starts Splunk, deploys app, runs Playwright tests

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
SPLUNK_URL="${SPLUNK_URL:-http://localhost:8000}"
SPLUNK_USERNAME="${SPLUNK_USERNAME:-admin}"
SPLUNK_PASSWORD="${SPLUNK_PASSWORD:-changeme123}"

echo "=== TA-user-governance Functional Tests ==="
echo ""

# Check if Splunk container exists
if ! docker ps -a --format '{{.Names}}' | grep -q '^splunk-dev$'; then
    echo "Error: splunk-dev container does not exist"
    echo "Create it with: docker run -d --name splunk-dev ..."
    exit 1
fi

# Start Splunk if not running
if ! docker ps --format '{{.Names}}' | grep -q '^splunk-dev$'; then
    echo "Starting Splunk container..."
    docker start splunk-dev
fi

# Wait for Splunk to be healthy
echo "Waiting for Splunk to be healthy..."
count=0
while [ $count -lt 60 ]; do
    health=$(docker inspect --format='{{.State.Health.Status}}' splunk-dev 2>/dev/null || echo "unknown")
    if [ "$health" = "healthy" ]; then
        echo "Splunk is healthy!"
        break
    fi
    echo "  Status: $health (attempt $((count+1))/60)"
    sleep 5
    count=$((count + 1))
done

if [ "$health" != "healthy" ]; then
    echo "Error: Splunk did not become healthy"
    exit 1
fi

# Deploy latest app version
echo ""
echo "Deploying latest app version..."
"$APP_DIR/deploy.sh"

# Wait a bit more for Splunk to fully restart after deploy
echo "Waiting for Splunk to restart after deploy..."
sleep 10
count=0
while [ $count -lt 30 ]; do
    health=$(docker inspect --format='{{.State.Health.Status}}' splunk-dev 2>/dev/null || echo "unknown")
    if [ "$health" = "healthy" ]; then
        break
    fi
    sleep 3
    count=$((count + 1))
done

# Run Playwright tests
echo ""
echo "Running Playwright tests..."
echo "URL: $SPLUNK_URL"
echo ""

cd "$SCRIPT_DIR"

# Export environment variables for tests
export SPLUNK_URL
export SPLUNK_USERNAME
export SPLUNK_PASSWORD

# Run tests with optional arguments
if [ "$1" = "--headed" ]; then
    /opt/homebrew/bin/npx playwright test --headed
elif [ "$1" = "--debug" ]; then
    /opt/homebrew/bin/npx playwright test --debug
elif [ "$1" = "--ui" ]; then
    /opt/homebrew/bin/npx playwright test --ui
else
    /opt/homebrew/bin/npx playwright test "$@"
fi

TEST_EXIT=$?

echo ""
if [ $TEST_EXIT -eq 0 ]; then
    echo "=== All tests passed! ==="
else
    echo "=== Some tests failed (exit code: $TEST_EXIT) ==="
    echo "Run 'npm run report' to see detailed results"
fi

exit $TEST_EXIT
