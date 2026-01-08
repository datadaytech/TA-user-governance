/**
 * Quick check of dashboard state
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Quick dashboard check', async ({ page }) => {
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER ERROR:', msg.text());
        }
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
    console.log('Page loaded');

    // Wait longer
    await page.waitForTimeout(15000);

    // Check for any table elements
    const tables = await page.locator('table').count();
    console.log('Total tables on page:', tables);

    const tbodyRows = await page.locator('table tbody tr').count();
    console.log('Total tbody rows:', tbodyRows);

    // Check for dashboard content
    const panels = await page.locator('.dashboard-panel').count();
    console.log('Dashboard panels:', panels);

    // Check specifically for suspicious_searches_table
    const suspiciousTable = await page.locator('#suspicious_searches_table').count();
    console.log('Suspicious searches table found:', suspiciousTable);

    // Get all HTML class=fieldset to see what panels loaded
    const panelTitles = await page.locator('.panel-title').allTextContents();
    console.log('Panel titles:', panelTitles);

    // Screenshot
    await page.screenshot({ path: 'screenshots/quick-check-dashboard.png', fullPage: true });
    console.log('Screenshot saved');
});
