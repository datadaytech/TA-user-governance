/**
 * Check table HTML content
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Check table HTML', async ({ page }) => {
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

    // Wait for suspicious panel to be visible
    console.log('Waiting for panel...');
    await page.waitForSelector('#suspicious_searches_table', { timeout: 20000 });

    // Wait for data loading - look for the search completion
    console.log('Waiting 20 seconds for data...');
    await page.waitForTimeout(20000);

    // Get the panel HTML
    const panelHtml = await page.locator('#suspicious_searches_table').innerHTML();
    console.log('Panel HTML length:', panelHtml.length);
    console.log('Panel HTML preview:', panelHtml.substring(0, 500));

    // Check for table elements
    const tableCount = await page.locator('#suspicious_searches_table table').count();
    console.log('Tables in panel:', tableCount);

    const theadCount = await page.locator('#suspicious_searches_table thead').count();
    console.log('Theads in panel:', theadCount);

    const tbodyCount = await page.locator('#suspicious_searches_table tbody').count();
    console.log('Tbodys in panel:', tbodyCount);

    const trCount = await page.locator('#suspicious_searches_table tbody tr').count();
    console.log('TRs in tbody:', trCount);

    // Check for "no results" message
    const noResults = await page.locator('#suspicious_searches_table .msg-text').count();
    console.log('No results message count:', noResults);

    if (noResults > 0) {
        const msgText = await page.locator('#suspicious_searches_table .msg-text').first().textContent();
        console.log('Message text:', msgText);
    }

    // Check for shared-waitspinner
    const spinner = await page.locator('#suspicious_searches_table .shared-waitspinner').count();
    console.log('Spinner count:', spinner);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/check-table-html.png', fullPage: true });
});
