const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Debug metric popup', async ({ page }) => {
    // Login
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);

    // Navigate to dashboard
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/scheduled_search_governance`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Check if popup overlay exists
    const popupExists = await page.evaluate(() => {
        return document.getElementById('metricPopupOverlay') !== null;
    });
    console.log('Popup overlay exists:', popupExists);

    // Check metric panels
    const panels = await page.locator('[data-metric-setup="true"]');
    const panelCount = await panels.count();
    console.log('Metric panels with setup:', panelCount);

    if (panelCount > 0) {
        // Get info about the first panel
        const panelInfo = await panels.first().evaluate(el => {
            return {
                cursor: window.getComputedStyle(el).cursor,
                metricType: el.getAttribute('data-metric-type'),
                hasClickHandler: el.onclick !== null || el._events,
                title: el.querySelector('h3, .panel-title')?.textContent
            };
        });
        console.log('First panel info:', panelInfo);

        // Try to click and listen for console logs
        page.on('console', msg => {
            if (msg.text().includes('metric') || msg.text().includes('popup')) {
                console.log('BROWSER LOG:', msg.text());
            }
        });

        // Click the first metric panel
        console.log('Clicking first metric panel...');
        await panels.first().click();
        await page.waitForTimeout(2000);

        // Check if popup is now visible
        const popupVisible = await page.evaluate(() => {
            const el = document.getElementById('metricPopupOverlay');
            return el ? el.classList.contains('active') : false;
        });
        console.log('Popup visible after click:', popupVisible);

        // Check for any errors
        const popupState = await page.evaluate(() => {
            const el = document.getElementById('metricPopupOverlay');
            if (!el) return { exists: false };
            return {
                exists: true,
                classes: el.className,
                display: window.getComputedStyle(el).display,
                visibility: window.getComputedStyle(el).visibility,
                opacity: window.getComputedStyle(el).opacity,
                zIndex: window.getComputedStyle(el).zIndex
            };
        });
        console.log('Popup state:', popupState);
    }

    // Try calling openMetricPopup directly
    console.log('Trying to call openMetricPopup directly...');
    const directCallResult = await page.evaluate(() => {
        if (typeof window.openMetricPopup === 'function') {
            return 'openMetricPopup is a function';
        } else if (typeof openMetricPopup === 'function') {
            return 'openMetricPopup is a global function';
        } else {
            return 'openMetricPopup not found';
        }
    });
    console.log('Direct call check:', directCallResult);
});
