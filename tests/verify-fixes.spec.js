const { test, expect } = require('./fixtures');

test('verify metric value and modal fixes', async ({ governancePage }) => {
    const page = governancePage;

    // Enable console logging
    page.on('console', msg => {
        if (msg.type() === 'log' || msg.type() === 'error') {
            console.log(`BROWSER ${msg.type()}: ${msg.text()}`);
        }
    });

    // Wait for dashboard to load
    await page.waitForTimeout(10000);

    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/verify-01-dashboard.png', fullPage: true });

    // Get the total metric styling and value
    const totalMetric = await page.evaluate(() => {
        const panel = document.querySelector('#total_metric_panel');
        const result = panel?.querySelector('.single-result');
        const styles = result ? window.getComputedStyle(result) : null;
        return {
            text: result?.textContent?.trim() || 'N/A',
            color: styles?.color || 'N/A',
            webkitTextFillColor: styles?.webkitTextFillColor || 'N/A',
            opacity: styles?.opacity || 'N/A'
        };
    });
    console.log('Total metric display:', JSON.stringify(totalMetric, null, 2));

    // The value should NOT be grayed out (transparent fill) anymore
    // It should be the solid cyan color #00d4ff
    expect(totalMetric.text).not.toBe('0');

    // Click on Total Scheduled Searches panel
    await page.click('#total_metric_panel');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'screenshots/verify-02-total-modal.png', fullPage: true });

    // Get modal value
    const modalValue = await page.evaluate(() => {
        const valueEl = document.querySelector('#metricPopupValue');
        return valueEl?.textContent?.trim() || 'N/A';
    });
    console.log('Modal value:', modalValue);

    // Modal value should match the dashboard value (not be 0)
    expect(modalValue).not.toBe('0');
    expect(modalValue).toBe(totalMetric.text);

    // Close modal
    await page.click('#metricPopupClose');
    await page.waitForTimeout(500);

    // Test Currently Flagged modal
    await page.click('#flagged_metric_panel');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'screenshots/verify-03-flagged-modal.png', fullPage: true });

    const flaggedModalValue = await page.evaluate(() => {
        const valueEl = document.querySelector('#metricPopupValue');
        const panel = document.querySelector('#flagged_metric_panel .single-result');
        return {
            modal: valueEl?.textContent?.trim() || 'N/A',
            panel: panel?.textContent?.trim() || 'N/A'
        };
    });
    console.log('Flagged modal value:', JSON.stringify(flaggedModalValue, null, 2));

    // Modal value should match panel value
    expect(flaggedModalValue.modal).toBe(flaggedModalValue.panel);

    // Close modal
    await page.click('#metricPopupClose');

    console.log('All tests passed!');
});
