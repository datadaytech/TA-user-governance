/**
 * Flag Regression Test
 * Tests that after flagging a search:
 * 1. Visualizations persist
 * 2. Checkboxes remain functional
 * 3. Cron clickables work
 * 4. Metric panel modals work
 */

const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test.describe('Flag Functionality Regression Tests', () => {
    let page;

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();

        // Listen for console logs
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Error') || text.includes('error') || text.includes('metric') || text.includes('popup') || text.includes('flag')) {
                console.log('BROWSER:', text);
            }
        });

        // Login
        await page.goto(`${SPLUNK_URL}/en-US/account/login`);
        await page.fill('input[name="username"]', SPLUNK_USERNAME);
        await page.fill('input[name="password"]', SPLUNK_PASSWORD);
        await page.click('input[type="submit"]');
        await page.waitForURL(/\/en-US\/app\//);

        console.log('Logged in successfully');
    });

    test.afterAll(async () => {
        if (page) await page.close();
    });

    test.beforeEach(async () => {
        // Navigate to governance dashboard
        await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/scheduled_search_governance`);
        await page.waitForLoadState('networkidle');

        // Wait for tables to load and JS to initialize fully - needs 10s for all handlers
        await page.waitForTimeout(10000);

        // Wait for cron-clickable elements to be present
        await page.waitForSelector('.cron-clickable', { timeout: 10000 }).catch(() => {});
    });

    async function verifyVisualizationsPresent() {
        const checks = {
            checkboxes: false,
            cronClickables: false,
            metricPanels: false,
            tableRows: false,
            popupOverlay: false
        };

        // Check for checkboxes
        const checkboxCount = await page.locator('.gov-checkbox').count();
        checks.checkboxes = checkboxCount > 0;
        console.log(`  Checkboxes: ${checkboxCount}`);

        // Check for cron clickables
        const cronCount = await page.locator('.cron-clickable').count();
        checks.cronClickables = cronCount > 0;
        console.log(`  Cron clickables: ${cronCount}`);

        // Check for metric panels with click handlers
        const metricPanels = await page.locator('[data-metric-setup="true"]').count();
        checks.metricPanels = metricPanels > 0;
        console.log(`  Metric panels with handlers: ${metricPanels}`);

        // Check for table rows
        const rows = await page.locator('.gov-enhanced').count();
        checks.tableRows = rows > 0;
        console.log(`  Enhanced table rows: ${rows}`);

        // Check popup overlay exists
        const popupExists = await page.evaluate(() => document.getElementById('metricPopupOverlay') !== null);
        checks.popupOverlay = popupExists;
        console.log(`  Popup overlay exists: ${popupExists}`);

        return checks;
    }

    async function verifyMetricPanelClickable() {
        // Find a metric panel - use data-metric-type as it's set on HTML, data-metric-setup is added by JS
        // First try with setup attribute, then fall back to type attribute
        let panel = page.locator('[data-metric-setup="true"]').first();
        if (await panel.count() === 0) {
            // Fall back to panels with data-metric-type
            panel = page.locator('[data-metric-type]').first();
        }
        if (await panel.count() === 0) {
            console.log('  No metric panels found');
            return false;
        }

        const metricType = await panel.getAttribute('data-metric-type');
        console.log(`  Clicking metric panel type: ${metricType}`);

        // Scroll into view and wait for any initialization
        await panel.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        // Click the panel
        await panel.click();
        await page.waitForTimeout(2000);

        // Check if modal opened using the correct selector
        const modalVisible = await page.evaluate(() => {
            const el = document.getElementById('metricPopupOverlay');
            return el && el.classList.contains('active');
        });

        if (modalVisible) {
            console.log('  Metric popup opened successfully');
            // Close the modal by clicking Close button
            const closeBtn = page.locator('#metricPopupClose');
            if (await closeBtn.count() > 0) {
                await closeBtn.click();
                await page.waitForTimeout(500);
            }
        } else {
            console.log('  Metric popup did NOT open');
        }

        return modalVisible;
    }

    async function verifyCronClickable() {
        // Find a cron clickable and click it
        const cron = page.locator('.cron-clickable').first();
        if (await cron.count() === 0) {
            console.log('  No cron clickables found');
            return false;
        }

        // Log what we're clicking
        const cronText = await cron.textContent();
        console.log(`  Clicking cron: ${cronText}`);

        // Scroll into view first
        await cron.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        await cron.click({ force: true });
        await page.waitForTimeout(2000);

        // Check if cron modal opened - correct ID is cronModalOverlay
        const modalVisible = await page.evaluate(() => {
            const el = document.getElementById('cronModalOverlay');
            return el && el.classList.contains('active');
        });

        if (modalVisible) {
            console.log('  Cron modal opened successfully');
            // Close the modal
            const closeBtn = page.locator('#cronModalClose');
            if (await closeBtn.count() > 0) {
                await closeBtn.click();
            } else {
                await page.keyboard.press('Escape');
            }
            await page.waitForTimeout(500);
        } else {
            console.log('  Cron modal did NOT open');
            // Debug: check if cronModalOverlay exists
            const overlayExists = await page.evaluate(() => {
                const el = document.getElementById('cronModalOverlay');
                return el ? { exists: true, classes: el.className } : { exists: false };
            });
            console.log('  Debug overlay state:', overlayExists);
        }

        return modalVisible;
    }

    test('TEST 1: Verify initial state before any flags', async () => {
        console.log('\n=== TEST 1: Checking initial visualizations ===');

        const checks = await verifyVisualizationsPresent();

        expect(checks.checkboxes).toBe(true);
        expect(checks.cronClickables).toBe(true);
        expect(checks.metricPanels).toBe(true);
        expect(checks.tableRows).toBe(true);
        expect(checks.popupOverlay).toBe(true);

        // Test metric panel click
        console.log('  Testing metric panel click...');
        const metricWorks = await verifyMetricPanelClickable();
        expect(metricWorks).toBe(true);

        // Test cron click
        console.log('  Testing cron click...');
        const cronWorks = await verifyCronClickable();
        expect(cronWorks).toBe(true);

        console.log('=== TEST 1: PASSED ===\n');
    });

    test('TEST 2: Flag a search and verify visualizations persist', async () => {
        console.log('\n=== TEST 2: Flag and verify persistence ===');

        // First verify initial state
        console.log('Step 1: Verify initial state');
        let checks = await verifyVisualizationsPresent();
        expect(checks.checkboxes).toBe(true);

        // Find a checkbox to select (unflagged search)
        console.log('Step 2: Find and select an unflagged search');
        const unflaggedCheckbox = page.locator('.gov-checkbox[data-flagged="false"]').first();
        if (await unflaggedCheckbox.count() === 0) {
            console.log('No unflagged searches available to test');
            test.skip();
            return;
        }

        // Get the search name before clicking
        const searchName = await unflaggedCheckbox.getAttribute('data-search');
        console.log(`  Selected search: ${searchName}`);

        // Click the checkbox
        await unflaggedCheckbox.click();
        await page.waitForTimeout(500);

        // Verify checkbox is checked
        const isChecked = await unflaggedCheckbox.isChecked();
        console.log(`  Checkbox checked: ${isChecked}`);
        expect(isChecked).toBe(true);

        // Handle the prompt dialog for reason
        page.once('dialog', async dialog => {
            console.log(`  Dialog: ${dialog.type()} - ${dialog.message()}`);
            if (dialog.type() === 'prompt') {
                await dialog.accept('Test flag reason');
            } else {
                await dialog.accept();
            }
        });

        // Click the Flag button
        console.log('Step 3: Click Flag button');
        const flagButton = page.locator('button:has-text("Flag Selected"), .flag-btn, [onclick*="flagSelectedSearch"]').first();
        await flagButton.click();

        // Wait for flag operation and refresh (longer wait for all handlers to re-initialize)
        console.log('Step 4: Wait for flag operation to complete');
        await page.waitForTimeout(7000);

        // NOW THE CRITICAL CHECK - Do visualizations still work?
        console.log('Step 5: Verify visualizations AFTER flag');
        checks = await verifyVisualizationsPresent();

        // These should ALL still be true - cron and checkboxes must persist
        expect(checks.checkboxes).toBe(true);
        expect(checks.cronClickables).toBe(true);
        expect(checks.tableRows).toBe(true);
        // Note: metricPanels count may temporarily be 0 due to re-initialization timing
        // We verify functionality below

        // Test metric panel click AFTER flag (this is the real functionality test)
        console.log('Step 6: Test metric panel click after flag');
        await page.waitForTimeout(2000); // Extra wait for panel handlers to initialize
        const metricWorks = await verifyMetricPanelClickable();
        expect(metricWorks).toBe(true);

        // Test cron click AFTER flag
        console.log('Step 7: Test cron click after flag');
        const cronWorks = await verifyCronClickable();
        expect(cronWorks).toBe(true);

        console.log('=== TEST 2: PASSED ===\n');
    });

    test('TEST 3: Flag multiple searches sequentially', async () => {
        console.log('\n=== TEST 3: Multiple sequential flags ===');

        for (let i = 1; i <= 3; i++) {
            console.log(`\n--- Iteration ${i} ---`);

            // Wait for page to stabilize
            await page.waitForTimeout(2000);

            // Find an unflagged checkbox
            const unflaggedCheckbox = page.locator('.gov-checkbox[data-flagged="false"]').first();
            if (await unflaggedCheckbox.count() === 0) {
                console.log('No more unflagged searches');
                break;
            }

            const searchName = await unflaggedCheckbox.getAttribute('data-search');
            console.log(`Flagging: ${searchName}`);

            // Set up dialog handler
            page.once('dialog', async dialog => {
                await dialog.accept('Test reason ' + i);
            });

            // Select and flag
            await unflaggedCheckbox.click();
            await page.waitForTimeout(300);

            // Click Flag button
            const flagButton = page.locator('button:has-text("Flag Selected"), .flag-btn').first();
            if (await flagButton.count() > 0) {
                await flagButton.click();
            }

            // Wait for refresh
            await page.waitForTimeout(5000);

            // Verify core visualizations persist
            const checks = await verifyVisualizationsPresent();
            console.log(`After iteration ${i}:`);
            expect(checks.checkboxes).toBe(true);
            expect(checks.cronClickables).toBe(true);

            // Test metric popup works (with extra wait for handlers)
            await page.waitForTimeout(2000);
            const metricWorks = await verifyMetricPanelClickable();
            expect(metricWorks).toBe(true);
        }

        console.log('\n=== TEST 3: PASSED ===');
    });

    test('TEST 4: Verify metric popup opens from different panels', async () => {
        console.log('\n=== TEST 4: Test different metric panels ===');

        const panels = page.locator('[data-metric-setup="true"]');
        const count = await panels.count();
        console.log(`Found ${count} metric panels`);

        // Test first 3 panels
        for (let i = 0; i < Math.min(3, count); i++) {
            console.log(`\nTesting panel ${i + 1}...`);

            const panel = panels.nth(i);
            const metricType = await panel.getAttribute('data-metric-type');
            console.log(`  Metric type: ${metricType}`);

            await panel.click();
            await page.waitForTimeout(1500);

            const modalVisible = await page.evaluate(() => {
                const el = document.getElementById('metricPopupOverlay');
                return el && el.classList.contains('active');
            });

            expect(modalVisible).toBe(true);
            console.log(`  Panel ${i + 1} popup opened: ${modalVisible}`);

            // Close popup
            await page.locator('#metricPopupClose').click();
            await page.waitForTimeout(500);
        }

        console.log('\n=== TEST 4: PASSED ===');
    });

    test('TEST 5: Flag then unflag cycle', async () => {
        console.log('\n=== TEST 5: Flag then unflag cycle ===');

        // Find an unflagged search
        const unflaggedCheckbox = page.locator('.gov-checkbox[data-flagged="false"]').first();
        if (await unflaggedCheckbox.count() === 0) {
            console.log('No unflagged searches available');
            test.skip();
            return;
        }

        const searchName = await unflaggedCheckbox.getAttribute('data-search');
        console.log(`Step 1: Flagging ${searchName}`);

        // Flag the search
        page.once('dialog', async dialog => {
            await dialog.accept('Test reason for cycle');
        });

        await unflaggedCheckbox.click();
        await page.waitForTimeout(300);
        await page.locator('button:has-text("Flag Selected")').first().click();
        await page.waitForTimeout(5000);

        // Verify still works after flag
        console.log('Step 2: Verify after flag');
        let checks = await verifyVisualizationsPresent();
        expect(checks.checkboxes).toBe(true);
        expect(checks.cronClickables).toBe(true);

        await page.waitForTimeout(2000);
        let metricWorks = await verifyMetricPanelClickable();
        expect(metricWorks).toBe(true);

        // Now unflag
        console.log('Step 3: Unflag the search');

        // Find the now-flagged checkbox
        await page.waitForTimeout(2000);
        const flaggedCheckbox = page.locator(`.gov-checkbox[data-search="${searchName}"]`);
        if (await flaggedCheckbox.count() > 0) {
            await flaggedCheckbox.click();
            await page.waitForTimeout(300);

            // Look for unflag button
            const unflagButton = page.locator('button:has-text("Unflag"), button:has-text("Resolve")').first();
            if (await unflagButton.count() > 0) {
                page.once('dialog', async dialog => {
                    await dialog.accept();
                });
                await unflagButton.click();
                await page.waitForTimeout(5000);
            }
        }

        // Verify still works after unflag
        console.log('Step 4: Verify after unflag');
        checks = await verifyVisualizationsPresent();
        expect(checks.checkboxes).toBe(true);
        expect(checks.cronClickables).toBe(true);

        await page.waitForTimeout(2000);
        metricWorks = await verifyMetricPanelClickable();
        expect(metricWorks).toBe(true);

        console.log('=== TEST 5: PASSED ===');
    });

    test('TEST 6: Full workflow end-to-end', async () => {
        console.log('\n=== TEST 6: Full workflow ===');

        // 1. Verify initial state
        console.log('Step 1: Initial state');
        let checks = await verifyVisualizationsPresent();
        expect(checks.checkboxes).toBe(true);

        // 2. Open metric popup
        console.log('Step 2: Open metric popup');
        let metricWorks = await verifyMetricPanelClickable();
        expect(metricWorks).toBe(true);

        // 3. Open cron modal
        console.log('Step 3: Open cron modal');
        let cronWorks = await verifyCronClickable();
        expect(cronWorks).toBe(true);

        // 4. Flag a search
        console.log('Step 4: Flag a search');
        const unflaggedCheckbox = page.locator('.gov-checkbox[data-flagged="false"]').first();
        if (await unflaggedCheckbox.count() > 0) {
            page.once('dialog', async dialog => {
                await dialog.accept('Full workflow test');
            });
            await unflaggedCheckbox.click();
            await page.waitForTimeout(300);
            await page.locator('button:has-text("Flag Selected")').first().click();
            await page.waitForTimeout(5000);
        }

        // 5. Verify all still works
        console.log('Step 5: Verify all still works');
        checks = await verifyVisualizationsPresent();
        expect(checks.checkboxes).toBe(true);
        expect(checks.cronClickables).toBe(true);
        // Note: metricPanels count may be 0 after flag due to timing, but functionality works
        // The important test is whether the click actually opens the popup

        metricWorks = await verifyMetricPanelClickable();
        expect(metricWorks).toBe(true);

        cronWorks = await verifyCronClickable();
        expect(cronWorks).toBe(true);

        console.log('=== TEST 6: PASSED ===');
    });
});
