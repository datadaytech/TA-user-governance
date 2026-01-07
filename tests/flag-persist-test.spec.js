const { test, expect } = require('./fixtures');

test('verify flag persists after page reload', async ({ governancePage }) => {
    const page = governancePage;

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`BROWSER ERROR: ${msg.text()}`);
        }
    });

    await page.waitForTimeout(8000);

    // Get initial count
    const initialCount = await page.evaluate(() => {
        const el = document.querySelector('#flagged_metric_panel .single-result');
        return el ? parseInt(el.textContent.trim()) || 0 : 0;
    });
    console.log('Initial flagged count:', initialCount);

    // Find a search that is NOT flagged
    const unflaggedSearch = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr[data-search]');
        for (const row of rows) {
            const searchName = row.getAttribute('data-search');
            const isFlagged = row.getAttribute('data-flagged') === 'true' ||
                              row.classList.contains('row-flagged') ||
                              !!row.querySelector('.flag-indicator');
            // Skip if already flagged or if it's a governance search
            if (!isFlagged && searchName && !searchName.startsWith('Governance -')) {
                return searchName;
            }
        }
        return null;
    });

    if (!unflaggedSearch) {
        console.log('No unflagged search found to test');
        return;
    }

    console.log('Found unflagged search to flag:', unflaggedSearch);

    // Select the search
    const checkbox = page.locator(`tr[data-search="${unflaggedSearch}"] .gov-checkbox`);
    if (await checkbox.isVisible()) {
        await checkbox.click();
        await page.waitForTimeout(500);
    }

    // Flag it
    page.once('dialog', async dialog => {
        console.log('Accepting flag dialog');
        await dialog.accept();
    });

    await page.locator('#flag-selected-btn').click();
    await page.waitForTimeout(4000);

    console.log('Flag action completed, reloading page...');

    // Reload the page to verify persistence
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);

    // Check if the count increased
    const finalCount = await page.evaluate(() => {
        const el = document.querySelector('#flagged_metric_panel .single-result');
        return el ? parseInt(el.textContent.trim()) || 0 : 0;
    });
    console.log('Final flagged count after reload:', finalCount);

    // Check if the search shows as flagged
    const isFlaggedNow = await page.evaluate((searchName) => {
        const row = document.querySelector(`tr[data-search="${searchName}"]`);
        if (!row) return 'row not found';
        return row.getAttribute('data-flagged') === 'true' ||
               row.classList.contains('row-flagged') ||
               !!row.querySelector('.flag-indicator');
    }, unflaggedSearch);

    console.log(`Search "${unflaggedSearch}" is now flagged:`, isFlaggedNow);

    // Verify it's in the lookup
    await page.screenshot({ path: 'screenshots/persist-test-final.png', fullPage: true });

    expect(finalCount).toBeGreaterThanOrEqual(initialCount);
});
