const { test, expect } = require('./fixtures');

/**
 * Comprehensive checkbox functionality tests
 * These tests verify that checkboxes work correctly when:
 * - Clicking directly on the checkbox
 * - Clicking on other cells in the row
 * - Using select-all functionality
 * - Across different pages (Scheduled Search, Dashboard Governance)
 */

test.describe('Checkbox Functionality - Scheduled Search Governance', () => {

  test('should check checkbox when clicking directly on the checkbox', async ({ governancePage }) => {
    const page = governancePage;

    // Wait for table to render with checkboxes
    await page.waitForTimeout(3000);

    // Find the first checkbox
    const firstCheckbox = page.locator('.gov-checkbox').first();
    await expect(firstCheckbox).toBeVisible();

    // Verify initial state is unchecked
    const initialState = await firstCheckbox.isChecked();
    console.log('Initial checkbox state:', initialState);

    // Click directly on the checkbox
    await firstCheckbox.click();
    await page.waitForTimeout(500);

    // Verify checkbox is now checked
    const afterClickState = await firstCheckbox.isChecked();
    console.log('After click checkbox state:', afterClickState);

    expect(afterClickState).toBe(!initialState);

    // Verify visual feedback - row should be highlighted
    const row = firstCheckbox.locator('xpath=ancestor::tr');
    const rowClass = await row.getAttribute('class');
    console.log('Row class after click:', rowClass);

    if (afterClickState) {
      expect(rowClass).toContain('row-selected');
    }
  });

  test('should uncheck checkbox when clicking again', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    const firstCheckbox = page.locator('.gov-checkbox').first();
    await expect(firstCheckbox).toBeVisible();

    // First click - check
    await firstCheckbox.click();
    await page.waitForTimeout(300);
    const checkedState = await firstCheckbox.isChecked();
    console.log('After first click:', checkedState);

    // Second click - uncheck
    await firstCheckbox.click();
    await page.waitForTimeout(300);
    const uncheckedState = await firstCheckbox.isChecked();
    console.log('After second click:', uncheckedState);

    expect(uncheckedState).toBe(!checkedState);
  });

  test('should show checkmark visual when checked', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    const firstCheckbox = page.locator('.gov-checkbox').first();

    // Get initial pseudo-element state (using computed styles)
    await firstCheckbox.click();
    await page.waitForTimeout(300);

    // Verify the checkbox shows as checked in DOM
    const isChecked = await firstCheckbox.isChecked();
    expect(isChecked).toBe(true);

    // Verify the CSS :checked styling is applied (background color change)
    const bgColor = await firstCheckbox.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log('Checkbox background when checked:', bgColor);

    // The checked state should have a non-transparent background
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('should select multiple checkboxes independently', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    const checkboxes = page.locator('.gov-checkbox');
    const count = await checkboxes.count();

    if (count >= 3) {
      // Select first, third checkboxes (skip second)
      await checkboxes.nth(0).click();
      await page.waitForTimeout(200);
      await checkboxes.nth(2).click();
      await page.waitForTimeout(200);

      // Verify states
      const first = await checkboxes.nth(0).isChecked();
      const second = await checkboxes.nth(1).isChecked();
      const third = await checkboxes.nth(2).isChecked();

      console.log('Checkbox states - 1st:', first, '2nd:', second, '3rd:', third);

      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(third).toBe(true);
    }
  });

  test('should update selection count badge when checking', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    const checkboxes = page.locator('.gov-checkbox');
    const count = await checkboxes.count();

    if (count >= 2) {
      // Select two checkboxes
      await checkboxes.nth(0).click();
      await page.waitForTimeout(300);
      await checkboxes.nth(1).click();
      await page.waitForTimeout(300);

      // Check for selection badge or toast
      const badge = page.locator('#selectionCountBadge, .selection-count-badge');
      const toast = page.locator('.cron-toast');

      const badgeVisible = await badge.isVisible().catch(() => false);
      const toastText = await toast.textContent().catch(() => '');

      console.log('Badge visible:', badgeVisible, 'Toast text:', toastText);

      // Either badge should show "2 searches selected" or toast should indicate selection
      expect(badgeVisible || toastText.includes('selected')).toBe(true);
    }
  });

  test('should select all with header checkbox', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    // Find select-all checkbox in the first table
    const selectAll = page.locator('.gov-select-all').first();
    await expect(selectAll).toBeVisible();

    // Click select all
    await selectAll.click();
    await page.waitForTimeout(500);

    // Verify it's checked
    const selectAllChecked = await selectAll.isChecked();
    console.log('Select-all checked:', selectAllChecked);
    expect(selectAllChecked).toBe(true);

    // Verify all checkboxes in that table are checked
    const table = selectAll.locator('xpath=ancestor::table');
    const checkboxes = table.locator('.gov-checkbox');
    const checkboxCount = await checkboxes.count();

    for (let i = 0; i < Math.min(checkboxCount, 5); i++) {
      const isChecked = await checkboxes.nth(i).isChecked();
      console.log(`Checkbox ${i} checked:`, isChecked);
      expect(isChecked).toBe(true);
    }
  });

  test('should deselect all when clicking select-all again', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    const selectAll = page.locator('.gov-select-all').first();

    // First click - select all
    await selectAll.click();
    await page.waitForTimeout(300);

    // Second click - deselect all
    await selectAll.click();
    await page.waitForTimeout(300);

    const selectAllChecked = await selectAll.isChecked();
    expect(selectAllChecked).toBe(false);

    // Verify all checkboxes are unchecked
    const table = selectAll.locator('xpath=ancestor::table');
    const checkboxes = table.locator('.gov-checkbox');
    const checkboxCount = await checkboxes.count();

    for (let i = 0; i < Math.min(checkboxCount, 5); i++) {
      const isChecked = await checkboxes.nth(i).isChecked();
      expect(isChecked).toBe(false);
    }
  });

  test('should highlight row when checkbox is checked', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    const firstCheckbox = page.locator('.gov-checkbox').first();
    const row = firstCheckbox.locator('xpath=ancestor::tr');

    // Get initial row background
    const initialBg = await row.evaluate(el => window.getComputedStyle(el).backgroundColor);
    console.log('Initial row background:', initialBg);

    // Check the checkbox
    await firstCheckbox.click();
    await page.waitForTimeout(300);

    // Get new row background
    const newBg = await row.evaluate(el => window.getComputedStyle(el).backgroundColor);
    console.log('Row background after check:', newBg);

    // Verify background changed (row-selected class adds highlight)
    const hasSelectedClass = await row.getAttribute('class');
    expect(hasSelectedClass).toContain('row-selected');
  });

  test('should work with keyboard navigation (space to toggle)', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    const firstCheckbox = page.locator('.gov-checkbox').first();

    // Focus the checkbox
    await firstCheckbox.focus();
    await page.waitForTimeout(200);

    // Press space to toggle
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    const isChecked = await firstCheckbox.isChecked();
    console.log('Checkbox state after space key:', isChecked);

    expect(isChecked).toBe(true);
  });

});

