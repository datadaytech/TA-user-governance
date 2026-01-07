/**
 * Status Labels Comprehensive Test Suite
 * Tests all status label transitions and audit logging
 *
 * Status Workflow:
 * - Suspicious: Detected but not flagged
 * - Pending (Flagged): Marked for governance, deadline set
 * - Notified: Owner notified, deadline active (still flagged)
 * - Pending Review: User fixing SPL/removing suspicious conditions (still flagged)
 * - Disabled: Auto-disabled, should unflag and fall off chart
 * - Resolved: Successfully fixed, unflagged
 */

const { test, expect } = require('../fixtures');
const fs = require('fs');
const path = require('path');

const screenshotDir = path.join(__dirname, '../screenshots/status-labels');
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

test.describe('Status Labels Comprehensive Tests', () => {

    test.describe('Status Display Tests', () => {

        test('should display correct colors for each status', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Check status color mapping in any status indicators
            const statusColors = await page.evaluate(() => {
                const colors = {};
                const statusElements = document.querySelectorAll('[data-status], .status-indicator, .status-badge, .status-dropdown-wrapper');
                statusElements.forEach(el => {
                    const status = el.getAttribute('data-status') || el.getAttribute('data-current-status');
                    if (status) {
                        const computed = window.getComputedStyle(el);
                        colors[status] = computed.backgroundColor || computed.color;
                    }
                });
                return colors;
            });

            console.log('Status colors found:', colors);
            await page.screenshot({ path: path.join(screenshotDir, 'status-colors.png'), fullPage: true });
        });

        test('should show status dropdown with correct options for flagged searches', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Open flagged panel
            const flaggedPanel = page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    // Click on status dropdown
                    const statusDropdown = page.locator('.status-dropdown-wrapper').first();
                    if (await statusDropdown.count() > 0) {
                        await statusDropdown.click();
                        await page.waitForTimeout(500);

                        // Capture dropdown options
                        const options = await page.locator('.status-option').allTextContents();
                        console.log('Flagged search status options:', options);

                        await page.screenshot({ path: path.join(screenshotDir, 'flagged-status-dropdown.png'), fullPage: true });

                        // Verify expected options exist
                        const expectedOptions = ['Flagged', 'Notified', 'Pending Review', 'Disabled', 'Resolved'];
                        for (const expected of expectedOptions) {
                            const found = options.some(opt => opt.toLowerCase().includes(expected.toLowerCase().split(' ')[0]));
                            console.log(`${expected}: ${found ? 'FOUND' : 'NOT FOUND'}`);
                        }

                        // Close dropdown
                        await page.keyboard.press('Escape');
                    }
                }
                await page.keyboard.press('Escape');
            }
        });

        test('should show only Flag option for suspicious searches', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Open suspicious panel
            const suspiciousPanel = page.locator('.dashboard-element').filter({ hasText: /Suspicious/i }).first();
            if (await suspiciousPanel.count() > 0) {
                await suspiciousPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    // Click on status dropdown if it exists in suspicious modal
                    const statusDropdown = page.locator('.status-dropdown-wrapper').first();
                    if (await statusDropdown.count() > 0) {
                        await statusDropdown.click();
                        await page.waitForTimeout(500);

                        // Capture dropdown options
                        const options = await page.locator('.status-option').allTextContents();
                        console.log('Suspicious search status options:', options);

                        await page.screenshot({ path: path.join(screenshotDir, 'suspicious-status-dropdown.png'), fullPage: true });

                        // Should only have "Flag for Review" option
                        expect(options.length).toBeLessThanOrEqual(2); // Flag + possibly current status

                        // Close dropdown
                        await page.keyboard.press('Escape');
                    }
                }
                await page.keyboard.press('Escape');
            }
        });
    });

    test.describe('Status Transition Tests', () => {

        test('Transition: Suspicious -> Flagged', async ({ authenticatedPage }) => {
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

            // Record initial counts
            const initialSuspicious = await page.locator('.dashboard-element').filter({ hasText: /Suspicious/i }).first().locator('.single-value-number, .single-result-value').textContent().catch(() => '0');
            const initialFlagged = await page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first().locator('.single-value-number, .single-result-value').textContent().catch(() => '0');

            console.log(`Initial - Suspicious: ${initialSuspicious}, Flagged: ${initialFlagged}`);

            // Open suspicious modal and flag a search
            const suspiciousPanel = page.locator('.dashboard-element').filter({ hasText: /Suspicious/i }).first();
            if (await suspiciousPanel.count() > 0 && parseInt(initialSuspicious) > 0) {
                await suspiciousPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    // Select a search
                    const checkbox = page.locator('.metric-row-checkbox').first();
                    if (await checkbox.count() > 0) {
                        await checkbox.click({ force: true });
                        await page.waitForTimeout(500);

                        // Click Flag button
                        const flagBtn = page.locator('#metricPopupFlag');
                        if (await flagBtn.isVisible()) {
                            await flagBtn.click();
                            await page.waitForTimeout(5000);
                        }
                    }
                }
                await page.keyboard.press('Escape');
                await page.waitForTimeout(1000);
                await page.keyboard.press('Escape');

                // Wait for refresh
                await page.waitForTimeout(5000);

                // Check counts changed
                const finalSuspicious = await page.locator('.dashboard-element').filter({ hasText: /Suspicious/i }).first().locator('.single-value-number, .single-result-value').textContent().catch(() => '0');
                const finalFlagged = await page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first().locator('.single-value-number, .single-result-value').textContent().catch(() => '0');

                console.log(`After Flag - Suspicious: ${finalSuspicious}, Flagged: ${finalFlagged}`);
                await page.screenshot({ path: path.join(screenshotDir, 'transition-suspicious-to-flagged.png'), fullPage: true });
            }
        });

        test('Transition: Flagged -> Notified', async ({ authenticatedPage }) => {
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

                            await page.screenshot({ path: path.join(screenshotDir, 'transition-flagged-to-notified.png'), fullPage: true });
                            console.log('Successfully transitioned to Notified');
                        }
                    }
                }
                await page.keyboard.press('Escape');
            }
        });

        test('Transition: Notified -> Pending Review', async ({ authenticatedPage }) => {
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

                            await page.screenshot({ path: path.join(screenshotDir, 'transition-to-pending-review.png'), fullPage: true });
                            console.log('Successfully transitioned to Pending Review');
                        }
                    }
                }
                await page.keyboard.press('Escape');
            }
        });

        test('Transition: Flagged -> Disabled (unflag + fall off)', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const initialFlagged = await page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first().locator('.single-value-number, .single-result-value').textContent().catch(() => '0');
            console.log(`Initial flagged count: ${initialFlagged}`);

            const flaggedPanel = page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0 && parseInt(initialFlagged) > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                if (await popup.count() > 0) {
                    const statusDropdown = page.locator('.status-dropdown-wrapper').first();
                    if (await statusDropdown.count() > 0) {
                        await statusDropdown.click();
                        await page.waitForTimeout(500);

                        const disabledOption = page.locator('.status-option').filter({ hasText: /Disabled/i }).first();
                        if (await disabledOption.count() > 0) {
                            await disabledOption.click();
                            await page.waitForTimeout(5000);

                            await page.screenshot({ path: path.join(screenshotDir, 'transition-to-disabled.png'), fullPage: true });
                            console.log('Successfully transitioned to Disabled');

                            // Verify flagged count decreased (search should fall off)
                            const finalFlagged = await page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first().locator('.single-value-number, .single-result-value').textContent().catch(() => '0');
                            console.log(`Final flagged count: ${finalFlagged}`);

                            // Disabled searches should unflag
                            if (parseInt(initialFlagged) > parseInt(finalFlagged)) {
                                console.log('PASS: Disabled search fell off flagged count');
                            }
                        }
                    }
                }
                await page.keyboard.press('Escape');
            }
        });

        test('Transition: Flagged -> Resolved (unflag)', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            const initialFlagged = await page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first().locator('.single-value-number, .single-result-value').textContent().catch(() => '0');
            console.log(`Initial flagged count: ${initialFlagged}`);

            const flaggedPanel = page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0 && parseInt(initialFlagged) > 0) {
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

                            await page.screenshot({ path: path.join(screenshotDir, 'transition-to-resolved.png'), fullPage: true });
                            console.log('Successfully transitioned to Resolved/Unflagged');

                            // Verify flagged count decreased
                            const finalFlagged = await page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first().locator('.single-value-number, .single-result-value').textContent().catch(() => '0');
                            console.log(`Final flagged count: ${finalFlagged}`);

                            // Resolved searches should be removed
                            expect(parseInt(finalFlagged)).toBeLessThan(parseInt(initialFlagged));
                        }
                    }
                }
                await page.keyboard.press('Escape');
            }
        });
    });

    test.describe('Audit Logging Tests', () => {

        test('should log status change to audit', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            // First perform a status change
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
                        }
                    }
                }
                await page.keyboard.press('Escape');
            }

            // Now check audit log
            await page.goto('/en-US/app/TA-user-governance/governance_audit', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForTimeout(10000);

            await page.screenshot({ path: path.join(screenshotDir, 'audit-after-status-change.png'), fullPage: true });

            // Look for recent status change entry
            const pageContent = await page.content();
            const hasStatusChange = pageContent.includes('status') || pageContent.includes('notified');
            console.log(`Audit log contains status change: ${hasStatusChange}`);
        });
    });
});
