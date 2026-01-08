/**
 * Debug flagging Governance_Test_JoinCommand
 */

const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Debug flagging Governance_Test_JoinCommand', async ({ page }) => {
    // Track all console logs
    page.on('console', msg => {
        console.log('BROWSER:', msg.text());
    });

    // Login
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
    console.log('Logged in');

    // Navigate to governance_dashboard
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(10000);

    // First, check current flagged searches
    console.log('\n=== Checking current flagged searches ===');
    const flaggedBefore = await page.evaluate(async () => {
        return new Promise((resolve) => {
            require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                var search = new SearchManager({
                    id: 'check_flagged_' + Date.now(),
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
                setTimeout(() => resolve([]), 5000);
            });
        });
    });
    console.log('Flagged searches before:', flaggedBefore);

    // Find the checkbox for Governance_Test_JoinCommand
    console.log('\n=== Looking for Governance_Test_JoinCommand ===');

    // Search for all checkboxes and find the one we want
    const allCheckboxes = await page.locator('.gov-checkbox').all();
    console.log('Total checkboxes:', allCheckboxes.length);

    let targetCheckbox = null;
    for (const cb of allCheckboxes) {
        const searchName = await cb.getAttribute('data-search');
        if (searchName && searchName.includes('JoinCommand')) {
            targetCheckbox = cb;
            console.log('Found checkbox for:', searchName);
            const isFlagged = await cb.getAttribute('data-flagged');
            console.log('  data-flagged:', isFlagged);
            break;
        }
    }

    if (!targetCheckbox) {
        // Try looking in the table directly
        console.log('Checkbox not found, searching table...');
        const tableRows = await page.locator('table tbody tr').all();
        for (const row of tableRows) {
            const text = await row.textContent();
            if (text.includes('JoinCommand')) {
                console.log('Found row with JoinCommand:', text.substring(0, 100));
                const checkbox = await row.locator('.gov-checkbox').first();
                if (await checkbox.count() > 0) {
                    targetCheckbox = checkbox;
                    const searchName = await checkbox.getAttribute('data-search');
                    console.log('Checkbox data-search:', searchName);
                }
                break;
            }
        }
    }

    if (!targetCheckbox) {
        console.log('ERROR: Could not find Governance_Test_JoinCommand checkbox');
        await page.screenshot({ path: 'screenshots/join-command-not-found.png' });
        return;
    }

    // Click the checkbox
    console.log('\n=== Clicking checkbox ===');
    await targetCheckbox.scrollIntoViewIfNeeded();
    await targetCheckbox.click();
    await page.waitForTimeout(500);

    const isChecked = await targetCheckbox.isChecked();
    console.log('Checkbox is checked:', isChecked);

    // Set up dialog handler
    page.once('dialog', async dialog => {
        console.log('Dialog appeared:', dialog.type(), dialog.message().substring(0, 100));
        await dialog.accept('Test flagging JoinCommand');
    });

    // Click Flag Selected button
    console.log('\n=== Clicking Flag Selected ===');
    const flagBtn = page.locator('#flag-selected-btn').first();
    await flagBtn.click();

    // Wait for the flag operation
    console.log('Waiting for flag operation...');
    await page.waitForTimeout(7000);

    // Check if flagged now
    console.log('\n=== Checking flagged searches after ===');
    const flaggedAfter = await page.evaluate(async () => {
        return new Promise((resolve) => {
            require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                var search = new SearchManager({
                    id: 'check_flagged_after_' + Date.now(),
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
                setTimeout(() => resolve([]), 5000);
            });
        });
    });
    console.log('Flagged searches after:', flaggedAfter);

    // Check visual indicator
    console.log('\n=== Checking visual indicator ===');
    const flagIndicators = await page.locator('.flag-indicator').count();
    console.log('Flag indicators on page:', flagIndicators);

    // Find the row again and check its state
    const checkboxAfter = page.locator('.gov-checkbox[data-search*="JoinCommand"]').first();
    if (await checkboxAfter.count() > 0) {
        const flaggedAttr = await checkboxAfter.getAttribute('data-flagged');
        console.log('Checkbox data-flagged after:', flaggedAttr);

        // Check for visual indicator in same row
        const row = checkboxAfter.locator('xpath=ancestor::tr');
        const indicator = await row.locator('.flag-indicator').count();
        console.log('Flag indicator in row:', indicator);
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/join-command-flag-debug.png' });
    console.log('\nScreenshot saved');
});
