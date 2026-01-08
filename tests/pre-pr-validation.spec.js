/**
 * Pre-PR Validation Test Suite
 * Captures screenshots of all key UI states for visual regression testing
 * Run this before every pull request
 */

const { test, expect } = require('./fixtures');
const fs = require('fs');
const path = require('path');

// Create timestamped screenshot directory
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const screenshotDir = path.join(__dirname, 'screenshots', `pre-pr-${timestamp}`);

test.beforeAll(async () => {
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }
    console.log(`Screenshots will be saved to: ${screenshotDir}`);
});

test.describe('Pre-PR Visual Regression Tests', () => {

    test('1. Governance Dashboard - Initial Load', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
        await page.waitForTimeout(5000);

        // Full page screenshot
        await page.screenshot({
            path: path.join(screenshotDir, '01-dashboard-full.png'),
            fullPage: true
        });

        // Metric panels area
        const metricPanels = page.locator('.dashboard-row').first();
        if (await metricPanels.count() > 0) {
            await metricPanels.screenshot({
                path: path.join(screenshotDir, '02-metric-panels.png')
            });
        }

        // Verify checkboxes exist
        const checkboxCount = await page.locator('.gov-checkbox').count();
        console.log(`Checkboxes found: ${checkboxCount}`);
        expect(checkboxCount).toBeGreaterThan(0);
    });

    test('2. Tables with Visual Indicators', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
        await page.waitForTimeout(5000);

        // Suspicious Scheduled Searches table
        const suspiciousPanel = page.locator('.dashboard-panel').filter({ hasText: /Suspicious.*Scheduled/i }).first();
        if (await suspiciousPanel.count() > 0) {
            await suspiciousPanel.screenshot({
                path: path.join(screenshotDir, '03-suspicious-searches-panel.png')
            });
        }

        // All Scheduled Searches table
        const allSearchesPanel = page.locator('.dashboard-panel').filter({ hasText: /All Scheduled Searches/i }).first();
        if (await allSearchesPanel.count() > 0) {
            await allSearchesPanel.screenshot({
                path: path.join(screenshotDir, '04-all-searches-panel.png')
            });
        }

        // Verify cron clickables
        const cronCount = await page.locator('.cron-clickable').count();
        console.log(`Cron clickables found: ${cronCount}`);
        expect(cronCount).toBeGreaterThan(0);
    });

    test('3. Flagged Metric Popup', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
        await page.waitForTimeout(5000);

        // Click flagged metric panel
        const flaggedPanel = page.locator('.single-value, .panel-body').filter({ hasText: /flagged/i }).first();
        if (await flaggedPanel.count() > 0) {
            await flaggedPanel.click();
            await page.waitForTimeout(3000);

            const popup = page.locator('#metricPopupOverlay.active');
            if (await popup.count() > 0) {
                await popup.screenshot({
                    path: path.join(screenshotDir, '05-flagged-popup.png')
                });

                // Check for status dropdown
                const statusDropdown = page.locator('.status-dropdown-wrapper').first();
                if (await statusDropdown.count() > 0) {
                    await statusDropdown.screenshot({
                        path: path.join(screenshotDir, '06-status-dropdown.png')
                    });
                }

                // Close popup
                await page.keyboard.press('Escape');
            }
        }
    });

    test('4. Extend Deadline Modal', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
        await page.waitForTimeout(5000);

        // Open extend modal directly
        await page.evaluate(() => {
            if (typeof window.openExtendModal === 'function') {
                window.openExtendModal([{
                    searchName: 'Screenshot_Test_Search',
                    owner: 'admin',
                    app: 'search',
                    status: 'pending',
                    deadlineEpoch: Math.floor(Date.now() / 1000) + (7 * 86400),
                    daysRemaining: 7
                }]);
            }
        });
        await page.waitForTimeout(1500);

        const extendModal = page.locator('#extendModalOverlay.active');
        if (await extendModal.count() > 0) {
            await extendModal.screenshot({
                path: path.join(screenshotDir, '07-extend-modal.png')
            });

            // Test negative value input
            await page.locator('#extendCustomDays').fill('-3');
            await page.waitForTimeout(500);
            await extendModal.screenshot({
                path: path.join(screenshotDir, '08-extend-modal-negative.png')
            });

            // Close modal
            await page.keyboard.press('Escape');
        }
    });

    test('5. Cron Schedule Modal', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
        await page.waitForTimeout(5000);

        // Click on a cron schedule
        const cronClickable = page.locator('.cron-clickable').first();
        if (await cronClickable.count() > 0) {
            await cronClickable.click();
            await page.waitForTimeout(2000);

            const cronModal = page.locator('#cronModalOverlay.active');
            if (await cronModal.count() > 0) {
                await cronModal.screenshot({
                    path: path.join(screenshotDir, '09-cron-modal.png')
                });
                await page.keyboard.press('Escape');
            }
        }
    });

    test('6. Row Selection States', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
        await page.waitForTimeout(5000);

        // Select a checkbox using click instead of check (works better with custom checkboxes)
        const checkbox = page.locator('.gov-checkbox').first();
        if (await checkbox.count() > 0) {
            await checkbox.click({ force: true });
            await page.waitForTimeout(1000);

            // Screenshot showing selected row
            await page.screenshot({
                path: path.join(screenshotDir, '10-row-selection.png'),
                fullPage: true
            });
        }

        // Screenshot of action buttons area
        const actionsPanel = page.locator('.dashboard-panel').filter({ hasText: /Action/i }).first();
        if (await actionsPanel.count() > 0) {
            await actionsPanel.screenshot({
                path: path.join(screenshotDir, '11-action-buttons.png')
            });
        }
    });

    test('7. Cost Analysis Dashboard', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/cost_analysis', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
        await page.waitForTimeout(5000);

        await page.screenshot({
            path: path.join(screenshotDir, '12-cost-analysis-full.png'),
            fullPage: true
        });
    });

    test('8. Final Summary', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Count screenshots taken
        const files = fs.readdirSync(screenshotDir);
        console.log(`\n========================================`);
        console.log(`  PRE-PR VISUAL VALIDATION COMPLETE`);
        console.log(`========================================`);
        console.log(`Screenshots saved: ${files.length}`);
        console.log(`Location: ${screenshotDir}`);
        console.log(`\nFiles:`);
        files.forEach(f => console.log(`  - ${f}`));
        console.log(`========================================\n`);

        expect(files.length).toBeGreaterThan(5);
    });
});
