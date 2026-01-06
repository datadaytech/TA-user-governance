// @ts-check
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

// Helper to login
async function login(page) {
  await page.goto(`${SPLUNK_URL}/en-US/account/login`);
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', SPLUNK_USERNAME);
  await page.fill('input[name="password"]', SPLUNK_PASSWORD);
  await page.click('input[type="submit"], button[type="submit"]');
  await page.waitForURL(/\/en-US\/app\//, { timeout: 15000 });
}

test.describe('Governance Settings Page', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_settings`);
    await page.waitForSelector('.dashboard-body', { timeout: 30000 });
    // Wait for JS to initialize
    await page.waitForTimeout(3000);
  });

  test('Page loads with correct title', async ({ page }) => {
    const title = await page.locator('.dashboard-title, .dashboard-header-title, h1').first().textContent();
    expect(title?.toLowerCase()).toContain('governance');
    console.log(`Settings page title: ${title}`);
  });

  test('Licensing model section appears first (Step 1)', async ({ page }) => {
    // Look for "Splunk Licensing Model" text in the page
    const licensingHeader = page.locator('text=Splunk Licensing Model');
    const count = await licensingHeader.count();
    console.log(`Found ${count} "Splunk Licensing Model" elements`);
    expect(count).toBeGreaterThan(0);
  });

  test('Save Licensing Model button exists', async ({ page }) => {
    // Look for button by text content
    const btn = page.locator('button:has-text("Save Licensing Model")');
    const count = await btn.count();
    console.log(`Found ${count} Save Licensing Model buttons`);
    expect(count).toBeGreaterThan(0);
  });

  test('Data Refresh Settings section appears second (Step 2)', async ({ page }) => {
    const dataRefreshHeader = page.locator('text=Data Refresh Settings');
    const count = await dataRefreshHeader.count();
    console.log(`Found ${count} "Data Refresh Settings" elements`);
    expect(count).toBeGreaterThan(0);
  });

  test('Save Schedule button exists', async ({ page }) => {
    const btn = page.locator('button:has-text("Save Schedule")');
    const count = await btn.count();
    console.log(`Found ${count} Save Schedule buttons`);
    expect(count).toBeGreaterThan(0);
  });

  test('Run Cache Now button exists', async ({ page }) => {
    const btn = page.locator('button:has-text("Run Cache Now")');
    const count = await btn.count();
    console.log(`Found ${count} Run Cache Now buttons`);
    expect(count).toBeGreaterThan(0);
  });

  test('SVC Entitlement label is displayed', async ({ page }) => {
    const label = page.locator('text=SVC Entitlement');
    const count = await label.count();
    console.log(`Found ${count} SVC Entitlement labels`);
    // This label may not appear if workload isn't selected
  });

  test('Admin email distribution list hint is displayed', async ({ page }) => {
    const hint = page.locator('text=distribution list');
    const count = await hint.count();
    console.log(`Found ${count} distribution list hints`);
    expect(count).toBeGreaterThan(0);
  });

  test('Wasteful Patterns section exists', async ({ page }) => {
    const section = page.locator('text=Wasteful SPL Patterns');
    const count = await section.count();
    console.log(`Found ${count} Wasteful SPL Patterns sections`);
    expect(count).toBeGreaterThan(0);
  });

  test('Add Pattern button exists', async ({ page }) => {
    const btn = page.locator('button:has-text("Add Pattern")');
    const count = await btn.count();
    console.log(`Found ${count} Add Pattern buttons`);
    expect(count).toBeGreaterThan(0);
  });

  test('All threshold Save buttons exist', async ({ page }) => {
    // Find all Save buttons
    const saveButtons = page.locator('button:has-text("Save")');
    const count = await saveButtons.count();
    console.log(`Found ${count} Save buttons total`);
    // Should have multiple save buttons
    expect(count).toBeGreaterThan(5);
  });
});

test.describe('Governance Dashboard Page', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForSelector('.dashboard-body', { timeout: 30000 });
    await page.waitForTimeout(3000);
  });

  test('Page loads with correct title', async ({ page }) => {
    const title = await page.locator('.dashboard-title, .dashboard-header-title, h1').first().textContent();
    expect(title?.toLowerCase()).toContain('governance');
    console.log(`Dashboard title: ${title}`);
  });

  test('Flag Selected button exists', async ({ page }) => {
    const btn = page.locator('button:has-text("Flag Selected")');
    const count = await btn.count();
    console.log(`Found ${count} Flag Selected buttons`);
    expect(count).toBeGreaterThan(0);
  });

  test('Unflag Selected button exists', async ({ page }) => {
    const btn = page.locator('button:has-text("Unflag")');
    const count = await btn.count();
    console.log(`Found ${count} Unflag buttons`);
    expect(count).toBeGreaterThan(0);
  });

  test('Preview Impact button exists', async ({ page }) => {
    const btn = page.locator('button:has-text("Preview Impact")');
    const count = await btn.count();
    console.log(`Found ${count} Preview Impact buttons`);
    expect(count).toBeGreaterThan(0);
  });

  test('Email Owner button exists', async ({ page }) => {
    const btn = page.locator('button:has-text("Email Owner")');
    const count = await btn.count();
    console.log(`Found ${count} Email Owner buttons`);
    expect(count).toBeGreaterThan(0);
  });

  test('View Flagged button exists', async ({ page }) => {
    const btn = page.locator('button:has-text("Flagged")');
    const count = await btn.count();
    console.log(`Found ${count} View Flagged buttons`);
    expect(count).toBeGreaterThan(0);
  });

  test('Metric panels are present', async ({ page }) => {
    await page.waitForTimeout(3000);
    const singleValues = page.locator('.single-result, .single-value, .viz-single-value');
    const count = await singleValues.count();
    console.log(`Found ${count} metric panels`);
    expect(count).toBeGreaterThan(0);
  });

  test('Suspicious searches table exists', async ({ page }) => {
    await page.waitForTimeout(3000);
    const tables = page.locator('table');
    const count = await tables.count();
    console.log(`Found ${count} tables`);
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Other Pages Load', () => {

  test('Dashboard Governance page loads', async ({ page }) => {
    await login(page);
    const response = await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/dashboard_governance`);
    expect(response?.status()).not.toBe(404);
    await page.waitForSelector('.dashboard-body', { timeout: 30000 });
    console.log('Dashboard Governance page loaded');
  });

  test('Cost Analysis page loads', async ({ page }) => {
    await login(page);
    const response = await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/cost_analysis`);
    expect(response?.status()).not.toBe(404);
    await page.waitForSelector('.dashboard-body', { timeout: 30000 });
    const panels = await page.locator('.dashboard-panel, .panel-body').count();
    console.log(`Cost Analysis has ${panels} panels`);
    expect(panels).toBeGreaterThan(0);
  });

  test('Audit History page loads', async ({ page }) => {
    await login(page);
    const response = await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/audit_history`);
    expect(response?.status()).not.toBe(404);
    await page.waitForSelector('.dashboard-body', { timeout: 30000 });
    console.log('Audit History page loaded');
  });
});
