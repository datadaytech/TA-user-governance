/**
 * Test multi-select batch flagging (verifies race condition fix)
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Multi-select batch flagging works correctly', async ({ page }) => {
    // Track console
    page.on('console', msg => {
        console.log('BROWSER:', msg.text());
    });

    // Login
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);

    // Navigate
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Clear lookup first
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

    // Open Suspicious popup
    console.log('=== Opening Suspicious Searches popup ===');
    await page.click('text=Suspicious (Unflagged)');
    await page.waitForTimeout(3000);

    // Verify popup opened
    const popupVisible = await page.locator('#metricPopupOverlay.active').isVisible();
    console.log('Popup visible:', popupVisible);

    // Log current metric searches
    const metricsData = await page.evaluate(() => {
        return {
            currentMetricSearches: window.currentMetricSearches || [],
            selectedCount: $('.metric-row-checkbox:checked').length
        };
    });
    console.log('Current metric searches:', metricsData.currentMetricSearches.length);

    // Select checkboxes
    const checkboxes = page.locator('#metricPopupTable .metric-row-checkbox');
    const count = await checkboxes.count();
    console.log('Checkboxes found:', count);

    if (count >= 3) {
        // Select 3 checkboxes
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();
        await checkboxes.nth(2).check();
        console.log('Selected 3 checkboxes');

        // Verify selections
        const selectionsAfter = await page.evaluate(() => {
            var selected = [];
            $('.metric-row-checkbox:checked').each(function() {
                var idx = parseInt($(this).attr('data-index'));
                if (window.currentMetricSearches && window.currentMetricSearches[idx]) {
                    selected.push(window.currentMetricSearches[idx]);
                }
            });
            return selected;
        });
        console.log('Selected searches:', selectionsAfter);

        // Handle confirm dialogs
        page.on('dialog', async dialog => {
            console.log('Dialog:', dialog.type(), '-', dialog.message().substring(0, 100));
            await dialog.accept();
        });

        // Verify flag button exists and check visibility
        const flagBtnExists = await page.locator('#metricPopupFlag').count();
        const flagBtnHidden = await page.evaluate(() => $('#metricPopupFlag').css('display'));
        console.log('Flag button exists:', flagBtnExists, ', display:', flagBtnHidden);

        // Show button and click
        await page.evaluate(() => {
            $('#metricPopupFlag').show();
            console.log('Manually showed flag button');
        });

        await page.waitForTimeout(500);

        // Click using evaluate to ensure jQuery handler fires
        await page.evaluate(() => {
            $('#metricPopupFlag').trigger('click');
        });
        console.log('Triggered flag button click');

        // Wait for operation
        await page.waitForTimeout(7000);

        // Check flagged lookup
        console.log('=== Verifying flagged searches ===');
        const flagged = await page.evaluate(async () => {
            return new Promise((resolve) => {
                require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                    var search = new SearchManager({
                        id: 'check_' + Date.now(),
                        search: '| inputlookup flagged_searches_lookup | table search_name, status',
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

        console.log('Flagged count:', flagged.length);
        flagged.forEach(r => console.log('  -', r[0], ':', r[1]));

        // Should have exactly 3 flagged searches
        expect(flagged.length).toBe(3);

    } else {
        console.log('Not enough checkboxes to test');
    }

    await page.screenshot({ path: 'screenshots/multi-flag-batch-test.png' });
});
