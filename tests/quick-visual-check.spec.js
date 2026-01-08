const { test } = require('@playwright/test');
const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';

test('Visual check - take screenshot', async ({ page }) => {
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'changeme123');
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
    
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(8000);
    
    await page.screenshot({ path: 'screenshots/visual-check-after-revert.png', fullPage: true });
    console.log('Screenshot saved');
});
