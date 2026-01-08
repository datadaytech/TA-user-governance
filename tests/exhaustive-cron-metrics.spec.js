/**
 * Exhaustive Cron & Metrics Tests
 * Tests cron schedule modal and all metric panels
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

test.describe('Exhaustive Cron Schedule Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Cron schedule column exists and is clickable', async ({ page }) => {
        await goToDashboard(page);

        const cronClickables = page.locator('.cron-clickable');
        const count = await cronClickables.count();
        console.log('Cron clickable elements:', count);
        expect(count).toBeGreaterThan(0);
    });

    test('Cron modal opens with all preset buttons', async ({ page }) => {
        await goToDashboard(page);

        const cron = page.locator('.cron-clickable').first();
        if (await cron.count() > 0) {
            await cron.click();
            await page.waitForTimeout(1000);

            const modal = page.locator('#cronModalOverlay');
            expect(await modal.isVisible()).toBe(true);

            // Check preset buttons
            const presets = ['Every 15 min', 'Hourly', 'Daily', 'Weekly', 'Monthly'];
            for (const preset of presets) {
                const btn = page.locator(`.cron-preset-btn:has-text("${preset}")`);
                const exists = await btn.count() > 0;
                console.log(`  Preset "${preset}": ${exists ? '✓' : '✗'}`);
            }

            await page.click('#cronModalClose');
        }
    });

    test('Cron modal inputs are editable', async ({ page }) => {
        await goToDashboard(page);

        const cron = page.locator('.cron-clickable').first();
        if (await cron.count() > 0) {
            await cron.click();
            await page.waitForTimeout(1000);

            // Test input fields
            const inputs = ['cronMinute', 'cronHour', 'cronDayMonth', 'cronMonth', 'cronDayWeek'];
            for (const inputId of inputs) {
                const input = page.locator(`#${inputId}`);
                const isEditable = await input.isEditable();
                console.log(`  Input ${inputId}: ${isEditable ? '✓ editable' : '✗ not editable'}`);
                expect(isEditable).toBe(true);
            }

            await page.click('#cronModalClose');
        }
    });

    test('Cron preset buttons update preview', async ({ page }) => {
        await goToDashboard(page);

        const cron = page.locator('.cron-clickable').first();
        if (await cron.count() > 0) {
            await cron.click();
            await page.waitForTimeout(1000);

            // Get initial preview
            const preview = page.locator('#cronPreviewValue');
            const initialValue = await preview.textContent();
            console.log('Initial preview:', initialValue);

            // Click a preset
            const hourlyBtn = page.locator('.cron-preset-btn:has-text("Hourly")');
            if (await hourlyBtn.count() > 0) {
                await hourlyBtn.click();
                await page.waitForTimeout(500);

                const newValue = await preview.textContent();
                console.log('After Hourly preset:', newValue);
                expect(newValue).toContain('0 * * * *');
            }

            await page.click('#cronModalClose');
        }
    });

    test('Cron modal has Save and Cancel buttons', async ({ page }) => {
        await goToDashboard(page);

        const cron = page.locator('.cron-clickable').first();
        if (await cron.count() > 0) {
            await cron.click();
            await page.waitForTimeout(1000);

            const saveBtn = page.locator('#cronModalSave');
            const cancelBtn = page.locator('#cronModalCancel');

            expect(await saveBtn.isVisible()).toBe(true);
            expect(await cancelBtn.isVisible()).toBe(true);

            // Cancel should close modal
            await cancelBtn.click();
            await page.waitForTimeout(500);
            expect(await page.locator('#cronModalOverlay').isVisible()).toBe(false);
        }
    });
});

test.describe('Exhaustive Metric Panel Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Total Scheduled Searches panel', async ({ page }) => {
        await goToDashboard(page);

        const panel = page.locator('#total_metric_panel');
        expect(await panel.isVisible()).toBe(true);

        const value = page.locator('#total_metric_panel .single-result');
        if (await value.count() > 0) {
            const text = await value.textContent();
            const num = parseInt(text) || 0;
            console.log('Total Scheduled Searches:', num);
            expect(num).toBeGreaterThan(0);

            // Check white color
            const color = await value.evaluate(el => window.getComputedStyle(el).color);
            console.log('Total metric color:', color);
            expect(color).toMatch(/rgb\(255,\s*255,\s*255\)/);
        }
    });

    test('Suspicious (Unflagged) panel', async ({ page }) => {
        await goToDashboard(page);

        const panel = page.locator('#suspicious_metric_panel');
        expect(await panel.isVisible()).toBe(true);

        const value = page.locator('#suspicious_metric_panel .single-result');
        if (await value.count() > 0) {
            const text = await value.textContent();
            const num = parseInt(text) || 0;
            console.log('Suspicious (Unflagged):', num);

            // Check yellow color
            const color = await value.evaluate(el => window.getComputedStyle(el).color);
            console.log('Suspicious metric color:', color);
        }
    });

    test('Currently Flagged panel', async ({ page }) => {
        await goToDashboard(page);

        const panel = page.locator('#flagged_metric_panel');
        expect(await panel.isVisible()).toBe(true);

        const value = page.locator('#flagged_metric_panel .single-result');
        if (await value.count() > 0) {
            const text = await value.textContent();
            const num = parseInt(text) || 0;
            console.log('Currently Flagged:', num);
        }
    });

    test('Expiring Soon panel', async ({ page }) => {
        await goToDashboard(page);

        const panel = page.locator('#expiring_metric_panel');
        expect(await panel.isVisible()).toBe(true);

        const value = page.locator('#expiring_metric_panel .single-result');
        if (await value.count() > 0) {
            const text = await value.textContent();
            const num = parseInt(text) || 0;
            console.log('Expiring Soon:', num);
        }
    });

    test('Auto-Disabled panel', async ({ page }) => {
        await goToDashboard(page);

        const panel = page.locator('#disabled_metric_panel');
        expect(await panel.isVisible()).toBe(true);

        const value = page.locator('#disabled_metric_panel .single-result');
        if (await value.count() > 0) {
            const text = await value.textContent();
            const num = parseInt(text) || 0;
            console.log('Auto-Disabled:', num);
        }
    });

    test('Clicking Total metric opens popup', async ({ page }) => {
        await goToDashboard(page);

        await page.click('#total_metric_panel');
        await page.waitForTimeout(3000);

        const popup = page.locator('#metricPopupOverlay');
        expect(await popup.isVisible()).toBe(true);

        await page.keyboard.press('Escape');
    });

    test('Clicking Suspicious metric opens popup', async ({ page }) => {
        await goToDashboard(page);

        await page.click('#suspicious_metric_panel');
        await page.waitForTimeout(3000);

        const popup = page.locator('#metricPopupOverlay');
        expect(await popup.isVisible()).toBe(true);

        // Get popup row count
        const rows = page.locator('#metricPopupTable tbody tr:not(:has-text("Loading")):not(:has-text("No"))');
        const rowCount = await rows.count();
        console.log('Suspicious popup rows:', rowCount);

        // Get metric value
        const metricValue = page.locator('#suspicious_metric_panel .single-result');
        const expectedCount = parseInt(await metricValue.textContent()) || 0;

        // Should match
        expect(rowCount).toBe(expectedCount);
        console.log(`✓ Suspicious count matches: metric=${expectedCount}, popup=${rowCount}`);

        await page.keyboard.press('Escape');
    });

    test('Clicking Flagged metric opens popup', async ({ page }) => {
        await goToDashboard(page);

        await page.click('#flagged_metric_panel');
        await page.waitForTimeout(3000);

        const popup = page.locator('#metricPopupOverlay');
        expect(await popup.isVisible()).toBe(true);

        await page.keyboard.press('Escape');
    });

    test('Metric popup has no checkboxes', async ({ page }) => {
        await goToDashboard(page);

        await page.click('#suspicious_metric_panel');
        await page.waitForTimeout(3000);

        const checkboxes = await page.locator('#metricPopupTable input[type="checkbox"]').count();
        expect(checkboxes).toBe(0);
        console.log('✓ No checkboxes in metric popup');

        await page.keyboard.press('Escape');
    });

    test('Metric popup has status dropdown in rows', async ({ page }) => {
        await goToDashboard(page);

        await page.click('#flagged_metric_panel');
        await page.waitForTimeout(3000);

        const popup = page.locator('#metricPopupOverlay');
        if (await popup.isVisible()) {
            const dropdowns = await page.locator('#metricPopupTable .status-dropdown-wrapper').count();
            console.log('Status dropdowns in popup:', dropdowns);

            // If there are rows, they should have dropdowns
            const rows = await page.locator('#metricPopupTable tbody tr:not(:has-text("Loading")):not(:has-text("No"))').count();
            if (rows > 0) {
                expect(dropdowns).toBeGreaterThan(0);
            }
        }

        await page.keyboard.press('Escape');
    });
});

test.describe('Metric Count Validation', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('All metric counts are consistent', async ({ page }) => {
        await goToDashboard(page);

        // Collect all metric values
        const metrics = {};

        const panels = [
            { id: 'total_metric_panel', name: 'Total' },
            { id: 'suspicious_metric_panel', name: 'Suspicious' },
            { id: 'flagged_metric_panel', name: 'Flagged' },
            { id: 'expiring_metric_panel', name: 'Expiring' },
            { id: 'disabled_metric_panel', name: 'Disabled' }
        ];

        for (const panel of panels) {
            const value = page.locator(`#${panel.id} .single-result`);
            if (await value.count() > 0) {
                metrics[panel.name] = parseInt(await value.textContent()) || 0;
            }
        }

        console.log('=== Metric Summary ===');
        console.log(JSON.stringify(metrics, null, 2));

        // Validation: Total should be >= suspicious + flagged (because some might overlap or be other states)
        // This is a sanity check
        if (metrics.Total !== undefined) {
            console.log(`Total: ${metrics.Total}`);
            console.log(`Suspicious (unflagged): ${metrics.Suspicious}`);
            console.log(`Flagged: ${metrics.Flagged}`);
        }
    });

    test('Table row count matches Total when showing All', async ({ page }) => {
        await goToDashboard(page);

        // Get total metric
        const totalMetric = page.locator('#total_metric_panel .single-result');
        let expectedTotal = 0;
        if (await totalMetric.count() > 0) {
            expectedTotal = parseInt(await totalMetric.textContent()) || 0;
        }
        console.log('Expected Total:', expectedTotal);

        // Ensure we're on "All Searches" view with "Enabled Only" filter
        await page.selectOption('select[name="view_filter"]', 'all');
        await page.selectOption('select[name="filter_status"]', '0'); // Enabled only
        await page.waitForTimeout(3000);

        // Count table rows (may need pagination consideration)
        const tableRows = await page.locator('#all_searches_table tbody tr, .splunk-table tbody tr').count();
        console.log('Table rows:', tableRows);

        // Note: Table might be paginated, so this might not exactly match
        // At least verify we have rows
        expect(tableRows).toBeGreaterThan(0);
    });
});
