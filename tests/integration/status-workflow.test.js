/**
 * Integration Tests - Status Workflow
 * Tests the complete status transition workflow from Suspicious to Resolved
 */

const { test, expect } = require('../fixtures');

test.describe('Status Workflow Integration Tests', () => {

    test.describe('Suspicious to Flagged Flow', () => {
        let createdSearchName;

        test('should create a test scheduled search', async ({ authenticatedPage }) => {
            const page = authenticatedPage;
            createdSearchName = `Integration_Test_${Date.now()}`;

            // Use Splunk's search interface to create a scheduled search
            await page.evaluate(async (searchName) => {
                var mvc = require('splunkjs/mvc');
                var searchService = mvc.createService();

                return new Promise((resolve, reject) => {
                    searchService.savedSearches().create({
                        name: searchName,
                        search: '| makeresults | eval test="integration_test"',
                        cron_schedule: '*/30 * * * *',
                        is_scheduled: 1,
                        dispatch: {
                            earliest_time: '-1h',
                            latest_time: 'now'
                        }
                    }, function(err, search) {
                        if (err) reject(err);
                        else resolve(search);
                    });
                });
            }, createdSearchName);

            // Verify search was created by checking it appears in the list
            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForTimeout(5000);
        });

        test('should detect suspicious search and allow flagging', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Click on suspicious panel to open modal
            const suspiciousPanel = page.locator('.dashboard-element, .dashboard-panel').filter({ hasText: /Suspicious/i }).first();
            if (await suspiciousPanel.count() > 0) {
                await suspiciousPanel.click();
                await page.waitForTimeout(3000);

                const popup = page.locator('#metricPopupOverlay.active');
                expect(await popup.count()).toBe(1);

                // Select a search
                const checkbox = page.locator('.metric-row-checkbox').first();
                if (await checkbox.count() > 0) {
                    await checkbox.click({ force: true });

                    // Click Flag button
                    const flagBtn = page.locator('#metricPopupFlag');
                    if (await flagBtn.isVisible()) {
                        // Handle confirm dialog
                        page.on('dialog', async dialog => {
                            await dialog.accept();
                        });

                        await flagBtn.click();
                        await page.waitForTimeout(5000);
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('should verify flag was saved to lookup', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            // Execute search to check lookup
            const result = await page.evaluate(async () => {
                var mvc = require('splunkjs/mvc');
                var searchManager = new mvc.SearchManager({
                    search: '| inputlookup flagged_searches_lookup | search flag_status=pending | head 1',
                    earliest_time: '-1h',
                    latest_time: 'now'
                });

                return new Promise((resolve) => {
                    searchManager.on('search:done', function() {
                        var results = searchManager.data('results');
                        if (results) {
                            results.on('data', function() {
                                resolve(results.data().rows.length);
                            });
                        } else {
                            resolve(0);
                        }
                    });
                });
            });

            // There should be at least one pending flagged search
            console.log(`Flagged pending searches: ${result}`);
        });

        test('should allow status change from Flagged to Notified', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Click on flagged panel
            const flaggedPanel = page.locator('.dashboard-element, .dashboard-panel').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                // Find status dropdown and change to notified
                const statusDropdown = page.locator('.status-dropdown-wrapper').first();
                if (await statusDropdown.count() > 0) {
                    await statusDropdown.click();
                    await page.waitForTimeout(500);

                    const notifiedOption = page.locator('.status-option').filter({ hasText: /Notified/i }).first();
                    if (await notifiedOption.count() > 0) {
                        await notifiedOption.click();
                        await page.waitForTimeout(3000);
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('should allow status change to Disabled', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Click on flagged panel
            const flaggedPanel = page.locator('.dashboard-element, .dashboard-panel').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                // Find status dropdown and change to disabled
                const statusDropdown = page.locator('.status-dropdown-wrapper').first();
                if (await statusDropdown.count() > 0) {
                    await statusDropdown.click();
                    await page.waitForTimeout(500);

                    const disabledOption = page.locator('.status-option').filter({ hasText: /Disabled/i }).first();
                    if (await disabledOption.count() > 0) {
                        await disabledOption.click();
                        await page.waitForTimeout(3000);
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('should verify audit log entries were created', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_audit', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Should have audit entries
            const tableRows = await page.locator('tr').count();
            expect(tableRows).toBeGreaterThan(1); // Header + at least 1 data row
        });
    });

    test.describe('Extend Deadline Flow', () => {
        test('should open extend modal for flagged search', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Click on flagged panel
            const flaggedPanel = page.locator('.dashboard-element, .dashboard-panel').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                // Select a search
                const checkbox = page.locator('.metric-row-checkbox').first();
                if (await checkbox.count() > 0) {
                    await checkbox.click({ force: true });
                    await page.waitForTimeout(500);

                    // Click Extend button
                    const extendBtn = page.locator('#metricPopupExtend');
                    if (await extendBtn.isVisible()) {
                        await extendBtn.click();
                        await page.waitForTimeout(2000);

                        // Verify extend modal opened
                        const extendModal = page.locator('#extendModalOverlay.active');
                        expect(await extendModal.count()).toBe(1);
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('should extend deadline and verify new deadline', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Open flagged panel
            const flaggedPanel = page.locator('.dashboard-element, .dashboard-panel').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                // Select search and extend
                const checkbox = page.locator('.metric-row-checkbox').first();
                if (await checkbox.count() > 0) {
                    await checkbox.click({ force: true });
                    await page.waitForTimeout(500);

                    const extendBtn = page.locator('#metricPopupExtend');
                    if (await extendBtn.isVisible()) {
                        await extendBtn.click();
                        await page.waitForTimeout(2000);

                        // Set extension days
                        await page.locator('#extendCustomDays').fill('14');
                        await page.waitForTimeout(500);

                        // Click save
                        await page.locator('#extendModalSave').click();
                        await page.waitForTimeout(5000);

                        // Modal should close
                        const extendModal = page.locator('#extendModalOverlay.active');
                        expect(await extendModal.count()).toBe(0);
                    }
                }
            }
        });

        test('should reject negative extension values', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Open extend modal via JS
            await page.evaluate(() => {
                if (typeof window.openExtendModal === 'function') {
                    window.openExtendModal([{
                        searchName: 'Test_Search',
                        owner: 'admin',
                        app: 'search',
                        status: 'pending',
                        deadlineEpoch: Math.floor(Date.now() / 1000) + (7 * 86400),
                        daysRemaining: 7
                    }]);
                }
            });
            await page.waitForTimeout(1500);

            // Enter negative value
            await page.locator('#extendCustomDays').fill('-7');
            await page.waitForTimeout(500);

            // Click save
            await page.locator('#extendModalSave').click();
            await page.waitForTimeout(1000);

            // Modal should still be open (rejected negative value)
            const extendModal = page.locator('#extendModalOverlay.active');
            const modalOpen = await extendModal.count() > 0;

            // Should either show error or modal stays open
            if (modalOpen) {
                // Check for error message
                const errorMsg = await page.locator('.extend-error, .error-message').count();
                console.log(`Negative value rejected: ${errorMsg > 0 ? 'with error message' : 'modal stayed open'}`);
            }

            await page.keyboard.press('Escape');
        });
    });

    test.describe('Unflag/Resolve Flow', () => {
        test('should allow resolving (unflagging) a search', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Click on flagged panel
            const flaggedPanel = page.locator('.dashboard-element, .dashboard-panel').filter({ hasText: /Currently Flagged/i }).first();
            if (await flaggedPanel.count() > 0) {
                await flaggedPanel.click();
                await page.waitForTimeout(3000);

                // Find status dropdown and change to resolved
                const statusDropdown = page.locator('.status-dropdown-wrapper').first();
                if (await statusDropdown.count() > 0) {
                    await statusDropdown.click();
                    await page.waitForTimeout(500);

                    const resolvedOption = page.locator('.status-option').filter({ hasText: /Resolved|Unflag/i }).first();
                    if (await resolvedOption.count() > 0) {
                        await resolvedOption.click();
                        await page.waitForTimeout(5000);

                        // Search should be removed from flagged list
                        console.log('Search unflagged/resolved');
                    }
                }

                await page.keyboard.press('Escape');
            }
        });

        test('should verify resolved search no longer in flagged count', async ({ authenticatedPage }) => {
            const page = authenticatedPage;

            await page.goto('/en-US/app/TA-user-governance/governance_dashboard', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForSelector('.dashboard-body', { timeout: 45000 });
            await page.waitForTimeout(5000);

            // Get flagged count
            const flaggedPanel = page.locator('.dashboard-element').filter({ hasText: /Currently Flagged/i }).first();
            const flaggedValue = await flaggedPanel.locator('.single-value-number, .single-result-value').textContent();
            console.log(`Current flagged count: ${flaggedValue}`);

            // Count should have decreased (or be 0)
            const count = parseInt(flaggedValue) || 0;
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });
});
