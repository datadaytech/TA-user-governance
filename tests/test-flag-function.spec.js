/**
 * Test the flagThisSearch function directly
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Test flagThisSearch function directly', async ({ page }) => {
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

    // Navigate to governance_dashboard (to load governance.js)
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    console.log('Dashboard loaded');

    // First, check what's currently in the flagged lookup
    console.log('\n=== Step 1: Check current flagged searches ===');
    const beforeFlag = await page.evaluate(async () => {
        return new Promise((resolve) => {
            require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                var search = new SearchManager({
                    id: 'check_before_' + Date.now(),
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
    console.log('Flagged searches before:', beforeFlag);

    // Check if JoinCommand is already flagged
    const alreadyFlagged = beforeFlag.some(row => row[0] && row[0].includes('JoinCommand'));
    console.log('JoinCommand already flagged:', alreadyFlagged);

    if (alreadyFlagged) {
        console.log('JoinCommand already flagged, removing it first...');
        // Remove it from lookup
        await page.evaluate(async () => {
            return new Promise((resolve) => {
                require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                    var search = new SearchManager({
                        id: 'remove_join_' + Date.now(),
                        search: '| inputlookup flagged_searches_lookup | search search_name!="Governance_Test_JoinCommand" | outputlookup flagged_searches_lookup',
                        earliest_time: '-1h',
                        latest_time: 'now',
                        autostart: true
                    });
                    search.on('search:done', function() {
                        resolve(true);
                    });
                    setTimeout(() => resolve(false), 10000);
                });
            });
        });
        await page.waitForTimeout(2000);
    }

    // Step 2: Set up prompt handler BEFORE calling flagThisSearch
    console.log('\n=== Step 2: Call flagThisSearch function ===');

    page.once('dialog', async dialog => {
        console.log('Dialog appeared:', dialog.type(), dialog.message());
        await dialog.accept('Testing flag via automated test');
    });

    // Call flagThisSearch
    await page.evaluate(() => {
        window.flagThisSearch('Governance_Test_JoinCommand', 'admin', 'TA-user-governance');
    });

    // Step 3: Wait for the operation to complete
    console.log('\n=== Step 3: Wait for flag operation to complete ===');
    await page.waitForTimeout(7000);

    // Step 4: Verify the lookup was updated
    console.log('\n=== Step 4: Verify flagged searches after ===');
    const afterFlag = await page.evaluate(async () => {
        return new Promise((resolve) => {
            require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                var search = new SearchManager({
                    id: 'check_after_' + Date.now(),
                    search: '| inputlookup flagged_searches_lookup | table search_name, status, reason',
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
    console.log('Flagged searches after:');
    afterFlag.forEach(row => {
        console.log(' -', row);
    });

    // Verify JoinCommand is now flagged
    const nowFlagged = afterFlag.some(row => row[0] && row[0].includes('JoinCommand'));
    console.log('\nJoinCommand now flagged:', nowFlagged);

    // Count entries for JoinCommand (should be exactly 1)
    const joinCommandEntries = afterFlag.filter(row => row[0] && row[0].includes('JoinCommand'));
    console.log('JoinCommand entries count:', joinCommandEntries.length);

    if (joinCommandEntries.length === 1) {
        console.log('✓ JoinCommand flagged correctly with 1 entry');
    } else if (joinCommandEntries.length > 1) {
        console.log('✗ DUPLICATE entries detected!');
    } else {
        console.log('✗ JoinCommand NOT flagged!');
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/test-flag-function.png', fullPage: true });

    // Assertions
    expect(nowFlagged).toBe(true);
    expect(joinCommandEntries.length).toBe(1);
});

test('Test flagging again does not create duplicates', async ({ page }) => {
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

    // Navigate
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Check current state
    console.log('\n=== Check if JoinCommand is flagged ===');
    const beforeFlag = await page.evaluate(async () => {
        return new Promise((resolve) => {
            require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                var search = new SearchManager({
                    id: 'check_dup_before_' + Date.now(),
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

    const beforeCount = beforeFlag.filter(row => row[0] && row[0].includes('JoinCommand')).length;
    console.log('JoinCommand entries before second flag:', beforeCount);

    // Flag again
    console.log('\n=== Flag JoinCommand again ===');
    page.once('dialog', async dialog => {
        await dialog.accept('Second flag attempt');
    });

    await page.evaluate(() => {
        window.flagThisSearch('Governance_Test_JoinCommand', 'admin', 'TA-user-governance');
    });

    await page.waitForTimeout(7000);

    // Check after
    const afterFlag = await page.evaluate(async () => {
        return new Promise((resolve) => {
            require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                var search = new SearchManager({
                    id: 'check_dup_after_' + Date.now(),
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

    const afterCount = afterFlag.filter(row => row[0] && row[0].includes('JoinCommand')).length;
    console.log('JoinCommand entries after second flag:', afterCount);

    // Should still be exactly 1 entry
    if (afterCount === 1) {
        console.log('✓ No duplicates created - still 1 entry');
    } else {
        console.log('✗ DUPLICATES CREATED! Count:', afterCount);
    }

    expect(afterCount).toBe(1);
});
