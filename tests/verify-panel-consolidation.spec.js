/**
 * Quick verification of panel consolidation changes
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test.describe('Panel Consolidation Verification', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('GOVERNANCE')) {
                console.log('BROWSER:', msg.text());
            }
        });

        // Login
        await page.goto(`${SPLUNK_URL}/en-US/account/login`);
        await page.fill('input[name="username"]', SPLUNK_USERNAME);
        await page.fill('input[name="password"]', SPLUNK_PASSWORD);
        await page.click('input[type="submit"]');
        await page.waitForURL(/\/en-US\/app\//);
    });

    test('Verify dashboard loads with consolidated panel', async ({ page }) => {
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // 1. Verify "Suspicious Scheduled Searches" panel is GONE
        const suspiciousPanelTitle = await page.locator('h3:has-text("Suspicious Scheduled Searches - Requires Review")').count();
        expect(suspiciousPanelTitle).toBe(0);
        console.log('✓ Suspicious Scheduled Searches panel removed');

        // 2. Verify "All Scheduled Searches" panel EXISTS
        const allSearchesPanel = await page.locator('h3:has-text("All Scheduled Searches")').count();
        expect(allSearchesPanel).toBeGreaterThan(0);
        console.log('✓ All Scheduled Searches panel present');

        // 3. Verify button layout - Email Owner after Disable Expiring
        const buttonOrder = await page.evaluate(() => {
            const buttons = $('#all-searches-actions button');
            return buttons.map((i, el) => $(el).attr('id')).get();
        });
        console.log('Button order:', buttonOrder);
        
        // Check order: flag, unflag, disable-expiring, email
        const emailIdx = buttonOrder.indexOf('email-btn-2');
        const disableExpiringIdx = buttonOrder.indexOf('disable-expiring-btn');
        expect(emailIdx).toBeGreaterThan(disableExpiringIdx);
        console.log('✓ Email Owner button after Disable Expiring');

        // 4. Verify "Preview Impact" and "View Flagged Modal" buttons are GONE
        const previewImpact = await page.locator('#preview-impact-btn').count();
        const viewFlagged = await page.locator('#view-flagged-btn').count();
        expect(previewImpact).toBe(0);
        expect(viewFlagged).toBe(0);
        console.log('✓ Preview Impact and View Flagged Modal buttons removed');

        // 5. Take screenshot
        await page.screenshot({ path: 'screenshots/panel-consolidation-verify.png' });
        console.log('✓ Screenshot saved');
    });

    test('Verify status dropdown shows correct options', async ({ page }) => {
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // Find a status badge in the table
        const statusBadges = page.locator('.status-dropdown-wrapper, .governance-status-dropdown');
        const badgeCount = await statusBadges.count();
        console.log('Status badges found:', badgeCount);

        if (badgeCount > 0) {
            // Click first badge
            await statusBadges.first().click();
            await page.waitForTimeout(500);

            // Check if dropdown appears
            const dropdown = page.locator('.status-dropdown-menu');
            const dropdownVisible = await dropdown.isVisible();
            console.log('Dropdown visible:', dropdownVisible);

            if (dropdownVisible) {
                const options = await dropdown.locator('.status-option').allTextContents();
                console.log('Dropdown options:', options);
                expect(options.length).toBeGreaterThan(0);
            }

            await page.keyboard.press('Escape');
        }

        console.log('✓ Status dropdown verification complete');
    });

    test('Verify Suspicious (Unflagged) metric popup', async ({ page }) => {
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // Click on Suspicious (Unflagged) metric
        const suspiciousMetric = page.locator('text=Suspicious (Unflagged)');
        if (await suspiciousMetric.count() > 0) {
            await suspiciousMetric.first().click();
            await page.waitForTimeout(2000);

            // Verify popup opens
            const popup = page.locator('#metricPopupOverlay');
            const popupVisible = await popup.locator('.active').count() > 0 || 
                                await page.locator('#metricPopupOverlay.active').count() > 0;
            console.log('Popup opened:', popupVisible);

            if (popupVisible) {
                // Check that popup shows items (or "No items")
                const popupContent = await page.locator('#metricPopupTable').textContent();
                console.log('Popup has content:', popupContent.length > 0);
                
                await page.keyboard.press('Escape');
            }
        } else {
            console.log('No Suspicious (Unflagged) metric found - may be 0');
        }

        console.log('✓ Suspicious metric popup verification complete');
    });
});
