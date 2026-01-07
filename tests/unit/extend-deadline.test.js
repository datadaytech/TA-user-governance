/**
 * Unit tests for Extend Deadline functionality
 * Tests the data flow from metric popup selection to deadline extension
 * Run with: npx jest tests/unit/extend-deadline.test.js
 */

describe('Extend Deadline Functionality', () => {

    // Helper function from governance.js
    function escapeString(str) {
        if (!str) return "";
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }

    describe('Data Format Mapping', () => {
        // Simulates the data format from currentMetricSearches
        const metricSearchFormat = {
            name: 'Test_Search_001',
            owner: 'admin',
            app: 'search',
            status: 'pending',
            deadlineEpoch: 1704672000,
            daysRemaining: 5
        };

        // Function that maps metric popup format to extend modal format
        function mapToExtendFormat(metricSearch) {
            return {
                searchName: metricSearch.name,
                owner: metricSearch.owner,
                app: metricSearch.app,
                status: metricSearch.status
            };
        }

        test('should map metric popup format to extend modal format', () => {
            const mapped = mapToExtendFormat(metricSearchFormat);

            expect(mapped.searchName).toBe('Test_Search_001');
            expect(mapped.owner).toBe('admin');
            expect(mapped.app).toBe('search');
            expect(mapped.status).toBe('pending');
        });

        test('should handle multiple searches mapping', () => {
            const metricSearches = [
                { name: 'Search1', owner: 'admin', app: 'app1', status: 'pending' },
                { name: 'Search2', owner: 'user1', app: 'app2', status: 'notified' },
                { name: 'Search3', owner: 'user2', app: 'app3', status: 'review' }
            ];

            const mapped = metricSearches.map(mapToExtendFormat);

            expect(mapped.length).toBe(3);
            expect(mapped[0].searchName).toBe('Search1');
            expect(mapped[1].searchName).toBe('Search2');
            expect(mapped[2].searchName).toBe('Search3');
        });
    });

    describe('Extension Calculation', () => {

        test('should calculate extension in seconds correctly', () => {
            const extensionDays = 7;
            const extensionSeconds = extensionDays * 24 * 60 * 60;
            expect(extensionSeconds).toBe(604800);
        });

        test('should calculate different extension periods', () => {
            expect(3 * 24 * 60 * 60).toBe(259200);   // 3 days
            expect(7 * 24 * 60 * 60).toBe(604800);   // 7 days
            expect(14 * 24 * 60 * 60).toBe(1209600); // 14 days
            expect(30 * 24 * 60 * 60).toBe(2592000); // 30 days
        });
    });

    describe('Condition Building for SPL', () => {

        function buildConditions(searches) {
            return searches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            }).join(' OR ');
        }

        test('should build single search condition', () => {
            const searches = [{ searchName: 'Test_Search', owner: 'admin' }];
            const conditions = buildConditions(searches);

            expect(conditions).toBe('search_name="Test_Search"');
        });

        test('should build multiple search conditions with OR', () => {
            const searches = [
                { searchName: 'Search1', owner: 'admin' },
                { searchName: 'Search2', owner: 'user1' },
                { searchName: 'Search3', owner: 'user2' }
            ];
            const conditions = buildConditions(searches);

            expect(conditions).toBe('search_name="Search1" OR search_name="Search2" OR search_name="Search3"');
        });

        test('should escape special characters in search names', () => {
            const searches = [
                { searchName: 'Search with "quotes"', owner: 'admin' },
                { searchName: 'Search with \\backslash', owner: 'admin' }
            ];
            const conditions = buildConditions(searches);

            expect(conditions).toContain('search_name="Search with \\"quotes\\""');
            expect(conditions).toContain('search_name="Search with \\\\backslash"');
        });

        test('should handle empty array', () => {
            const searches = [];
            const conditions = buildConditions(searches);

            expect(conditions).toBe('');
        });
    });

    describe('Extend Deadline SPL Query Generation', () => {

        function generateExtendQuery(searches, extensionSeconds) {
            if (!searches || searches.length === 0) {
                return null;
            }

            var conditions = searches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            }).join(' OR ');

            return '| inputlookup flagged_searches_lookup ' +
                '| eval remediation_deadline = if(' + conditions + ', remediation_deadline + ' + extensionSeconds + ', remediation_deadline)' +
                '| outputlookup flagged_searches_lookup';
        }

        test('should generate valid extend query for single search', () => {
            const searches = [{ searchName: 'My_Test_Search', owner: 'admin' }];
            const extensionSeconds = 604800; // 7 days

            const query = generateExtendQuery(searches, extensionSeconds);

            expect(query).toContain('| inputlookup flagged_searches_lookup');
            expect(query).toContain('search_name="My_Test_Search"');
            expect(query).toContain('remediation_deadline + 604800');
            expect(query).toContain('| outputlookup flagged_searches_lookup');
        });

        test('should generate valid extend query for multiple searches', () => {
            const searches = [
                { searchName: 'Search1', owner: 'admin' },
                { searchName: 'Search2', owner: 'user1' }
            ];
            const extensionSeconds = 259200; // 3 days

            const query = generateExtendQuery(searches, extensionSeconds);

            expect(query).toContain('search_name="Search1" OR search_name="Search2"');
            expect(query).toContain('remediation_deadline + 259200');
        });

        test('should return null for empty searches array', () => {
            const query = generateExtendQuery([], 604800);
            expect(query).toBeNull();
        });

        test('should return null for null searches', () => {
            const query = generateExtendQuery(null, 604800);
            expect(query).toBeNull();
        });
    });

    describe('Custom Days Input Validation', () => {

        function parseCustomDays(inputValue) {
            var val = parseInt(inputValue);
            if (isNaN(val) || val <= 0 || val > 365) {
                return null;
            }
            return val;
        }

        test('should parse valid numeric input', () => {
            expect(parseCustomDays('7')).toBe(7);
            expect(parseCustomDays('14')).toBe(14);
            expect(parseCustomDays('30')).toBe(30);
            expect(parseCustomDays('365')).toBe(365);
        });

        test('should return null for invalid input', () => {
            expect(parseCustomDays('')).toBeNull();
            expect(parseCustomDays('abc')).toBeNull();
            expect(parseCustomDays('0')).toBeNull();
            expect(parseCustomDays('-5')).toBeNull();
            expect(parseCustomDays('366')).toBeNull(); // > 365
        });

        test('should handle decimal input by truncating', () => {
            expect(parseCustomDays('7.5')).toBe(7);
            expect(parseCustomDays('14.9')).toBe(14);
        });
    });

    describe('Preview Date Calculation', () => {

        function calculatePreviewDate(extensionDays) {
            var newDate = new Date();
            newDate.setDate(newDate.getDate() + extensionDays);
            return newDate;
        }

        test('should calculate future date correctly', () => {
            const now = new Date();
            const futureDate = calculatePreviewDate(7);

            const diffMs = futureDate - now;
            const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

            expect(diffDays).toBe(7);
        });

        test('should handle different extension periods', () => {
            const now = new Date();

            [3, 7, 14, 30].forEach(days => {
                const futureDate = calculatePreviewDate(days);
                const diffMs = futureDate - now;
                const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

                expect(diffDays).toBe(days);
            });
        });
    });

    describe('Full Extend Flow Simulation', () => {

        // This simulates the full data flow from metric popup to extend execution
        function simulateExtendFlow(metricSearches, extensionDays) {
            // Step 1: Map from metric format to extend format
            var mappedSearches = metricSearches.map(function(s) {
                return {
                    searchName: s.name,
                    owner: s.owner,
                    app: s.app,
                    status: s.status
                };
            });

            // Step 2: Validate
            if (extensionDays <= 0 || !mappedSearches.length) {
                return { success: false, error: 'Invalid parameters' };
            }

            // Step 3: Calculate extension
            var extensionSeconds = extensionDays * 24 * 60 * 60;

            // Step 4: Build conditions
            var conditions = mappedSearches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            }).join(' OR ');

            // Step 5: Generate query
            var searchQuery = '| inputlookup flagged_searches_lookup ' +
                '| eval remediation_deadline = if(' + conditions + ', remediation_deadline + ' + extensionSeconds + ', remediation_deadline)' +
                '| outputlookup flagged_searches_lookup';

            return {
                success: true,
                query: searchQuery,
                searchCount: mappedSearches.length,
                extensionSeconds: extensionSeconds
            };
        }

        test('should complete full extend flow successfully', () => {
            const metricSearches = [
                { name: 'Governance_Test_Search_1', owner: 'admin', app: 'TA-user-governance', status: 'pending' },
                { name: 'Governance_Test_Search_2', owner: 'admin', app: 'TA-user-governance', status: 'notified' }
            ];

            const result = simulateExtendFlow(metricSearches, 7);

            expect(result.success).toBe(true);
            expect(result.searchCount).toBe(2);
            expect(result.extensionSeconds).toBe(604800);
            expect(result.query).toContain('Governance_Test_Search_1');
            expect(result.query).toContain('Governance_Test_Search_2');
        });

        test('should fail with invalid extension days', () => {
            const metricSearches = [{ name: 'Test', owner: 'admin', app: 'app', status: 'pending' }];

            expect(simulateExtendFlow(metricSearches, 0).success).toBe(false);
            expect(simulateExtendFlow(metricSearches, -5).success).toBe(false);
        });

        test('should fail with empty searches array', () => {
            expect(simulateExtendFlow([], 7).success).toBe(false);
        });
    });

    describe('Edge Cases', () => {

        test('should handle search names with special characters', () => {
            const metricSearches = [
                { name: 'Search_with_"quotes"', owner: 'admin', app: 'app', status: 'pending' },
                { name: "Search_with_'apostrophe'", owner: 'admin', app: 'app', status: 'pending' },
                { name: 'Search with spaces', owner: 'admin', app: 'app', status: 'pending' }
            ];

            var mappedSearches = metricSearches.map(function(s) {
                return { searchName: s.name, owner: s.owner, app: s.app, status: s.status };
            });

            var conditions = mappedSearches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            }).join(' OR ');

            expect(conditions).toContain('search_name="Search_with_\\"quotes\\""');
            expect(conditions).toContain("search_name=\"Search_with_\\'apostrophe\\'\"");
            expect(conditions).toContain('search_name="Search with spaces"');
        });

        test('should handle very long search names', () => {
            const longName = 'A'.repeat(500);
            const metricSearches = [{ name: longName, owner: 'admin', app: 'app', status: 'pending' }];

            var mappedSearches = metricSearches.map(function(s) {
                return { searchName: s.name };
            });

            var conditions = mappedSearches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            });

            expect(conditions[0]).toContain(longName);
        });

        test('should handle unicode characters in search names', () => {
            const metricSearches = [
                { name: 'Search_日本語', owner: 'admin', app: 'app', status: 'pending' },
                { name: 'Search_émoji_🔍', owner: 'admin', app: 'app', status: 'pending' }
            ];

            var mappedSearches = metricSearches.map(function(s) {
                return { searchName: s.name };
            });

            expect(mappedSearches[0].searchName).toBe('Search_日本語');
            expect(mappedSearches[1].searchName).toBe('Search_émoji_🔍');
        });
    });

});
