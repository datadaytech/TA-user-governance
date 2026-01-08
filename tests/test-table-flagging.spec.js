/**
 * Test table flagging functionality
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Table flagging - Flag from All Scheduled Searches panel', async ({ page }) => {
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

    // Refresh to reload the table
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Select "Suspicious Only" filter
    console.log('=== Selecting Suspicious Only filter ===');
    const viewFilter = page.locator('select[data-test="dropdown"]').filter({ hasText: /All Searches|Suspicious Only/ }).first();
    if (await viewFilter.count() > 0) {
        await viewFilter.selectOption({ label: 'Suspicious Only' });
        await page.waitForTimeout(3000);
    } else {
        // Try alternative approach via dropdown
        await page.locator('text=View').first().click();
        await page.waitForTimeout(500);
        await page.locator('text=Suspicious Only').first().click();
        await page.waitForTimeout(3000);
    }

    // Find checkboxes in All Scheduled Searches table
    console.log('=== Finding checkboxes in table ===');
    const tableCheckboxes = page.locator('#all_searches_table .gov-checkbox, .dashboard-panel:has-text("All Scheduled Searches") .gov-checkbox');
    const checkboxCount = await tableCheckboxes.count();
    console.log('Table checkboxes found:', checkboxCount);

    if (checkboxCount >= 1) {
        // Select first checkbox
        await tableCheckboxes.nth(0).check();
        await page.waitForTimeout(500);

        // Get the search info
        const searchInfo = await page.evaluate(() => {
            var checked = $('.gov-checkbox:checked').first();
            return {
                searchName: checked.attr('data-search'),
                owner: checked.attr('data-owner'),
                flagged: checked.attr('data-flagged')
            };
        });
        console.log('Selected search:', searchInfo);

        // Click Flag Selected button
        console.log('=== Clicking Flag Selected button ===');
        await page.evaluate(() => {
            $('#flag-btn-2').trigger('click');
        });

        await page.waitForTimeout(5000);

        // Verify flagged
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

        expect(flagged.length).toBeGreaterThanOrEqual(1);
    } else {
        console.log('No checkboxes found in table');
    }

    await page.screenshot({ path: 'screenshots/table-flagging-test.png' });
});

test('Table status dropdown shows correct options', async ({ page }) => {
    // Track console
    page.on('console', msg => {
        if (msg.text().includes('status') || msg.text().includes('dropdown')) {
            console.log('BROWSER:', msg.text());
        }
    });

    // Login
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);

    // Navigate to dashboard
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Find a status dropdown in the table
    console.log('=== Looking for status dropdowns ===');
    const statusDropdowns = page.locator('.status-dropdown-wrapper');
    const dropdownCount = await statusDropdowns.count();
    console.log('Status dropdowns found:', dropdownCount);

    if (dropdownCount >= 1) {
        // Click the first dropdown
        const firstDropdown = statusDropdowns.first();
        const currentStatus = await firstDropdown.getAttribute('data-current-status');
        console.log('First dropdown status:', currentStatus);

        await firstDropdown.click();
        await page.waitForTimeout(500);

        // Check what options are shown
        const options = await page.evaluate(() => {
            return $('.status-dropdown-menu .status-option').map(function() {
                return $(this).text().trim();
            }).get();
        });
        console.log('Options shown:', options);

        // For suspicious/ok status, should only show "Flag for Review"
        if (currentStatus && (currentStatus.toLowerCase() === 'suspicious' || currentStatus.toLowerCase() === 'ok')) {
            expect(options.length).toBe(1);
            expect(options[0]).toContain('Flag');
        } else if (currentStatus && currentStatus.toLowerCase().includes('flagged')) {
            // For flagged status, should show multiple options
            expect(options.length).toBeGreaterThan(1);
        }

        // Close dropdown
        await page.keyboard.press('Escape');
    }

    await page.screenshot({ path: 'screenshots/status-dropdown-test.png' });
});
