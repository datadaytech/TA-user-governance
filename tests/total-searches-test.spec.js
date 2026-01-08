const { test, expect } = require('./fixtures');

test('debug total scheduled searches', async ({ governancePage }) => {
    const page = governancePage;

    page.on('console', msg => {
        console.log(`BROWSER ${msg.type()}: ${msg.text()}`);
    });

    await page.waitForTimeout(8000);

    // Screenshot the dashboard
    await page.screenshot({ path: 'screenshots/total-01-dashboard.png', fullPage: true });

    // Get the total metric value and styling
    const totalMetric = await page.evaluate(() => {
        const panel = document.querySelector('#total_metric_panel');
        const result = panel?.querySelector('.single-result');
        const styles = result ? window.getComputedStyle(result) : null;
        return {
            text: result?.textContent?.trim() || 'N/A',
            color: styles?.color || 'N/A',
            opacity: styles?.opacity || 'N/A',
            background: styles?.background || 'N/A',
            webkitTextFillColor: styles?.webkitTextFillColor || 'N/A'
        };
    });
    console.log('Total metric display:', JSON.stringify(totalMetric, null, 2));

    // Click on Total Scheduled Searches
    const totalPanel = page.locator('#total_metric_panel .single-value, #total_metric_panel .single-result').first();
    await totalPanel.click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'screenshots/total-02-modal.png', fullPage: true });

    // Get the modal value
    const modalValue = await page.evaluate(() => {
        const valueEl = document.querySelector('#metricPopupValue');
        const titleEl = document.querySelector('#metricPopupTitle');
        const tableRows = document.querySelectorAll('#metricPopupTableBody tr');
        return {
            value: valueEl?.textContent?.trim() || 'N/A',
            title: titleEl?.textContent?.trim() || 'N/A',
            rowCount: tableRows.length
        };
    });
    console.log('Modal displays:', JSON.stringify(modalValue, null, 2));

    // Check browser console for errors
    const logs = await page.evaluate(() => {
        return window._consoleErrors || [];
    });
    console.log('Console errors:', logs);
});
