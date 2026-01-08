/**
 * Debug test for Extend Deadline functionality
 * Tests the complete flow from flagged searches modal to extend deadline execution
 */

const { test, expect } = require('./fixtures');

test.describe('Extend Deadline Debug Tests', () => {

    test('should trace extend deadline flow through console logs', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const consoleLogs = [];

        // Capture all console messages
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push({ type: msg.type(), text });
            if (text.includes('Extend') || text.includes('extend') || text.includes('performExtendDeadline') || text.includes('metricPopupExtend') || text.includes('openExtendModal')) {
                console.log(`[${msg.type()}] ${text}`);
            }
        });

        // Navigate to governance dashboard
        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // First, let's flag a search to ensure we have something to extend
        console.log('Looking for flagged searches...');

        // Click on the flagged metric panel to open modal
        const flaggedPanel = page.locator('.single-value, .panel-body').filter({ hasText: /flagged/i }).first();

        if (await flaggedPanel.count() > 0) {
            console.log('Found flagged panel, clicking...');
            await flaggedPanel.click();
            await page.waitForTimeout(3000);
        } else {
            // Try clicking the numeric value directly
            console.log('Trying to find numeric metric...');
            const metricValue = page.locator('.single-result, .single-value').first();
            if (await metricValue.count() > 0) {
                await metricValue.click();
                await page.waitForTimeout(3000);
            }
        }

        // Take screenshot of current state
        await page.screenshot({ path: 'screenshots/extend-debug-1-initial.png', fullPage: true });

        // Check if metric popup opened
        const metricPopup = page.locator('#metricPopupOverlay.active, .metric-popup-overlay.active');
        if (await metricPopup.count() > 0) {
            console.log('Metric popup is open');

            // Select a checkbox
            const checkbox = page.locator('.metric-row-checkbox').first();
            if (await checkbox.count() > 0) {
                await checkbox.check();
                console.log('Checked first checkbox');
            }

            await page.screenshot({ path: 'screenshots/extend-debug-2-checkbox-selected.png', fullPage: true });

            // Look for extend button
            const extendBtn = page.locator('#metricPopupExtend:visible');
            if (await extendBtn.count() > 0) {
                console.log('Found Extend button, clicking...');
                await extendBtn.click();
                await page.waitForTimeout(2000);

                await page.screenshot({ path: 'screenshots/extend-debug-3-after-extend-click.png', fullPage: true });

                // Check if extend modal opened
                const extendModal = page.locator('#extendModalOverlay.active');
                if (await extendModal.count() > 0) {
                    console.log('Extend modal is open');

                    // Check the search list
                    const searchList = await page.locator('#extendSearchList').innerHTML();
                    console.log('Search list HTML:', searchList);

                    // Check the custom days input
                    const customDays = await page.locator('#extendCustomDays').inputValue();
                    console.log('Custom days value:', customDays);

                    // Click Save button
                    const saveBtn = page.locator('#extendModalSave');
                    if (await saveBtn.count() > 0) {
                        console.log('Clicking Save button...');
                        await saveBtn.click();
                        await page.waitForTimeout(5000);

                        await page.screenshot({ path: 'screenshots/extend-debug-4-after-save.png', fullPage: true });
                    }
                } else {
                    console.log('Extend modal did not open!');
                    await page.screenshot({ path: 'screenshots/extend-debug-error-no-modal.png', fullPage: true });
                }
            } else {
                console.log('Extend button not visible');
                await page.screenshot({ path: 'screenshots/extend-debug-error-no-extend-btn.png', fullPage: true });
            }
        } else {
            console.log('Metric popup did not open');
        }

        // Print relevant console logs
        console.log('\n=== RELEVANT CONSOLE LOGS ===');
        consoleLogs.filter(log =>
            log.text.includes('Extend') ||
            log.text.includes('extend') ||
            log.text.includes('performExtendDeadline') ||
            log.text.includes('metricPopupExtend') ||
            log.text.includes('openExtendModal') ||
            log.text.includes('runSearch') ||
            log.text.includes('currentExtendSearches')
        ).forEach(log => {
            console.log(`[${log.type}] ${log.text}`);
        });
        console.log('=== END CONSOLE LOGS ===\n');

        // Take final screenshot
        await page.screenshot({ path: 'screenshots/extend-debug-final.png', fullPage: true });
    });

    test('should verify flagged searches exist and can be selected', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Navigate to governance dashboard
        await page.goto('/en-US/app/TA-user-governance/governance_dashboard?form.view_filter=flagged', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Check if there are flagged searches
        const flaggedSearches = await page.evaluate(() => {
            const rows = document.querySelectorAll('.metric-popup-row, table tbody tr');
            return rows.length;
        });

        console.log(`Found ${flaggedSearches} flagged searches`);

        await page.screenshot({ path: 'screenshots/extend-debug-flagged-view.png', fullPage: true });
    });

    test('should directly test extend modal opening', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const consoleLogs = [];

        // Capture console
        page.on('console', msg => {
            consoleLogs.push({ type: msg.type(), text: msg.text() });
        });

        // Navigate to governance dashboard
        await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Call openExtendModal directly via evaluate
        const result = await page.evaluate(() => {
            if (typeof window.openExtendModal === 'function') {
                const testSearches = [
                    { searchName: 'Test_Search_1', owner: 'admin', app: 'search', status: 'pending' }
                ];
                window.openExtendModal(testSearches);
                return 'openExtendModal called successfully';
            }
            return 'openExtendModal not found';
        });

        console.log('Direct call result:', result);
        await page.waitForTimeout(2000);

        // Check if modal opened
        const extendModal = page.locator('#extendModalOverlay.active');
        const isOpen = await extendModal.count() > 0;
        console.log('Extend modal is open:', isOpen);

        if (isOpen) {
            // Check the search list
            const searchList = await page.locator('#extendSearchList').innerHTML();
            console.log('Search list:', searchList);

            // Click the save button
            await page.locator('#extendModalSave').click();
            await page.waitForTimeout(3000);
        }

        await page.screenshot({ path: 'screenshots/extend-debug-direct-call.png', fullPage: true });

        // Print relevant logs
        console.log('\n=== CONSOLE LOGS ===');
        consoleLogs.forEach(log => {
            if (log.text.includes('Extend') || log.text.includes('extend') || log.text.includes('search')) {
                console.log(`[${log.type}] ${log.text}`);
            }
        });
    });
});
