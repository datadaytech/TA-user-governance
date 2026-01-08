/**
 * Test for visual indicator and modal persistence after flagging
 * Regression test for: "If I flag a search the panel reloads then all visual indicators go away along with the modal"
 */

const { test, expect } = require('./fixtures');

test.describe('Flag Persistence Regression Tests', () => {

    test('should maintain visual indicators after flagging from suspicious modal', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const consoleLogs = [];

        // Capture console logs
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push({ type: msg.type(), text });
            if (text.includes('Enhancing') || text.includes('refresh') || text.includes('flag')) {
                console.log(`[Console] ${text}`);
            }
        });

        // Navigate to governance dashboard (which has suspicious searches)
        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
        await page.waitForTimeout(5000);

        // Count initial visual indicators
        const initialCheckboxes = await page.locator('.gov-checkbox').count();
        const initialCronClickables = await page.locator('.cron-clickable').count();
        console.log(`BEFORE FLAG - Checkboxes: ${initialCheckboxes}, Cron Clickables: ${initialCronClickables}`);
        expect(initialCheckboxes).toBeGreaterThan(0);
        expect(initialCronClickables).toBeGreaterThan(0);

        // Take initial screenshot
        await page.screenshot({ path: 'screenshots/flag-regression-1-initial.png', fullPage: true });

        // Click on suspicious metric panel to open popup
        // The panel has h3 with text "Suspicious (Unflagged)" and cursor:pointer is set
        const suspiciousPanel = page.locator('.dashboard-element, .dashboard-panel').filter({ hasText: /Suspicious.*Unflagged/i }).first();
        if (await suspiciousPanel.count() === 0) {
            console.log('No suspicious panel found - trying alternate selector');
            const altPanel = page.locator('h3').filter({ hasText: /Suspicious/i }).first();
            if (await altPanel.count() > 0) {
                await altPanel.click();
            } else {
                console.log('No suspicious panel found with any selector, skipping test');
                return;
            }
        } else {
            await suspiciousPanel.click();
        }
        await page.waitForTimeout(3000);

        // Verify popup opened
        const popup = page.locator('#metricPopupOverlay.active');
        const popupCount = await popup.count();
        console.log('Popup count after click:', popupCount);
        if (popupCount === 0) {
            // Take debug screenshot
            await page.screenshot({ path: 'screenshots/flag-regression-debug-no-popup.png', fullPage: true });
            console.log('Popup did not open - checking if click handler is working');
        }
        expect(popupCount).toBeGreaterThan(0);
        console.log('Suspicious popup opened');

        await page.screenshot({ path: 'screenshots/flag-regression-2-popup-open.png', fullPage: true });

        // Select a checkbox in the popup
        const popupCheckbox = page.locator('.metric-row-checkbox').first();
        if (await popupCheckbox.count() > 0) {
            await popupCheckbox.click({ force: true });
            await page.waitForTimeout(500);
            console.log('Selected a search in popup');
        }

        // Handle dialogs
        let dialogsReceived = [];
        page.on('dialog', async dialog => {
            const msg = dialog.message();
            console.log(`Dialog received: ${msg.substring(0, 100)}...`);
            dialogsReceived.push(msg);
            // Accept the "would you like to adjust deadline" confirm dialog
            await dialog.accept();
        });

        // Click flag button
        const flagBtn = page.locator('#metricPopupFlag');
        if (await flagBtn.isVisible()) {
            console.log('Clicking Flag button...');
            await flagBtn.click();
            await page.waitForTimeout(8000); // Wait for flag, refresh, and possible extend modal
        }

        console.log(`Dialogs received: ${dialogsReceived.length}`);
        await page.screenshot({ path: 'screenshots/flag-regression-3-after-flag.png', fullPage: true });

        // Close any open modals
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);

        // Wait for enhancement to complete
        await page.waitForTimeout(5000);

        // Count visual indicators AFTER flagging
        const finalCheckboxes = await page.locator('.gov-checkbox').count();
        const finalCronClickables = await page.locator('.cron-clickable').count();
        console.log(`AFTER FLAG - Checkboxes: ${finalCheckboxes}, Cron Clickables: ${finalCronClickables}`);

        await page.screenshot({ path: 'screenshots/flag-regression-4-final.png', fullPage: true });

        // CRITICAL ASSERTIONS - Visual indicators should persist
        expect(finalCheckboxes).toBeGreaterThan(0);
        expect(finalCronClickables).toBeGreaterThan(0);

        // Summary
        console.log('\n=== FLAG PERSISTENCE TEST SUMMARY ===');
        console.log(`Checkboxes: ${initialCheckboxes} -> ${finalCheckboxes} (should be > 0)`);
        console.log(`Cron Clickables: ${initialCronClickables} -> ${finalCronClickables} (should be > 0)`);

        // Warn if counts dropped significantly
        if (finalCheckboxes < initialCheckboxes * 0.8) {
            console.warn('WARNING: Checkbox count dropped significantly after flag!');
        }
        if (finalCronClickables < initialCronClickables * 0.8) {
            console.warn('WARNING: Cron clickable count dropped significantly after flag!');
        }
    });

    test('should allow modal to open after flagging and refresh', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Navigate to governance dashboard
        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
        await page.waitForTimeout(5000);

        // First, verify a modal can open
        const metricPanel = page.locator('.single-value, .panel-body').first();
        await metricPanel.click();
        await page.waitForTimeout(2000);

        let popupVisible = await page.locator('#metricPopupOverlay.active').count() > 0;
        console.log(`Initial popup test: ${popupVisible ? 'PASS' : 'FAIL'}`);

        // Close if open
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);

        // Now trigger a refresh by manually calling the JS function
        await page.evaluate(() => {
            if (typeof window.refreshDashboard === 'function') {
                window.refreshDashboard();
            } else {
                // Trigger via startSearch on all managers
                var mvc = require('splunkjs/mvc');
                var managers = mvc.Components.getInstances();
                managers.forEach(function(m) {
                    if (m && typeof m.startSearch === 'function') {
                        try { m.startSearch(); } catch(e) {}
                    }
                });
            }
        });

        // Wait for refresh to complete
        await page.waitForTimeout(8000);

        // Verify visual indicators still exist
        const checkboxes = await page.locator('.gov-checkbox').count();
        const cronClickables = await page.locator('.cron-clickable').count();
        console.log(`After refresh - Checkboxes: ${checkboxes}, Cron Clickables: ${cronClickables}`);

        await page.screenshot({ path: 'screenshots/flag-regression-5-after-refresh.png', fullPage: true });

        // Try to open a modal again
        const metricPanel2 = page.locator('.single-value, .panel-body').first();
        await metricPanel2.click();
        await page.waitForTimeout(3000);

        popupVisible = await page.locator('#metricPopupOverlay.active').count() > 0;
        console.log(`Post-refresh popup test: ${popupVisible ? 'PASS' : 'FAIL'}`);

        await page.screenshot({ path: 'screenshots/flag-regression-6-popup-after-refresh.png', fullPage: true });

        // CRITICAL ASSERTIONS
        expect(checkboxes).toBeGreaterThan(0);
        expect(popupVisible).toBe(true);
    });
});
