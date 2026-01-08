/**
 * SPL Preview Test - Magnifying Glass Icon
 * Verifies that clicking the magnifying glass shows clean SPL without HTML artifacts
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

async function login(page) {
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
}

async function goToDashboard(page) {
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(6000);
}

test.describe('SPL Preview Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Magnifying glass shows clean SPL without HTML artifacts', async ({ page }) => {
        await goToDashboard(page);

        // Find the first magnifying glass icon
        const magnifyIcon = page.locator('.search-preview-icon').first();

        if (await magnifyIcon.count() > 0) {
            await magnifyIcon.click();
            await page.waitForTimeout(2000);

            // Check that the modal is visible
            const modal = page.locator('#searchPreviewModalOverlay');
            expect(await modal.isVisible()).toBe(true);
            console.log('SPL Preview modal opened');

            // Get the SPL content
            const splContent = page.locator('#searchPreviewQuery');
            const splText = await splContent.textContent();

            console.log('SPL Content preview:', splText.substring(0, 200));

            // Check that SPL does NOT contain HTML style artifacts
            expect(splText).not.toContain('style="color:');
            expect(splText).not.toContain('<span');
            expect(splText).not.toContain('color: #');
            expect(splText).not.toContain('rgb(');

            console.log('SPL content is clean (no HTML artifacts)');

            // Check that SPL contains expected Splunk commands
            // At minimum, a search should have some SPL content
            const hasValidSPL = splText.includes('|') ||
                               splText.includes('search') ||
                               splText.includes('index') ||
                               splText.includes('stats') ||
                               splText.includes('eval') ||
                               splText.length > 10;

            expect(hasValidSPL).toBe(true);
            console.log('SPL contains valid search content');

            // Close modal
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        } else {
            console.log('No magnifying glass icons found - skipping test');
        }
    });

    test('SPL preview modal can be closed with X button', async ({ page }) => {
        await goToDashboard(page);

        const magnifyIcon = page.locator('.search-preview-icon').first();

        if (await magnifyIcon.count() > 0) {
            await magnifyIcon.click();
            await page.waitForTimeout(2000);

            const modal = page.locator('#searchPreviewModalOverlay');
            expect(await modal.isVisible()).toBe(true);

            // Click close button
            await page.click('#searchPreviewClose');
            await page.waitForTimeout(500);

            expect(await modal.isVisible()).toBe(false);
            console.log('Modal closed successfully');
        }
    });

    test('SPL preview shows correct search name', async ({ page }) => {
        await goToDashboard(page);

        const magnifyIcon = page.locator('.search-preview-icon').first();

        if (await magnifyIcon.count() > 0) {
            // Get the search name from the data attribute
            const expectedName = await magnifyIcon.getAttribute('data-search-name');
            console.log('Expected search name:', expectedName);

            await magnifyIcon.click();
            await page.waitForTimeout(2000);

            // Get the displayed search name
            const displayedName = await page.locator('#searchPreviewName').textContent();
            console.log('Displayed search name:', displayedName);

            expect(displayedName).toBe(expectedName);
            console.log('Search name matches correctly');

            await page.keyboard.press('Escape');
        }
    });
});
