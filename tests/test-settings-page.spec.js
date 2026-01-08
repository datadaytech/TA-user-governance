const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Test Governance Settings page loads', async ({ page }) => {
    // Track all failed requests
    const failedRequests = [];
    page.on('response', response => {
        if (response.status() >= 400) {
            failedRequests.push({
                url: response.url(),
                status: response.status(),
                statusText: response.statusText()
            });
        }
    });

    // Listen for console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER ERROR:', msg.text());
        }
    });

    // Login
    console.log('Logging in...');
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
    console.log('Logged in');

    // Navigate to governance settings
    console.log('Navigating to Governance Settings...');
    const response = await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_settings`);

    console.log('Response status:', response.status());
    console.log('Response URL:', response.url());

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Log failed requests
    console.log('\n=== Failed Requests ===');
    failedRequests.forEach(req => {
        console.log(`${req.status} ${req.statusText}: ${req.url}`);
    });

    // Check for dashboard content
    const pageTitle = await page.title();
    console.log('\nPage title:', pageTitle);

    // Check if dashboard loaded
    const hasLabel = await page.locator('text=Governance Settings').count();
    console.log('Has Governance Settings label:', hasLabel > 0);

    // Verify settings sections exist
    const settingsSections = await page.locator('text=Data Refresh Settings').count();
    console.log('Data Refresh Settings found:', settingsSections > 0);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/governance-settings-page.png' });
    console.log('\nScreenshot saved to screenshots/governance-settings-page.png');

    expect(response.status()).toBe(200);
    expect(hasLabel).toBeGreaterThan(0);
});
