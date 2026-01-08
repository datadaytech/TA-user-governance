const { test, expect } = require('./fixtures');

test('comprehensive UI and modal test', async ({ governancePage }) => {
    const page = governancePage;

    // Wait for page to fully load
    await page.waitForTimeout(6000);

    // Screenshot 1: Full dashboard after full load
    await page.screenshot({
        path: 'screenshots/01-dashboard-full.png',
        fullPage: true
    });
    console.log('Screenshot 1: Full dashboard');

    // Screenshot 2: Zoom on metric panels
    const metricsArea = page.locator('.dashboard-row').first();
    if (await metricsArea.isVisible()) {
        await metricsArea.screenshot({
            path: 'screenshots/02-metrics-panels.png'
        });
        console.log('Screenshot 2: Metrics panels');
    }

    // Screenshot 3: Click on "Currently Flagged" metric
    const flaggedMetric = page.locator('#flagged_metric_panel .single-value, #flagged_metric_panel .single-result').first();
    if (await flaggedMetric.isVisible()) {
        await flaggedMetric.click();
        await page.waitForTimeout(2000);

        await page.screenshot({
            path: 'screenshots/03-flagged-modal.png',
            fullPage: true
        });
        console.log('Screenshot 3: Flagged modal opened');

        // Click close button
        const closeBtn = page.locator('#metricPopupClose');
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(1000);

            // Check if another modal appeared (the bug)
            const isModalStillOpen = await page.locator('#metricPopupOverlay.active').isVisible();
            console.log('Modal still open after close?', isModalStillOpen);

            await page.screenshot({
                path: 'screenshots/04-after-close.png',
                fullPage: true
            });
            console.log('Screenshot 4: After modal close');

            // Verify no modal is open
            expect(isModalStillOpen).toBe(false);
        }
    }

    // Screenshot 5: Click on "Suspicious" metric
    await page.waitForTimeout(500);
    const suspiciousMetric = page.locator('#suspicious_metric_panel .single-value, #suspicious_metric_panel .single-result').first();
    if (await suspiciousMetric.isVisible()) {
        await suspiciousMetric.click();
        await page.waitForTimeout(2000);

        await page.screenshot({
            path: 'screenshots/05-suspicious-modal.png',
            fullPage: true
        });
        console.log('Screenshot 5: Suspicious modal opened');

        // Close it
        const closeBtn = page.locator('#metricPopupClose');
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(1000);
        }
    }

    // Screenshot 6: Suspicious table panel
    const suspiciousTable = page.locator('#suspicious_searches_table, .dashboard-panel').nth(5);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(500);
    await page.screenshot({
        path: 'screenshots/06-suspicious-table.png',
        fullPage: false
    });
    console.log('Screenshot 6: Suspicious table area');

    // Screenshot 7: All searches table
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({
        path: 'screenshots/07-all-searches-table.png',
        fullPage: false
    });
    console.log('Screenshot 7: All searches table');

    console.log('All UI tests complete');
});
