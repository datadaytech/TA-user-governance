const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ bypassCSP: true });
    const page = await context.newPage();

    console.log("=== Testing Badge Display in Flagged Modal ===\n");

    // Login
    await page.goto('http://localhost:8000/en-US/account/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'changeme123');
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/app\//);

    // Go to dashboard
    console.log("1. Loading dashboard...");
    await page.goto('http://localhost:8000/en-US/app/TA-user-governance/governance_dashboard?v=' + Date.now());
    await page.waitForTimeout(15000);

    // Click Currently Flagged panel
    console.log("2. Opening Currently Flagged modal...");
    await page.evaluate(function() {
        var h3s = document.querySelectorAll('.panel-head h3');
        for (var i = 0; i < h3s.length; i++) {
            if (h3s[i].textContent.indexOf('Flagged') > -1 && h3s[i].textContent.indexOf('Suspicious') === -1) {
                var parent = h3s[i].closest('.dashboard-element');
                if (parent) {
                    var sv = parent.querySelector('.single-value');
                    if (sv) { sv.click(); return; }
                }
            }
        }
    });
    await page.waitForTimeout(5000);

    // Get modal content
    var modalData = await page.evaluate(function() {
        var rows = document.querySelectorAll('#metricPopupTableBody tr.metric-popup-row');
        var data = [];
        rows.forEach(function(row) {
            var name = row.getAttribute('data-search-name') || 'unknown';
            var statusCell = row.querySelector('.status-cell');
            var badges = [];
            if (statusCell) {
                var badgeEls = statusCell.querySelectorAll('.status-badge');
                badgeEls.forEach(function(b) {
                    badges.push(b.textContent.trim());
                });
            }
            data.push({ name: name, badges: badges });
        });
        return data;
    });

    console.log("   Modal content:");
    var disabledCount = 0;
    var notifiedCount = 0;
    modalData.forEach(function(item, i) {
        var badgeStr = item.badges.join(', ') || 'none';
        console.log("     " + (i+1) + ". " + item.name + " -> [" + badgeStr + "]");
        if (item.badges.includes('DISABLED')) disabledCount++;
        if (item.badges.includes('NOTIFIED')) notifiedCount++;
    });

    console.log("\n=== RESULT ===");
    console.log("Total rows: " + modalData.length);
    console.log("DISABLED badges: " + disabledCount);
    console.log("NOTIFIED badges: " + notifiedCount);

    // Expected: 1 DISABLED, 5 NOTIFIED
    if (disabledCount === 1 && notifiedCount === 5) {
        console.log("✓ PASS: Correct badge distribution (1 DISABLED, 5 NOTIFIED)");
    } else {
        console.log("✗ FAIL: Expected 1 DISABLED and 5 NOTIFIED");
    }

    await page.screenshot({ path: '/tmp/badge-display.png' });
    console.log("\nScreenshot: /tmp/badge-display.png");

    await browser.close();
})();
