const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Screenshot current dashboard state', async ({ page }) => {
    // Login
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
    
    // Go to dashboard
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(8000);
    
    // Full page screenshot
    await page.screenshot({ path: 'screenshots/current-dashboard-state.png', fullPage: true });
    
    // Scroll to table
    await page.evaluate(() => {
        const table = document.querySelector('.splunk-table, .dashboard-panel table');
        if (table) table.scrollIntoView();
    });
    await page.waitForTimeout(1000);
    
    // Table screenshot
    await page.screenshot({ path: 'screenshots/current-table-state.png' });
    
    console.log('Screenshots saved');
});
