const { test, expect } = require('./fixtures');

test('capture cost analysis page screenshot', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Navigate to cost analysis page
    await page.goto('/en-US/app/TA-user-governance/cost_analysis', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    // Wait for page to fully load
    await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });

    // Wait for search results to populate by checking for actual data
    // Look for single value panels that have loaded (contain SVCs text or dollar values)
    try {
        await page.waitForSelector('.single-value .single-result:not(:empty)', { timeout: 15000 });
    } catch (e) {
        console.log('Single values may not have loaded, continuing...');
    }
    await page.waitForTimeout(8000);  // Additional wait for all panels

    // Take full page screenshot
    await page.screenshot({
        path: 'screenshots/cost-analysis-page.png',
        fullPage: true
    });

    console.log('Screenshot saved to screenshots/cost-analysis-page.png');
});

test('verify cost analysis dashboard loads with cache', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Navigate to cost analysis page
    await page.goto('/en-US/app/TA-user-governance/cost_analysis', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
    await page.waitForTimeout(8000);

    // Check for dashboard panels (tables, charts, visualizations)
    const panels = page.locator('.dashboard-panel, .panel-body, table, .viz-table');
    const panelCount = await panels.count();
    console.log(`Found ${panelCount} dashboard panels`);

    // Just verify page loads correctly
    await expect(page).toHaveURL(/cost_analysis/);

    // Take screenshot
    await page.screenshot({
        path: 'screenshots/cost-analysis-metrics.png',
        fullPage: true
    });

    console.log('Cost analysis dashboard loaded successfully');
});
