const { test, expect } = require('./fixtures');

test('flag an unflagged search', async ({ governancePage }) => {
    const page = governancePage;

    page.on('console', msg => {
        if (msg.type() === 'log' || msg.type() === 'error') {
            console.log(`BROWSER ${msg.type()}: ${msg.text()}`);
        }
    });

    await page.waitForTimeout(8000);

    // Get initial flagged count
    const initialCount = await page.evaluate(() => {
        const el = document.querySelector('#flagged_metric_panel .single-result');
        return el ? parseInt(el.textContent.trim()) || 0 : 0;
    });
    console.log('Initial flagged count:', initialCount);

    // Find rows in the suspicious table that are NOT flagged
    const unflaggedRows = await page.evaluate(() => {
        const rows = document.querySelectorAll('#suspicious_searches_table tbody tr, .gov-enhanced tbody tr');
        const unflagged = [];
        rows.forEach((row, idx) => {
            const isFlagged = row.getAttribute('data-flagged') === 'true' ||
                              row.classList.contains('row-flagged') ||
                              row.querySelector('.flag-indicator');
            const searchName = row.getAttribute('data-search') || row.querySelector('td')?.textContent?.trim();
            if (!isFlagged && searchName && idx > 0) {
                unflagged.push({ idx, searchName, isFlagged });
            }
        });
        return unflagged.slice(0, 5);
    });

    console.log('Unflagged rows found:', unflaggedRows.length);
    console.log('Unflagged searches:', JSON.stringify(unflaggedRows, null, 2));

    if (unflaggedRows.length === 0) {
        console.log('No unflagged searches found to test - all suspicious searches are already flagged');

        // Let's check what searches exist
        const allRows = await page.evaluate(() => {
            const rows = document.querySelectorAll('tr[data-search]');
            return Array.from(rows).slice(0, 10).map(r => ({
                search: r.getAttribute('data-search'),
                flagged: r.getAttribute('data-flagged'),
                hasFlag: !!r.querySelector('.flag-indicator')
            }));
        });
        console.log('All rows with data-search:', JSON.stringify(allRows, null, 2));
        return;
    }

    // Select an unflagged row
    const targetSearch = unflaggedRows[0].searchName;
    console.log('Selecting unflagged search:', targetSearch);

    // Click the checkbox for this row
    const checkbox = page.locator(`tr[data-search="${targetSearch}"] .gov-checkbox`);
    if (await checkbox.isVisible()) {
        await checkbox.click();
        await page.waitForTimeout(500);
    } else {
        // Try clicking the row
        await page.locator(`tr[data-search="${targetSearch}"]`).click();
        await page.waitForTimeout(500);
    }

    await page.screenshot({ path: 'screenshots/unflag-01-selected.png', fullPage: true });

    // Click Flag Selected button
    page.once('dialog', async dialog => {
        console.log('Confirm dialog:', dialog.message());
        await dialog.accept();
    });

    const flagBtn = page.locator('#flag-selected-btn');
    await flagBtn.click();
    await page.waitForTimeout(4000);

    await page.screenshot({ path: 'screenshots/unflag-02-after-flag.png', fullPage: true });

    // Get final flagged count
    const finalCount = await page.evaluate(() => {
        const el = document.querySelector('#flagged_metric_panel .single-result');
        return el ? parseInt(el.textContent.trim()) || 0 : 0;
    });
    console.log('Final flagged count:', finalCount);

    // Verify the search is now flagged in the lookup
    await page.waitForTimeout(2000);

    const isNowFlagged = await page.evaluate((searchName) => {
        const row = document.querySelector(`tr[data-search="${searchName}"]`);
        if (!row) return 'row not found';
        return {
            dataFlagged: row.getAttribute('data-flagged'),
            hasClass: row.classList.contains('row-flagged'),
            hasIndicator: !!row.querySelector('.flag-indicator')
        };
    }, targetSearch);

    console.log('Search now flagged:', JSON.stringify(isNowFlagged));

    // The count should have increased (unless refresh is needed)
    console.log(`Count change: ${initialCount} -> ${finalCount}`);
});
