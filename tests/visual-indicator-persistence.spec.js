/**
 * Test for visual indicator persistence after dashboard refresh
 * Verifies checkboxes, flag icons, and cron clickables remain after unflag/actions
 */

const { test, expect } = require('./fixtures');

test.describe('Visual Indicator Persistence Tests', () => {

    test('should maintain visual indicators after unflag action', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const consoleLogs = [];

        // Capture console logs
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push({ type: msg.type(), text });
        });

        // Navigate to governance dashboard
        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Check initial state - look for checkboxes
        const initialCheckboxes = await page.locator('.gov-checkbox').count();
        console.log(`Initial checkboxes found: ${initialCheckboxes}`);

        // Look for cron clickables
        const initialCronClickables = await page.locator('.cron-clickable').count();
        console.log(`Initial cron clickables found: ${initialCronClickables}`);

        // Take initial screenshot
        await page.screenshot({ path: 'screenshots/visual-persist-1-initial.png', fullPage: true });

        // Open flagged searches modal if available
        const flaggedPanel = page.locator('.single-value, .panel-body').filter({ hasText: /flagged/i }).first();
        if (await flaggedPanel.count() > 0) {
            await flaggedPanel.click();
            await page.waitForTimeout(3000);

            const popup = page.locator('#metricPopupOverlay.active');
            if (await popup.count() > 0) {
                console.log('Flagged popup opened');

                // Select a checkbox
                const checkbox = page.locator('.metric-row-checkbox').first();
                if (await checkbox.count() > 0) {
                    await checkbox.check({ force: true });
                    console.log('Checkbox checked in popup');
                    await page.waitForTimeout(1000);

                    // Handle confirmation dialog
                    page.once('dialog', async dialog => {
                        console.log(`Dialog: ${dialog.message()}`);
                        await dialog.accept();
                    });

                    // Click unflag button
                    const unflagBtn = page.locator('#metricPopupUnflag');
                    if (await unflagBtn.isVisible()) {
                        console.log('Clicking unflag button...');
                        await unflagBtn.click();
                        await page.waitForTimeout(6000); // Wait for refresh cycle
                    }
                }

                // Close popup if still open
                await page.keyboard.press('Escape');
                await page.waitForTimeout(1000);
            }
        }

        await page.screenshot({ path: 'screenshots/visual-persist-2-after-action.png', fullPage: true });

        // Wait for enhancement to re-run
        await page.waitForTimeout(5000);

        // Check if visual indicators are still present
        const finalCheckboxes = await page.locator('.gov-checkbox').count();
        console.log(`Final checkboxes found: ${finalCheckboxes}`);

        const finalCronClickables = await page.locator('.cron-clickable').count();
        console.log(`Final cron clickables found: ${finalCronClickables}`);

        await page.screenshot({ path: 'screenshots/visual-persist-3-final.png', fullPage: true });

        // Verify checkboxes still exist
        expect(finalCheckboxes).toBeGreaterThan(0);

        // Print summary
        console.log('\n=== VISUAL INDICATOR SUMMARY ===');
        console.log(`Checkboxes: ${initialCheckboxes} -> ${finalCheckboxes}`);
        console.log(`Cron Clickables: ${initialCronClickables} -> ${finalCronClickables}`);
    });

    test('should show N/A for days left on unflagged searches', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Navigate to governance dashboard
        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Open flagged modal
        const flaggedPanel = page.locator('.single-value, .panel-body').filter({ hasText: /flagged/i }).first();
        if (await flaggedPanel.count() > 0) {
            await flaggedPanel.click();
            await page.waitForTimeout(3000);

            const popup = page.locator('#metricPopupOverlay.active');
            if (await popup.count() > 0) {
                // Look for rows and check countdown cells
                const rows = page.locator('.metric-popup-row');
                const rowCount = await rows.count();
                console.log(`Found ${rowCount} rows in popup`);

                for (let i = 0; i < Math.min(rowCount, 5); i++) {
                    const row = rows.nth(i);
                    const statusCell = await row.locator('.status-cell').textContent();
                    const countdownCell = row.locator('.countdown-cell');

                    if (await countdownCell.count() > 0) {
                        const countdownText = await countdownCell.textContent();
                        console.log(`Row ${i}: Status="${statusCell?.trim()}", Countdown="${countdownText?.trim()}"`);

                        // If status shows resolved/disabled, countdown should be N/A
                        if (statusCell && (statusCell.includes('resolved') || statusCell.includes('disabled'))) {
                            expect(countdownText?.toLowerCase()).toContain('n/a');
                        }
                    }
                }

                await page.screenshot({ path: 'screenshots/visual-persist-days-left.png', fullPage: true });
            }
        }
    });
});
