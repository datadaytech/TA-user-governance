const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        bypassCSP: true
    });
    const page = await context.newPage();

    // Track dialog counts
    var dialogCount = 0;
    var dialogs = [];

    // Listen for dialogs
    page.on('dialog', async dialog => {
        dialogCount++;
        dialogs.push({
            num: dialogCount,
            type: dialog.type(),
            message: dialog.message().substring(0, 50)
        });
        console.log("Dialog #" + dialogCount + " appeared: " + dialog.message().substring(0, 40));
        await dialog.accept();
    });

    // Listen for console
    page.on('console', msg => {
        var text = msg.text();
        if (text.indexOf('unflagSearch') > -1 || text.indexOf('Button clicked') > -1 || text.indexOf('inProgress') > -1 || text.indexOf('flagSelectedSearch') > -1) {
            console.log("[JS] " + text);
        }
    });

    console.log("=== Testing Single-Click Fix ===\n");

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
    await page.waitForTimeout(20000);

    // Check JS version
    var jsVersion = await page.evaluate(function() {
        if (typeof window.unflagSearch === 'function') {
            return window.unflagSearch.toString().indexOf('inProgress:') > -1 ? 'NEW' : 'OLD';
        }
        return 'NOT LOADED';
    });
    console.log("   JS version: " + jsVersion + "\n");

    // TEST 1: Click unflag button
    console.log("2. TEST 1: Click 'Unflag Selected' button");
    dialogCount = 0;
    dialogs = [];

    await page.click('#unflag-selected-btn');
    await page.waitForTimeout(2000);

    console.log("   Total dialogs: " + dialogCount);
    console.log("   Result: " + (dialogCount === 1 ? "✓ PASS" : "✗ FAIL - expected 1, got " + dialogCount));

    // Wait for debounce to clear
    console.log("\n   (Waiting 4s for debounce to clear...)\n");
    await page.waitForTimeout(4000);

    // TEST 2: Click flag button
    console.log("3. TEST 2: Click 'Flag Selected' button");
    dialogCount = 0;
    dialogs = [];

    await page.click('#flag-selected-btn');
    await page.waitForTimeout(2000);

    console.log("   Total dialogs: " + dialogCount);
    console.log("   Result: " + (dialogCount === 1 ? "✓ PASS" : "✗ FAIL - expected 1, got " + dialogCount));

    // Wait for debounce
    console.log("\n   (Waiting 4s for debounce to clear...)\n");
    await page.waitForTimeout(4000);

    // TEST 3: Click disable button
    console.log("4. TEST 3: Click 'Disable Expiring Soon' button");
    dialogCount = 0;
    dialogs = [];

    var disableBtn = await page.$('#disable-expiring-btn');
    if (disableBtn) {
        await disableBtn.click();
        await page.waitForTimeout(2000);
        console.log("   Total dialogs: " + dialogCount);
        console.log("   Result: " + (dialogCount === 1 ? "✓ PASS" : "✗ FAIL - expected 1, got " + dialogCount));
    } else {
        console.log("   Button not found, skipping");
    }

    console.log("\n=== Summary ===");
    console.log("All tests should show exactly 1 dialog per button click.");

    await browser.close();
})();
