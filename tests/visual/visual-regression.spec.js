/**
 * Visual Regression Tests
 * Captures and compares screenshots for UI consistency
 */

const { test, expect } = require('../fixtures');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const BASELINE_DIR = path.join(__dirname, 'baseline');
const DIFF_DIR = path.join(__dirname, 'diff');
const CURRENT_DIR = path.join(__dirname, 'current');
const THRESHOLD = 0.1; // 10% pixel difference threshold

// Ensure directories exist
[BASELINE_DIR, DIFF_DIR, CURRENT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

/**
 * Compare two screenshots and return diff percentage
 */
async function compareScreenshots(baselinePath, currentPath, diffPath) {
    if (!fs.existsSync(baselinePath)) {
        // No baseline, create one
        fs.copyFileSync(currentPath, baselinePath);
        return { isNew: true, diffPercent: 0 };
    }

    const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
    const current = PNG.sync.read(fs.readFileSync(currentPath));

    // Handle size differences
    if (baseline.width !== current.width || baseline.height !== current.height) {
        return {
            isNew: false,
            diffPercent: 100,
            error: `Size mismatch: baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`
        };
    }

    const { width, height } = baseline;
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
        baseline.data,
        current.data,
        diff.data,
        width,
        height,
        { threshold: 0.1 }
    );

    // Save diff image
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    const totalPixels = width * height;
    const diffPercent = (numDiffPixels / totalPixels) * 100;

    return {
        isNew: false,
        diffPercent,
        numDiffPixels,
        totalPixels
    };
}

