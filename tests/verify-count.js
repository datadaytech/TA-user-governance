const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ bypassCSP: true });
    const page = await context.newPage();

    console.log("=== Verifying Flagged Count Fix ===\n");

    await page.goto('http://localhost:8000/en-US/account/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'changeme123');
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/app\//);

    // Navigate to dashboard
    console.log("1. Navigating to dashboard...");
    await page.goto('http://localhost:8000/en-US/app/TA-user-governance/governance_dashboard?_t=' + Date.now(), {
        waitUntil: 'load'
    });
    await page.waitForTimeout(20000);

    // Get Currently Flagged value
    var flaggedValue = await page.evaluate(function() {
        var panels = document.querySelectorAll('.dashboard-panel, .dashboard-element');
        for (var i = 0; i < panels.length; i++) {
            var title = panels[i].querySelector('h3');
            if (title && title.textContent.indexOf('Currently Flagged') > -1) {
                var sv = panels[i].querySelector('.single-value');
                if (sv) return sv.textContent.trim();
            }
        }
        return 'NOT FOUND';
    });

    console.log("2. Currently Flagged panel value: " + flaggedValue);

    // Click on the Currently Flagged panel
    console.log("3. Clicking on Currently Flagged panel...");
    await page.evaluate(function() {
        var panels = document.querySelectorAll('.dashboard-panel, .dashboard-element');
        for (var i = 0; i < panels.length; i++) {
            var title = panels[i].querySelector('h3');
            if (title && title.textContent.indexOf('Currently Flagged') > -1) {
                var sv = panels[i].querySelector('.single-value');
                if (sv) {
                    sv.click();
                    return true;
                }
            }
        }
        return false;
    });

    await page.waitForTimeout(5000);

    // Check if modal opened
    var modalVisible = await page.locator('#metricPopupOverlay').isVisible().catch(function() { return false; });
    if (!modalVisible) {
        console.log("   ERROR: Modal did not open");
        await page.screenshot({ path: '/tmp/flagged-count-fix.png' });
        await browser.close();
        return;
    }

    // Get modal info
    var modalInfo = await page.evaluate(function() {
        var valueEl = document.getElementById('metricPopupValue');
        var titleEl = document.getElementById('metricPopupTitle');
        var tableRows = document.querySelectorAll('#metricPopupTableBody tr.metric-popup-row');
        var searches = [];
        tableRows.forEach(function(row) {
            var name = row.getAttribute('data-search-name') || 'unknown';
            searches.push(name);
        });
        return {
            value: valueEl ? valueEl.textContent : 'N/A',
            title: titleEl ? titleEl.textContent : 'N/A',
            rowCount: tableRows.length,
            searches: searches
        };
    });

    console.log("   Modal opened!");
    console.log("   Modal header value: " + modalInfo.value);
    console.log("   Modal title: " + modalInfo.title);
    console.log("   Rows in table: " + modalInfo.rowCount);
    console.log("\n   Searches shown:");
    modalInfo.searches.forEach(function(s, i) {
        console.log("     " + (i+1) + ". " + s);
    });

    console.log("\n=== RESULT ===");
    var panelNum = parseInt(flaggedValue);
    var modalNum = parseInt(modalInfo.value);

    if (panelNum === modalInfo.rowCount && panelNum === modalNum) {
        console.log("✓ PASS: All values match!");
        console.log("  Panel value: " + flaggedValue);
        console.log("  Modal header: " + modalInfo.value);
        console.log("  Rows shown: " + modalInfo.rowCount);
    } else {
        console.log("✗ Mismatch detected:");
        console.log("  Panel value: " + flaggedValue);
        console.log("  Modal header: " + modalInfo.value);
        console.log("  Rows shown: " + modalInfo.rowCount);
    }

    await page.screenshot({ path: '/tmp/flagged-count-fix.png' });
    console.log("\nScreenshot saved: /tmp/flagged-count-fix.png");

    await browser.close();
})();
