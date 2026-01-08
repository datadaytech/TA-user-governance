/**
 * Debug test for governance_dashboard modal break after flagging
 */

const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Debug governance_dashboard modal break after flag', async ({ page }) => {
    // Track console logs
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('metric') || text.includes('popup') || text.includes('modal') ||
            text.includes('flag') || text.includes('Error') || text.includes('error') ||
            text.includes('Setting up') || text.includes('Enhancing')) {
            console.log('BROWSER:', text);
        }
    });

    // Login
    console.log('Logging in...');
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
    console.log('Logged in');

    // Navigate to governance_dashboard with specific filters
    console.log('\n=== Navigating to governance_dashboard ===');
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard?form.view_filter=all&form.filter_status=0&form.filter_app=*&form.filter_owner=*`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(10000);

    // Check "Suspicious Scheduled Searches - Requires Review" panel
    console.log('\n=== Checking Suspicious Searches panel ===');

    // Look for the table
    const suspiciousTable = page.locator('#suspicious_searches_table');
    const tableExists = await suspiciousTable.count() > 0;
    console.log('Suspicious table exists:', tableExists);

    // Check for checkboxes in the suspicious table
    const checkboxes = await page.locator('#suspicious_searches_table .gov-checkbox').count();
    console.log('Checkboxes in suspicious table:', checkboxes);

    // Check for cron clickables
    const cronClickables = await page.locator('#suspicious_searches_table .cron-clickable').count();
    console.log('Cron clickables in suspicious table:', cronClickables);

    // Check for metric panels
    const metricPanels = await page.locator('[data-metric-type]').count();
    console.log('Metric panels:', metricPanels);

    // Check if metric popup overlay exists
    const popupExists = await page.evaluate(() => {
        return document.getElementById('metricPopupOverlay') !== null;
    });
    console.log('Metric popup overlay exists:', popupExists);

    // Test clicking a metric panel BEFORE flagging
    console.log('\n=== Testing metric panel click BEFORE flag ===');
    const metricPanel = page.locator('[data-metric-type]').first();
    if (await metricPanel.count() > 0) {
        const metricType = await metricPanel.getAttribute('data-metric-type');
        console.log('Clicking metric panel:', metricType);

        await metricPanel.scrollIntoViewIfNeeded();
        await metricPanel.click();
        await page.waitForTimeout(2000);

        const modalOpenedBefore = await page.evaluate(() => {
            const el = document.getElementById('metricPopupOverlay');
            return el && el.classList.contains('active');
        });
        console.log('Modal opened BEFORE flag:', modalOpenedBefore);

        // Close modal
        if (modalOpenedBefore) {
            await page.locator('#metricPopupClose').click();
            await page.waitForTimeout(500);
        }
    }

    // Test cron click BEFORE flagging
    console.log('\n=== Testing cron click BEFORE flag ===');
    const cronBefore = page.locator('.cron-clickable').first();
    if (await cronBefore.count() > 0) {
        await cronBefore.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await cronBefore.click({ force: true });
        await page.waitForTimeout(2000);

        const cronModalBefore = await page.evaluate(() => {
            const el = document.getElementById('cronModalOverlay');
            return el && el.classList.contains('active');
        });
        console.log('Cron modal opened BEFORE flag:', cronModalBefore);

        if (cronModalBefore) {
            await page.locator('#cronModalClose').click().catch(() => {});
            await page.waitForTimeout(500);
        }
    }

    // Now flag a search
    console.log('\n=== Flagging a search ===');
    const checkbox = page.locator('.gov-checkbox[data-flagged="false"]').first();
    if (await checkbox.count() > 0) {
        const searchName = await checkbox.getAttribute('data-search');
        console.log('Flagging search:', searchName);

        // Set up dialog handler
        page.once('dialog', async dialog => {
            console.log('Dialog:', dialog.type(), '-', dialog.message().substring(0, 50));
            await dialog.accept('Test flag for debugging');
        });

        await checkbox.click();
        await page.waitForTimeout(300);

        const flagBtn = page.locator('#flag-selected-btn, button:has-text("Flag Selected")').first();
        if (await flagBtn.count() > 0) {
            await flagBtn.click();
            console.log('Clicked flag button');
        }

        // Wait for flag operation and refresh
        await page.waitForTimeout(7000);

        console.log('\n=== State AFTER flag ===');

        // Re-check everything
        const checkboxesAfter = await page.locator('#suspicious_searches_table .gov-checkbox').count();
        console.log('Checkboxes after flag:', checkboxesAfter);

        const cronAfter = await page.locator('#suspicious_searches_table .cron-clickable').count();
        console.log('Cron clickables after flag:', cronAfter);

        const metricPanelsAfter = await page.locator('[data-metric-setup="true"]').count();
        console.log('Metric panels with setup after flag:', metricPanelsAfter);

        // Test metric panel click AFTER flagging
        console.log('\n=== Testing metric panel click AFTER flag ===');
        const metricPanelAfter = page.locator('[data-metric-type]').first();
        if (await metricPanelAfter.count() > 0) {
            await metricPanelAfter.scrollIntoViewIfNeeded();
            await metricPanelAfter.click();
            await page.waitForTimeout(2000);

            const modalOpenedAfter = await page.evaluate(() => {
                const el = document.getElementById('metricPopupOverlay');
                return el && el.classList.contains('active');
            });
            console.log('Modal opened AFTER flag:', modalOpenedAfter);

            if (!modalOpenedAfter) {
                // Debug - check state
                const modalState = await page.evaluate(() => {
                    const el = document.getElementById('metricPopupOverlay');
                    return el ? {
                        exists: true,
                        classes: el.className,
                        display: window.getComputedStyle(el).display
                    } : { exists: false };
                });
                console.log('Modal state:', modalState);
            }

            // Close if opened
            if (modalOpenedAfter) {
                await page.locator('#metricPopupClose').click();
                await page.waitForTimeout(500);
            }
        }

        // Test cron click AFTER flagging
        console.log('\n=== Testing cron click AFTER flag ===');
        const cronAfterFlag = page.locator('.cron-clickable').first();
        if (await cronAfterFlag.count() > 0) {
            await cronAfterFlag.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            await cronAfterFlag.click({ force: true });
            await page.waitForTimeout(2000);

            const cronModalAfter = await page.evaluate(() => {
                const el = document.getElementById('cronModalOverlay');
                return el && el.classList.contains('active');
            });
            console.log('Cron modal opened AFTER flag:', cronModalAfter);

            if (!cronModalAfter) {
                const cronState = await page.evaluate(() => {
                    const el = document.getElementById('cronModalOverlay');
                    return el ? { exists: true, classes: el.className } : { exists: false };
                });
                console.log('Cron modal state:', cronState);
            }
        } else {
            console.log('No cron clickables found after flag!');
        }

    } else {
        console.log('No unflagged checkboxes found to test');
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/governance-dashboard-debug.png' });
    console.log('\nScreenshot saved');
});
