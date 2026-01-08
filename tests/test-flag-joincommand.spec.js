/**
 * Test flagging Governance_Test_JoinCommand with visual indicator verification
 */

const { test, expect } = require('@playwright/test');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

test('Flag Governance_Test_JoinCommand and verify visual indicator', async ({ page }) => {
    // Track all console logs
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

    // Navigate to governance_dashboard
    await page.goto(`${SPLUNK_URL}/en-US/app/TA-user-governance/governance_dashboard`);
    await page.waitForLoadState('networkidle');

    // Wait for tables to populate - wait for any table row
    console.log('Waiting for table to populate...');
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
    await page.waitForTimeout(3000); // Extra wait for enhancement

    // Check if we have any checkboxes
    let checkboxCount = await page.locator('.gov-checkbox').count();
    console.log('Initial checkbox count:', checkboxCount);

    // If no checkboxes, wait more
    if (checkboxCount === 0) {
        console.log('No checkboxes found, waiting more...');
        await page.waitForTimeout(5000);
        checkboxCount = await page.locator('.gov-checkbox').count();
        console.log('Checkbox count after wait:', checkboxCount);
    }

    // Take screenshot of current state
    await page.screenshot({ path: 'screenshots/before-flag-joincommand.png' });

    // Check current flagged searches
    console.log('\n=== Checking current flagged searches ===');
    const flaggedBefore = await page.evaluate(async () => {
        return new Promise((resolve) => {
            require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                var search = new SearchManager({
                    id: 'check_flagged_' + Date.now(),
                    search: '| inputlookup flagged_searches_lookup | table search_name, status',
                    earliest_time: '-1h',
                    latest_time: 'now',
                    autostart: true
                });
                search.on('search:done', function() {
                    var results = search.data('results');
                    if (results) {
                        results.on('data', function() {
                            resolve(results.data().rows || []);
                        });
                    } else {
                        resolve([]);
                    }
                });
                setTimeout(() => resolve([]), 5000);
            });
        });
    });
    console.log('Flagged searches before:', flaggedBefore);

    // Check if JoinCommand is already flagged
    const joinCommandFlagged = flaggedBefore.some(row => row[0] && row[0].includes('JoinCommand'));
    console.log('JoinCommand already flagged:', joinCommandFlagged);

    // Find the checkbox for Governance_Test_JoinCommand
    console.log('\n=== Looking for Governance_Test_JoinCommand checkbox ===');

    // Try multiple selectors
    let targetCheckbox = null;

    // Method 1: Direct attribute selector
    targetCheckbox = page.locator('.gov-checkbox[data-search*="JoinCommand"]').first();
    if (await targetCheckbox.count() > 0) {
        console.log('Found via direct selector');
    } else {
        // Method 2: Search through all checkboxes
        const allCheckboxes = await page.locator('.gov-checkbox').all();
        console.log('Total checkboxes found:', allCheckboxes.length);

        for (const cb of allCheckboxes) {
            const searchName = await cb.getAttribute('data-search');
            console.log('Checkbox data-search:', searchName);
            if (searchName && searchName.includes('JoinCommand')) {
                targetCheckbox = cb;
                console.log('Found checkbox for:', searchName);
                break;
            }
        }
    }

    // Method 3: Find in table row text
    if (!targetCheckbox || await targetCheckbox.count() === 0) {
        console.log('Searching table rows for JoinCommand...');
        const rows = await page.locator('table tbody tr').all();
        console.log('Total table rows:', rows.length);

        for (const row of rows) {
            const text = await row.textContent();
            if (text.includes('JoinCommand')) {
                console.log('Found row containing JoinCommand');
                const checkbox = row.locator('input[type="checkbox"]');
                if (await checkbox.count() > 0) {
                    targetCheckbox = checkbox;
                    console.log('Found checkbox in row');
                    break;
                }
            }
        }
    }

    if (!targetCheckbox || await targetCheckbox.count() === 0) {
        // List all table content for debugging
        console.log('\n=== Dumping first 5 table rows ===');
        const rows = await page.locator('table tbody tr').all();
        for (let i = 0; i < Math.min(5, rows.length); i++) {
            const text = await rows[i].textContent();
            console.log(`Row ${i}:`, text.substring(0, 150));
        }

        await page.screenshot({ path: 'screenshots/joincommand-not-found.png' });
        throw new Error('Could not find Governance_Test_JoinCommand checkbox');
    }

    // Get current flagged state
    const flaggedAttrBefore = await targetCheckbox.getAttribute('data-flagged');
    console.log('Checkbox data-flagged before:', flaggedAttrBefore);

    // Click the checkbox
    console.log('\n=== Clicking checkbox ===');
    await targetCheckbox.scrollIntoViewIfNeeded();
    await targetCheckbox.click();
    await page.waitForTimeout(500);

    const isChecked = await targetCheckbox.isChecked();
    console.log('Checkbox is checked:', isChecked);
    expect(isChecked).toBe(true);

    // Set up dialog handler BEFORE clicking flag button
    page.once('dialog', async dialog => {
        console.log('Dialog appeared:', dialog.type());
        console.log('Dialog message:', dialog.message());
        await dialog.accept('Test flagging JoinCommand via automated test');
    });

    // Click Flag Selected button
    console.log('\n=== Clicking Flag Selected button ===');
    const flagBtn = page.locator('#flag-selected-btn');
    await expect(flagBtn).toBeVisible();
    await flagBtn.click();

    // Wait for the flag operation to complete
    console.log('Waiting for flag operation...');
    await page.waitForTimeout(5000);

    // Check if entry was added to lookup
    console.log('\n=== Checking flagged searches after ===');
    const flaggedAfter = await page.evaluate(async () => {
        return new Promise((resolve) => {
            require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
                var search = new SearchManager({
                    id: 'check_flagged_after_' + Date.now(),
                    search: '| inputlookup flagged_searches_lookup | table search_name, status, reason',
                    earliest_time: '-1h',
                    latest_time: 'now',
                    autostart: true
                });
                search.on('search:done', function() {
                    var results = search.data('results');
                    if (results) {
                        results.on('data', function() {
                            resolve(results.data().rows || []);
                        });
                    } else {
                        resolve([]);
                    }
                });
                setTimeout(() => resolve([]), 5000);
            });
        });
    });
    console.log('Flagged searches after:', flaggedAfter);

    // Verify JoinCommand is now in the flagged list
    const joinCommandInList = flaggedAfter.some(row => row[0] && row[0].includes('JoinCommand'));
    console.log('JoinCommand in flagged list:', joinCommandInList);
    expect(joinCommandInList).toBe(true);

    // Check visual indicator on the row
    console.log('\n=== Checking visual indicator ===');

    // Re-locate the checkbox after potential DOM changes
    const checkboxAfter = page.locator('.gov-checkbox[data-search*="JoinCommand"]').first();
    if (await checkboxAfter.count() > 0) {
        const flaggedAttrAfter = await checkboxAfter.getAttribute('data-flagged');
        console.log('Checkbox data-flagged after:', flaggedAttrAfter);
        expect(flaggedAttrAfter).toBe('true');

        // Check for flag indicator in the same row
        const row = checkboxAfter.locator('xpath=ancestor::tr');
        const hasRowFlaggedClass = await row.evaluate(el => el.classList.contains('row-flagged'));
        console.log('Row has row-flagged class:', hasRowFlaggedClass);

        const flagIndicator = row.locator('.flag-indicator');
        const indicatorCount = await flagIndicator.count();
        console.log('Flag indicator count in row:', indicatorCount);

        if (indicatorCount > 0) {
            console.log('✓ Visual indicator is present!');
        } else {
            console.log('✗ Visual indicator NOT found');
        }

        expect(indicatorCount).toBeGreaterThan(0);
    } else {
        console.log('WARNING: Could not find checkbox after flagging');
    }

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/after-flag-joincommand.png' });
    console.log('\n✓ Test completed - screenshots saved');
});
