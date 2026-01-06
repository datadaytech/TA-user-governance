const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ bypassCSP: true });
    const page = await context.newPage();

    console.log("=== Testing Wider Modal ===\n");

    await page.goto('http://localhost:8000/en-US/account/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'changeme123');
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/app\//);

    await page.goto('http://localhost:8000/en-US/app/TA-user-governance/governance_dashboard?_t=' + Date.now(), {
        waitUntil: 'networkidle'
    });
    await page.waitForTimeout(12000);
    console.log("1. Dashboard loaded\n");

    // Click on "Currently Flagged" panel
    console.log("2. Opening Currently Flagged modal...");
    await page.evaluate(function() {
        var h3s = document.querySelectorAll('.panel-head h3');
        for (var i = 0; i < h3s.length; i++) {
            if (h3s[i].textContent.indexOf('Flagged') > -1) {
                var parent = h3s[i].closest('.dashboard-element');
                if (parent) {
                    var sv = parent.querySelector('.single-value');
                    if (sv) sv.click();
                    break;
                }
            }
        }
    });

    await page.waitForTimeout(3000);

    var modalVisible = await page.locator('#metricPopupOverlay').isVisible().catch(function() { return false; });
    if (!modalVisible) {
        console.log("   ERROR: Modal did not open");
        await browser.close();
        return;
    }

    // Get header info
    var headerInfo = await page.evaluate(function() {
        var valueEl = document.getElementById('metricPopupValue');
        var titleEl = document.getElementById('metricPopupTitle');
        var modalEl = document.querySelector('.metric-popup');

        return {
            value: valueEl ? valueEl.textContent : 'N/A',
            title: titleEl ? titleEl.textContent : 'N/A',
            modalWidth: modalEl ? modalEl.offsetWidth : 0,
            titleTruncated: titleEl ? (titleEl.scrollWidth > titleEl.clientWidth) : false
        };
    });

    console.log("   Modal opened");
    console.log("   Value: " + headerInfo.value);
    console.log("   Title: " + headerInfo.title);
    console.log("   Modal width: " + headerInfo.modalWidth + "px");
    console.log("   Title truncated: " + headerInfo.titleTruncated);

    await page.screenshot({ path: '/tmp/wider-modal.png' });
    console.log("\n3. Screenshot saved: /tmp/wider-modal.png");

    console.log("\n=== RESULT ===");
    console.log("Title fully visible: " + (!headerInfo.titleTruncated ? "PASS" : "FAIL"));

    await browser.close();
})();
