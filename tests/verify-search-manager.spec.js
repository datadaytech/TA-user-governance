/**
 * Verify search manager returns data
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Verify search manager returns suspicious searches', async ({ page }) => {
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
    await page.waitForTimeout(5000);
    console.log('Page loaded');

    // Run a search using page's search manager
    const searchResults = await page.evaluate(async () => {
        return new Promise((resolve) => {
            require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                var search = new SearchManager({
                    id: 'test_suspicious_' + Date.now(),
                    search: '| inputlookup governance_search_cache.csv | search is_suspicious=1 disabled=0 | table title, owner, suspicious_reason | head 10',
                    earliest_time: '-24h',
                    latest_time: 'now',
                    autostart: true
                });

                search.on('search:error', function(err) {
                    console.log('Search error:', err);
                    resolve({ error: err.toString() });
                });

                search.on('search:done', function(state) {
                    console.log('Search done, state:', state);
                    var results = search.data('results');
                    if (results) {
                        results.on('data', function() {
                            var data = results.data();
                            console.log('Results data:', JSON.stringify(data));
                            resolve({
                                rows: data.rows || [],
                                fields: data.fields || []
                            });
                        });
                    } else {
                        console.log('No results object');
                        resolve({ rows: [], fields: [] });
                    }
                });

                setTimeout(() => {
                    console.log('Timeout waiting for search');
                    resolve({ timeout: true });
                }, 15000);
            });
        });
    });

    console.log('\n=== Search Results ===');
    console.log('Result object:', JSON.stringify(searchResults, null, 2));

    if (searchResults.rows) {
        console.log('Row count:', searchResults.rows.length);
        searchResults.rows.forEach((row, i) => {
            console.log(`Row ${i}:`, row);
        });
    }

    // Now check the actual dashboard table content
    await page.waitForTimeout(5000);

    const tbodyRows = await page.locator('#suspicious_searches_table tbody tr').count();
    console.log('\nActual table tbody rows:', tbodyRows);

    expect(searchResults.rows.length).toBeGreaterThan(0);
});
