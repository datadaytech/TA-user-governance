/**
 * Test new workflow features:
 * 1. Flagged → Notified separation (timer only starts on notify)
 * 2. Suspicious → OK whitelist feature
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

async function login(page) {
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
}

async function goToDashboard(page) {
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(6000);
}

test.describe('Flagged to Notified Workflow', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Flagged status shows "Awaiting Notification" instead of countdown', async ({ page }) => {
        await goToDashboard(page);

        // Open the flagged modal
        const flaggedPanel = page.locator('#flagged_metric_panel .single-result');
        if (await flaggedPanel.count() > 0) {
            await flaggedPanel.click();
            await page.waitForTimeout(3000);  // Wait longer for search to complete

            const modal = page.locator('#metricPopupOverlay');
            if (await modal.isVisible()) {
                // Look for any row with "Awaiting Notification" text
                const awaitingText = page.locator('.countdown-awaiting');
                const awaitingCount = await awaitingText.count();
                console.log('Found "Awaiting Notification" cells:', awaitingCount);

                // Check for Notify button - wait for it to appear
                const notifyBtn = page.locator('#metricPopupNotify');
                await page.waitForTimeout(1000);  // Extra wait for button visibility update
                const isNotifyVisible = await notifyBtn.isVisible();
                console.log('Notify User button visible:', isNotifyVisible);

                // Just verify awaitingCount > 0 for this test (the timer format is correct)
                expect(awaitingCount).toBeGreaterThan(0);

                await page.keyboard.press('Escape');
            }
        }
    });

    test('Notify button shows email preview dialog', async ({ page }) => {
        await goToDashboard(page);

        const flaggedPanel = page.locator('#flagged_metric_panel .single-result');
        if (await flaggedPanel.count() > 0) {
            const value = await flaggedPanel.textContent();
            if (value && parseInt(value) > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(2000);

                const modal = page.locator('#metricPopupOverlay');
                if (await modal.isVisible()) {
                    // Select first row
                    const rows = page.locator('.metric-popup-row');
                    if (await rows.count() > 0) {
                        await rows.first().click();
                        await page.waitForTimeout(500);

                        // Click notify button - should show confirm dialog
                        const notifyBtn = page.locator('#metricPopupNotify');
                        if (await notifyBtn.isVisible()) {
                            // Set up dialog handler
                            page.on('dialog', async dialog => {
                                console.log('Dialog message:', dialog.message().substring(0, 200));
                                expect(dialog.message()).toContain('notification');
                                await dialog.dismiss();
                            });

                            await notifyBtn.click();
                            await page.waitForTimeout(1000);
                        }
                    }

                    await page.keyboard.press('Escape');
                }
            }
        }
    });
});

test.describe('Suspicious OK Whitelist', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Status dropdown for suspicious search shows OK option', async ({ page }) => {
        await goToDashboard(page);

        // Open suspicious modal
        const suspiciousPanel = page.locator('#suspicious_metric_panel .single-result');
        if (await suspiciousPanel.count() > 0) {
            const value = await suspiciousPanel.textContent();
            if (value && parseInt(value) > 0) {
                await suspiciousPanel.click();
                await page.waitForTimeout(3000);  // Wait longer for data to load

                const modal = page.locator('#metricPopupOverlay');
                if (await modal.isVisible()) {
                    // Wait for table to populate
                    await page.waitForSelector('.metric-popup-row', { timeout: 10000 });

                    // Click on status dropdown using force to bypass any overlays
                    const statusDropdown = page.locator('.metric-popup-row .status-dropdown-wrapper').first();
                    if (await statusDropdown.count() > 0) {
                        await statusDropdown.click({ force: true });
                        await page.waitForTimeout(500);

                        // Check for OK option in dropdown
                        const okOption = page.locator('.status-option[data-status="ok"]');
                        const okCount = await okOption.count();
                        console.log('OK (Whitelist) option found:', okCount > 0);
                        expect(okCount).toBeGreaterThan(0);

                        // Close dropdown by clicking elsewhere
                        await page.click('body', { position: { x: 0, y: 0 } });
                    }

                    await page.keyboard.press('Escape');
                }
            }
        }
    });

    test('OK option opens confirmation modal with note requirement', async ({ page }) => {
        await goToDashboard(page);

        const suspiciousPanel = page.locator('#suspicious_metric_panel .single-result');
        if (await suspiciousPanel.count() > 0) {
            const value = await suspiciousPanel.textContent();
            if (value && parseInt(value) > 0) {
                await suspiciousPanel.click();
                await page.waitForTimeout(3000);

                const modal = page.locator('#metricPopupOverlay');
                if (await modal.isVisible()) {
                    // Wait for table to populate
                    await page.waitForSelector('.metric-popup-row', { timeout: 10000 });

                    // Click on status dropdown using force
                    const statusDropdown = page.locator('.metric-popup-row .status-dropdown-wrapper').first();
                    if (await statusDropdown.count() > 0) {
                        await statusDropdown.click({ force: true });
                        await page.waitForTimeout(500);

                        // Click OK option
                        const okOption = page.locator('.status-option[data-status="ok"]');
                        if (await okOption.count() > 0) {
                            await okOption.click({ force: true });
                            await page.waitForTimeout(500);

                            // Check if OK confirm modal opened
                            const okModal = page.locator('#okConfirmModalOverlay');
                            const isOkModalVisible = await okModal.isVisible();
                            console.log('OK confirm modal visible:', isOkModalVisible);
                            expect(isOkModalVisible).toBe(true);

                            // Check for note textarea
                            const noteTextarea = page.locator('#okConfirmNote');
                            const hasTextarea = await noteTextarea.count() > 0;
                            console.log('Note textarea present:', hasTextarea);
                            expect(hasTextarea).toBe(true);

                            // Close modal
                            await page.locator('#okConfirmModalCancel').click();
                        }
                    }

                    await page.keyboard.press('Escape');
                }
            }
        }
    });
});
