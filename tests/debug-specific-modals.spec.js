/**
 * Debug specific modals on governance_dashboard
 */

const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Debug specific modals on governance_dashboard', async ({ page }) => {
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('modal') || text.includes('popup') || text.includes('impact') ||
            text.includes('flagged') || text.includes('Error') || text.includes('Button clicked')) {
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

    console.log('\n=== Testing "View All Flagged" button BEFORE flag ===');

    // List all action buttons
    const buttons = await page.locator('.action-buttons button, .btn').all();
    console.log('Total buttons found:', buttons.length);
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
        const text = await buttons[i].textContent();
        const id = await buttons[i].getAttribute('id');
        console.log(`  Button ${i}: "${text.trim()}" id="${id}"`);
    }

    // Test View Flagged button
    const viewFlaggedBtn = page.locator('#view-flagged-btn, button:has-text("View All Flagged")').first();
    if (await viewFlaggedBtn.count() > 0) {
        console.log('\nClicking View All Flagged button...');
        await viewFlaggedBtn.click();
        await page.waitForTimeout(2000);

        // Check for flagged modal
        const flaggedModalOpen = await page.evaluate(() => {
            const el = document.getElementById('flaggedModalOverlay');
            return el && el.classList.contains('active');
        });
        console.log('Flagged modal opened:', flaggedModalOpen);

        if (flaggedModalOpen) {
            // Close it using the close button (Escape was fixed, but use button to be safe)
            const closeBtn = page.locator('#flaggedModalClose, #flaggedModalCancel').first();
            if (await closeBtn.count() > 0) {
                await closeBtn.click();
            } else {
                await page.keyboard.press('Escape');
            }
            await page.waitForTimeout(500);
        }
    }

    // Test Preview Impact with a selection
    console.log('\n=== Testing "Preview Impact" button BEFORE flag ===');
    const checkbox = page.locator('.gov-checkbox').first();
    if (await checkbox.count() > 0) {
        await checkbox.click();
        await page.waitForTimeout(300);
        console.log('Selected a checkbox');

        const previewBtn = page.locator('#preview-impact-btn, button:has-text("Preview Impact")').first();
        if (await previewBtn.count() > 0) {
            console.log('Clicking Preview Impact...');
            await previewBtn.click();
            await page.waitForTimeout(2000);

            // Check for impact modal
            const impactModalOpen = await page.evaluate(() => {
                const el = document.getElementById('impactModalOverlay');
                return el && el.classList.contains('active');
            });
            console.log('Impact modal opened:', impactModalOpen);

            if (impactModalOpen) {
                // Close impact modal
                const impactClose = page.locator('#impactModalClose').first();
                if (await impactClose.count() > 0) {
                    await impactClose.click();
                } else {
                    await page.keyboard.press('Escape');
                }
                await page.waitForTimeout(500);
            }
        }

        // Uncheck the checkbox before continuing
        const checkboxStillChecked = await checkbox.isChecked();
        if (checkboxStillChecked) {
            await checkbox.click();
            await page.waitForTimeout(300);
        }
    }

    // Now flag a search
    console.log('\n=== Flagging a search ===');
    const unflaggedCheckbox = page.locator('.gov-checkbox[data-flagged="false"]').first();
    if (await unflaggedCheckbox.count() > 0) {
        page.once('dialog', async dialog => {
            await dialog.accept('Test');
        });

        await unflaggedCheckbox.click();
        await page.waitForTimeout(300);
        await page.locator('#flag-selected-btn').click();
        await page.waitForTimeout(7000);

        console.log('\n=== Testing modals AFTER flag ===');

        // Test View Flagged again
        const viewFlaggedAfter = page.locator('#view-flagged-btn').first();
        if (await viewFlaggedAfter.count() > 0) {
            console.log('Clicking View All Flagged after flag...');
            await viewFlaggedAfter.click();
            await page.waitForTimeout(2000);

            const flaggedModalAfter = await page.evaluate(() => {
                const el = document.getElementById('flaggedModalOverlay');
                return el && el.classList.contains('active');
            });
            console.log('Flagged modal opened AFTER flag:', flaggedModalAfter);

            if (!flaggedModalAfter) {
                const modalState = await page.evaluate(() => {
                    const el = document.getElementById('flaggedModalOverlay');
                    return el ? { exists: true, classes: el.className } : { exists: false };
                });
                console.log('Modal state:', modalState);
            } else {
                // Close flagged modal
                const closeFlaggedBtn = page.locator('#flaggedModalClose, #flaggedModalCancel').first();
                if (await closeFlaggedBtn.count() > 0) {
                    await closeFlaggedBtn.click();
                } else {
                    await page.keyboard.press('Escape');
                }
                await page.waitForTimeout(500);
            }
        }

        // Test Preview Impact after flag
        console.log('\nTesting Preview Impact after flag...');
        const checkboxAfter = page.locator('.gov-checkbox').first();
        if (await checkboxAfter.count() > 0) {
            await checkboxAfter.click();
            await page.waitForTimeout(300);

            const previewAfter = page.locator('#preview-impact-btn').first();
            if (await previewAfter.count() > 0) {
                await previewAfter.click();
                await page.waitForTimeout(2000);

                const impactAfter = await page.evaluate(() => {
                    const el = document.getElementById('impactModalOverlay');
                    return el && el.classList.contains('active');
                });
                console.log('Impact modal opened AFTER flag:', impactAfter);

                if (!impactAfter) {
                    const impactState = await page.evaluate(() => {
                        const el = document.getElementById('impactModalOverlay');
                        return el ? { exists: true, classes: el.className } : { exists: false };
                    });
                    console.log('Impact modal state:', impactState);
                }
            }
        }
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/specific-modals-debug.png' });
});
