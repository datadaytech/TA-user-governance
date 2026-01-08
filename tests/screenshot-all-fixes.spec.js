const { test, expect } = require('./fixtures');

test('screenshot all fixes', async ({ governancePage }) => {
    const page = governancePage;

    // Enable console logging
    page.on('console', msg => {
        if (msg.type() === 'log' || msg.type() === 'error') {
            console.log(`BROWSER ${msg.type()}: ${msg.text()}`);
        }
    });

    // Wait for dashboard to load fully
    await page.waitForTimeout(15000);

    // Screenshot 1: Main dashboard with metrics
    await page.screenshot({ path: 'screenshots/all-fixes-01-dashboard.png', fullPage: true });
    console.log('Screenshot 1: Dashboard');

    // Get total metric value
    const totalValue = await page.evaluate(() => {
        const el = document.querySelector('#total_metric_panel .single-result');
        return el?.textContent?.trim() || 'not found';
    });
    console.log('Total Scheduled Searches value:', totalValue);

    // Click on Total Scheduled Searches
    await page.click('#total_metric_panel');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/all-fixes-02-total-modal.png', fullPage: true });
    console.log('Screenshot 2: Total modal');

    // Get modal value
    const modalValue = await page.evaluate(() => {
        return document.querySelector('#metricPopupValue')?.textContent?.trim() || 'not found';
    });
    console.log('Modal value:', modalValue);

    // Close modal
    await page.click('#metricPopupClose');
    await page.waitForTimeout(500);

    // Click on Currently Flagged
    await page.click('#flagged_metric_panel');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/all-fixes-03-flagged-modal.png', fullPage: true });
    console.log('Screenshot 3: Flagged modal with status badges');

    // Close modal
    await page.click('#metricPopupClose');
    await page.waitForTimeout(500);

    // Scroll to All Scheduled Searches table to see icon description column
    await page.evaluate(() => {
        const table = document.querySelector('#all_searches_table');
        if (table) table.scrollIntoView();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/all-fixes-04-all-searches-table.png', fullPage: true });
    console.log('Screenshot 4: All Scheduled Searches with icon description column');

    console.log('All screenshots captured!');
});
