const { test, expect } = require('./fixtures');

test('modal opens and closes without duplicates', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(6000);

    // Screenshot before clicking
    await page.screenshot({ path: 'screenshots/modal-01-before.png', fullPage: true });

    // Click on Currently Flagged metric
    const flaggedMetric = page.locator('#flagged_metric_panel .single-value, #flagged_metric_panel .single-result').first();
    await flaggedMetric.click();
    await page.waitForTimeout(2500);

    // Screenshot with modal open
    await page.screenshot({ path: 'screenshots/modal-02-open.png', fullPage: true });

    // Verify only metricPopupOverlay is active (not flaggedModalOverlay)
    const metricPopupActive = await page.locator('#metricPopupOverlay.active').isVisible();
    const flaggedModalActive = await page.locator('#flaggedModalOverlay.active').isVisible();
    console.log('metricPopupOverlay active:', metricPopupActive);
    console.log('flaggedModalOverlay active:', flaggedModalActive);

    // Close the modal
    const closeBtn = page.locator('#metricPopupClose');
    await closeBtn.click();
    await page.waitForTimeout(1500);

    // Screenshot after close
    await page.screenshot({ path: 'screenshots/modal-03-closed.png', fullPage: true });

    // Verify NO modals are active
    const anyMetricPopup = await page.locator('#metricPopupOverlay.active').isVisible();
    const anyFlaggedModal = await page.locator('#flaggedModalOverlay.active').isVisible();
    console.log('After close - metricPopupOverlay active:', anyMetricPopup);
    console.log('After close - flaggedModalOverlay active:', anyFlaggedModal);

    expect(anyMetricPopup).toBe(false);
    expect(anyFlaggedModal).toBe(false);

    console.log('SUCCESS: Modal opened and closed without duplicate modals appearing');
});
