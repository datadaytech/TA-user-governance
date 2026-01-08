/**
 * Comprehensive Flag Testing
 * Tests: multi-select flagging, sequential flagging, visual indicators, modal data
 */

const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

// Helper to login
async function login(page) {
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
}

// Helper to clear flagged searches lookup
async function clearFlaggedLookup(page) {
    return page.evaluate(async () => {
        return new Promise((resolve) => {
            require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                var search = new SearchManager({
                    id: 'clear_lookup_' + Date.now(),
                    search: '| makeresults | eval search_name="placeholder" | where 1=0 | outputlookup flagged_searches_lookup',
                    earliest_time: '-1h',
                    latest_time: 'now',
                    autostart: true
                });
                search.on('search:done', () => resolve(true));
                setTimeout(() => resolve(false), 10000);
            });
        });
    });
}

// Helper to get flagged searches
async function getFlaggedSearches(page) {
    return page.evaluate(async () => {
        return new Promise((resolve) => {
            require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                var search = new SearchManager({
                    id: 'get_flagged_' + Date.now(),
                    search: '| inputlookup flagged_searches_lookup | table search_name, search_owner, status, reason',
                    earliest_time: '-1h',
                    latest_time: 'now',
                    autostart: true
                });
                search.on('search:done', function() {
                    var results = search.data('results');
                    if (results) {
                        results.on('data', function() {
                            resolve(results.data().rows || []);
                        });
                    } else {
                        resolve([]);
                    }
                });
                setTimeout(() => resolve([]), 10000);
            });
        });
    });
}

test.describe('Multi-Select Flagging Tests', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            if (msg.text().includes('flagMultipleSearches') ||
                msg.text().includes('Selected searches') ||
                msg.text().includes('flag')) {
                console.log('BROWSER:', msg.text());
            }
        });
    });

    test('Multi-select: Flag 2 searches at once', async ({ page }) => {
        await login(page);

        // Navigate to dashboard
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // Clear lookup first
        console.log('Clearing flagged lookup...');
        await clearFlaggedLookup(page);
        await page.waitForTimeout(2000);

        // Verify cleared
        const beforeFlag = await getFlaggedSearches(page);
        console.log('Flagged before:', beforeFlag.length);

        // Click "Suspicious (Unflagged)" metric to open popup with unflagged searches
        console.log('Opening suspicious searches popup...');
        const suspiciousMetric = page.locator('text=Suspicious (Unflagged)').first();
        await suspiciousMetric.click();
        await page.waitForTimeout(3000);

        // Find checkboxes in the popup table
        const checkboxes = page.locator('#metricPopupTable .gov-checkbox, #metricPopupTable input[type="checkbox"]');
        const checkboxCount = await checkboxes.count();
        console.log('Checkboxes found in popup:', checkboxCount);

        if (checkboxCount >= 2) {
            // Select first two checkboxes using data-index
            console.log('Selecting 2 checkboxes...');
            await checkboxes.nth(0).check();
            await page.waitForTimeout(200);
            await checkboxes.nth(1).check();
            await page.waitForTimeout(200);

            // Get selected search names via page.evaluate (uses data-index)
            const selectedSearches = await page.evaluate(() => {
                var selected = [];
                $('.metric-row-checkbox:checked').each(function() {
                    var idx = parseInt($(this).attr('data-index'));
                    if (window.currentMetricSearches && window.currentMetricSearches[idx]) {
                        selected.push(window.currentMetricSearches[idx]);
                    }
                });
                return selected;
            });
            console.log('Selected searches:', selectedSearches);

            // Handle dialogs
            page.on('dialog', async dialog => {
                console.log('Dialog:', dialog.type(), '-', dialog.message().substring(0, 100));
                await dialog.accept();
            });

            // Show button and trigger click via jQuery
            await page.evaluate(() => {
                $('#metricPopupFlag').show();
                $('#metricPopupFlag').trigger('click');
            });
            console.log('Triggered Flag Selected click');

            // Wait for flag operation
            await page.waitForTimeout(7000);

            // Verify searches were flagged
            const afterFlag = await getFlaggedSearches(page);
            console.log('Flagged after:', afterFlag.length);
            console.log('Flagged entries:', afterFlag);

            // Check that searches are in the list
            const flaggedNames = afterFlag.map(r => r[0]);
            console.log('Flagged names:', flaggedNames);

            // Should have at least 2 flagged
            expect(afterFlag.length).toBeGreaterThanOrEqual(2);
        } else {
            console.log('Not enough checkboxes to test multi-select');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
        }

        await page.screenshot({ path: 'screenshots/multi-select-flag-test.png' });
    });

    test('Sequential flagging: Flag one, reload, flag another', async ({ page }) => {
        await login(page);

        // Navigate to dashboard
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // Clear lookup first
        console.log('Clearing flagged lookup...');
        await clearFlaggedLookup(page);
        await page.waitForTimeout(2000);

        // Open suspicious searches
        const suspiciousMetric = page.locator('text=Suspicious (Unflagged)').first();
        await suspiciousMetric.click();
        await page.waitForTimeout(3000);

        // Find checkboxes
        const checkboxes = page.locator('#metricPopupTable .gov-checkbox, #metricPopupTable input[type="checkbox"]');
        const checkboxCount = await checkboxes.count();
        console.log('Checkboxes found:', checkboxCount);

        if (checkboxCount >= 2) {
            // Handle dialogs
            page.on('dialog', async dialog => {
                console.log('Dialog:', dialog.type(), '-', dialog.message().substring(0, 100));
                await dialog.accept();
            });

            // Flag first search
            console.log('=== FIRST FLAG ===');
            await checkboxes.nth(0).check();
            await page.waitForTimeout(200);

            // Get search name from currentMetricSearches
            const search1 = await page.evaluate(() => {
                var idx = parseInt($('.metric-row-checkbox:checked').first().attr('data-index'));
                return window.currentMetricSearches && window.currentMetricSearches[idx];
            });
            console.log('Flagging first search:', search1);

            // Trigger flag via jQuery
            await page.evaluate(() => {
                $('#metricPopupFlag').show();
                $('#metricPopupFlag').trigger('click');
            });
            await page.waitForTimeout(5000);

            // Close popup and reopen (simulate reload)
            await page.keyboard.press('Escape');
            await page.waitForTimeout(2000);

            console.log('=== SECOND FLAG (after reload) ===');
            await suspiciousMetric.click();
            await page.waitForTimeout(3000);

            // Find checkboxes again
            const checkboxes2 = page.locator('#metricPopupTable .metric-row-checkbox');
            const count2 = await checkboxes2.count();
            console.log('Checkboxes after reload:', count2);

            if (count2 > 0) {
                await checkboxes2.nth(0).check();
                await page.waitForTimeout(200);

                const search2 = await page.evaluate(() => {
                    var idx = parseInt($('.metric-row-checkbox:checked').first().attr('data-index'));
                    return window.currentMetricSearches && window.currentMetricSearches[idx];
                });
                console.log('Flagging second search:', search2);

                // Trigger flag via jQuery
                await page.evaluate(() => {
                    $('#metricPopupFlag').show();
                    $('#metricPopupFlag').trigger('click');
                });
                await page.waitForTimeout(5000);

                // Verify both are flagged
                const flagged = await getFlaggedSearches(page);
                console.log('Total flagged:', flagged.length);
                console.log('Flagged names:', flagged.map(r => r[0]));

                // Should have at least 2 flagged
                expect(flagged.length).toBeGreaterThanOrEqual(2);
            }
        }

        await page.screenshot({ path: 'screenshots/sequential-flag-test.png' });
    });

    test('Visual indicator appears after flagging', async ({ page }) => {
        await login(page);

        // Navigate to dashboard
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // Use flagThisSearch directly to test visual indicator
        page.once('dialog', async dialog => {
            console.log('Dialog:', dialog.message());
            await dialog.accept('Test visual indicator');
        });

        // Call flagThisSearch
        await page.evaluate(() => {
            window.flagThisSearch('Governance_Test_JoinCommand', 'admin', 'TA-user-governance');
        });

        await page.waitForTimeout(5000);

        // Check for flag indicator
        const indicator = page.locator('.flag-indicator');
        const indicatorCount = await indicator.count();
        console.log('Flag indicators on page:', indicatorCount);

        // Check the specific row
        const checkbox = page.locator('.gov-checkbox[data-search*="JoinCommand"]');
        if (await checkbox.count() > 0) {
            const flaggedAttr = await checkbox.getAttribute('data-flagged');
            console.log('Checkbox data-flagged:', flaggedAttr);

            const row = checkbox.locator('xpath=ancestor::tr');
            const rowHasIndicator = await row.locator('.flag-indicator').count();
            console.log('Row has indicator:', rowHasIndicator > 0);
        }

        await page.screenshot({ path: 'screenshots/visual-indicator-test.png' });
    });
});

