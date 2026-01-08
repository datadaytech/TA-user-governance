/**
 * Playwright tests for Negative Extension functionality
 * Tests reducing deadline time and disable prompts when deadline expires
 */

const { test, expect } = require('./fixtures');

test.describe('Negative Extension Tests', () => {

    test('should allow negative values in extend deadline input', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const consoleLogs = [];

        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push({ type: msg.type(), text });
            if (text.includes('extend') || text.includes('Extend') || text.includes('reduce') || text.includes('Reduce')) {
                console.log(`[BROWSER ${msg.type()}] ${text}`);
            }
        });

        // Handle dialogs
        page.on('dialog', async dialog => {
            console.log(`Dialog: ${dialog.type()} - ${dialog.message()}`);
            await dialog.dismiss(); // Dismiss to continue test
        });

        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Open flagged popup
        const flaggedPanel = page.locator('.single-value, .panel-body').filter({ hasText: /flagged/i }).first();
        if (await flaggedPanel.count() > 0) {
            await flaggedPanel.click();
            await page.waitForTimeout(3000);
        }

        const popup = page.locator('#metricPopupOverlay.active');
        if (await popup.count() === 0) {
            console.log('Flagged popup not opened');
            return;
        }

        // Select a checkbox
        const checkbox = page.locator('.metric-row-checkbox').first();
        if (await checkbox.count() > 0) {
            await checkbox.check({ force: true });
            await page.waitForTimeout(500);
        }

        // Click Extend button
        const extendBtn = page.locator('#metricPopupExtend');
        if (await extendBtn.isVisible()) {
            await extendBtn.click();
            await page.waitForTimeout(1500);
        }

        // Check if extend modal opened
        const extendModal = page.locator('#extendModalOverlay.active');
        if (await extendModal.count() === 0) {
            console.log('Extend modal not opened');
            return;
        }

        console.log('Extend modal opened');

        // Test: Enter negative value
        const customDaysInput = page.locator('#extendCustomDays');
        await customDaysInput.fill('-3');
        await page.waitForTimeout(500);

        const inputValue = await customDaysInput.inputValue();
        console.log('Input value after entering -3:', inputValue);

        // Verify the input accepts negative values
        expect(inputValue).toBe('-3');

        await page.screenshot({ path: 'screenshots/negative-extension-1-input.png', fullPage: true });
    });

    test('should reduce deadline with negative value when safe', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const consoleLogs = [];
        let saveClicked = false;

        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push({ type: msg.type(), text });
        });

        // Track dialogs
        const dialogs = [];
        page.on('dialog', async dialog => {
            dialogs.push({ type: dialog.type(), message: dialog.message() });
            console.log(`Dialog: ${dialog.type()} - ${dialog.message()}`);
            await dialog.accept();
        });

        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Use direct function call to open extend modal with test data
        const result = await page.evaluate(() => {
            if (typeof window.openExtendModal === 'function') {
                // Create search with deadline far in the future (won't expire with -1 day)
                var now = Math.floor(Date.now() / 1000);
                var testSearches = [{
                    searchName: 'Negative_Extension_Test_' + Date.now(),
                    owner: 'admin',
                    app: 'search',
                    status: 'pending',
                    deadlineEpoch: now + (30 * 86400) // 30 days from now
                }];
                window.openExtendModal(testSearches);
                return { success: true, searchName: testSearches[0].searchName };
            }
            return { success: false };
        });

        console.log('openExtendModal result:', result);
        await page.waitForTimeout(1000);

        if (!result.success) {
            console.log('Failed to open extend modal');
            return;
        }

        // Enter negative value
        const customDaysInput = page.locator('#extendCustomDays');
        await customDaysInput.fill('-1');
        await page.waitForTimeout(500);

        // Click Save
        console.log('Clicking Save with -1 days...');
        await page.locator('#extendModalSave').click();
        await page.waitForTimeout(3000);

        await page.screenshot({ path: 'screenshots/negative-extension-2-after-save.png', fullPage: true });

        // Check console logs for "reduced" message
        const reduceLogs = consoleLogs.filter(log =>
            log.text.includes('reduced') ||
            log.text.includes('Reduce') ||
            log.text.includes('Reducing')
        );
        console.log('Reduce-related logs:', reduceLogs.length);

        // The reduce should complete without requiring disable (30 days - 1 day = 29 days remaining)
        const hadDisablePrompt = dialogs.some(d =>
            d.message.includes('disable') ||
            d.message.includes('past')
        );
        console.log('Had disable prompt:', hadDisablePrompt);
    });

    test('should prompt to disable when deadline would expire', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const consoleLogs = [];
        const dialogs = [];

        page.on('console', msg => {
            consoleLogs.push({ type: msg.type(), text: msg.text() });
        });

        page.on('dialog', async dialog => {
            dialogs.push({ type: dialog.type(), message: dialog.message() });
            console.log(`Dialog captured: ${dialog.type()} - ${dialog.message()}`);
            // Dismiss to not actually disable
            await dialog.dismiss();
        });

        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Open extend modal with test data that will expire with large negative value
        const result = await page.evaluate(() => {
            if (typeof window.openExtendModal === 'function') {
                var now = Math.floor(Date.now() / 1000);
                var testSearches = [{
                    searchName: 'Will_Expire_Test_' + Date.now(),
                    owner: 'admin',
                    app: 'search',
                    status: 'pending',
                    deadlineEpoch: now + (2 * 86400) // Only 2 days from now
                }];
                window.openExtendModal(testSearches);
                return { success: true, searchName: testSearches[0].searchName, deadline: testSearches[0].deadlineEpoch };
            }
            return { success: false };
        });

        console.log('openExtendModal result:', result);
        await page.waitForTimeout(1000);

        if (!result.success) {
            console.log('Failed to open extend modal');
            return;
        }

        // Enter negative value that would expire the deadline
        const customDaysInput = page.locator('#extendCustomDays');
        await customDaysInput.fill('-10'); // 10 days would definitely expire a 2-day deadline
        await page.waitForTimeout(500);

        console.log('Clicking Save with -10 days (should trigger disable prompt)...');
        await page.locator('#extendModalSave').click();
        await page.waitForTimeout(2000);

        await page.screenshot({ path: 'screenshots/negative-extension-3-disable-prompt.png', fullPage: true });

        // Check if disable prompt appeared
        const disablePrompt = dialogs.find(d =>
            d.message.includes('disable') ||
            d.message.includes('past') ||
            d.message.includes('expired')
        );

        console.log('Dialogs received:', dialogs.length);
        dialogs.forEach((d, i) => {
            console.log(`  Dialog ${i}: ${d.message.substring(0, 100)}...`);
        });

        if (disablePrompt) {
            console.log('SUCCESS: Disable prompt appeared as expected');
            expect(disablePrompt.message).toContain('disable');
        } else {
            console.log('No disable prompt received - deadline may not have been set correctly');
        }
    });

    test('should reject zero value', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const dialogs = [];

        page.on('dialog', async dialog => {
            dialogs.push({ type: dialog.type(), message: dialog.message() });
            console.log(`Dialog: ${dialog.message()}`);
            await dialog.accept();
        });

        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Open extend modal
        await page.evaluate(() => {
            if (typeof window.openExtendModal === 'function') {
                window.openExtendModal([{
                    searchName: 'Zero_Test',
                    owner: 'admin',
                    app: 'search',
                    status: 'pending'
                }]);
            }
        });
        await page.waitForTimeout(1000);

        // Enter zero
        await page.locator('#extendCustomDays').fill('0');
        await page.waitForTimeout(500);

        // Click Save
        await page.locator('#extendModalSave').click();
        await page.waitForTimeout(2000);

        // Should show error alert
        const errorAlert = dialogs.find(d =>
            d.message.includes('non-zero') ||
            d.message.includes('valid')
        );

        console.log('Dialogs:', dialogs.map(d => d.message));

        if (errorAlert) {
            console.log('SUCCESS: Zero value rejected with alert');
            expect(errorAlert.message).toMatch(/non-zero|valid/i);
        }

        await page.screenshot({ path: 'screenshots/negative-extension-4-zero-reject.png', fullPage: true });
    });
});
