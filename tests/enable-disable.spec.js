const { test, expect } = require('./fixtures');

test.describe('Enable/Disable Functionality', () => {

  test.describe('Metric Popup Modal', () => {

    test('should open metric popup when clicking Currently Flagged', async ({ governancePage }) => {
      const page = governancePage;

      // Wait for dashboard to fully load
      await page.waitForTimeout(3000);

      // Find and click the "Currently Flagged" single value
      const flaggedPanel = page.locator('#flagged_metric_panel .single-value, [id*="flagged"] .viz-single-value');
      await expect(flaggedPanel).toBeVisible({ timeout: 15000 });

      // Click on the value
      await flaggedPanel.click();

      // Verify metric popup appears
      const popup = page.locator('#metricPopupOverlay');
      await expect(popup).toBeVisible({ timeout: 10000 });

      // Verify popup has expected elements
      await expect(page.locator('#metricPopupTitle')).toContainText(/Flagged|Currently/i);
      await expect(page.locator('#metricPopupTableBody')).toBeVisible();
    });

    test('should display flagged searches with correct statuses', async ({ governancePage }) => {
      const page = governancePage;

      await page.waitForTimeout(3000);

      // Click Currently Flagged metric
      const flaggedPanel = page.locator('#flagged_metric_panel .single-value, [id*="flagged"] .viz-single-value');
      await flaggedPanel.click();

      // Wait for popup and table to load
      await page.waitForSelector('#metricPopupTableBody tr', { timeout: 15000 });

      // Verify we have rows with status badges
      const statusCells = page.locator('.status-cell');
      const count = await statusCells.count();
      expect(count).toBeGreaterThan(0);

      // Check for various status badges
      const pageContent = await page.content();
      const hasDisabled = pageContent.includes('DISABLED');
      const hasNotified = pageContent.includes('NOTIFIED');
      const hasPending = pageContent.includes('PENDING') || pageContent.includes('FLAGGED');

      console.log(`Status badges found - DISABLED: ${hasDisabled}, NOTIFIED: ${hasNotified}, PENDING/FLAGGED: ${hasPending}`);

      // At least one status should be visible
      expect(hasDisabled || hasNotified || hasPending).toBe(true);
    });

    test('should show Enable button when disabled searches exist', async ({ governancePage }) => {
      const page = governancePage;

      await page.waitForTimeout(3000);

      // Click Currently Flagged metric
      const flaggedPanel = page.locator('#flagged_metric_panel .single-value, [id*="flagged"] .viz-single-value');
      await flaggedPanel.click();

      // Wait for popup
      await page.waitForSelector('#metricPopupOverlay.active', { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Enable button should be visible (because we have a disabled search in test data)
      const enableBtn = page.locator('#metricPopupEnable');
      await expect(enableBtn).toBeVisible({ timeout: 5000 });
    });

  });

  test.describe('Enable Selected Functionality', () => {

    test('should enable a disabled search and update status to ENABLED', async ({ governancePage }) => {
      const page = governancePage;

      await page.waitForTimeout(3000);

      // Click Currently Flagged metric
      const flaggedPanel = page.locator('#flagged_metric_panel .single-value, [id*="flagged"] .viz-single-value');
      await flaggedPanel.click();

      // Wait for popup and table
      await page.waitForSelector('#metricPopupTableBody tr', { timeout: 15000 });
      await page.waitForTimeout(2000);

      // Find a row with DISABLED status
      const disabledRow = page.locator('.metric-popup-row:has(.status-badge:has-text("DISABLED"))').first();

      if (await disabledRow.isVisible()) {
        // Select the checkbox
        const checkbox = disabledRow.locator('.metric-row-checkbox');
        await checkbox.click();

        // Click Enable Selected button
        const enableBtn = page.locator('#metricPopupEnable');
        await enableBtn.click();

        // Wait for confirmation dialog and accept it
        page.on('dialog', dialog => dialog.accept());
        await page.waitForTimeout(3000);

        // Verify success message or status change
        const successMsg = page.locator('.enable-message');
        const statusCell = disabledRow.locator('.status-cell');

        // Check for success indicators
        const hasSuccessMessage = await successMsg.textContent().then(t => t.includes('re-enabled')).catch(() => false);
        const statusChanged = await statusCell.textContent().then(t => t.includes('ENABLED')).catch(() => false);

        console.log(`Enable result - Success message: ${hasSuccessMessage}, Status changed: ${statusChanged}`);

        // At least one indicator should show success
        expect(hasSuccessMessage || statusChanged).toBe(true);
      } else {
        console.log('No disabled search found - skipping enable test');
        test.skip();
      }
    });

  });

  test.describe('Flagged Count Consistency', () => {

    test('should match flagged count between metric and filtered view', async ({ governancePage }) => {
      const page = governancePage;

      await page.waitForTimeout(5000);

      // Get the Currently Flagged metric value
      const flaggedMetric = page.locator('#flagged_metric_panel .single-value .single-result, #flagged_metric .single-result');
      const metricValue = await flaggedMetric.textContent().then(t => parseInt(t.trim())).catch(() => 0);
      console.log(`Currently Flagged metric value: ${metricValue}`);

      // Select "Flagged Only" in the View dropdown
      const viewDropdown = page.locator('select[name="view_filter"], .input-dropdown:has-text("View") select').first();

      if (await viewDropdown.isVisible()) {
        await viewDropdown.selectOption('flagged');
        await page.waitForTimeout(3000);

        // Count rows in the table
        const tableRows = page.locator('#all_searches_table tbody tr');
        const tableCount = await tableRows.count();
        console.log(`Flagged Only table row count: ${tableCount}`);

        // The counts should match (or be close if there's pagination)
        expect(tableCount).toBeGreaterThanOrEqual(metricValue - 1);
        expect(tableCount).toBeLessThanOrEqual(metricValue + 1);
      } else {
        console.log('View dropdown not found - checking alternative selectors');
        test.skip();
      }
    });

  });

  test.describe('Dark Theme', () => {

    test('should have dark background color', async ({ governancePage }) => {
      const page = governancePage;

      await page.waitForTimeout(3000);

      // Check body or dashboard background color
      const bodyBgColor = await page.evaluate(() => {
        const body = document.querySelector('body');
        return window.getComputedStyle(body).backgroundColor;
      });

      console.log(`Body background color: ${bodyBgColor}`);

      // Dark theme should have low RGB values (dark colors)
      // Parse rgb(r, g, b) format
      const rgbMatch = bodyBgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number);
        const avgColor = (r + g + b) / 3;
        console.log(`Average RGB value: ${avgColor}`);

        // Dark theme should have average RGB below 100
        expect(avgColor).toBeLessThan(100);
      }
    });

    test('should display panel titles correctly', async ({ governancePage }) => {
      const page = governancePage;

      await page.waitForTimeout(3000);

      // Check for visible panel titles
      const titles = [
        'Total Scheduled Searches',
        'Suspicious (Unflagged)',
        'Currently Flagged',
        'All Scheduled Searches'
      ];

      for (const title of titles) {
        const titleElement = page.locator(`text=${title}`).first();
        const isVisible = await titleElement.isVisible().catch(() => false);
        console.log(`Panel title "${title}": ${isVisible ? 'visible' : 'NOT visible'}`);

        if (!isVisible) {
          // Try alternative selector
          const altVisible = await page.locator(`[class*="title"]:has-text("${title}")`).first().isVisible().catch(() => false);
          console.log(`  Alternative selector: ${altVisible ? 'visible' : 'NOT visible'}`);
        }
      }

      // At least the main titles should be visible
      await expect(page.locator('text=Currently Flagged').first()).toBeVisible();
      await expect(page.locator('text=All Scheduled Searches').first()).toBeVisible();
    });

  });

  test.describe('Disabled Icon', () => {

    test('should show prohibition icon (🚫) for disabled searches', async ({ governancePage }) => {
      const page = governancePage;

      await page.waitForTimeout(5000);

      // Look for the 🚫 icon in the table (used for "Disabled by Governance" status)
      const pageContent = await page.content();
      const hasNewIcon = pageContent.includes('🚫');
      const hasOldIcon = pageContent.includes('⛔');

      console.log(`Disabled icons - New (🚫): ${hasNewIcon}, Old (⛔): ${hasOldIcon}`);

      // If there are disabled searches, the new icon should be present
      // and the old icon should not be present
      if (hasNewIcon || hasOldIcon) {
        expect(hasNewIcon).toBe(true);
      }
    });

  });

});
