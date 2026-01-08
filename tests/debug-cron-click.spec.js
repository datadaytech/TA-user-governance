const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Debug cron click', async ({ page }) => {
    // Listen for all console logs
    page.on('console', msg => {
        console.log('BROWSER:', msg.text());
    });

    // Login
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
    console.log('Logged in');

    // Navigate to dashboard
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/scheduled_search_governance`);
    await page.waitForLoadState('networkidle');

    // Wait longer for JS to fully initialize
    console.log('Waiting for JS initialization...');
    await page.waitForTimeout(10000);

    // Check if cron modal overlay exists
    const cronModalExists = await page.evaluate(() => {
        return document.getElementById('cronModalOverlay') !== null;
    });
    console.log('Cron modal overlay exists:', cronModalExists);

    // Check cron clickable elements
    const cronClickables = await page.locator('.cron-clickable').all();
    console.log('Cron clickable count:', cronClickables.length);

    if (cronClickables.length > 0) {
        // Get info about first cron clickable
        const firstCron = cronClickables[0];
        const cronInfo = await firstCron.evaluate(el => ({
            text: el.textContent,
            dataCron: el.getAttribute('data-cron'),
            dataSearch: el.getAttribute('data-search'),
            cursor: window.getComputedStyle(el).cursor,
            zIndex: window.getComputedStyle(el).zIndex,
            position: window.getComputedStyle(el).position,
            rect: el.getBoundingClientRect()
        }));
        console.log('First cron info:', cronInfo);

        // Check if anything is covering the element
        const isCovered = await firstCron.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const topElement = document.elementFromPoint(centerX, centerY);
            return {
                topElement: topElement?.tagName,
                topElementClass: topElement?.className,
                isTarget: topElement === el
            };
        });
        console.log('Coverage check:', isCovered);

        // Try clicking with force
        console.log('\nAttempting click...');
        await firstCron.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(2000);

        // Check modal state after click
        const modalState = await page.evaluate(() => {
            const modal = document.getElementById('cronModalOverlay');
            if (!modal) return { exists: false };
            return {
                exists: true,
                classes: modal.className,
                display: window.getComputedStyle(modal).display,
                visibility: window.getComputedStyle(modal).visibility,
                opacity: window.getComputedStyle(modal).opacity,
                hasActive: modal.classList.contains('active')
            };
        });
        console.log('Modal state after click:', modalState);

        // Try calling openCronModal directly
        console.log('\nTrying direct call to openCronModal...');
        const directResult = await page.evaluate(() => {
            if (typeof window.openCronModal === 'function') {
                window.openCronModal('TestSearch', '*/5 * * * *', 'admin', 'TA-user-governance');
                return 'Called openCronModal';
            }
            return 'openCronModal not found';
        });
        console.log('Direct call result:', directResult);

        await page.waitForTimeout(1000);

        // Check modal state after direct call
        const modalStateAfterDirect = await page.evaluate(() => {
            const modal = document.getElementById('cronModalOverlay');
            return {
                exists: !!modal,
                hasActive: modal?.classList.contains('active'),
                classes: modal?.className
            };
        });
        console.log('Modal state after direct call:', modalStateAfterDirect);
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/debug-cron.png' });
});