test.describe('Visual Regression Tests', () => {

    test.describe('Dashboard Visual Consistency', () => {

        test('VR-1: Governance Dashboard main view', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const screenshotPath = path.join(CURRENT_DIR, 'vr-governance-dashboard.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });

            const result = await compareScreenshots(
                path.join(BASELINE_DIR, 'vr-governance-dashboard.png'),
                screenshotPath,
                path.join(DIFF_DIR, 'vr-governance-dashboard-diff.png')
            );

            if (result.isNew) {
                console.log('New baseline created for governance dashboard');
            } else {
                console.log(`Visual diff: ${result.diffPercent.toFixed(2)}%`);
                expect(result.diffPercent).toBeLessThan(THRESHOLD * 100);
            }
        });

        test('VR-2: Scheduled Search Governance view', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const screenshotPath = path.join(CURRENT_DIR, 'vr-scheduled-search.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });

            const result = await compareScreenshots(
                path.join(BASELINE_DIR, 'vr-scheduled-search.png'),
                screenshotPath,
                path.join(DIFF_DIR, 'vr-scheduled-search-diff.png')
            );

            if (result.isNew) {
                console.log('New baseline created for scheduled search governance');
            } else {
                console.log(`Visual diff: ${result.diffPercent.toFixed(2)}%`);
            }
        });

        test('VR-3: Cost Analysis view', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/cost_analysis', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const screenshotPath = path.join(CURRENT_DIR, 'vr-cost-analysis.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });

            const result = await compareScreenshots(
                path.join(BASELINE_DIR, 'vr-cost-analysis.png'),
                screenshotPath,
                path.join(DIFF_DIR, 'vr-cost-analysis-diff.png')
            );

            if (result.isNew) {
                console.log('New baseline created for cost analysis');
            } else {
                console.log(`Visual diff: ${result.diffPercent.toFixed(2)}%`);
            }
        });

        test('VR-4: Settings page view', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_settings', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const screenshotPath = path.join(CURRENT_DIR, 'vr-settings.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });

            const result = await compareScreenshots(
                path.join(BASELINE_DIR, 'vr-settings.png'),
                screenshotPath,
                path.join(DIFF_DIR, 'vr-settings-diff.png')
            );

            if (result.isNew) {
                console.log('New baseline created for settings');
            } else {
                console.log(`Visual diff: ${result.diffPercent.toFixed(2)}%`);
            }
        });

        test('VR-5: Audit log view', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_audit', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const screenshotPath = path.join(CURRENT_DIR, 'vr-audit.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });

            const result = await compareScreenshots(
                path.join(BASELINE_DIR, 'vr-audit.png'),
                screenshotPath,
                path.join(DIFF_DIR, 'vr-audit-diff.png')
            );

            if (result.isNew) {
                console.log('New baseline created for audit log');
            } else {
                console.log(`Visual diff: ${result.diffPercent.toFixed(2)}%`);
            }
        });
    });

    test.describe('UI Component Visual Tests', () => {

        test('VR-6: Checkbox styling', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const checkbox = page.locator('.gov-checkbox').first();
            if (await checkbox.count() > 0) {
                const screenshotPath = path.join(CURRENT_DIR, 'vr-checkbox-unchecked.png');
                await checkbox.screenshot({ path: screenshotPath });

                // Click checkbox
                await checkbox.click({ force: true });
                await page.waitForTimeout(500);

                const checkedPath = path.join(CURRENT_DIR, 'vr-checkbox-checked.png');
                await checkbox.screenshot({ path: checkedPath });

                console.log('Checkbox screenshots captured');
            }
        });

        test('VR-7: Status dropdown styling', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Click flagged panel
            const flaggedPanel = page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                const statusDropdown = page.locator('.status-dropdown-wrapper').first();
                if (await statusDropdown.count() > 0) {
                    const closedPath = path.join(CURRENT_DIR, 'vr-status-dropdown-closed.png');
                    await statusDropdown.screenshot({ path: closedPath });

                    await statusDropdown.click();
                    await page.waitForTimeout(500);

                    const menu = page.locator('.status-dropdown-menu');
                    if (await menu.count() > 0) {
                        const openPath = path.join(CURRENT_DIR, 'vr-status-dropdown-open.png');
                        await menu.screenshot({ path: openPath });
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('VR-8: Cron modal styling', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const cronClickable = page.locator('.cron-clickable').first();
            if (await cronClickable.count() > 0) {
                await cronClickable.click();
                await page.waitForTimeout(2000);

                const cronModal = page.locator('#cronModalOverlay.active');
                if (await cronModal.count() > 0) {
                    const screenshotPath = path.join(CURRENT_DIR, 'vr-cron-modal.png');
                    await cronModal.screenshot({ path: screenshotPath });

                    const result = await compareScreenshots(
                        path.join(BASELINE_DIR, 'vr-cron-modal.png'),
                        screenshotPath,
                        path.join(DIFF_DIR, 'vr-cron-modal-diff.png')
                    );

                    if (result.isNew) {
                        console.log('New baseline created for cron modal');
                    } else {
                        console.log(`Visual diff: ${result.diffPercent.toFixed(2)}%`);
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('VR-9: Metric popup styling', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const metricPanel = page.locator('.single-value, .panel-body').first();
            if (await metricPanel.count() > 0) {
                await metricPanel.click();
                await page.waitForTimeout(2000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    const screenshotPath = path.join(CURRENT_DIR, 'vr-metric-popup.png');
                    await popup.screenshot({ path: screenshotPath });

                    const result = await compareScreenshots(
                        path.join(BASELINE_DIR, 'vr-metric-popup.png'),
                        screenshotPath,
                        path.join(DIFF_DIR, 'vr-metric-popup-diff.png')
                    );

                    if (result.isNew) {
                        console.log('New baseline created for metric popup');
                    } else {
                        console.log(`Visual diff: ${result.diffPercent.toFixed(2)}%`);
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('VR-10: Extend deadline modal styling', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Open extend modal via JS
            await page.evaluate(() => {
                if (typeof window.openExtendModal === 'function') {
                    window.openExtendModal([{
                        searchName: 'Visual_Test_Search',
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
                const screenshotPath = path.join(CURRENT_DIR, 'vr-extend-modal.png');
                await extendModal.screenshot({ path: screenshotPath });

                const result = await compareScreenshots(
                    path.join(BASELINE_DIR, 'vr-extend-modal.png'),
                    screenshotPath,
                    path.join(DIFF_DIR, 'vr-extend-modal-diff.png')
                );

                if (result.isNew) {
                    console.log('New baseline created for extend modal');
                } else {
                    console.log(`Visual diff: ${result.diffPercent.toFixed(2)}%`);
                }
            }

            await page.keyboard.press('Escape');
        });
    });

    test.describe('Color and Theme Consistency', () => {

        test('VR-11: Status color consistency', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Capture status indicators
            const statusBadges = page.locator('.status-indicator, .status-badge, .status-dropdown-wrapper');
            const count = await statusBadges.count();

            if (count > 0) {
                // Take screenshot of each unique status type
                const screenshotPath = path.join(CURRENT_DIR, 'vr-status-colors.png');
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`Found ${count} status indicators`);
            }
        });

        test('VR-12: Table row styling', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const table = page.locator('.splunk-table, .table').first();
            if (await table.count() > 0) {
                const screenshotPath = path.join(CURRENT_DIR, 'vr-table-styling.png');
                await table.screenshot({ path: screenshotPath });

                const result = await compareScreenshots(
                    path.join(BASELINE_DIR, 'vr-table-styling.png'),
                    screenshotPath,
                    path.join(DIFF_DIR, 'vr-table-styling-diff.png')
                );

                if (result.isNew) {
                    console.log('New baseline created for table styling');
                } else {
                    console.log(`Visual diff: ${result.diffPercent.toFixed(2)}%`);
                }
            }
        });
    });
});
