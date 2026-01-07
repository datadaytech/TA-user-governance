const { test } = require('./fixtures');

test('capture governance dashboard screenshot', async ({ governancePage }) => {
    const page = governancePage;

    // Wait for page to fully load
    await page.waitForTimeout(5000);

    // Take full page screenshot
    await page.screenshot({
        path: 'screenshots/governance-dashboard-current.png',
        fullPage: true
    });

    console.log('Screenshot saved to screenshots/governance-dashboard-current.png');
});
