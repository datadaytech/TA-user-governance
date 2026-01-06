const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ bypassCSP: true });
    const page = await context.newPage();

    console.log("=== Checking Status Display ===\n");

    // Login
    await page.goto('http://localhost:8000/en-US/account/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'changeme123');
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/app\//);

    // Go to dashboard with cache buster
    console.log("1. Loading dashboard...");
    await page.goto('http://localhost:8000/en-US/app/TA-user-governance/governance_dashboard?refresh=' + Date.now(), {
        waitUntil: 'networkidle'
    });
    await page.waitForTimeout(20000);

    // Find Governance_Test_Search_3 in the All Scheduled Searches table
    console.log("2. Finding Governance_Test_Search_3 in main table...");

    var tableInfo = await page.evaluate(function() {
        var tables = document.querySelectorAll('table');
        for (var i = 0; i < tables.length; i++) {
            var rows = tables[i].querySelectorAll('tbody tr');
            for (var j = 0; j < rows.length; j++) {
                var cells = rows[j].querySelectorAll('td');
                for (var k = 0; k < cells.length; k++) {
                    if (cells[k].textContent.indexOf('Governance_Test_Search_3') > -1) {
                        // Found the row - get status column
                        var statusCell = null;
                        var allText = [];
                        for (var m = 0; m < cells.length; m++) {
                            allText.push(cells[m].textContent.trim());
                            if (cells[m].textContent.indexOf('Disabled') > -1 ||
                                cells[m].textContent.indexOf('Pending') > -1 ||
                                cells[m].textContent.indexOf('Flagged') > -1 ||
                                cells[m].textContent.indexOf('OK') > -1) {
                                statusCell = cells[m];
                            }
                        }
                        return {
                            found: true,
                            rowText: allText.join(' | '),
                            status: statusCell ? statusCell.textContent.trim() : 'Not found',
                            statusBgColor: statusCell ? window.getComputedStyle(statusCell).backgroundColor : 'N/A'
                        };
                    }
                }
            }
        }
        return { found: false };
    });

    if (tableInfo.found) {
        console.log("   Found in table!");
        console.log("   Status: " + tableInfo.status);
        console.log("   Background color: " + tableInfo.statusBgColor);
    } else {
        console.log("   NOT found in any table");
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/status-check.png', fullPage: true });
    console.log("\n3. Screenshot saved: /tmp/status-check.png");

    await browser.close();
})();
