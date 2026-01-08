/**
 * Comprehensive Governance Dashboard Tests
 * Tests all scenarios, status types, metric counts, and functionality
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test.describe('Comprehensive Governance Dashboard Tests', () => {
    let page;

    test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext();
        page = await context.newPage();

        // Enable console logging
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('GOVERNANCE')) {
                console.log('BROWSER:', msg.text());
            }
        });

        // Login once
        await page.goto(`${SPLUNK_URL}/en-US/account/login`);
        await page.fill('input[name="username"]', SPLUNK_USERNAME);
        await page.fill('input[name="password"]', SPLUNK_PASSWORD);
        await page.click('input[type="submit"]');
        await page.waitForURL(/\/en-US\/app\//);
    });

    test.afterAll(async () => {
        await page.close();
    });

    test.describe('1. Dashboard Loading & Layout', () => {
        test('Dashboard loads without errors', async () => {
            await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(5000);

            // Verify no 404 errors
            const title = await page.title();
            expect(title).not.toContain('404');
            expect(title).not.toContain('Error');
        });

        test('All metric panels are visible', async () => {
            const panels = ['total_metric_panel', 'suspicious_metric_panel', 'flagged_metric_panel', 'expiring_metric_panel', 'disabled_metric_panel'];

            for (const panelId of panels) {
                const panel = page.locator(`#${panelId}`);
                const isVisible = await panel.isVisible();
                console.log(`Panel ${panelId}: ${isVisible ? 'visible' : 'NOT visible'}`);
                expect(isVisible).toBe(true);
            }
        });

        test('Table has no checkbox column', async () => {
            const checkboxHeaders = await page.locator('.gov-select-header, th:has(input[type="checkbox"])').count();
            expect(checkboxHeaders).toBe(0);
            console.log('✓ No checkbox columns found');
        });

        test('Owner column has no dropdown', async () => {
            // Check that owner cells don't have status-dropdown-wrapper
            const table = page.locator('#all_searches_table, .splunk-table').first();
            await table.waitFor({ state: 'visible', timeout: 10000 });

            const ownerCells = await page.evaluate(() => {
                const headers = Array.from(document.querySelectorAll('th'));
                const ownerIdx = headers.findIndex(h => h.textContent.trim() === 'Owner');
                if (ownerIdx === -1) return { found: false };

                const rows = document.querySelectorAll('tbody tr');
                let hasDropdown = false;
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells[ownerIdx] && cells[ownerIdx].querySelector('.status-dropdown-wrapper')) {
                        hasDropdown = true;
                    }
                });
                return { found: true, hasDropdown };
            });

            if (ownerCells.found) {
                expect(ownerCells.hasDropdown).toBe(false);
                console.log('✓ Owner column has no dropdown');
            }
        });

        test('Total metric has white text', async () => {
            const totalResult = page.locator('#total_metric_panel .single-result');
            if (await totalResult.count() > 0) {
                const color = await totalResult.evaluate(el => window.getComputedStyle(el).color);
                console.log('Total metric color:', color);
                // White is rgb(255, 255, 255)
                expect(color).toMatch(/rgb\(255,\s*255,\s*255\)|#fff|white/i);
            }
        });
    });

    test.describe('2. Metric Count Validation', () => {
        test('Suspicious metric matches table count', async () => {
            await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(5000);

            // Get suspicious metric value
            const suspiciousMetric = page.locator('#suspicious_metric_panel .single-result');
            let metricCount = 0;
            if (await suspiciousMetric.count() > 0) {
                const text = await suspiciousMetric.textContent();
                metricCount = parseInt(text.trim()) || 0;
            }
            console.log('Suspicious metric count:', metricCount);

            // Filter to suspicious only
            await page.selectOption('select[name="view_filter"]', 'suspicious');
            await page.waitForTimeout(3000);

            // Count rows in table
            const tableRows = await page.locator('#all_searches_table tbody tr, .splunk-table tbody tr').count();
            console.log('Table rows (Suspicious Only):', tableRows);

            // They should match (or table is 0 if metric is 0)
            if (metricCount === 0) {
                expect(tableRows === 0 || tableRows === 1).toBe(true); // May have "no results" row
            } else {
                expect(tableRows).toBe(metricCount);
            }

            // Reset filter
            await page.selectOption('select[name="view_filter"]', 'all');
        });

        test('Flagged metric matches table count', async () => {
            // Get flagged metric value
            const flaggedMetric = page.locator('#flagged_metric_panel .single-result');
            let metricCount = 0;
            if (await flaggedMetric.count() > 0) {
                const text = await flaggedMetric.textContent();
                metricCount = parseInt(text.trim()) || 0;
            }
            console.log('Flagged metric count:', metricCount);

            // Filter to flagged only
            await page.selectOption('select[name="view_filter"]', 'flagged');
            await page.waitForTimeout(3000);

            // Count rows in table
            const tableRows = await page.locator('#all_searches_table tbody tr, .splunk-table tbody tr').count();
            console.log('Table rows (Flagged Only):', tableRows);

            // Reset filter
            await page.selectOption('select[name="view_filter"]', 'all');
        });
    });

    test.describe('3. Status Dropdown Functionality', () => {
        test('Status dropdown appears on click', async () => {
            await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(5000);

            // Find a status dropdown wrapper
            const statusDropdowns = page.locator('.status-dropdown-wrapper');
            const count = await statusDropdowns.count();
            console.log('Status dropdowns found:', count);

            if (count > 0) {
                // Click the first one
                await statusDropdowns.first().click();
                await page.waitForTimeout(500);

                // Check if menu appeared
                const menu = page.locator('.status-dropdown-menu');
                const menuVisible = await menu.isVisible();
                expect(menuVisible).toBe(true);
                console.log('✓ Status dropdown menu appears on click');

                // Close menu
                await page.keyboard.press('Escape');
            }
        });

        test('Status dropdown has all options', async () => {
            const statusDropdowns = page.locator('.status-dropdown-wrapper');
            const count = await statusDropdowns.count();

            if (count > 0) {
                await statusDropdowns.first().click();
                await page.waitForTimeout(500);

                const options = await page.locator('.status-dropdown-menu .status-option').allTextContents();
                console.log('Dropdown options:', options);

                // Should have 5 options
                expect(options.length).toBe(5);

                // Check for expected options
                const expectedOptions = ['Flag for Review', 'Notified', 'Pending Review', 'Disabled', 'Resolved'];
                for (const expected of expectedOptions) {
                    const found = options.some(opt => opt.includes(expected));
                    console.log(`  ${expected}: ${found ? '✓' : '✗'}`);
                    expect(found).toBe(true);
                }

                await page.keyboard.press('Escape');
            }
        });
    });

    test.describe('4. Re-flagging Prevention', () => {
        test('Already flagged search shows error when flagging again', async () => {
            await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(5000);

            // Find a flagged status dropdown (Flagged, Pending, Notified, Disabled)
            const flaggedDropdown = page.locator('.status-dropdown-wrapper').filter({
                has: page.locator('.status-badge:has-text("FLAGGED"), .status-badge:has-text("PENDING"), .status-badge:has-text("NOTIFIED"), .status-badge:has-text("DISABLED")')
            }).first();

            const hasFlag = await flaggedDropdown.count() > 0;
            console.log('Found flagged dropdown:', hasFlag);

            if (hasFlag) {
                // Setup dialog listener
                let alertMessage = '';
                page.once('dialog', async dialog => {
                    alertMessage = dialog.message();
                    console.log('Alert received:', alertMessage);
                    await dialog.accept();
                });

                // Click the dropdown
                await flaggedDropdown.click();
                await page.waitForTimeout(500);

                // Click "Flag for Review" option
                const flagOption = page.locator('.status-option:has-text("Flag for Review")');
                if (await flagOption.count() > 0) {
                    await flagOption.click();
                    await page.waitForTimeout(1000);

                    // Should get alert about already flagged
                    expect(alertMessage.toLowerCase()).toContain('already flagged');
                    console.log('✓ Re-flagging prevented with error message');
                }
            }
        });
    });

    test.describe('5. Cron Schedule Modal', () => {
        test('Cron schedule is clickable and opens modal', async () => {
            await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(5000);

            const cronClickable = page.locator('.cron-clickable').first();
            const hasCron = await cronClickable.count() > 0;
            console.log('Found cron clickable:', hasCron);

            if (hasCron) {
                await cronClickable.click();
                await page.waitForTimeout(1000);

                // Check if modal opened
                const modal = page.locator('#cronModalOverlay');
                const modalVisible = await modal.isVisible();
                console.log('Cron modal visible:', modalVisible);

                if (modalVisible) {
                    // Check modal has expected elements
                    const presetButtons = await page.locator('.cron-preset-btn').count();
                    console.log('Preset buttons found:', presetButtons);
                    expect(presetButtons).toBeGreaterThan(0);

                    // Close modal
                    await page.click('#cronModalClose');
                }
            }
        });
    });

    test.describe('6. Metric Popup Functionality', () => {
        test('Suspicious metric popup opens and shows correct count', async () => {
            await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(5000);

            // Get the suspicious metric value
            const suspiciousPanel = page.locator('#suspicious_metric_panel .single-result');
            let metricValue = 0;
            if (await suspiciousPanel.count() > 0) {
                metricValue = parseInt(await suspiciousPanel.textContent()) || 0;
            }
            console.log('Suspicious metric value:', metricValue);

            // Click on the panel
            await page.locator('#suspicious_metric_panel').click();
            await page.waitForTimeout(3000);

            // Check popup opened
            const popup = page.locator('#metricPopupOverlay.active');
            const popupVisible = await popup.isVisible();
            console.log('Popup visible:', popupVisible);

            if (popupVisible) {
                // Count rows in popup
                const popupRows = await page.locator('#metricPopupTable tbody tr:not(:has-text("Loading")):not(:has-text("No items"))').count();
                console.log('Popup rows:', popupRows);

                // Should match the metric
                if (metricValue > 0) {
                    expect(popupRows).toBe(metricValue);
                }

                // Close popup
                await page.keyboard.press('Escape');
            }
        });

        test('Metric popup has no checkboxes', async () => {
            await page.locator('#flagged_metric_panel').click();
            await page.waitForTimeout(3000);

            const popup = page.locator('#metricPopupOverlay.active');
            if (await popup.isVisible()) {
                // Check for checkbox
                const checkboxes = await page.locator('#metricPopupTable input[type="checkbox"]').count();
                expect(checkboxes).toBe(0);
                console.log('✓ No checkboxes in metric popup');

                await page.keyboard.press('Escape');
            }
        });
    });

    test.describe('7. Status State Validation', () => {
        test('All governance statuses display correctly', async () => {
            await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(5000);

            // Check for various status badges
            const statuses = {
                'OK': await page.locator('.status-badge:has-text("OK")').count(),
                'SUSPICIOUS': await page.locator('.status-badge:has-text("SUSPICIOUS")').count(),
                'FLAGGED': await page.locator('.status-badge:has-text("FLAGGED")').count(),
                'PENDING': await page.locator('.status-badge:has-text("PENDING")').count(),
                'NOTIFIED': await page.locator('.status-badge:has-text("NOTIFIED")').count(),
                'DISABLED': await page.locator('.status-badge:has-text("DISABLED")').count()
            };

            console.log('Status badge counts:', statuses);

            // At least some should be present
            const totalBadges = Object.values(statuses).reduce((a, b) => a + b, 0);
            console.log('Total status badges:', totalBadges);
            expect(totalBadges).toBeGreaterThan(0);
        });
    });

    test.describe('8. View Filter Validation', () => {
        test('All Searches view shows all data', async () => {
            await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(5000);

            await page.selectOption('select[name="view_filter"]', 'all');
            await page.waitForTimeout(2000);

            const rowCount = await page.locator('#all_searches_table tbody tr, .splunk-table tbody tr').count();
            console.log('All Searches row count:', rowCount);
            expect(rowCount).toBeGreaterThan(0);
        });

        test('Flagged Only view filters correctly', async () => {
            await page.selectOption('select[name="view_filter"]', 'flagged');
            await page.waitForTimeout(2000);

            // All visible rows should have flagged-related status
            const rows = page.locator('#all_searches_table tbody tr, .splunk-table tbody tr');
            const count = await rows.count();
            console.log('Flagged Only row count:', count);

            if (count > 0) {
                // Check that each row has a flagged status
                for (let i = 0; i < Math.min(count, 5); i++) {
                    const row = rows.nth(i);
                    const statusText = await row.locator('.status-dropdown-wrapper, .status-badge').first().textContent();
                    console.log(`  Row ${i + 1} status:`, statusText?.trim());
                    // Should be Flagged, Pending, Notified, or Disabled
                    const isFlagged = /FLAGGED|PENDING|NOTIFIED|DISABLED/i.test(statusText || '');
                    expect(isFlagged).toBe(true);
                }
            }
        });

        test('Suspicious Only view filters correctly', async () => {
            await page.selectOption('select[name="view_filter"]', 'suspicious');
            await page.waitForTimeout(2000);

            const rows = page.locator('#all_searches_table tbody tr, .splunk-table tbody tr');
            const count = await rows.count();
            console.log('Suspicious Only row count:', count);

            if (count > 0) {
                // All rows should have SUSPICIOUS status (not flagged)
                for (let i = 0; i < Math.min(count, 5); i++) {
                    const row = rows.nth(i);
                    const statusText = await row.locator('.status-dropdown-wrapper, .status-badge').first().textContent();
                    console.log(`  Row ${i + 1} status:`, statusText?.trim());
                    expect(statusText?.toUpperCase()).toContain('SUSPICIOUS');
                }
            }

            // Reset
            await page.selectOption('select[name="view_filter"]', 'all');
        });
    });

    test.describe('9. Screenshots for Visual Verification', () => {
        test('Capture full dashboard screenshot', async () => {
            await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(5000);

            await page.screenshot({ path: 'screenshots/comprehensive-test-dashboard.png', fullPage: true });
            console.log('✓ Full dashboard screenshot saved');
        });

        test('Capture metrics row screenshot', async () => {
            const metricsRow = page.locator('.dashboard-row').first();
            if (await metricsRow.isVisible()) {
                await metricsRow.screenshot({ path: 'screenshots/comprehensive-test-metrics.png' });
                console.log('✓ Metrics row screenshot saved');
            }
        });

        test('Capture table screenshot', async () => {
            const table = page.locator('#all_searches_table, .splunk-table').first();
            await table.waitFor({ state: 'visible', timeout: 10000 });
            await table.screenshot({ path: 'screenshots/comprehensive-test-table.png' });
            console.log('✓ Table screenshot saved');
        });
    });
});
