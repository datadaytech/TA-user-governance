/**
 * Debug test for Unflag button functionality
 * Tests the unflag flow on the All Scheduled Searches panel
 */

const { test, expect } = require('./fixtures');

test.describe('Unflag Button Debug Tests', () => {

    test('should verify checkbox selection and unflag on All Scheduled Searches', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const consoleLogs = [];

        // Capture console logs
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push({ type: msg.type(), text });
            if (text.includes('unflag') || text.includes('Unflag') || text.includes('Selected') || text.includes('checkbox')) {
                console.log(`[${msg.type()}] ${text}`);
            }
        });

        // Navigate to governance dashboard
        await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Take initial screenshot
        await page.screenshot({ path: 'screenshots/unflag-debug-1-initial.png', fullPage: true });

        // Look for the All Scheduled Searches table
        const allSearchesTable = page.locator('#all_searches_table, table').first();
        console.log('Looking for All Scheduled Searches table...');

        // Wait for checkboxes to be added by JavaScript enhancement
        await page.waitForTimeout(3000);

        // Find checkboxes in the table
        const checkboxes = page.locator('.gov-checkbox');
        const checkboxCount = await checkboxes.count();
        console.log(`Found ${checkboxCount} checkboxes`);

        if (checkboxCount > 0) {
            // Check the first checkbox
            const firstCheckbox = checkboxes.first();
            await firstCheckbox.scrollIntoViewIfNeeded();
            await firstCheckbox.check();
            console.log('Checked first checkbox');

            await page.waitForTimeout(1000);

            // Take screenshot showing selected checkbox
            await page.screenshot({ path: 'screenshots/unflag-debug-2-checkbox-selected.png', fullPage: true });

            // Check if row is marked as selected
            const selectedRows = page.locator('.row-selected');
            const selectedCount = await selectedRows.count();
            console.log(`Selected rows count: ${selectedCount}`);

            // Find the Unflag button
            const unflagBtn = page.locator('#unflag-btn-2, button:has-text("Unflag")').first();
            const unflagVisible = await unflagBtn.isVisible();
            console.log(`Unflag button visible: ${unflagVisible}`);

            if (unflagVisible) {
                console.log('Clicking Unflag button...');

                // Set up dialog handler for confirmation
                page.once('dialog', async dialog => {
                    console.log(`Dialog message: ${dialog.message()}`);
                    await dialog.accept();
                });

                await unflagBtn.click();
                await page.waitForTimeout(3000);

                await page.screenshot({ path: 'screenshots/unflag-debug-3-after-unflag.png', fullPage: true });
            } else {
                console.log('Unflag button not visible');

                // Try to find all buttons to see what's available
                const buttons = page.locator('.action-buttons button, button.btn');
                const buttonTexts = await buttons.allTextContents();
                console.log('Available buttons:', buttonTexts);

                await page.screenshot({ path: 'screenshots/unflag-debug-error-no-unflag-btn.png', fullPage: true });
            }
        } else {
            console.log('No checkboxes found - table enhancement may have failed');
            await page.screenshot({ path: 'screenshots/unflag-debug-error-no-checkboxes.png', fullPage: true });
        }

        // Print relevant logs
        console.log('\n=== RELEVANT CONSOLE LOGS ===');
        consoleLogs.filter(log =>
            log.text.includes('unflag') ||
            log.text.includes('Unflag') ||
            log.text.includes('Selected') ||
            log.text.includes('checkbox') ||
            log.text.includes('search')
        ).forEach(log => {
            console.log(`[${log.type}] ${log.text}`);
        });
        console.log('=== END CONSOLE LOGS ===\n');
    });

    test('should verify unflag function is called correctly', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // Navigate to governance dashboard
        await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Check if window.unflagSearch exists
        const unflagExists = await page.evaluate(() => {
            return typeof window.unflagSearch === 'function';
        });
        console.log('window.unflagSearch exists:', unflagExists);

        // Check if getSelectedSearches exists
        const getSelectedExists = await page.evaluate(() => {
            // getSelectedSearches is defined inside the IIFE, so we need to check selectedSearches
            return typeof window.getSelectedSearches === 'function' ||
                   typeof window.flagSelected === 'function';
        });
        console.log('Selection functions exist:', getSelectedExists);

        // Try calling unflagSearch directly and see what happens
        const result = await page.evaluate(() => {
            // First, manually select a search to test
            const checkbox = document.querySelector('.gov-checkbox');
            if (checkbox) {
                checkbox.checked = true;
                // Trigger change event
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                return 'Checkbox found and checked';
            }
            return 'No checkbox found';
        });
        console.log('Checkbox result:', result);

        await page.waitForTimeout(1000);

        // Check selectedSearches after checkbox change
        const selectedCount = await page.evaluate(() => {
            const checkboxes = document.querySelectorAll('.gov-checkbox:checked');
            return checkboxes.length;
        });
        console.log('Checked checkboxes count:', selectedCount);

        await page.screenshot({ path: 'screenshots/unflag-debug-direct-test.png', fullPage: true });
    });

    test('should test unflag button click handler', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const consoleLogs = [];

        page.on('console', msg => {
            consoleLogs.push({ type: msg.type(), text: msg.text() });
        });

        // Handle dialogs - accept all
        page.on('dialog', async dialog => {
            console.log(`Dialog: ${dialog.type()} - ${dialog.message()}`);
            await dialog.accept();
        });

        // Navigate to governance dashboard
        await page.goto('/en-US/app/TA-user-governance/scheduled_search_governance', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForSelector('.dashboard-body, .dashboard-view', { timeout: 30000 });
        await page.waitForTimeout(5000);

        // Check the first checkbox
        await page.evaluate(() => {
            const checkbox = document.querySelector('.gov-checkbox');
            if (checkbox) {
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await page.waitForTimeout(500);

        // Click unflag button directly
        await page.evaluate(() => {
            const btn = document.querySelector('#unflag-btn-2');
            if (btn) {
                console.log('Clicking unflag button directly');
                btn.click();
            } else {
                console.log('Unflag button not found');
            }
        });

        await page.waitForTimeout(5000);

        // Print console logs that are relevant
        console.log('\n=== UNFLAG RELATED CONSOLE LOGS ===');
        consoleLogs.filter(log =>
            log.text.includes('unflag') ||
            log.text.includes('Unflag') ||
            log.text.includes('Selected') ||
            log.text.includes('resolved') ||
            log.text.includes('runSearch')
        ).forEach(log => {
            console.log(`[${log.type}] ${log.text}`);
        });

        await page.screenshot({ path: 'screenshots/unflag-debug-click-handler.png', fullPage: true });
    });
});
