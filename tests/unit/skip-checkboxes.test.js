/**
 * Unit tests for checkbox skip logic in enhanceTable function
 * Tests that certain panels (Activity, Audit, History, Cost) don't get checkboxes
 */

describe('Checkbox Skip Logic', () => {
    // Helper function that mirrors the logic in governance.js
    function shouldSkipCheckboxes(panelTitle) {
        var isCostPanel = panelTitle.indexOf('Highest Cost') > -1 || panelTitle.indexOf('Cost Impact') > -1;
        var isActivityPanel = panelTitle.indexOf('Activity') > -1 || panelTitle.indexOf('Audit') > -1 || panelTitle.indexOf('History') > -1;
        return isCostPanel || isActivityPanel;
    }

    describe('Activity/Audit/History panels', () => {
        test('should skip checkboxes for "Recent Dashboard Governance Activity" panel', () => {
            expect(shouldSkipCheckboxes('Recent Dashboard Governance Activity')).toBe(true);
        });

        test('should skip checkboxes for "Audit History" panel', () => {
            expect(shouldSkipCheckboxes('Audit History')).toBe(true);
        });

        test('should skip checkboxes for "Activity Log" panel', () => {
            expect(shouldSkipCheckboxes('Activity Log')).toBe(true);
        });

        test('should skip checkboxes for "Governance Activity" panel', () => {
            expect(shouldSkipCheckboxes('Governance Activity')).toBe(true);
        });

        test('should skip checkboxes for "Search History" panel', () => {
            expect(shouldSkipCheckboxes('Search History')).toBe(true);
        });

        test('should skip checkboxes for "Audit Trail" panel', () => {
            expect(shouldSkipCheckboxes('Audit Trail')).toBe(true);
        });
    });

    describe('Cost panels', () => {
        test('should skip checkboxes for "Highest Cost Searches" panel', () => {
            expect(shouldSkipCheckboxes('Highest Cost Searches')).toBe(true);
        });

        test('should skip checkboxes for "Cost Impact Analysis" panel', () => {
            expect(shouldSkipCheckboxes('Cost Impact Analysis')).toBe(true);
        });
    });

    describe('Panels that SHOULD have checkboxes', () => {
        test('should NOT skip checkboxes for "All Scheduled Searches" panel', () => {
            expect(shouldSkipCheckboxes('All Scheduled Searches')).toBe(false);
        });

        test('should NOT skip checkboxes for "Suspicious Scheduled Searches" panel', () => {
            expect(shouldSkipCheckboxes('Suspicious Scheduled Searches')).toBe(false);
        });

        test('should NOT skip checkboxes for "Currently Flagged" panel', () => {
            expect(shouldSkipCheckboxes('Currently Flagged')).toBe(false);
        });

        test('should NOT skip checkboxes for "Large/Complex Dashboards" panel', () => {
            expect(shouldSkipCheckboxes('Large/Complex Dashboards - Review for Optimization')).toBe(false);
        });

        test('should NOT skip checkboxes for "All Dashboards" panel', () => {
            expect(shouldSkipCheckboxes('All Dashboards')).toBe(false);
        });

        test('should NOT skip checkboxes for "Pending Remediation" panel', () => {
            expect(shouldSkipCheckboxes('Pending Remediation')).toBe(false);
        });
    });

    describe('Edge cases', () => {
        test('should handle empty panel title', () => {
            expect(shouldSkipCheckboxes('')).toBe(false);
        });

        test('should be case-sensitive (Activity vs activity)', () => {
            // The logic uses indexOf which is case-sensitive
            expect(shouldSkipCheckboxes('Recent activity log')).toBe(false);
            expect(shouldSkipCheckboxes('Recent Activity Log')).toBe(true);
        });

        test('should handle partial matches correctly', () => {
            // "Inactive" contains "Activ" but not "Activity"
            expect(shouldSkipCheckboxes('Inactive Searches')).toBe(false);
        });
    });
});