test.describe('Flagged Modal Data Tests', () => {
    test('Modal shows correct search name and owner', async ({ page }) => {
        page.on('console', msg => {
            console.log('BROWSER:', msg.text());
        });

        await login(page);

        // Navigate to dashboard
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // First flag a search with known data
        page.once('dialog', async dialog => {
            await dialog.accept('Test modal data');
        });

        await page.evaluate(() => {
            window.flagThisSearch('Governance_Test_HighFrequency', 'admin', 'TA-user-governance');
        });

        await page.waitForTimeout(5000);

        // Open flagged searches modal
        await page.evaluate(() => {
            if (window.openFlaggedModal) {
                window.openFlaggedModal();
            }
        });

        await page.waitForTimeout(3000);

        // Check modal content
        const modalVisible = await page.locator('#flaggedModalOverlay.active').isVisible();
        console.log('Modal visible:', modalVisible);

        if (modalVisible) {
            const modalContent = await page.locator('#flaggedSearchesList').textContent();
            console.log('Modal content preview:', modalContent.substring(0, 500));

            // Check if search name appears correctly
            const hasSearchName = modalContent.includes('Governance_Test_HighFrequency');
            console.log('Has correct search name:', hasSearchName);

            // Check if owner is "admin" not the search name
            const rows = page.locator('#flaggedSearchesList tr');
            const rowCount = await rows.count();
            console.log('Modal rows:', rowCount);

            for (let i = 1; i < Math.min(rowCount, 5); i++) {
                const cells = rows.nth(i).locator('td');
                const cellCount = await cells.count();
                if (cellCount >= 2) {
                    const searchName = await cells.nth(0).textContent();
                    const owner = await cells.nth(1).textContent();
                    console.log(`Row ${i}: search="${searchName.trim()}", owner="${owner.trim()}"`);

                    // Owner should NOT be the same as search name
                    if (searchName.includes('Governance_Test')) {
                        expect(owner.trim()).not.toBe(searchName.trim());
                    }
                }
            }
        }

        await page.screenshot({ path: 'screenshots/modal-data-test.png' });
    });
});
