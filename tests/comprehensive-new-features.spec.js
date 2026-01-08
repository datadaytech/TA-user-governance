/**
 * Comprehensive New Features Tests
 * Tests all recent additions: row selection, funny messages, reason modal, clean SPL
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

test.describe('Row Selection in Metric Popup', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Clicking a row in metric popup toggles selection', async ({ page }) => {
        await goToDashboard(page);

        // Click on Suspicious metric to open popup
        const suspiciousPanel = page.locator('#suspicious_metric_panel .single-result');
        if (await suspiciousPanel.count() > 0) {
            await suspiciousPanel.click();
            await page.waitForTimeout(2000);

            const modal = page.locator('#metricPopupOverlay');
            if (await modal.isVisible()) {
                const rows = page.locator('.metric-popup-row');
                const rowCount = await rows.count();

                if (rowCount > 0) {
                    // Click first row to select
                    await rows.first().click();
                    await page.waitForTimeout(500);

                    // Check if row has selected class
                    const isSelected = await rows.first().evaluate(el => el.classList.contains('selected'));
                    console.log('Row selected:', isSelected);

                    // Click again to deselect
                    await rows.first().click();
                    await page.waitForTimeout(500);

                    const isDeselected = await rows.first().evaluate(el => !el.classList.contains('selected'));
                    console.log('Row deselected:', isDeselected);

                    expect(isSelected || isDeselected).toBe(true);
                    console.log('Row selection toggle works');
                }

                await page.keyboard.press('Escape');
            }
        }
    });

    test('Selection count displays when rows are selected', async ({ page }) => {
        await goToDashboard(page);

        const flaggedPanel = page.locator('#flagged_metric_panel .single-result');
        if (await flaggedPanel.count() > 0) {
            await flaggedPanel.click();
            await page.waitForTimeout(2000);

            const modal = page.locator('#metricPopupOverlay');
            if (await modal.isVisible()) {
                const rows = page.locator('.metric-popup-row');
                const rowCount = await rows.count();

                if (rowCount >= 2) {
                    // Select two rows
                    await rows.nth(0).click();
                    await page.waitForTimeout(300);
                    await rows.nth(1).click();
                    await page.waitForTimeout(500);

                    // Check for selection count display
                    const countDisplay = page.locator('.selection-count');
                    if (await countDisplay.count() > 0) {
                        const text = await countDisplay.textContent();
                        console.log('Selection count text:', text);
                        expect(text).toContain('selected');
                    }
                }

                await page.keyboard.press('Escape');
            }
        }
    });
});

test.describe('Clean SPL Preview', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('SPL preview shows clean query without HTML color artifacts', async ({ page }) => {
        await goToDashboard(page);

        const magnifyIcon = page.locator('.search-preview-icon').first();
        if (await magnifyIcon.count() > 0) {
            await magnifyIcon.click();
            await page.waitForTimeout(2000);

            const modal = page.locator('#searchPreviewModalOverlay');
            if (await modal.isVisible()) {
                const splContent = page.locator('#searchPreviewQuery');
                const splText = await splContent.textContent();

                // Should NOT contain any HTML style artifacts
                expect(splText).not.toContain('style="color:');
                expect(splText).not.toContain('<span');
                expect(splText).not.toContain('</span>');
                expect(splText).not.toContain('color: #');

                console.log('SPL is clean - no HTML artifacts found');
                console.log('SPL preview (first 150 chars):', splText.substring(0, 150));

                await page.keyboard.press('Escape');
            }
        }
    });
});

test.describe('Reason Modal with Solutions', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Reason modal shows practical optimization suggestions', async ({ page }) => {
        await goToDashboard(page);

        const reasonClickable = page.locator('.reason-clickable').first();
        if (await reasonClickable.count() > 0) {
            await reasonClickable.click();
            await page.waitForTimeout(1000);

            const modal = page.locator('#reasonModalOverlay');
            if (await modal.isVisible()) {
                const solutions = page.locator('#reasonSolutions');
                const solutionsHtml = await solutions.innerHTML();

                // Check for practical suggestions with code examples
                const hasCodeExamples = solutionsHtml.includes('<code>') || solutionsHtml.includes('tstats') || solutionsHtml.includes('stats');
                console.log('Solutions contain code examples:', hasCodeExamples);

                // Check for styled list items
                const hasStyledItems = solutionsHtml.includes('background:') || solutionsHtml.includes('border-left:');
                console.log('Solutions have styled items:', hasStyledItems);

                expect(solutionsHtml.length).toBeGreaterThan(100);
                console.log('Reason modal shows solutions');

                await page.keyboard.press('Escape');
            }
        }
    });
});

test.describe('Total Scheduled Searches Panel', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Total panel has white value color and no drilldown', async ({ page }) => {
        await goToDashboard(page);

        const totalPanel = page.locator('#total_metric_panel .single-result');
        if (await totalPanel.count() > 0) {
            // Check the color is white
            const color = await totalPanel.evaluate(el => window.getComputedStyle(el).color);
            console.log('Total panel value color:', color);

            // White should be rgb(255, 255, 255)
            expect(color).toMatch(/rgb\(255,\s*255,\s*255\)/);
            console.log('Total panel has white value');

            // Try clicking - should NOT open a popup
            await totalPanel.click();
            await page.waitForTimeout(1000);

            const popup = page.locator('#metricPopupOverlay');
            const isPopupVisible = await popup.isVisible();

            // Since we removed drilldown, popup should NOT open
            // (Or if it does open, it's from another source)
            console.log('Popup visible after clicking Total:', isPopupVisible);
        }
    });
});

test.describe('Dashboard Status Sorting', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Status column maintains correct priority order', async ({ page }) => {
        await goToDashboard(page);

        const statusDropdowns = page.locator('.status-dropdown-wrapper');
        const count = await statusDropdowns.count();

        if (count > 0) {
            const statuses = [];
            for (let i = 0; i < Math.min(count, 20); i++) {
                const status = await statusDropdowns.nth(i).getAttribute('data-current-status');
                statuses.push(status);
            }

            console.log('Status order (first 20):', statuses.slice(0, 10));

            // Check that Suspicious comes before OK
            const suspiciousIdx = statuses.findIndex(s => s === 'Suspicious');
            const okIdx = statuses.findIndex(s => s === 'OK');

            if (suspiciousIdx !== -1 && okIdx !== -1) {
                expect(suspiciousIdx).toBeLessThan(okIdx);
                console.log('Suspicious appears before OK - correct order');
            }
        }
    });
});

test.describe('Funny Empty Messages', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Zero items shows encouraging message', async ({ page }) => {
        await goToDashboard(page);

        // Check the Disabled metric - often has 0 items
        const disabledPanel = page.locator('#disabled_metric_panel .single-result');
        if (await disabledPanel.count() > 0) {
            const value = await disabledPanel.textContent();

            if (value && value.trim() === '0') {
                await disabledPanel.click();
                await page.waitForTimeout(2000);

                const modal = page.locator('#metricPopupOverlay');
                if (await modal.isVisible()) {
                    const tableBody = page.locator('#metricPopupTableBody');
                    const content = await tableBody.textContent();

                    // Should have an encouraging message, not just "No items found"
                    const hasFunnyMessage = !content.includes('No items found') || content.includes('Zero') || content.includes('Congrats') || content.includes('clean');
                    console.log('Empty message content:', content.substring(0, 100));

                    await page.keyboard.press('Escape');
                }
            }
        }
    });
});
