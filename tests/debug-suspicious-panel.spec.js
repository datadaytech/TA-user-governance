/**
 * Debug the "Suspicious Scheduled Searches - Requires Review" panel specifically
 */

const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Debug Suspicious Searches panel modal after flag', async ({ page }) => {
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('popup') || text.includes('metric') || text.includes('modal') ||
            text.includes('Error') || text.includes('click') || text.includes('Setting up')) {
            console.log('BROWSER:', text);
        }
    });

    // Login
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
    console.log('Logged in');

    // Navigate to governance_dashboard
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard?form.view_filter=all&form.filter_status=0&form.filter_app=*&form.filter_owner=*`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(10000);

    // Find the "Suspicious Scheduled Searches - Requires Review" panel
    console.log('\n=== Finding Suspicious Searches panel ===');

    // The suspicious_metric_panel should be for "Suspicious (Unflagged)"
    const suspiciousPanel = page.locator('#suspicious_metric_panel, [data-metric-type="suspicious"]').first();
    const panelExists = await suspiciousPanel.count() > 0;
    console.log('Suspicious metric panel exists:', panelExists);

    if (panelExists) {
        // Get panel info
        const panelInfo = await suspiciousPanel.evaluate(el => ({
            id: el.id,
            dataMetricType: el.getAttribute('data-metric-type'),
            hasSetup: el.getAttribute('data-metric-setup'),
            title: el.querySelector('.panel-title, h3, .single-result')?.textContent
        }));
        console.log('Panel info:', panelInfo);

        // Test clicking BEFORE flag
        console.log('\n=== Clicking Suspicious panel BEFORE flag ===');
        await suspiciousPanel.scrollIntoViewIfNeeded();
        await suspiciousPanel.click();
        await page.waitForTimeout(2000);

        const modalBefore = await page.evaluate(() => {
            const el = document.getElementById('metricPopupOverlay');
            return el && el.classList.contains('active');
        });
        console.log('Modal opened BEFORE flag:', modalBefore);

        if (modalBefore) {
            // Check modal content
            const modalContent = await page.evaluate(() => {
                const title = document.getElementById('metricPopupTitle')?.textContent;
                const rows = document.querySelectorAll('.metric-popup-row').length;
                return { title, rows };
            });
            console.log('Modal content:', modalContent);

            // Close modal
            await page.locator('#metricPopupClose').click();
            await page.waitForTimeout(500);
        }
    }

    // Now flag a search from the suspicious table
    console.log('\n=== Flagging from suspicious table ===');
    const suspiciousCheckbox = page.locator('#suspicious_searches_table .gov-checkbox[data-flagged="false"]').first();
    if (await suspiciousCheckbox.count() > 0) {
        const searchName = await suspiciousCheckbox.getAttribute('data-search');
        console.log('Flagging:', searchName);

        page.once('dialog', async dialog => {
            await dialog.accept('Test');
        });

        await suspiciousCheckbox.click();
        await page.waitForTimeout(300);
        await page.locator('#flag-selected-btn').click();
        await page.waitForTimeout(7000);

        console.log('\n=== State after flag ===');

        // Check if suspicious panel still exists and works
        const panelAfter = page.locator('#suspicious_metric_panel, [data-metric-type="suspicious"]').first();
        const panelExistsAfter = await panelAfter.count() > 0;
        console.log('Suspicious panel exists after flag:', panelExistsAfter);

        if (panelExistsAfter) {
            const panelInfoAfter = await panelAfter.evaluate(el => ({
                id: el.id,
                dataMetricType: el.getAttribute('data-metric-type'),
                hasSetup: el.getAttribute('data-metric-setup'),
                cursor: window.getComputedStyle(el).cursor
            }));
            console.log('Panel info after flag:', panelInfoAfter);

            // Try clicking AFTER flag
            console.log('\n=== Clicking Suspicious panel AFTER flag ===');
            await panelAfter.scrollIntoViewIfNeeded();
            await panelAfter.click();
            await page.waitForTimeout(2000);

            const modalAfter = await page.evaluate(() => {
                const el = document.getElementById('metricPopupOverlay');
                return el && el.classList.contains('active');
            });
            console.log('Modal opened AFTER flag:', modalAfter);

            if (modalAfter) {
                const modalContentAfter = await page.evaluate(() => {
                    const title = document.getElementById('metricPopupTitle')?.textContent;
                    const rows = document.querySelectorAll('.metric-popup-row').length;
                    return { title, rows };
                });
                console.log('Modal content after flag:', modalContentAfter);

                await page.locator('#metricPopupClose').click();
            } else {
                // Debug - check what's happening
                const debugInfo = await page.evaluate(() => {
                    const overlay = document.getElementById('metricPopupOverlay');
                    const panels = document.querySelectorAll('[data-metric-type="suspicious"]');
                    return {
                        overlayExists: !!overlay,
                        overlayClasses: overlay?.className,
                        panelCount: panels.length,
                        panelsHaveSetup: Array.from(panels).map(p => p.getAttribute('data-metric-setup'))
                    };
                });
                console.log('Debug info:', debugInfo);
            }
        }
    } else {
        console.log('No unflagged checkbox found in suspicious table');
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/suspicious-panel-debug.png' });
});
