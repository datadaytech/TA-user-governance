const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ bypassCSP: true });
    const page = await context.newPage();

    // Track dialogs
    page.on('dialog', async dialog => {
        console.log("Dialog: " + dialog.message().substring(0, 60));
        await dialog.accept();
    });

    console.log("=== Testing Disabled Indicator Persistence ===\n");

    // Login
    await page.goto('http://localhost:8000/en-US/account/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'changeme123');
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/app\//);

    // Go to dashboard
    console.log("1. Loading dashboard...");
    await page.goto('http://localhost:8000/en-US/app/TA-user-governance/governance_dashboard?v=' + Date.now(), {
        waitUntil: 'load'
    });
    await page.waitForTimeout(15000);
    console.log("   Dashboard loaded\n");

    // Click on Currently Flagged panel to open modal
    console.log("2. Opening Currently Flagged modal...");
    var clicked = await page.evaluate(function() {
        var h3s = document.querySelectorAll('.panel-head h3');
        for (var i = 0; i < h3s.length; i++) {
            if (h3s[i].textContent.indexOf('Flagged') > -1 && h3s[i].textContent.indexOf('Suspicious') === -1) {
                var parent = h3s[i].closest('.dashboard-element');
                if (parent) {
                    var sv = parent.querySelector('.single-value');
                    if (sv) {
                        sv.click();
                        return true;
                    }
                }
            }
        }
        return false;
    });

    if (!clicked) {
        console.log("   ERROR: Could not click on Currently Flagged panel");
        await browser.close();
        return;
    }

    await page.waitForTimeout(5000);

    // Get initial modal data
    var initialData = await page.evaluate(function() {
        var rows = document.querySelectorAll('#metricPopupTableBody tr.metric-popup-row');
        var data = [];
        rows.forEach(function(row) {
            var name = row.getAttribute('data-search-name') || 'unknown';
            var statusCell = row.querySelector('.status-cell');
            var hasDisabled = statusCell ? statusCell.innerHTML.indexOf('DISABLED') > -1 : false;
            data.push({ name: name, hasDisabled: hasDisabled });
        });
        return data;
    });

    console.log("   Modal opened with " + initialData.length + " searches:");
    initialData.forEach(function(item, i) {
        var marker = item.hasDisabled ? ' [DISABLED]' : '';
        console.log("     " + (i+1) + ". " + item.name + marker);
    });

    // Close modal
    console.log("\n3. Closing modal...");
    await page.click('#metricPopupClose');
    await page.waitForTimeout(1000);

    // Reopen modal
    console.log("4. Reopening modal...");
    await page.evaluate(function() {
        var h3s = document.querySelectorAll('.panel-head h3');
        for (var i = 0; i < h3s.length; i++) {
            if (h3s[i].textContent.indexOf('Flagged') > -1 && h3s[i].textContent.indexOf('Suspicious') === -1) {
                var parent = h3s[i].closest('.dashboard-element');
                if (parent) {
                    var sv = parent.querySelector('.single-value');
                    if (sv) {
                        sv.click();
                        return;
                    }
                }
            }
        }
    });
    await page.waitForTimeout(5000);

    // Get modal data again
    var reopenedData = await page.evaluate(function() {
        var rows = document.querySelectorAll('#metricPopupTableBody tr.metric-popup-row');
        var data = [];
        rows.forEach(function(row) {
            var name = row.getAttribute('data-search-name') || 'unknown';
            var statusCell = row.querySelector('.status-cell');
            var hasDisabled = statusCell ? statusCell.innerHTML.indexOf('DISABLED') > -1 : false;
            var statusHtml = statusCell ? statusCell.innerHTML.substring(0, 100) : '';
            data.push({ name: name, hasDisabled: hasDisabled, statusHtml: statusHtml });
        });
        return data;
    });

    console.log("   Modal reopened with " + reopenedData.length + " searches:");
    reopenedData.forEach(function(item, i) {
        var marker = item.hasDisabled ? ' [DISABLED]' : '';
        console.log("     " + (i+1) + ". " + item.name + marker);
    });

    console.log("\n=== RESULT ===");
    // Check if any disabled items exist and if count is same
    var initialDisabled = initialData.filter(function(d) { return d.hasDisabled; }).length;
    var reopenedDisabled = reopenedData.filter(function(d) { return d.hasDisabled; }).length;

    console.log("Initial count: " + initialData.length + ", Disabled: " + initialDisabled);
    console.log("Reopened count: " + reopenedData.length + ", Disabled: " + reopenedDisabled);

    if (initialData.length === reopenedData.length) {
        console.log("✓ PASS: Same number of items shown after reopen");
    } else {
        console.log("✗ FAIL: Count changed - initial: " + initialData.length + ", reopened: " + reopenedData.length);
    }

    await page.screenshot({ path: '/tmp/disabled-persist.png' });
    console.log("\nScreenshot: /tmp/disabled-persist.png");

    await browser.close();
})();
