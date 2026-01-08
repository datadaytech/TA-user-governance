/**
 * Trace test for extend deadline
 */
const { test, expect } = require('./fixtures');

test('trace extend deadline flow', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const consoleLogs = [];

    page.on('console', msg => {
        const text = msg.text();
        consoleLogs.push({ type: msg.type(), text });
        if (text.includes('Extend') || text.includes('extend') || text.includes('perform')) {
            console.log(`[${msg.type()}] ${text}`);
        }
    });

    page.on('dialog', async dialog => {
        console.log(`Dialog: ${dialog.type()} - ${dialog.message()}`);
        await dialog.accept();
    });

    await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });
    await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
    await page.waitForTimeout(5000);

    // Click on "Currently Flagged" metric to open modal
    console.log('Looking for flagged metric panel...');
    const flaggedPanel = page.locator('#flagged_metric_panel, .single-value').filter({ hasText: /flagged/i }).first();

    if (await flaggedPanel.count() > 0) {
        console.log('Clicking flagged panel...');
        await flaggedPanel.click();
        await page.waitForTimeout(3000);

        // Check if popup opened
        const popup = page.locator('#metricPopupOverlay.active');
        if (await popup.count() > 0) {
            console.log('Popup opened');

            // Select a checkbox
            const checkbox = page.locator('.metric-row-checkbox').first();
            if (await checkbox.count() > 0) {
                await checkbox.check({ force: true });
                console.log('Checkbox checked');
            }

            await page.waitForTimeout(1000);

            // Click Extend Deadline button
            const extendBtn = page.locator('#metricPopupExtend');
            if (await extendBtn.isVisible()) {
                console.log('Clicking Extend Deadline button...');
                await extendBtn.click();
                await page.waitForTimeout(2000);

                // Check if extend modal opened
                const extendModal = page.locator('#extendModalOverlay.active');
                if (await extendModal.count() > 0) {
                    console.log('Extend modal opened');

                    // Check the search list
                    const searchList = await page.locator('#extendSearchList').innerHTML();
                    console.log('Search list:', searchList);

                    // Check custom days value
                    const customDays = await page.locator('#extendCustomDays').inputValue();
                    console.log('Custom days:', customDays);

                    // Click Save button
                    console.log('Clicking Save button...');
                    await page.locator('#extendModalSave').click();
                    await page.waitForTimeout(5000);

                    console.log('After save click');
                } else {
                    console.log('Extend modal did not open');
                }
            } else {
                console.log('Extend button not visible');
            }
        } else {
            console.log('Popup did not open');
        }
    } else {
        console.log('Flagged panel not found');
    }

    // Print relevant logs
    console.log('\n=== EXTEND RELATED LOGS ===');
    consoleLogs.filter(log =>
        log.text.includes('Extend') ||
        log.text.includes('extend') ||
        log.text.includes('perform') ||
        log.text.includes('deadline') ||
        log.text.includes('search')
    ).forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
    });

    await page.screenshot({ path: 'screenshots/extend-trace.png', fullPage: true });
});
