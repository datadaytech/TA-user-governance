/**
 * Unit tests for Unflag functionality
 * Tests the unflag flow including condition building and SPL query generation
 */

describe('Unflag Functionality', () => {

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

    describe('Condition Building', () => {

        function buildConditions(searches) {
            return searches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            }).join(' OR ');
        }

        test('should build single search condition', () => {
            const searches = [{ searchName: 'Test_Search' }];
            const conditions = buildConditions(searches);
            expect(conditions).toBe('search_name="Test_Search"');
        });

        test('should build multiple search conditions with OR', () => {
            const searches = [
                { searchName: 'Search1' },
                { searchName: 'Search2' },
                { searchName: 'Search3' }
            ];
            const conditions = buildConditions(searches);
            expect(conditions).toBe('search_name="Search1" OR search_name="Search2" OR search_name="Search3"');
        });

        test('should escape special characters', () => {
            const searches = [{ searchName: 'Search with "quotes"' }];
            const conditions = buildConditions(searches);
            expect(conditions).toBe('search_name="Search with \\"quotes\\""');
        });

        test('should handle empty array', () => {
            const conditions = buildConditions([]);
            expect(conditions).toBe('');
        });
    });

    describe('SPL Query Generation', () => {

        function generateUnflagQuery(searches) {
            if (!searches || searches.length === 0) return null;

            var conditions = searches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            }).join(' OR ');

            return '| inputlookup flagged_searches_lookup ' +
                '| eval status = if(' + conditions + ', "resolved", status)' +
                '| outputlookup flagged_searches_lookup';
        }

        test('should generate valid unflag query for single search', () => {
            const searches = [{ searchName: 'My_Test_Search' }];
            const query = generateUnflagQuery(searches);

            expect(query).toContain('| inputlookup flagged_searches_lookup');
            expect(query).toContain('search_name="My_Test_Search"');
            expect(query).toContain('"resolved"');
            expect(query).toContain('| outputlookup flagged_searches_lookup');
        });

        test('should generate valid unflag query for multiple searches', () => {
            const searches = [
                { searchName: 'Search1' },
                { searchName: 'Search2' }
            ];
            const query = generateUnflagQuery(searches);

            expect(query).toContain('search_name="Search1" OR search_name="Search2"');
        });

        test('should return null for empty searches', () => {
            expect(generateUnflagQuery([])).toBeNull();
            expect(generateUnflagQuery(null)).toBeNull();
        });
    });

    describe('Confirm Message Generation', () => {

        function generateConfirmMessage(searches) {
            if (!searches || searches.length === 0) return null;

            return searches.length === 1
                ? "Mark '" + searches[0].searchName + "' as resolved?"
                : "Mark " + searches.length + " searches as resolved?";
        }

        test('should generate single search message', () => {
            const searches = [{ searchName: 'My_Search' }];
            const msg = generateConfirmMessage(searches);
            expect(msg).toBe("Mark 'My_Search' as resolved?");
        });

        test('should generate multiple searches message', () => {
            const searches = [
                { searchName: 'Search1' },
                { searchName: 'Search2' },
                { searchName: 'Search3' }
            ];
            const msg = generateConfirmMessage(searches);
            expect(msg).toBe("Mark 3 searches as resolved?");
        });

        test('should return null for empty array', () => {
            expect(generateConfirmMessage([])).toBeNull();
        });
    });

    describe('Metric Popup Unflag Query', () => {

        // Tests for the #metricPopupUnflag functionality
        function generateMetricUnflagQuery(searches) {
            if (!searches || searches.length === 0) return null;

            var conditions = searches.map(function(s) {
                return 'search_name!="' + escapeString(s.name) + '"';
            }).join(' AND ');

            return '| inputlookup flagged_searches_lookup | where ' + conditions + ' | outputlookup flagged_searches_lookup';
        }

        test('should generate DELETE-style query for metric popup unflag', () => {
            const searches = [{ name: 'Search_To_Remove' }];
            const query = generateMetricUnflagQuery(searches);

            expect(query).toContain('| inputlookup flagged_searches_lookup');
            expect(query).toContain('| where search_name!="Search_To_Remove"');
            expect(query).toContain('| outputlookup flagged_searches_lookup');
        });

        test('should use AND for multiple deletions', () => {
            const searches = [
                { name: 'Search1' },
                { name: 'Search2' }
            ];
            const query = generateMetricUnflagQuery(searches);

            expect(query).toContain('search_name!="Search1" AND search_name!="Search2"');
        });

        test('should escape special characters in metric popup', () => {
            const searches = [{ name: 'Search with "special" chars' }];
            const query = generateMetricUnflagQuery(searches);

            expect(query).toContain('search_name!="Search with \\"special\\" chars"');
        });
    });

    describe('Full Unflag Flow Simulation', () => {

        function simulateUnflagFlow(selectedSearches) {
            if (!selectedSearches || selectedSearches.length === 0) {
                return { success: false, error: 'No searches selected' };
            }

            // Build condition
            var conditions = selectedSearches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            }).join(' OR ');

            // Generate query
            var searchQuery = '| inputlookup flagged_searches_lookup ' +
                '| eval status = if(' + conditions + ', "resolved", status)' +
                '| outputlookup flagged_searches_lookup';

            return {
                success: true,
                query: searchQuery,
                searchCount: selectedSearches.length,
                conditions: conditions
            };
        }

        test('should complete full unflag flow successfully', () => {
            const selectedSearches = [
                { searchName: 'Governance_Test_Search_1', owner: 'admin', flagged: true },
                { searchName: 'Governance_Test_Search_2', owner: 'admin', flagged: true }
            ];

            const result = simulateUnflagFlow(selectedSearches);

            expect(result.success).toBe(true);
            expect(result.searchCount).toBe(2);
            expect(result.query).toContain('Governance_Test_Search_1');
            expect(result.query).toContain('Governance_Test_Search_2');
            expect(result.query).toContain('"resolved"');
        });

        test('should fail with empty selections', () => {
            expect(simulateUnflagFlow([]).success).toBe(false);
            expect(simulateUnflagFlow(null).success).toBe(false);
        });
    });

    describe('Selected Searches Array Management', () => {

        test('should maintain searchName property from checkbox data', () => {
            // Simulating checkbox data attributes
            const checkboxData = {
                'data-search': 'My_Search',
                'data-owner': 'admin',
                'data-app': 'search',
                'data-flagged': 'true'
            };

            const selectedSearch = {
                searchName: checkboxData['data-search'],
                owner: checkboxData['data-owner'],
                app: checkboxData['data-app'],
                flagged: checkboxData['data-flagged'] === 'true'
            };

            expect(selectedSearch.searchName).toBe('My_Search');
            expect(selectedSearch.flagged).toBe(true);
        });

        test('should handle multiple selected checkboxes', () => {
            const checkboxes = [
                { 'data-search': 'Search1', 'data-flagged': 'true' },
                { 'data-search': 'Search2', 'data-flagged': 'true' },
                { 'data-search': 'Search3', 'data-flagged': 'false' }
            ];

            const selectedSearches = checkboxes.map(function(cb) {
                return {
                    searchName: cb['data-search'],
                    flagged: cb['data-flagged'] === 'true'
                };
            });

            expect(selectedSearches.length).toBe(3);
            expect(selectedSearches[0].searchName).toBe('Search1');
            expect(selectedSearches[2].flagged).toBe(false);
        });
    });

    describe('Edge Cases', () => {

        test('should handle search names with special characters', () => {
            const searches = [
                { searchName: 'Search with spaces' },
                { searchName: 'Search_with_underscores' },
                { searchName: 'Search-with-hyphens' },
                { searchName: 'Search.with.dots' }
            ];

            var conditions = searches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            }).join(' OR ');

            expect(conditions).toContain('search_name="Search with spaces"');
            expect(conditions).toContain('search_name="Search_with_underscores"');
            expect(conditions).toContain('search_name="Search-with-hyphens"');
            expect(conditions).toContain('search_name="Search.with.dots"');
        });

        test('should handle very long search names', () => {
            const longName = 'A'.repeat(500);
            const searches = [{ searchName: longName }];

            var conditions = searches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            });

            expect(conditions[0]).toContain(longName);
        });

        test('should handle unicode characters', () => {
            const searches = [
                { searchName: 'Search_日本語' },
                { searchName: 'Búsqueda_español' }
            ];

            var conditions = searches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            }).join(' OR ');

            expect(conditions).toContain('Search_日本語');
            expect(conditions).toContain('Búsqueda_español');
        });
    });

});
