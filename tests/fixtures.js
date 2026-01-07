const { test: base, expect } = require('@playwright/test');

// Splunk credentials - configurable via environment variables
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

/**
 * Extended test fixture with Splunk authentication
 */
const test = base.extend({
  // Authenticated page fixture
  authenticatedPage: async ({ page }, use) => {
    // Go to login page directly
    await page.goto('/en-US/account/login', { waitUntil: 'networkidle' });

    // Check if we're on the login page
    const usernameField = page.locator('input[name="username"]');
    const isLoginPage = await usernameField.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLoginPage) {
      console.log('Logging in to Splunk...');

      // Fill in credentials
      await usernameField.fill(SPLUNK_USERNAME);
      await page.locator('input[name="password"]').fill(SPLUNK_PASSWORD);

      // Click Sign In button specifically
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for navigation to complete
      await page.waitForURL(/.*\/app\/.*|.*\/en-US\/app\/.*/, { timeout: 30000 });

      console.log('Login successful');
    } else {
      console.log('Already logged in or different page');
    }

    // Use the authenticated page
    await use(page);
  },

  // Governance dashboard page fixture
  governancePage: async ({ authenticatedPage }, use) => {
    const page = authenticatedPage;

    console.log('Navigating to governance dashboard...');

    // Navigate to scheduled search governance dashboard
    await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for dashboard body to appear
    await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });

    // Wait for JavaScript to load and enhance tables
    await page.waitForTimeout(5000);

    console.log('Dashboard loaded');

    await use(page);
  },
});

module.exports = { test, expect };
