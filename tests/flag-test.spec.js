const { test, expect } = require('./fixtures');

test('test flagging a search', async ({ governancePage }) => {
    const page = governancePage;

    // Enable console logging
    page.on('console', msg => {
        if (msg.type() === 'log' || msg.type() === 'error') {
            console.log(`BROWSER ${msg.type()}: ${msg.text()}`);
        }
    });

    await page.waitForTimeout(8000);

    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/flag-01-initial.png', fullPage: true });

    // Count initial flagged searches
    const initialCount = await page.evaluate(() => {
        const flaggedMetric = document.querySelector('#flagged_metric_panel .single-result');
        return flaggedMetric ? flaggedMetric.textContent.trim() : 'N/A';
    });
    console.log('Initial flagged count:', initialCount);

    // Find an unflagged row in the suspicious table and select it
    const checkbox = page.locator('.gov-checkbox').first();
    const isVisible = await checkbox.isVisible().catch(() => false);

    if (!isVisible) {
        console.log('No checkboxes found - looking for alternative selectors');

        // Try clicking on a row in the suspicious table
        const tableRow = page.locator('#suspicious_searches_table tr').nth(1);
        if (await tableRow.isVisible()) {
            await tableRow.click();
            await page.waitForTimeout(1000);
        }
    } else {
        await checkbox.click();
        await page.waitForTimeout(500);
    }

    await page.screenshot({ path: 'screenshots/flag-02-selected.png', fullPage: true });

    // Click the Flag Selected button
    const flagBtn = page.locator('#flag-selected-btn, button:has-text("Flag Selected")').first();
    const flagBtnVisible = await flagBtn.isVisible().catch(() => false);

    console.log('Flag button visible:', flagBtnVisible);

    if (flagBtnVisible) {
        // Set up dialog handler for the confirm dialog
        page.once('dialog', async dialog => {
            console.log('Dialog appeared:', dialog.message());
            await dialog.accept();
        });

        await flagBtn.click();
        await page.waitForTimeout(3000);

        await page.screenshot({ path: 'screenshots/flag-03-after-flag.png', fullPage: true });

        // Check for toast notification
        const toastText = await page.evaluate(() => {
            const toast = document.querySelector('.toast-message, .msg-text, [class*="toast"]');
            return toast ? toast.textContent : 'No toast found';
        });
        console.log('Toast message:', toastText);

        // Wait for page to update
        await page.waitForTimeout(2000);

        // Get final flagged count
        const finalCount = await page.evaluate(() => {
            const flaggedMetric = document.querySelector('#flagged_metric_panel .single-result');
            return flaggedMetric ? flaggedMetric.textContent.trim() : 'N/A';
        });
        console.log('Final flagged count:', finalCount);

        await page.screenshot({ path: 'screenshots/flag-04-final.png', fullPage: true });
    } else {
        console.log('Flag button not found - checking page structure');

        // Debug: List all buttons
        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button')).map(b => ({
                id: b.id,
                text: b.textContent.trim().substring(0, 30),
                visible: b.offsetParent !== null
            }));
        });
        console.log('Available buttons:', JSON.stringify(buttons.slice(0, 10), null, 2));
    }
});
