/**
 * Test panel consolidation - suspicious metric, flagging, and view filtering
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test.describe('Panel Consolidation Tests', () => {

    test.beforeEach(async ({ page }) => {
        // Track console
        page.on('console', msg => {
            console.log('BROWSER:', msg.text());
        });

        // Handle dialogs
        page.on('dialog', async dialog => {
            console.log('Dialog:', dialog.type(), '-', dialog.message().substring(0, 100));
            await dialog.accept();
        });

        // Login
        await page.goto(`${SPLUNK_URL}/en-US/account/login`);
        await page.fill('input[name="username"]', SPLUNK_USERNAME);
        await page.fill('input[name="password"]', SPLUNK_PASSWORD);
        await page.click('input[type="submit"]');
        await page.waitForURL(/\/en-US\/app\//);
    });

    test('Suspicious metric shows only unflagged suspicious searches', async ({ page }) => {
        // Navigate to dashboard
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // Clear flagged lookup first
        console.log('=== Clearing flagged lookup ===');
        await page.evaluate(async () => {
            return new Promise((resolve) => {
                require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                    var search = new SearchManager({
                        id: 'clear_' + Date.now(),
                        search: '| makeresults | eval x=1 | where x=0 | outputlookup flagged_searches_lookup',
                        earliest_time: '-1h',
                        latest_time: 'now',
                        autostart: true
                    });
                    search.on('search:done', () => resolve(true));
                    setTimeout(() => resolve(false), 10000);
                });
            });
        });
        await page.waitForTimeout(2000);

        // Get suspicious metric value before
        const suspiciousPanelBefore = page.locator('#suspicious_metric_panel .single-result, [id*="suspicious"] .single-result').first();
        let suspiciousCountBefore = '0';
        if (await suspiciousPanelBefore.count() > 0) {
            suspiciousCountBefore = await suspiciousPanelBefore.textContent();
            console.log('Suspicious count before:', suspiciousCountBefore);
        }

        // Click on Suspicious metric to open modal
        console.log('=== Clicking Suspicious (Unflagged) metric ===');
        await page.locator('text=Suspicious (Unflagged)').first().click();
        await page.waitForTimeout(3000);

        // Verify popup opened
        const popupVisible = await page.locator('#metricPopupOverlay.active').isVisible();
        console.log('Popup visible:', popupVisible);
        expect(popupVisible).toBe(true);

        // Count items in popup
        const popupRows = page.locator('#metricPopupTable tbody tr:not(:has-text("Loading")):not(:has-text("No items"))');
        const popupRowCount = await popupRows.count();
        console.log('Popup rows:', popupRowCount);

        // If we have items, flag one and verify it disappears
        if (popupRowCount > 0) {
            // Select first checkbox
            const firstCheckbox = page.locator('#metricPopupTable .metric-row-checkbox').first();
            await firstCheckbox.check();
            await page.waitForTimeout(500);

            // Get the search name
            const searchName = await page.evaluate(() => {
                var idx = parseInt($('.metric-row-checkbox:checked').first().attr('data-index'));
                return window.currentMetricSearches && window.currentMetricSearches[idx] ? window.currentMetricSearches[idx].name : null;
            });
            console.log('Selected search:', searchName);

            // Click Flag button
            console.log('=== Flagging selected search ===');
            await page.evaluate(() => {
                $('#metricPopupFlag').show();
                $('#metricPopupFlag').trigger('click');
            });

            await page.waitForTimeout(5000);

            // Click suspicious metric again to verify item is gone
            console.log('=== Reopening Suspicious (Unflagged) modal ===');
            await page.locator('text=Suspicious (Unflagged)').first().click();
            await page.waitForTimeout(3000);

            // Check popup content - should not contain the flagged search
            const popupContent = await page.locator('#metricPopupTable tbody').textContent();
            console.log('Popup content after flagging:', popupContent.substring(0, 200));

            if (searchName) {
                expect(popupContent).not.toContain(searchName);
            }

            // Close popup
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);

            // Click Flagged metric to verify item is there
            console.log('=== Opening Flagged modal ===');
            await page.locator('text=Currently Flagged').first().click();
            await page.waitForTimeout(3000);

            // Check flagged popup contains the search
            const flaggedContent = await page.locator('#metricPopupTable tbody').textContent();
            console.log('Flagged content:', flaggedContent.substring(0, 200));

            if (searchName) {
                expect(flaggedContent).toContain(searchName);
            }
        }

        await page.screenshot({ path: 'screenshots/suspicious-metric-test.png' });
    });

    test('Status dropdown shows correct options based on status', async ({ page }) => {
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // Find status dropdowns with "Suspicious" status
        const suspiciousDropdowns = page.locator('.status-dropdown-wrapper[data-current-status="Suspicious"]');
        const suspiciousCount = await suspiciousDropdowns.count();
        console.log('Suspicious status dropdowns:', suspiciousCount);

        if (suspiciousCount > 0) {
            // Click on a suspicious status dropdown
            await suspiciousDropdowns.first().click();
            await page.waitForTimeout(500);

            // Check options - should only have "Flag for Review"
            const options = await page.evaluate(() => {
                return $('.status-dropdown-menu .status-option').map(function() {
                    return $(this).text().trim();
                }).get();
            });
            console.log('Suspicious dropdown options:', options);

            expect(options.length).toBe(1);
            expect(options[0]).toContain('Flag');

            // Close dropdown
            await page.keyboard.press('Escape');
        }

        // Find status dropdowns with "Flagged" status
        const flaggedDropdowns = page.locator('.status-dropdown-wrapper[data-current-status*="Flagged"], .status-dropdown-wrapper[data-current-status*="Pending"]');
        const flaggedCount = await flaggedDropdowns.count();
        console.log('Flagged status dropdowns:', flaggedCount);

        if (flaggedCount > 0) {
            await page.waitForTimeout(500);
            await flaggedDropdowns.first().click();
            await page.waitForTimeout(500);

            const options = await page.evaluate(() => {
                return $('.status-dropdown-menu .status-option').map(function() {
                    return $(this).text().trim();
                }).get();
            });
            console.log('Flagged dropdown options:', options);

            expect(options.length).toBeGreaterThan(1);

            await page.keyboard.press('Escape');
        }

        await page.screenshot({ path: 'screenshots/status-dropdown-options-test.png' });
    });

    test('Lightning bolt icon appears for suspicious rows', async ({ page }) => {
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // Check for suspicious indicator (lightning bolt)
        const suspiciousIndicators = page.locator('.suspicious-indicator');
        const indicatorCount = await suspiciousIndicators.count();
        console.log('Suspicious indicators:', indicatorCount);

        // Check that indicators are blue colored
        if (indicatorCount > 0) {
            const indicatorColor = await suspiciousIndicators.first().evaluate(el =>
                window.getComputedStyle(el).color
            );
            console.log('Indicator color:', indicatorColor);

            // Should contain blue (#17a2b8 = rgb(23, 162, 184))
            expect(indicatorColor).toContain('23') || expect(indicatorColor).toContain('162') || expect(indicatorColor).toContain('184');
        }

        await page.screenshot({ path: 'screenshots/lightning-bolt-test.png' });
    });

    test('Re-flagging already flagged search shows error', async ({ page }) => {
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // Open flagged modal
        console.log('=== Opening Flagged modal ===');
        await page.locator('text=Currently Flagged').first().click();
        await page.waitForTimeout(3000);

        const popupVisible = await page.locator('#metricPopupOverlay.active').isVisible();
        if (!popupVisible) {
            console.log('No flagged modal - skipping test');
            return;
        }

        // Try to flag an already flagged search
        const checkboxes = page.locator('#metricPopupTable .metric-row-checkbox');
        const checkboxCount = await checkboxes.count();
        console.log('Checkboxes found:', checkboxCount);

        if (checkboxCount > 0) {
            await checkboxes.first().check();
            await page.waitForTimeout(500);

            // Show and click flag button
            await page.evaluate(() => {
                $('#metricPopupFlag').show();
            });

            let alertMessage = '';
            page.once('dialog', async dialog => {
                alertMessage = dialog.message();
                console.log('Alert:', alertMessage);
                await dialog.accept();
            });

            await page.evaluate(() => {
                $('#metricPopupFlag').trigger('click');
            });

            await page.waitForTimeout(1000);

            // Alert should mention already flagged
            expect(alertMessage.toLowerCase()).toContain('already flagged');
        }

        await page.screenshot({ path: 'screenshots/reflag-error-test.png' });
    });

});
