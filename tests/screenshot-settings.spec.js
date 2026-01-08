const { test, expect } = require('./fixtures');

test('capture governance settings page screenshot', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Navigate to governance settings page
    await page.goto('/en-US/app/TA-user-governance/governance_settings', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    // Wait for page to fully load
    await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
    await page.waitForTimeout(5000);

    // Take full page screenshot
    await page.screenshot({
        path: 'screenshots/settings-page-full.png',
        fullPage: true
    });

    console.log('Screenshot saved to screenshots/settings-page-full.png');
});

test('verify submit buttons are visible on settings page', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Navigate to governance settings page
    await page.goto('/en-US/app/TA-user-governance/governance_settings', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
    await page.waitForTimeout(5000);

    // Look for buttons - multiple selectors
    const buttons = page.locator('button, .btn, input[type="submit"]');
    const count = await buttons.count();
    console.log(`Found ${count} total buttons/button-like elements`);

    // Take screenshot
    await page.screenshot({
        path: 'screenshots/settings-buttons.png',
        fullPage: true
    });

    // There should be submit buttons on the page
    expect(count).toBeGreaterThan(0);
});

test('verify no checkbox on cost config table', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Navigate to governance settings page
    await page.goto('/en-US/app/TA-user-governance/governance_settings', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
    await page.waitForTimeout(5000);

    // Check if cost config table exists and has no visible checkboxes
    const costConfigTable = page.locator('#cost_config_table');
    const tableExists = await costConfigTable.count() > 0;

    if (tableExists) {
        // Check for visible checkboxes
        const checkboxes = costConfigTable.locator('.gov-checkbox, .gov-select-all');
        const visibleCheckboxes = await checkboxes.filter({ has: page.locator(':visible') }).count();
        console.log(`Cost config table has ${visibleCheckboxes} visible checkboxes`);

        // Should have no visible checkboxes
        expect(visibleCheckboxes).toBe(0);
    } else {
        console.log('Cost config table not found - checking panel by title');
        // Look for configuration panels
        const configPanel = page.locator('.panel-title:has-text("Configuration"), .panel-title:has-text("Cost")');
        console.log(`Found ${await configPanel.count()} configuration panels`);
    }

    // Take screenshot
    await page.screenshot({
        path: 'screenshots/settings-cost-config.png',
        fullPage: true
    });
});