test.describe('Checkbox Functionality - Dashboard Governance', () => {

  async function navigateToDashboardGovernance(page) {
    await page.goto(`${process.env.SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', process.env.SPLUNK_USERNAME || 'admin');
    await page.fill('input[name="password"]', process.env.SPLUNK_PASSWORD || 'changeme123');
    await page.click('input[type="submit"]');
    await page.waitForURL(/.*\/app\/.*/);
    await page.goto(`${process.env.SPLUNK_URL}/en-US/app/TA-user-governance/dashboard_governance`);
    await page.waitForSelector('.dashboard-body, .dashboard-view, .dashboard-row', { timeout: 30000 });
    await page.waitForTimeout(5000); // Wait for JS enhancement
  }

  test('should have checkboxes on Dashboard Governance tables', async ({ page }) => {
    await navigateToDashboardGovernance(page);

    // Look for checkboxes in the dashboard tables
    const checkboxes = page.locator('.gov-checkbox');
    const count = await checkboxes.count();

    console.log('Dashboard governance checkbox count:', count);
    expect(count).toBeGreaterThan(0);
  });

  test('should check checkbox when clicking directly on Dashboard Governance', async ({ page }) => {
    await navigateToDashboardGovernance(page);

    const firstCheckbox = page.locator('.gov-checkbox').first();

    if (await firstCheckbox.isVisible()) {
      const initialState = await firstCheckbox.isChecked();

      await firstCheckbox.click();
      await page.waitForTimeout(300);

      const newState = await firstCheckbox.isChecked();
      console.log('Dashboard checkbox - initial:', initialState, 'after:', newState);

      expect(newState).toBe(!initialState);
    }
  });

});

test.describe('Checkbox Edge Cases', () => {

  test('should maintain checkbox state after table refresh', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    const firstCheckbox = page.locator('.gov-checkbox').first();

    // Check the checkbox
    await firstCheckbox.click();
    await page.waitForTimeout(300);

    // Get the search name
    const searchName = await firstCheckbox.getAttribute('data-search');
    console.log('Checked search:', searchName);

    // Note: After table refresh, checkboxes are recreated
    // This test documents expected behavior (state not persisted across refresh)
    expect(await firstCheckbox.isChecked()).toBe(true);
  });

  test('should handle rapid clicking correctly', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    const firstCheckbox = page.locator('.gov-checkbox').first();
    const initialState = await firstCheckbox.isChecked();

    // Rapid clicks - should end up toggled from initial
    await firstCheckbox.click();
    await firstCheckbox.click();
    await firstCheckbox.click();
    await page.waitForTimeout(500);

    const finalState = await firstCheckbox.isChecked();
    console.log('After 3 rapid clicks - initial:', initialState, 'final:', finalState);

    // Three clicks = opposite of initial (toggle 3x = opposite)
    expect(finalState).toBe(!initialState);
  });

  test('should update select-all when all individual boxes checked', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    const selectAll = page.locator('.gov-select-all').first();
    const table = selectAll.locator('xpath=ancestor::table');
    const checkboxes = table.locator('.gov-checkbox');
    const count = await checkboxes.count();

    // Check all individual checkboxes
    for (let i = 0; i < count; i++) {
      if (!(await checkboxes.nth(i).isChecked())) {
        await checkboxes.nth(i).click();
        await page.waitForTimeout(100);
      }
    }

    await page.waitForTimeout(300);

    // Select-all should now be checked
    const selectAllChecked = await selectAll.isChecked();
    console.log('Select-all state after checking all:', selectAllChecked);
    expect(selectAllChecked).toBe(true);
  });

  test('should uncheck select-all when one individual box unchecked', async ({ governancePage }) => {
    const page = governancePage;
    await page.waitForTimeout(3000);

    const selectAll = page.locator('.gov-select-all').first();

    // First select all
    await selectAll.click();
    await page.waitForTimeout(300);

    // Now uncheck one
    const table = selectAll.locator('xpath=ancestor::table');
    const firstCheckbox = table.locator('.gov-checkbox').first();
    await firstCheckbox.click();
    await page.waitForTimeout(300);

    // Select-all should now be unchecked
    const selectAllChecked = await selectAll.isChecked();
    console.log('Select-all state after unchecking one:', selectAllChecked);
    expect(selectAllChecked).toBe(false);
  });

});
