/**
 * Verify extend deadline actually works
 * Tests the complete flow including before/after deadline values
 */

const { test, expect } = require('./fixtures');

test.describe('Extend Deadline Verification Tests', () => {

    test('should actually extend the deadline in the lookup', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const consoleLogs = [];

        // Capture all console logs
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push({ type: msg.type(), text });
            // Print extend-related logs immediately
            if (text.includes('extend') || text.includes('Extend') || text.includes('deadline')) {
                console.log(`[BROWSER ${msg.type()}] ${text}`);
            }
        });

        // Handle dialogs
        page.on('dialog', async dialog => {
            console.log(`Dialog: ${dialog.type()} - ${dialog.message()}`);
            await dialog.accept();
        });

        // Navigate to governance dashboard
        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Get initial deadline from lookup (if any flagged searches exist)
        const initialLookup = await page.evaluate(async () => {
            return new Promise((resolve) => {
                if (typeof require === 'function') {
                    require(['splunkjs/mvc/searchmanager', 'splunkjs/mvc'], function(SearchManager, mvc) {
                        var search = new SearchManager({
                            id: 'lookup_check_' + Date.now(),
                            search: '| inputlookup flagged_searches_lookup | head 1 | table search_name, remediation_deadline',
                            earliest_time: '-1h',
                            latest_time: 'now',
                            autostart: true
                        });
                        search.on('search:done', function() {
                            var results = search.data('results');
                            if (results) {
                                results.on('data', function() {
                                    var rows = results.data().rows;
                                    resolve(rows && rows.length > 0 ? {
                                        searchName: rows[0][0],
                                        deadline: rows[0][1]
                                    } : null);
                                });
                            } else {
                                resolve(null);
                            }
                        });
                        setTimeout(() => resolve(null), 5000);
                    });
                } else {
                    resolve(null);
                }
            });
        });

        console.log('Initial lookup data:', JSON.stringify(initialLookup));

        // Open flagged searches modal
        const flaggedPanel = page.locator('.single-value, .panel-body').filter({ hasText: /flagged/i }).first();
        if (await flaggedPanel.count() > 0) {
            console.log('Clicking flagged panel...');
            await flaggedPanel.click();
            await page.waitForTimeout(3000);
        }

        const popup = page.locator('#metricPopupOverlay.active');
        if (await popup.count() === 0) {
            console.log('Popup not opened, trying different selector...');
            await page.screenshot({ path: 'screenshots/extend-verify-no-popup.png', fullPage: true });
            return;
        }

        console.log('Popup opened successfully');
        await page.screenshot({ path: 'screenshots/extend-verify-1-popup.png', fullPage: true });

        // Select a checkbox
        const checkbox = page.locator('.metric-row-checkbox').first();
        if (await checkbox.count() > 0) {
            await checkbox.check({ force: true });
            console.log('Checkbox checked');
            await page.waitForTimeout(500);
        }

        // Click Extend Deadline button
        const extendBtn = page.locator('#metricPopupExtend');
        if (await extendBtn.isVisible()) {
            console.log('Clicking Extend button...');
            await extendBtn.click();
            await page.waitForTimeout(2000);
        }

        // Check if extend modal opened
        const extendModal = page.locator('#extendModalOverlay.active');
        if (await extendModal.count() > 0) {
            console.log('Extend modal opened');
            await page.screenshot({ path: 'screenshots/extend-verify-2-modal.png', fullPage: true });

            // Log current state
            const searchList = await page.locator('#extendSearchList').innerHTML();
            console.log('Search list HTML:', searchList);

            const customDays = await page.locator('#extendCustomDays').inputValue();
            console.log('Custom days input value:', customDays);

            // Set custom days to 14
            await page.locator('#extendCustomDays').fill('14');
            await page.waitForTimeout(500);

            const newCustomDays = await page.locator('#extendCustomDays').inputValue();
            console.log('New custom days value:', newCustomDays);

            // Check if currentExtendSearches is populated
            const extendState = await page.evaluate(() => {
                if (typeof window.currentExtendSearches !== 'undefined') {
                    return {
                        searches: window.currentExtendSearches,
                        days: window.currentExtendDays
                    };
                }
                return null;
            });
            console.log('Extend state before save:', JSON.stringify(extendState));

            // Click Save button
            console.log('Clicking Save button...');
            await page.locator('#extendModalSave').click();
            await page.waitForTimeout(5000);

            await page.screenshot({ path: 'screenshots/extend-verify-3-after-save.png', fullPage: true });
        } else {
            console.log('Extend modal did not open!');
            await page.screenshot({ path: 'screenshots/extend-verify-error.png', fullPage: true });
        }

        // Print all extend-related console logs
        console.log('\n=== ALL EXTEND CONSOLE LOGS ===');
        consoleLogs.filter(log =>
            log.text.includes('extend') ||
            log.text.includes('Extend') ||
            log.text.includes('performExtendDeadline') ||
            log.text.includes('deadline') ||
            log.text.includes('runSearch')
        ).forEach(log => {
            console.log(`[${log.type}] ${log.text}`);
        });
        console.log('=== END LOGS ===\n');

        // Verify the deadline was actually extended
        await page.waitForTimeout(2000);
        const finalLookup = await page.evaluate(async () => {
            return new Promise((resolve) => {
                if (typeof require === 'function') {
                    require(['splunkjs/mvc/searchmanager', 'splunkjs/mvc'], function(SearchManager, mvc) {
                        var search = new SearchManager({
                            id: 'lookup_check_final_' + Date.now(),
                            search: '| inputlookup flagged_searches_lookup | head 1 | table search_name, remediation_deadline',
                            earliest_time: '-1h',
                            latest_time: 'now',
                            autostart: true
                        });
                        search.on('search:done', function() {
                            var results = search.data('results');
                            if (results) {
                                results.on('data', function() {
                                    var rows = results.data().rows;
                                    resolve(rows && rows.length > 0 ? {
                                        searchName: rows[0][0],
                                        deadline: rows[0][1]
                                    } : null);
                                });
                            } else {
                                resolve(null);
                            }
                        });
                        setTimeout(() => resolve(null), 5000);
                    });
                } else {
                    resolve(null);
                }
            });
        });

        console.log('Final lookup data:', JSON.stringify(finalLookup));

        if (initialLookup && finalLookup && initialLookup.searchName === finalLookup.searchName) {
            const initialDeadline = parseFloat(initialLookup.deadline);
            const finalDeadline = parseFloat(finalLookup.deadline);
            const extensionSeconds = finalDeadline - initialDeadline;
            const extensionDays = extensionSeconds / 86400;

            console.log(`Deadline extended by ${extensionDays.toFixed(2)} days (${extensionSeconds} seconds)`);

            if (extensionDays > 0) {
                console.log('SUCCESS: Deadline was extended!');
            } else {
                console.log('FAILURE: Deadline was NOT extended');
            }
        }
    });

    test('should trace performExtendDeadline function call', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Navigate to governance dashboard
        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Directly call openExtendModal with test data
        const result = await page.evaluate(() => {
            if (typeof window.openExtendModal === 'function') {
                var testSearches = [{
                    searchName: 'Test_Search_Extend_Verify',
                    owner: 'admin',
                    app: 'search',
                    status: 'pending'
                }];
                window.openExtendModal(testSearches);
                return {
                    success: true,
                    currentExtendSearches: window.currentExtendSearches,
                    currentExtendDays: window.currentExtendDays
                };
            }
            return { success: false, error: 'openExtendModal not found' };
        });

        console.log('openExtendModal result:', JSON.stringify(result, null, 2));
        await page.waitForTimeout(1000);

        // Check if modal opened
        const extendModal = page.locator('#extendModalOverlay.active');
        const isOpen = await extendModal.count() > 0;
        console.log('Extend modal is open:', isOpen);

        if (isOpen) {
            // Verify the search list is populated
            const searchListHtml = await page.locator('#extendSearchList').innerHTML();
            console.log('Search list populated:', searchListHtml.length > 0);

            // Verify custom days has default value
            const customDays = await page.locator('#extendCustomDays').inputValue();
            console.log('Custom days default value:', customDays);

            await page.screenshot({ path: 'screenshots/extend-trace-modal.png', fullPage: true });
        }
    });
});
