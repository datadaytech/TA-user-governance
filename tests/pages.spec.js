// @ts-check
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test.describe('TA-user-governance Page Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Login to Splunk
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);

    // Wait for login form
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });

    // Fill credentials
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);

    // Submit login
    await page.click('input[type="submit"], button[type="submit"]');

    // Wait for redirect after login
    await page.waitForURL(/\/en-US\/app\//, { timeout: 15000 });
  });

  test('Scheduled Search Governance page loads (governance_dashboard)', async ({ page }) => {
    // Navigate to governance dashboard
    const response = await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);

    // Check HTTP status - should not be 404
    expect(response?.status()).not.toBe(404);

    // Wait for dashboard to load
    await page.waitForSelector('.dashboard-body, .dashboard-view-container', { timeout: 30000 });

    // Check for dashboard title
    const title = await page.locator('.dashboard-title, .dashboard-header-title, h1').first().textContent();
    expect(title?.toLowerCase()).toContain('governance');

    // Check for metric panels (single value visualizations)
    const panels = await page.locator('.dashboard-panel, .panel-body').count();
    expect(panels).toBeGreaterThan(0);

    console.log(`✓ governance_dashboard loaded with ${panels} panels`);
  });

  test('Governance Settings page loads (governance_settings)', async ({ page }) => {
    // Navigate to settings page
    const response = await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_settings`);

    // Check HTTP status - should not be 404
    expect(response?.status()).not.toBe(404);

    // Wait for dashboard to load
    await page.waitForSelector('.dashboard-body, .dashboard-view-container', { timeout: 30000 });

    // Check for input elements (settings page has inputs)
    const inputs = await page.locator('input, select, .splunk-dropdown').count();
    expect(inputs).toBeGreaterThan(0);

    console.log(`✓ governance_settings loaded with ${inputs} input elements`);
  });

  test('Cost Analysis page loads (cost_analysis)', async ({ page }) => {
    // Navigate to cost analysis page
    const response = await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/cost_analysis`);

    // Check HTTP status - should not be 404
    expect(response?.status()).not.toBe(404);

    // Wait for dashboard to load
    await page.waitForSelector('.dashboard-body, .dashboard-view-container', { timeout: 30000 });

    // Check for cost-related content
    const title = await page.locator('.dashboard-title, .dashboard-header-title, h1').first().textContent();
    expect(title?.toLowerCase()).toContain('cost');

    console.log(`✓ cost_analysis loaded`);
  });

  test('Dashboard Governance page loads (dashboard_governance)', async ({ page }) => {
    // Navigate to dashboard governance page
    const response = await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/dashboard_governance`);

    // Check HTTP status - should not be 404
    expect(response?.status()).not.toBe(404);

    // Wait for dashboard to load
    await page.waitForSelector('.dashboard-body, .dashboard-view-container', { timeout: 30000 });

    console.log(`✓ dashboard_governance loaded`);
  });

  test('Audit History page loads (audit_history)', async ({ page }) => {
    // Navigate to audit history page
    const response = await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/audit_history`);

    // Check HTTP status - should not be 404
    expect(response?.status()).not.toBe(404);

    // Wait for dashboard to load
    await page.waitForSelector('.dashboard-body, .dashboard-view-container', { timeout: 30000 });

    console.log(`✓ audit_history loaded`);
  });

  test('Navigation menu loads', async ({ page }) => {
    // Navigate to any page in the app
    const response = await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);

    // Check HTTP status
    expect(response?.status()).not.toBe(404);

    // Wait for dashboard to load (nav loads with it)
    await page.waitForSelector('.dashboard-body', { timeout: 30000 });

    // Check that we can see some navigation element
    const hasNav = await page.locator('.app-bar, nav, .shared-appbar').count();
    console.log(`✓ Navigation loaded (${hasNav} nav elements found)`);
  });
});

test.describe('Suspicious Searches Display', () => {

  test.beforeEach(async ({ page }) => {
    // Login to Splunk
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"], button[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//, { timeout: 15000 });
  });

  test('Suspicious searches panel shows data', async ({ page }) => {
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);

    // Wait for dashboard and panels to load
    await page.waitForSelector('.dashboard-body', { timeout: 30000 });

    // Wait for searches to complete (look for table content)
    await page.waitForTimeout(5000); // Give searches time to run

    // Check for suspicious searches table
    const tableRows = await page.locator('table tbody tr').count();
    console.log(`Found ${tableRows} table rows`);

    // Should have at least some data from our cache
    expect(tableRows).toBeGreaterThan(0);
  });

  test('Top metric panels display values', async ({ page }) => {
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);

    // Wait for dashboard to load
    await page.waitForSelector('.dashboard-body', { timeout: 30000 });

    // Wait for single value visualizations to render
    await page.waitForTimeout(5000);

    // Check for single value elements
    const singleValues = await page.locator('.single-result, .single-value, .viz-single-value').count();
    console.log(`Found ${singleValues} single value panels`);

    expect(singleValues).toBeGreaterThan(0);
  });
});
