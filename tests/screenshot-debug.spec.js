const { test } = require('./fixtures');

test('capture detailed dashboard screenshots', async ({ governancePage }) => {
    const page = governancePage;

    // Wait for page to fully load
    await page.waitForTimeout(5000);

    // Screenshot 1: Full page
    await page.screenshot({
        path: 'screenshots/01-full-dashboard.png',
        fullPage: true
    });
    console.log('Screenshot 1: Full dashboard saved');

    // Screenshot 2: Top metrics section
    const metricsRow = page.locator('.dashboard-row').first();
    await metricsRow.screenshot({
        path: 'screenshots/02-metrics-row.png'
    });
    console.log('Screenshot 2: Metrics row saved');

    // Screenshot 3: Suspicious searches table
    const suspiciousPanel = page.locator('#suspicious_searches_table').first();
    if (await suspiciousPanel.isVisible()) {
        await suspiciousPanel.screenshot({
            path: 'screenshots/03-suspicious-table.png'
        });
        console.log('Screenshot 3: Suspicious table saved');
    }

    // Screenshot 4: All searches table
    const allSearchesTable = page.locator('#all_searches_table').first();
    if (await allSearchesTable.isVisible()) {
        await allSearchesTable.screenshot({
            path: 'screenshots/04-all-searches-table.png'
        });
        console.log('Screenshot 4: All searches table saved');
    }

    // Screenshot 5: Click on Currently Flagged metric and capture modal
    const flaggedPanel = page.locator('#flagged_metric_panel .single-value, [id*="flagged"] .viz-single-value');
    if (await flaggedPanel.isVisible()) {
        await flaggedPanel.click();
        await page.waitForTimeout(2000);

        await page.screenshot({
            path: 'screenshots/05-flagged-modal-open.png',
            fullPage: true
        });
        console.log('Screenshot 5: Flagged modal open saved');

        // Try to close the modal
        const closeBtn = page.locator('.metric-popup-close, #metricPopupClose, button:has-text("Close")').first();
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(1000);

            await page.screenshot({
                path: 'screenshots/06-after-modal-close.png',
                fullPage: true
            });
            console.log('Screenshot 6: After modal close saved');
        }
    }

    console.log('All screenshots saved to screenshots/ directory');
});
