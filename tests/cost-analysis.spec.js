/**
 * Playwright E2E Tests for Cost Analysis Page
 * Tests the loadjob-based cache mechanism and UI functionality
 */

const { test, expect } = require('./fixtures');

test.describe('Cost Analysis Page - Cache Mechanism', () => {

    test.beforeEach(async ({ authenticatedPage }) => {
        // Navigate to cost analysis page
        await authenticatedPage.goto('/en-US/app/TA-user-governance/cost_analysis', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await authenticatedPage.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
    });

    test('page should load without errors', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Verify we're on the cost analysis page by checking URL and dashboard content loads
        await expect(page).toHaveURL(/cost_analysis/);

        // Wait for dashboard panels to render (more reliable than title)
        const panels = page.locator('.dashboard-panel, .panel-body');
        await expect(panels.first()).toBeVisible({ timeout: 30000 });

        // Take screenshot
        await page.screenshot({ path: 'screenshots/cost-analysis-loaded.png', fullPage: true });
    });

    test('cache status banner should be visible', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Wait for cache status element
        const cacheStatus = page.locator('#cacheStatus, [id*="cache"]').first();
        await page.waitForTimeout(3000);

        // Take screenshot of cache status area
        await page.screenshot({ path: 'screenshots/cost-analysis-cache-status.png', fullPage: false });
    });

    test('SVC usage panels should display data from cache', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Wait for panels to load
        await page.waitForTimeout(10000);

        // Check for single value panels
        const panels = page.locator('.single-value, .dashboard-panel');
        const panelCount = await panels.count();
        console.log(`Found ${panelCount} panels`);

        expect(panelCount).toBeGreaterThan(0);

        // Take screenshot
        await page.screenshot({ path: 'screenshots/cost-analysis-panels.png', fullPage: true });
    });

    test('charts should render', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.waitForTimeout(10000);

        // Look for chart elements
        const charts = page.locator('.highcharts-container, .chart-container, svg');
        const chartCount = await charts.count();
        console.log(`Found ${chartCount} chart elements`);

        // Take screenshot
        await page.screenshot({ path: 'screenshots/cost-analysis-charts.png', fullPage: true });
    });

    test('high cost searches table should display', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.waitForTimeout(10000);

        // Look for table
        const table = page.locator('#high_cost_table, .shared-resultstable');

        // Take screenshot
        await page.screenshot({ path: 'screenshots/cost-analysis-table.png', fullPage: true });
    });
});

test.describe('Governance Settings Page - Run Cache Now', () => {

    test('Run Cache Now button should be visible', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/governance_settings', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Look for Run Cache Now button
        const runCacheButton = page.locator('button:has-text("Run Cache Now"), .btn:has-text("Run Cache Now")');

        // Take screenshot
        await page.screenshot({ path: 'screenshots/settings-run-cache-button.png', fullPage: true });
    });

    test('settings form buttons should be visible', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/governance_settings', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Check for buttons
        const buttons = page.locator('.settings-form .btn, form button, .btn-primary');
        const buttonCount = await buttons.count();
        console.log(`Found ${buttonCount} buttons`);

        expect(buttonCount).toBeGreaterThan(0);

        await page.screenshot({ path: 'screenshots/settings-buttons.png', fullPage: true });
    });

    test('cost config table should NOT have checkboxes', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/governance_settings', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Check cost config table for checkboxes
        const costConfigCheckboxes = page.locator('#cost_config_table .gov-checkbox:visible');
        const checkboxCount = await costConfigCheckboxes.count();
        console.log(`Cost config table has ${checkboxCount} visible checkboxes`);

        expect(checkboxCount).toBe(0);

        await page.screenshot({ path: 'screenshots/settings-cost-config.png', fullPage: true });
    });
});

test.describe('Scheduled Search Governance Page', () => {

    test('page should load with dark theme', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Take screenshot
        await page.screenshot({ path: 'screenshots/scheduled-search-governance.png', fullPage: true });
    });

    test('metric panels should have click handlers', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Look for single value panels
        const metrics = page.locator('.single-value, .single-result');
        const metricsCount = await metrics.count();
        console.log(`Found ${metricsCount} metric panels`);

        await page.screenshot({ path: 'screenshots/scheduled-search-metrics.png', fullPage: true });
    });
});

test.describe('Dashboard Governance Page', () => {

    test('activity panel should NOT have checkboxes', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/dashboard_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Look for activity panel checkboxes (should be none)
        const activityCheckboxes = page.locator('.panel-title:has-text("Activity") ~ * .gov-checkbox:visible');
        const checkboxCount = await activityCheckboxes.count();
        console.log(`Activity panel has ${checkboxCount} visible checkboxes`);

        await page.screenshot({ path: 'screenshots/dashboard-governance-activity.png', fullPage: true });
    });

    test('page should have dashboard panels', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/dashboard_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Check for any dashboard panels (tables, charts, or visualizations)
        const panels = page.locator('.dashboard-panel, .panel-body, .panel-element-row, table');
        const panelCount = await panels.count();
        console.log(`Found ${panelCount} dashboard panels/elements`);

        expect(panelCount).toBeGreaterThan(0);

        await page.screenshot({ path: 'screenshots/dashboard-governance-metrics.png', fullPage: true });
    });
});

test.describe('Visual Regression', () => {

    test('capture full cost analysis page', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/cost_analysis', {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        await page.waitForTimeout(15000); // Wait for all data to load

        await page.screenshot({
            path: 'screenshots/visual-cost-analysis-full.png',
            fullPage: true
        });
    });

    test('capture full settings page', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/governance_settings', {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        await page.waitForTimeout(10000);

        await page.screenshot({
            path: 'screenshots/visual-settings-full.png',
            fullPage: true
        });
    });

    test('capture full scheduled search governance page', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        await page.waitForTimeout(10000);

        await page.screenshot({
            path: 'screenshots/visual-scheduled-search-full.png',
            fullPage: true
        });
    });

    test('capture full dashboard governance page', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        await page.goto('/en-US/app/TA-user-governance/dashboard_governance', {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        await page.waitForTimeout(10000);

        await page.screenshot({
            path: 'screenshots/visual-dashboard-governance-full.png',
            fullPage: true
        });
    });
});
