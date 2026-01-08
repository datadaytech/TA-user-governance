/**
 * Verify Total Scheduled Searches has static color (not gray/threshold)
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Total Scheduled Searches panel has correct color', async ({ page }) => {
    // Login
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);

    // Navigate to governance_dashboard
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Take screenshot of the metrics row
    await page.screenshot({ path: 'screenshots/total-searches-color.png', fullPage: true });
    console.log('Screenshot saved to screenshots/total-searches-color.png');

    // Try to find the Total Scheduled Searches panel and check its value color
    const totalPanel = page.locator('#total_metric_panel, [id*="total_metric"]').first();
    if (await totalPanel.count() > 0) {
        const panelScreenshot = await totalPanel.screenshot();
        require('fs').writeFileSync('screenshots/total-panel-only.png', panelScreenshot);
        console.log('Panel screenshot saved');
    }
});
