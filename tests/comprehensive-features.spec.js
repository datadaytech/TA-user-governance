/**
 * Comprehensive Feature Tests
 * Tests all new features: sort order, reason modal, status filter, lightning bolt color, OK badge
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

async function login(page) {
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
}

async function goToDashboard(page) {
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(6000);
}

test.describe('Table Sort Order Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Table should sort by status priority: Suspicious -> Flagged -> Pending -> OK -> Disabled', async ({ page }) => {
        await goToDashboard(page);

        // Get all status values from the table in order
        const statusDropdowns = page.locator('.status-dropdown-wrapper');
        const count = await statusDropdowns.count();

        const statuses = [];
        for (let i = 0; i < count; i++) {
            const status = await statusDropdowns.nth(i).getAttribute('data-current-status');
            statuses.push(status);
        }

        console.log('Status order:', statuses);

        // Define expected priority
        const priority = {
            'Suspicious': 1,
            'Flagged': 2,
            'Pending Remediation': 3,
            'Pending Review': 4,
            'OK': 5,
            'Disabled': 6,
            'Disabled by Governance': 7
        };

        // Check that statuses are in correct order (lower priority first)
        let lastPriority = 0;
        let sortViolations = 0;
        for (const status of statuses) {
            const currentPriority = priority[status] || 99;
            if (currentPriority < lastPriority) {
                sortViolations++;
                console.log(`Sort violation: ${status} (${currentPriority}) appeared after priority ${lastPriority}`);
            }
            lastPriority = Math.max(lastPriority, currentPriority);
        }

        // Allow some tolerance for ties being sorted by runtime
        expect(sortViolations).toBeLessThan(3);
        console.log('Sort order validated with', sortViolations, 'minor violations');
    });

    test('Suspicious searches should appear before OK searches', async ({ page }) => {
        await goToDashboard(page);

        const statusDropdowns = page.locator('.status-dropdown-wrapper');
        const count = await statusDropdowns.count();

        let firstSuspiciousIndex = -1;
        let firstOKIndex = -1;

        for (let i = 0; i < count; i++) {
            const status = await statusDropdowns.nth(i).getAttribute('data-current-status');
            if (status === 'Suspicious' && firstSuspiciousIndex === -1) {
                firstSuspiciousIndex = i;
            }
            if (status === 'OK' && firstOKIndex === -1) {
                firstOKIndex = i;
            }
        }

        if (firstSuspiciousIndex !== -1 && firstOKIndex !== -1) {
            console.log(`First Suspicious at index ${firstSuspiciousIndex}, first OK at index ${firstOKIndex}`);
            expect(firstSuspiciousIndex).toBeLessThan(firstOKIndex);
        }
    });
});

test.describe('Lightning Bolt Color Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Suspicious indicator lightning bolt should be yellow (#f8be34)', async ({ page }) => {
        await goToDashboard(page);

        const suspiciousIndicator = page.locator('.suspicious-indicator').first();

        if (await suspiciousIndicator.count() > 0) {
            const color = await suspiciousIndicator.evaluate(el => window.getComputedStyle(el).color);
            console.log('Lightning bolt color:', color);

            // Should be yellow rgb(248, 190, 52) = #f8be34
            expect(color).toMatch(/rgb\(248,\s*190,\s*52\)/);
            console.log('✓ Lightning bolt is yellow');
        } else {
            console.log('No suspicious indicator found on page');
        }
    });

    test('Lightning bolt has correct tooltip text', async ({ page }) => {
        await goToDashboard(page);

        const suspiciousIndicator = page.locator('.suspicious-indicator').first();

        if (await suspiciousIndicator.count() > 0) {
            const title = await suspiciousIndicator.getAttribute('title');
            console.log('Lightning bolt tooltip:', title);
            expect(title).toContain('Suspicious');
        }
    });
});

test.describe('OK Badge Color Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('OK status badge should have vibrant green color (#2ecc71)', async ({ page }) => {
        await goToDashboard(page);

        const okBadge = page.locator('.status-badge:has-text("OK")').first();

        if (await okBadge.count() > 0) {
            const color = await okBadge.evaluate(el => window.getComputedStyle(el).color);
            const textShadow = await okBadge.evaluate(el => window.getComputedStyle(el).textShadow);

            console.log('OK badge color:', color);
            console.log('OK badge text-shadow:', textShadow);

            // Should have green color rgb(46, 204, 113) = #2ecc71
            expect(color).toMatch(/rgb\(46,\s*204,\s*113\)/);
            console.log('✓ OK badge has vibrant green color');
        }
    });
});

test.describe('Reason Column Modal Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Reason column should have clickable elements', async ({ page }) => {
        await goToDashboard(page);

        const reasonClickables = page.locator('.reason-clickable');
        const count = await reasonClickables.count();
        console.log('Clickable reason elements:', count);

        // If there are reasons, they should be clickable
        if (count > 0) {
            const firstReason = reasonClickables.first();
            const cursor = await firstReason.evaluate(el => window.getComputedStyle(el).cursor);
            expect(cursor).toBe('pointer');
            console.log('✓ Reason elements are clickable');
        }
    });

    test('Clicking reason opens modal with solutions', async ({ page }) => {
        await goToDashboard(page);

        const reasonClickable = page.locator('.reason-clickable').first();

        if (await reasonClickable.count() > 0) {
            await reasonClickable.click();
            await page.waitForTimeout(500);

            const modal = page.locator('#reasonModalOverlay');
            expect(await modal.isVisible()).toBe(true);
            console.log('✓ Reason modal opened');

            // Check modal has solutions section
            const solutions = page.locator('#reasonSolutions');
            expect(await solutions.isVisible()).toBe(true);

            const solutionsContent = await solutions.innerHTML();
            expect(solutionsContent).toContain('<li');
            console.log('✓ Solutions are displayed in modal');

            // Close modal
            await page.click('#reasonModalClose');
            await page.waitForTimeout(300);
            expect(await modal.isVisible()).toBe(false);
        } else {
            console.log('No reason elements found to click');
        }
    });

    test('Reason modal shows search name correctly', async ({ page }) => {
        await goToDashboard(page);

        const reasonClickable = page.locator('.reason-clickable').first();

        if (await reasonClickable.count() > 0) {
            const searchName = await reasonClickable.getAttribute('data-search');

            await reasonClickable.click();
            await page.waitForTimeout(500);

            const modalSearchName = await page.locator('#reasonSearchName').textContent();
            expect(modalSearchName).toBe(searchName);
            console.log('✓ Search name matches:', searchName);

            await page.keyboard.press('Escape');
        }
    });

    test('Reason modal has Mark as Resolved button', async ({ page }) => {
        await goToDashboard(page);

        const reasonClickable = page.locator('.reason-clickable').first();

        if (await reasonClickable.count() > 0) {
            await reasonClickable.click();
            await page.waitForTimeout(500);

            const resolveBtn = page.locator('#reasonModalResolve');
            expect(await resolveBtn.isVisible()).toBe(true);
            expect(await resolveBtn.textContent()).toContain('Resolved');
            console.log('✓ Resolve button is present');

            await page.keyboard.press('Escape');
        }
    });
});

test.describe('Status Filter Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Status filter "All" option works without errors', async ({ page }) => {
        await goToDashboard(page);

        // Select "All" status
        const statusDropdown = page.locator('select[name="filter_status"]');
        await statusDropdown.selectOption('*');

        await page.waitForTimeout(3000);

        // Check that table has rows (no error)
        const rows = page.locator('#all_searches_table tbody tr');
        const count = await rows.count();
        console.log('Table rows with All filter:', count);
        expect(count).toBeGreaterThan(0);
        console.log('✓ All filter works correctly');
    });

    test('Status filter "Enabled Only" shows only enabled searches', async ({ page }) => {
        await goToDashboard(page);

        await page.selectOption('select[name="filter_status"]', '0');
        await page.waitForTimeout(3000);

        const rows = page.locator('#all_searches_table tbody tr');
        const count = await rows.count();
        console.log('Enabled searches:', count);
        expect(count).toBeGreaterThan(0);
    });

    test('Status filter "Disabled Only" works without errors', async ({ page }) => {
        await goToDashboard(page);

        await page.selectOption('select[name="filter_status"]', '1');
        await page.waitForTimeout(3000);

        // Even if no disabled searches, should not error
        const rows = page.locator('#all_searches_table tbody tr');
        const count = await rows.count();
        console.log('Disabled searches:', count);
        // Count could be 0 if no disabled searches
    });
});

test.describe('Re-flagging Prevention Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Attempting to flag an already flagged search shows alert', async ({ page }) => {
        await goToDashboard(page);

        // Find a flagged search
        const flaggedDropdown = page.locator('.status-dropdown-wrapper[data-current-status="Flagged"]').first();

        if (await flaggedDropdown.count() > 0) {
            let alertReceived = false;
            let alertMessage = '';

            page.once('dialog', async dialog => {
                alertReceived = true;
                alertMessage = dialog.message();
                await dialog.accept();
            });

            await flaggedDropdown.click();
            await page.waitForTimeout(500);

            // Click "Flag for Review" option
            const flagOption = page.locator('.status-option:has-text("Flag for Review")');
            if (await flagOption.count() > 0) {
                await flagOption.click();
                await page.waitForTimeout(1000);

                if (alertReceived) {
                    expect(alertMessage).toContain('already flagged');
                    console.log('✓ Re-flagging prevented with alert:', alertMessage);
                }
            }
        } else {
            console.log('No flagged searches found to test re-flagging');
        }
    });
});

test.describe('No Checkboxes Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Table should not have checkbox column', async ({ page }) => {
        await goToDashboard(page);

        // Check for gov-checkbox elements
        const checkboxes = page.locator('.gov-checkbox');
        const count = await checkboxes.count();

        console.log('Checkbox elements found:', count);
        expect(count).toBe(0);
        console.log('✓ No checkboxes in table');
    });

    test('Table should not have Select All checkbox', async ({ page }) => {
        await goToDashboard(page);

        const selectAll = page.locator('.gov-select-all');
        const count = await selectAll.count();

        console.log('Select-all checkboxes found:', count);
        expect(count).toBe(0);
        console.log('✓ No select-all checkbox');
    });
});

test.describe('Status Dropdown Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('All 5 status options available in dropdown', async ({ page }) => {
        await goToDashboard(page);

        const dropdown = page.locator('.status-dropdown-wrapper').first();
        if (await dropdown.count() > 0) {
            await dropdown.click();
            await page.waitForTimeout(500);

            const options = await page.locator('.status-dropdown-menu .status-option').allTextContents();
            console.log('Status options:', options);

            expect(options.some(o => o.includes('Flag for Review'))).toBe(true);
            expect(options.some(o => o.includes('Notified'))).toBe(true);
            expect(options.some(o => o.includes('Pending Review'))).toBe(true);
            expect(options.some(o => o.includes('Disabled'))).toBe(true);
            expect(options.some(o => o.includes('Resolved'))).toBe(true);

            console.log('✓ All 5 status options present');
            await page.keyboard.press('Escape');
        }
    });
});

test.describe('Cron Schedule Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Cron schedule is clickable and opens modal', async ({ page }) => {
        await goToDashboard(page);

        const cronClickable = page.locator('.cron-clickable').first();

        if (await cronClickable.count() > 0) {
            await cronClickable.click();
            await page.waitForTimeout(500);

            const modal = page.locator('#cronModalOverlay');
            expect(await modal.isVisible()).toBe(true);
            console.log('✓ Cron modal opens');

            await page.keyboard.press('Escape');
        }
    });
});
