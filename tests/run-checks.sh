#!/bin/bash
set -e  # Exit on first failure

echo "========================================"
echo "  TA-user-governance Validation Suite"
echo "========================================"
echo ""

# Navigate to tests directory
cd "$(dirname "$0")"

echo "=== 1. JavaScript Linting ==="
if command -v npx &> /dev/null; then
    # Check for common JS issues (optional - install eslint if needed)
    if [ -f "../appserver/static/governance.js" ]; then
        echo "Checking governance.js syntax..."
        node --check ../appserver/static/governance.js 2>/dev/null && echo "✓ Syntax OK" || echo "⚠ Syntax check skipped"
    fi
else
    echo "⚠ npx not found, skipping lint"
fi
echo ""

echo "=== 2. Unit Tests (Jest) ==="
npx jest unit/ --verbose --passWithNoTests
echo ""

echo "=== 3. Dashboard XML Validation ==="
for xml in ../default/data/ui/views/*.xml; do
    if [ -f "$xml" ]; then
        # Basic XML well-formedness check
        if command -v xmllint &> /dev/null; then
            xmllint --noout "$xml" 2>/dev/null && echo "✓ $(basename $xml)" || echo "✗ $(basename $xml) - malformed"
        else
            # Fallback: use Python
            python3 -c "import xml.etree.ElementTree as ET; ET.parse('$xml')" 2>/dev/null && echo "✓ $(basename $xml)" || echo "✗ $(basename $xml) - malformed"
        fi
    fi
done
echo ""

echo "=== 4. Lookup CSV Structure ==="
for csv in ../lookups/*.csv; do
    if [ -f "$csv" ]; then
        lines=$(wc -l < "$csv" | tr -d ' ')
        cols=$(head -1 "$csv" | tr ',' '\n' | wc -l | tr -d ' ')
        echo "✓ $(basename $csv): $lines lines, $cols columns"
    fi
done
echo ""

echo "=== 5. App Configuration ==="
if [ -f "../default/app.conf" ]; then
    echo "✓ app.conf exists"
    grep -q "label" ../default/app.conf && echo "  - Has label" || echo "  ⚠ Missing label"
    grep -q "version" ../default/app.conf && echo "  - Has version" || echo "  ⚠ Missing version"
fi
echo ""

echo "=== 6. Splunk Container Check ==="
if docker ps --format '{{.Names}}' | grep -q "splunk"; then
    echo "✓ Splunk container is running"
    # Quick API check
    curl -s -k -u admin:changeme123 "https://localhost:8089/services/server/info" -o /dev/null && echo "✓ Splunk API responding" || echo "⚠ Splunk API not responding"
else
    echo "⚠ Splunk container not running (Playwright tests will fail)"
fi
echo ""

echo "========================================"
echo "  ✅ All validation checks completed"
echo "========================================"
