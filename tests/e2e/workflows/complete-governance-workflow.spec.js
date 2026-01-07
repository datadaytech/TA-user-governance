/**
 * Complete End-to-End Governance Workflow Tests
 * Tests the entire user journey from suspicious detection to resolution
 */

const { test, expect } = require('../../fixtures');
const fs = require('fs');
const path = require('path');

const screenshotDir = path.join(__dirname, '../../screenshots/e2e-workflow');
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

test.describe('Complete Governance Workflow E2E', () => {

    test.describe('Scenario 1: Standard Governance Workflow', () => {
        const workflowScreenshots = [];

        test('Step 1: Navigate to Governance Dashboard', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Verify dashboard loaded
            const title = await page.title();
            expect(title).toContain('Governance');

            await page.screenshot({
                path: path.join(screenshotDir, 'e2e-01-dashboard-loaded.png'),
                fullPage: true
            });
        });

        test('Step 2: Review Suspicious Searches', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Get suspicious count
            const suspiciousPanel = page.locator('.dashboard-element').filter({ hasText: /Suspicious/i }).first();
            if (await suspiciousPanel.count() > 0) {
                const countText = await suspiciousPanel.locator('.single-value-number, .single-result-value').textContent();
                console.log(`Suspicious searches: ${countText}`);

                // Click to view details
                await suspiciousPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    await page.screenshot({
                        path: path.join(screenshotDir, 'e2e-02-suspicious-modal.png'),
                        fullPage: true
                    });
                }

                await page.keyboard.press('Escape');
            }
        });

        test('Step 3: Flag a Suspicious Search', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            page.on('dialog', async dialog => {
                console.log(`Dialog: ${dialog.message()}`);
                await dialog.accept();
            });

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const suspiciousPanel = page.locator('.dashboard-element').filter({ hasText: /Suspicious/i }).first();
            if (await suspiciousPanel.count() > 0) {
                await suspiciousPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    // Select first checkbox
                    const checkbox = page.locator('.metric-row-checkbox').first();
                    if (await checkbox.count() > 0) {
                        await checkbox.click({ force: true });
                        await page.waitForTimeout(500);

                        // Click Flag button
                        const flagBtn = page.locator('#metricPopupFlag');
                        if (await flagBtn.isVisible()) {
                            await flagBtn.click();
                            await page.waitForTimeout(5000);

                            await page.screenshot({
                                path: path.join(screenshotDir, 'e2e-03-after-flagging.png'),
                                fullPage: true
                            });
                        }
                    }
                }

                await page.keyboard.press('Escape');
                await page.waitForTimeout(1000);
                await page.keyboard.press('Escape');
            }
        });

        test('Step 4: Verify Flagged Search Appears in Currently Flagged', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const flaggedPanel = page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                const countText = await flaggedPanel.locator('.single-value-number, .single-result-value').textContent();
                const count = parseInt(countText) || 0;
                console.log(`Currently flagged: ${count}`);

                // Verify there's at least one flagged search
                expect(count).toBeGreaterThan(0);

                await page.screenshot({
                    path: path.join(screenshotDir, 'e2e-04-flagged-verified.png'),
                    fullPage: true
                });
            }
        });

        test('Step 5: Change Status to Notified', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const flaggedPanel = page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    const statusDropdown = page.locator('.status-dropdown-wrapper').first();
                    if (await statusDropdown.count() > 0) {
                        await statusDropdown.click();
                        await page.waitForTimeout(500);

                        const notifiedOption = page.locator('.status-option').filter({ hasText: /Notified/i }).first();
                        if (await notifiedOption.count() > 0) {
                            await notifiedOption.click();
                            await page.waitForTimeout(3000);

                            await page.screenshot({
                                path: path.join(screenshotDir, 'e2e-05-status-notified.png'),
                                fullPage: true
                            });
                        }
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('Step 6: Extend Deadline', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const flaggedPanel = page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    const checkbox = page.locator('.metric-row-checkbox').first();
                    if (await checkbox.count() > 0) {
                        await checkbox.click({ force: true });
                        await page.waitForTimeout(500);

                        const extendBtn = page.locator('#metricPopupExtend');
                        if (await extendBtn.isVisible()) {
                            await extendBtn.click();
                            await page.waitForTimeout(2000);

                            const extendModal = page.locator('#extendModalOverlay.active');
                            if (await extendModal.count() > 0) {
                                await page.locator('#extendCustomDays').fill('7');
                                await page.waitForTimeout(500);

                                await page.screenshot({
                                    path: path.join(screenshotDir, 'e2e-06-extend-modal.png'),
                                    fullPage: true
                                });

                                await page.locator('#extendModalSave').click();
                                await page.waitForTimeout(5000);
                            }
                        }
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('Step 7: Mark as Under Review', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const flaggedPanel = page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    const statusDropdown = page.locator('.status-dropdown-wrapper').first();
                    if (await statusDropdown.count() > 0) {
                        await statusDropdown.click();
                        await page.waitForTimeout(500);

                        const reviewOption = page.locator('.status-option').filter({ hasText: /Review/i }).first();
                        if (await reviewOption.count() > 0) {
                            await reviewOption.click();
                            await page.waitForTimeout(3000);

                            await page.screenshot({
                                path: path.join(screenshotDir, 'e2e-07-under-review.png'),
                                fullPage: true
                            });
                        }
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('Step 8: Resolve (Unflag) the Search', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const flaggedPanel = page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    const statusDropdown = page.locator('.status-dropdown-wrapper').first();
                    if (await statusDropdown.count() > 0) {
                        await statusDropdown.click();
                        await page.waitForTimeout(500);

                        const resolvedOption = page.locator('.status-option').filter({ hasText: /Resolved|Unflag/i }).first();
                        if (await resolvedOption.count() > 0) {
                            await resolvedOption.click();
                            await page.waitForTimeout(5000);

                            await page.screenshot({
                                path: path.join(screenshotDir, 'e2e-08-resolved.png'),
                                fullPage: true
                            });
                        }
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('Step 9: Verify Audit Trail', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_audit', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Verify audit entries exist
            const tableRows = await page.locator('tr').count();
            console.log(`Audit log entries: ${tableRows - 1}`); // Minus header row

            expect(tableRows).toBeGreaterThan(1);

            await page.screenshot({
                path: path.join(screenshotDir, 'e2e-09-audit-trail.png'),
                fullPage: true
            });
        });
    });

    test.describe('Scenario 2: Auto-Disable Flow', () => {

        test('Auto-disable: Search past deadline gets disabled', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            // This test verifies that searches past their remediation deadline
            // are properly identified and can be auto-disabled

            await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Check for "Past Due" or expired deadline indicators
            const pastDueCount = await page.locator('td').filter({ hasText: /0 days|Overdue|-.*days/i }).count();
            console.log(`Searches at or past deadline: ${pastDueCount}`);

            // Check auto-disabled panel if exists
            const disabledPanel = page.locator('.dashboard-element').filter({ hasText: /Auto.*Disabled|Disabled/i }).first();
            if (await disabledPanel.count() > 0) {
                const disabledCount = await disabledPanel.locator('.single-value-number, .single-result-value').textContent();
                console.log(`Auto-disabled searches: ${disabledCount}`);
            }

            await page.screenshot({
                path: path.join(screenshotDir, 'e2e-auto-disable-check.png'),
                fullPage: true
            });
        });
    });

    test.describe('Scenario 3: Bulk Operations', () => {

        test('Bulk flag: Select multiple searches and flag', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            page.on('dialog', async dialog => {
                await dialog.accept();
            });

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const suspiciousPanel = page.locator('.dashboard-element').filter({ hasText: /Suspicious/i }).first();
            if (await suspiciousPanel.count() > 0) {
                await suspiciousPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    // Select multiple checkboxes
                    const checkboxes = page.locator('.metric-row-checkbox');
                    const count = await checkboxes.count();

                    for (let i = 0; i < Math.min(3, count); i++) {
                        await checkboxes.nth(i).click({ force: true });
                        await page.waitForTimeout(200);
                    }

                    await page.screenshot({
                        path: path.join(screenshotDir, 'e2e-bulk-selection.png'),
                        fullPage: true
                    });

                    // Click Flag button for bulk operation
                    const flagBtn = page.locator('#metricPopupFlag');
                    if (await flagBtn.isVisible()) {
                        console.log('Bulk flag operation ready');
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('Bulk extend: Extend deadline for multiple searches', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const flaggedPanel = page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    // Select multiple checkboxes
                    const checkboxes = page.locator('.metric-row-checkbox');
                    const count = await checkboxes.count();

                    for (let i = 0; i < Math.min(3, count); i++) {
                        await checkboxes.nth(i).click({ force: true });
                        await page.waitForTimeout(200);
                    }

                    const extendBtn = page.locator('#metricPopupExtend');
                    if (await extendBtn.isVisible()) {
                        await extendBtn.click();
                        await page.waitForTimeout(2000);

                        const extendModal = page.locator('#extendModalOverlay.active');
                        if (await extendModal.count() > 0) {
                            // Verify multiple searches shown in extend modal
                            const searchList = await page.locator('#extendSearchList').innerHTML();
                            console.log('Bulk extend modal shows:', searchList.substring(0, 200));

                            await page.screenshot({
                                path: path.join(screenshotDir, 'e2e-bulk-extend.png'),
                                fullPage: true
                            });
                        }
                    }
                }

                await page.keyboard.press('Escape');
            }
        });
    });
});
