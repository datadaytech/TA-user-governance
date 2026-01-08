const { test, expect } = require('./fixtures');

test('quick capture of cost analysis', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Navigate directly
    await page.goto('/en-US/app/TA-user-governance/cost_analysis');

    // Wait 30 seconds for everything to load
    await page.waitForTimeout(30000);

    // Take screenshot
    await page.screenshot({
        path: 'screenshots/cost-analysis-30sec.png',
        fullPage: true
    });

    console.log('Screenshot saved');
});
