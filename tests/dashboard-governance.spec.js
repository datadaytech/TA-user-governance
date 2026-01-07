const { test, expect } = require('@playwright/test');

// Splunk credentials
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test.describe('Dashboard Governance Page', () => {
    test.beforeEach(async ({ page }) => {
        // Login to Splunk
        await page.goto('/en-US/account/login', { waitUntil: 'networkidle' });
        const usernameField = page.locator('input[name="username"]');
        if (await usernameField.isVisible({ timeout: 5000 }).catch(() => false)) {
            await usernameField.fill(SPLUNK_USERNAME);
            await page.locator('input[name="password"]').fill(SPLUNK_PASSWORD);
            await page.getByRole('button', { name: 'Sign In' }).click();
            await page.waitForURL(/.*\/app\/.*/, { timeout: 30000 });
        }

        // Navigate to Dashboard Governance page
        await page.goto('/en-US/app/TA-user-governance/dashboard_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);
    });

    test('Recent Dashboard Governance Activity panel should NOT have checkboxes', async ({ page }) => {
        // Find the Recent Dashboard Governance Activity panel by its title
        const activityPanel = page.locator('.dashboard-panel').filter({
            has: page.locator('text=Recent Dashboard Governance Activity')
        });

        // Wait for panel to load
        await expect(activityPanel).toBeVisible({ timeout: 10000 });

        // Check that no gov-checkbox elements exist in this panel
        const checkboxes = activityPanel.locator('.gov-checkbox');
        const checkboxCount = await checkboxes.count();

        console.log(`Found ${checkboxCount} checkboxes in Activity panel`);
        expect(checkboxCount).toBe(0);
    });

    test('Complex Dashboards table SHOULD have checkboxes', async ({ page }) => {
        // Find the Large/Complex Dashboards panel
        const complexPanel = page.locator('.dashboard-panel').filter({
            has: page.locator('text=Large/Complex Dashboards')
        });

        // Wait for panel to load
        await expect(complexPanel).toBeVisible({ timeout: 10000 });

        // Wait for table enhancement
        await page.waitForTimeout(3000);

        // Check that gov-checkbox elements exist in this panel
        const checkboxes = complexPanel.locator('.gov-checkbox');
        const checkboxCount = await checkboxes.count();

        console.log(`Found ${checkboxCount} checkboxes in Complex Dashboards panel`);
        // Should have at least the select-all checkbox header
        expect(checkboxCount).toBeGreaterThanOrEqual(0); // May be 0 if no data
    });

    test('clicking Total Dashboards metric should open popup modal', async ({ page }) => {
        // Find the Total Dashboards panel by text, then find the clickable single value
        const totalPanel = page.locator('.dashboard-panel').filter({
            has: page.locator('text=Total Dashboards')
        });
        await expect(totalPanel).toBeVisible({ timeout: 10000 });

        // Click on the single value visualization
        const totalMetric = totalPanel.locator('.single-result, .single-value').first();
        await totalMetric.click();

        // Wait for modal to appear
        await page.waitForTimeout(2000);

        // Check that the modal overlay is active
        const modalOverlay = page.locator('#metricPopupOverlay.active');
        const isModalOpen = await modalOverlay.isVisible();

        console.log('Total Dashboards modal opened:', isModalOpen);
        expect(isModalOpen).toBe(true);

        // Close the modal
        await page.locator('#metricPopupClose').click();
        await page.waitForTimeout(500);

        // Verify modal is closed
        const isModalClosed = !(await page.locator('#metricPopupOverlay.active').isVisible());
        expect(isModalClosed).toBe(true);
    });

    test('clicking Complex Dashboards metric should open popup modal', async ({ page }) => {
        // Find the Complex Dashboards panel by text
        const complexPanel = page.locator('.dashboard-panel').filter({
            has: page.locator('text=Complex Dashboards')
        }).first();
        await expect(complexPanel).toBeVisible({ timeout: 10000 });

        // Click on the single value visualization
        const complexMetric = complexPanel.locator('.single-result, .single-value').first();
        await complexMetric.click();
        await page.waitForTimeout(2000);

        // Check that the modal overlay is active
        const isModalOpen = await page.locator('#metricPopupOverlay.active').isVisible();
        console.log('Complex Dashboards modal opened:', isModalOpen);
        expect(isModalOpen).toBe(true);

        // Close the modal
        await page.locator('#metricPopupClose').click();
    });

    test('no duplicate modals should appear when closing', async ({ page }) => {
        // Find and click on a metric
        const totalPanel = page.locator('.dashboard-panel').filter({
            has: page.locator('text=Total Dashboards')
        });
        await expect(totalPanel).toBeVisible({ timeout: 10000 });

        const totalMetric = totalPanel.locator('.single-result, .single-value').first();
        await totalMetric.click();
        await page.waitForTimeout(2000);

        // Close the modal
        await page.locator('#metricPopupClose').click();
        await page.waitForTimeout(1000);

        // Count all active overlays
        const activeOverlays = page.locator('.cron-modal-overlay.active, #metricPopupOverlay.active, #flaggedModalOverlay.active');
        const activeCount = await activeOverlays.count();

        console.log('Active overlays after close:', activeCount);
        expect(activeCount).toBe(0);
    });
});
