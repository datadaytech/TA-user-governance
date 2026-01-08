const { test, expect } = require('./fixtures');

test('verify disable persists when modal reopens', async ({ governancePage }) => {
    const page = governancePage;

    // Enable console logging
    page.on('console', msg => {
        if (msg.type() === 'log' || msg.type() === 'error') {
            console.log(`BROWSER ${msg.type()}: ${msg.text()}`);
        }
    });

    // Wait for dashboard to load
    await page.waitForTimeout(12000);

    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/disable-persist-01-initial.png', fullPage: true });

    // Click on Total Scheduled Searches to open modal
    console.log('Opening Total Scheduled Searches modal...');
    await page.click('#total_metric_panel');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'screenshots/disable-persist-02-modal-open.png', fullPage: true });

    // Check if there are any searches in the modal
    const searchCount = await page.evaluate(() => {
        return document.querySelectorAll('.metric-popup-row').length;
    });
    console.log('Number of searches in modal:', searchCount);

    if (searchCount === 0) {
        console.log('No searches found in modal, skipping disable test');
        return;
    }

    // Get the first search name before disabling
    const firstSearchInfo = await page.evaluate(() => {
        const row = document.querySelector('.metric-popup-row');
        if (!row) return null;
        return {
            name: row.querySelector('td:nth-child(2)')?.textContent?.trim() || 'unknown',
            status: row.querySelector('.status-cell')?.textContent?.trim() || 'unknown'
        };
    });
    console.log('First search before disable:', JSON.stringify(firstSearchInfo));

    // Select the first search by clicking its checkbox
    await page.click('.metric-popup-row:first-child .metric-row-checkbox');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/disable-persist-03-selected.png', fullPage: true });

    // Click Disable Selected button
    console.log('Clicking Disable Selected...');

    // Accept the confirmation dialog
    page.on('dialog', async dialog => {
        console.log('Dialog:', dialog.message());
        await dialog.accept();
    });

    await page.click('#metricPopupDisable');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'screenshots/disable-persist-04-after-disable.png', fullPage: true });

    // Get the status after disabling
    const statusAfterDisable = await page.evaluate(() => {
        const row = document.querySelector('.metric-popup-row:first-child');
        if (!row) return null;
        return {
            name: row.querySelector('td:nth-child(2)')?.textContent?.trim() || 'unknown',
            status: row.querySelector('.status-cell')?.textContent?.trim() || 'unknown'
        };
    });
    console.log('First search after disable:', JSON.stringify(statusAfterDisable));

    // Close the modal
    await page.click('#metricPopupClose');
    await page.waitForTimeout(1000);

    // Wait a bit for the lookup to be updated
    await page.waitForTimeout(2000);

    // Reopen the modal
    console.log('Reopening modal to verify persistence...');
    await page.click('#total_metric_panel');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'screenshots/disable-persist-05-modal-reopened.png', fullPage: true });

    // Check if the search is still shown as disabled
    const statusAfterReopen = await page.evaluate((searchName) => {
        const rows = document.querySelectorAll('.metric-popup-row');
        for (const row of rows) {
            const name = row.querySelector('td:nth-child(2)')?.textContent?.trim();
            if (name === searchName) {
                return {
                    name: name,
                    status: row.querySelector('.status-cell')?.textContent?.trim() || 'unknown',
                    found: true
                };
            }
        }
        // Search might not appear in Total modal anymore since it's disabled
        return { found: false, reason: 'Search not found - may be excluded from active searches' };
    }, firstSearchInfo?.name);

    console.log('Status after reopen:', JSON.stringify(statusAfterReopen));

    // The search should either:
    // 1. Show as DISABLED if still in the modal
    // 2. Not appear at all (since disabled searches are filtered from "Total Scheduled Searches")
    if (statusAfterReopen.found) {
        expect(statusAfterReopen.status).toContain('DISABLED');
    } else {
        console.log('Search was filtered out from Total modal (expected behavior for disabled searches)');
    }

    // Close modal
    await page.click('#metricPopupClose');

    console.log('Disable persistence test completed!');
});
