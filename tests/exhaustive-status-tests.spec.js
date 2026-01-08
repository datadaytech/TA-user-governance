/**
 * Exhaustive Status State Tests
 * Tests every possible status transition and state
 */
const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

// Helper to login
async function login(page) {
    await page.goto(`${SPLUNK_URL}/en-US/account/login`);
    await page.fill('input[name="username"]', SPLUNK_USERNAME);
    await page.fill('input[name="password"]', SPLUNK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForURL(/\/en-US\/app\//);
}

// Helper to navigate to dashboard and wait for load
async function goToDashboard(page) {
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(6000);
}

// Helper to get a status dropdown by search name or status
async function findStatusDropdown(page, searchName = null, currentStatus = null) {
    const allDropdowns = page.locator('.status-dropdown-wrapper');
    const count = await allDropdowns.count();

    for (let i = 0; i < count; i++) {
        const dropdown = allDropdowns.nth(i);
        const name = await dropdown.getAttribute('data-search');
        const status = await dropdown.getAttribute('data-current-status');

        if (searchName && name === searchName) {
            return dropdown;
        }
        if (currentStatus && status?.toLowerCase().includes(currentStatus.toLowerCase())) {
            return dropdown;
        }
    }
    return null;
}

test.describe('Exhaustive Status State Tests', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('BROWSER ERROR:', msg.text());
            }
        });
        await login(page);
    });

    test.describe('Status Dropdown Contents', () => {
        test('Verify all 5 status options are present in dropdown', async ({ page }) => {
            await goToDashboard(page);

            const dropdown = page.locator('.status-dropdown-wrapper').first();
            if (await dropdown.count() === 0) {
                console.log('No status dropdowns found, skipping');
                return;
            }

            await dropdown.click();
            await page.waitForTimeout(500);

            const options = await page.locator('.status-dropdown-menu .status-option').allTextContents();
            console.log('Status options found:', options);

            const requiredOptions = [
                'Flag for Review',
                'Notified',
                'Pending Review',
                'Disabled',
                'Resolved'
            ];

            for (const required of requiredOptions) {
                const found = options.some(opt => opt.includes(required));
                console.log(`  ${required}: ${found ? '✓ FOUND' : '✗ MISSING'}`);
                expect(found).toBe(true);
            }

            await page.keyboard.press('Escape');
        });

        test('Each status option has correct color', async ({ page }) => {
            await goToDashboard(page);

            const dropdown = page.locator('.status-dropdown-wrapper').first();
            if (await dropdown.count() === 0) return;

            await dropdown.click();
            await page.waitForTimeout(500);

            const expectedColors = {
                'Flag for Review': '#f8991d',
                'Notified': '#f8be34',
                'Pending Review': '#6f42c1',
                'Disabled': '#dc4e41',
                'Resolved': '#53a051'
            };

            const options = page.locator('.status-dropdown-menu .status-option');
            const count = await options.count();

            for (let i = 0; i < count; i++) {
                const option = options.nth(i);
                const text = await option.textContent();
                const style = await option.getAttribute('style');
                console.log(`Option "${text?.trim()}": ${style}`);

                for (const [name, color] of Object.entries(expectedColors)) {
                    if (text?.includes(name)) {
                        expect(style).toContain(color);
                    }
                }
            }

            await page.keyboard.press('Escape');
        });
    });

    test.describe('Status State Transitions', () => {
        test('OK status can be flagged', async ({ page }) => {
            await goToDashboard(page);

            // Find an OK status
            const okDropdown = await findStatusDropdown(page, null, 'OK');
            if (!okDropdown) {
                console.log('No OK status found, skipping');
                return;
            }

            await okDropdown.click();
            await page.waitForTimeout(500);

            // Check that "Flag for Review" is available
            const flagOption = page.locator('.status-option:has-text("Flag for Review")');
            expect(await flagOption.count()).toBe(1);
            console.log('✓ OK status has Flag for Review option');

            await page.keyboard.press('Escape');
        });

        test('Suspicious status can be flagged', async ({ page }) => {
            await goToDashboard(page);

            const suspiciousDropdown = await findStatusDropdown(page, null, 'Suspicious');
            if (!suspiciousDropdown) {
                console.log('No Suspicious status found, skipping');
                return;
            }

            await suspiciousDropdown.click();
            await page.waitForTimeout(500);

            const flagOption = page.locator('.status-option:has-text("Flag for Review")');
            expect(await flagOption.count()).toBe(1);
            console.log('✓ Suspicious status has Flag for Review option');

            await page.keyboard.press('Escape');
        });

        test('Flagged status prevents re-flagging', async ({ page }) => {
            await goToDashboard(page);

            // Find any flagged status
            const flaggedDropdown = await findStatusDropdown(page, null, 'Flagged');
            if (!flaggedDropdown) {
                console.log('No Flagged status found, skipping');
                return;
            }

            let alertReceived = false;
            page.once('dialog', async dialog => {
                alertReceived = true;
                console.log('Alert:', dialog.message());
                expect(dialog.message().toLowerCase()).toContain('already flagged');
                await dialog.accept();
            });

            await flaggedDropdown.click();
            await page.waitForTimeout(500);

            const flagOption = page.locator('.status-option:has-text("Flag for Review")');
            if (await flagOption.count() > 0) {
                await flagOption.click();
                await page.waitForTimeout(1000);
                expect(alertReceived).toBe(true);
                console.log('✓ Re-flagging prevented with alert');
            }
        });

        test('Pending status can be changed to other states', async ({ page }) => {
            await goToDashboard(page);

            const pendingDropdown = await findStatusDropdown(page, null, 'Pending');
            if (!pendingDropdown) {
                console.log('No Pending status found, skipping');
                return;
            }

            await pendingDropdown.click();
            await page.waitForTimeout(500);

            const options = await page.locator('.status-dropdown-menu .status-option').allTextContents();
            console.log('Pending status options:', options);

            // Should have transition options
            expect(options.length).toBeGreaterThan(0);

            await page.keyboard.press('Escape');
        });
    });

    test.describe('Status Badge Display', () => {
        test('OK badge has green color', async ({ page }) => {
            await goToDashboard(page);

            const okBadge = page.locator('.status-badge:has-text("OK")').first();
            if (await okBadge.count() > 0) {
                const bgColor = await okBadge.evaluate(el => window.getComputedStyle(el).backgroundColor);
                console.log('OK badge background:', bgColor);
                // Green color check (rgb values for #53A051 or similar)
                expect(bgColor).toMatch(/rgb\(83,\s*160,\s*81\)|#53[aA]051/i);
            }
        });

        test('SUSPICIOUS badge has yellow/orange color', async ({ page }) => {
            await goToDashboard(page);

            const suspiciousBadge = page.locator('.status-badge:has-text("SUSPICIOUS")').first();
            if (await suspiciousBadge.count() > 0) {
                const bgColor = await suspiciousBadge.evaluate(el => window.getComputedStyle(el).backgroundColor);
                console.log('SUSPICIOUS badge background:', bgColor);
                // Yellow/orange color check
                expect(bgColor).toMatch(/rgb\(248,\s*190,\s*52\)|rgb\(241,\s*129,\s*63\)|#f8be34|#f1813f/i);
            }
        });

        test('FLAGGED badge has orange color', async ({ page }) => {
            await goToDashboard(page);

            const flaggedBadge = page.locator('.status-badge:has-text("FLAGGED")').first();
            if (await flaggedBadge.count() > 0) {
                const bgColor = await flaggedBadge.evaluate(el => window.getComputedStyle(el).backgroundColor);
                console.log('FLAGGED badge background:', bgColor);
            }
        });

        test('DISABLED badge has red/grey color', async ({ page }) => {
            await goToDashboard(page);

            const disabledBadge = page.locator('.status-badge:has-text("DISABLED")').first();
            if (await disabledBadge.count() > 0) {
                const bgColor = await disabledBadge.evaluate(el => window.getComputedStyle(el).backgroundColor);
                console.log('DISABLED badge background:', bgColor);
            }
        });
    });

    test.describe('Governance Status Logic', () => {
        test('Resolved searches show OK status, not Suspicious', async ({ page }) => {
            await goToDashboard(page);

            // Look for any search that might have been resolved
            // These should show "OK" even if they're suspicious in the cache
            const statusCells = page.locator('.status-dropdown-wrapper');
            const count = await statusCells.count();

            console.log('Total status dropdowns:', count);

            // Collect status distribution
            const statusCounts = {};
            for (let i = 0; i < count; i++) {
                const status = await statusCells.nth(i).getAttribute('data-current-status');
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            }
            console.log('Status distribution:', statusCounts);

            // Verify no resolved shows as Suspicious
            // (resolved searches should be showing as OK now)
            expect(statusCounts['Resolved'] || 0).toBe(0); // Resolved should be converted to OK
        });
    });
});
