/**
 * Unit tests for Negative Extension functionality
 * Tests reducing deadline time and disable prompts when deadline expires
 */

describe('Negative Extension Functionality', () => {

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

    describe('Extension Value Validation', () => {

        function validateExtensionValue(inputVal, currentExtendDays) {
            var extensionDays = !isNaN(inputVal) ? inputVal : currentExtendDays;
            return {
                extensionDays: extensionDays,
                isValid: extensionDays !== 0,
                isReducing: extensionDays < 0
            };
        }

        test('should accept positive values', () => {
            const result = validateExtensionValue(7, 7);
            expect(result.isValid).toBe(true);
            expect(result.isReducing).toBe(false);
            expect(result.extensionDays).toBe(7);
        });

        test('should accept negative values', () => {
            const result = validateExtensionValue(-3, 7);
            expect(result.isValid).toBe(true);
            expect(result.isReducing).toBe(true);
            expect(result.extensionDays).toBe(-3);
        });

        test('should reject zero value', () => {
            const result = validateExtensionValue(0, 7);
            expect(result.isValid).toBe(false);
        });

        test('should use default for NaN', () => {
            const result = validateExtensionValue(NaN, 7);
            expect(result.extensionDays).toBe(7);
        });

        test('should handle large negative values', () => {
            const result = validateExtensionValue(-100, 7);
            expect(result.isValid).toBe(true);
            expect(result.isReducing).toBe(true);
            expect(result.extensionDays).toBe(-100);
        });
    });

    describe('Extension Seconds Calculation', () => {

        function calculateExtensionSeconds(extensionDays) {
            return extensionDays * 24 * 60 * 60;
        }

        test('should calculate positive extension correctly', () => {
            expect(calculateExtensionSeconds(7)).toBe(604800); // 7 days in seconds
        });

        test('should calculate negative extension correctly', () => {
            expect(calculateExtensionSeconds(-3)).toBe(-259200); // -3 days in seconds
        });

        test('should handle single day', () => {
            expect(calculateExtensionSeconds(1)).toBe(86400);
            expect(calculateExtensionSeconds(-1)).toBe(-86400);
        });
    });

    describe('Deadline Expiration Check', () => {

        function checkDeadlineExpiration(searches, extensionSeconds) {
            var now = Math.floor(Date.now() / 1000);
            return searches.filter(function(s) {
                if (s.deadlineEpoch) {
                    return (s.deadlineEpoch + extensionSeconds) <= now;
                }
                return false;
            });
        }

        test('should detect expired deadline with negative extension', () => {
            const now = Math.floor(Date.now() / 1000);
            const searches = [
                { searchName: 'Test1', deadlineEpoch: now + 86400 } // 1 day from now
            ];
            // Reducing by 2 days would expire it
            const expired = checkDeadlineExpiration(searches, -2 * 86400);
            expect(expired.length).toBe(1);
        });

        test('should not flag search if deadline still in future', () => {
            const now = Math.floor(Date.now() / 1000);
            const searches = [
                { searchName: 'Test1', deadlineEpoch: now + 7 * 86400 } // 7 days from now
            ];
            // Reducing by 2 days still leaves 5 days
            const expired = checkDeadlineExpiration(searches, -2 * 86400);
            expect(expired.length).toBe(0);
        });

        test('should handle search without deadline info', () => {
            const searches = [
                { searchName: 'Test1' } // No deadlineEpoch
            ];
            const expired = checkDeadlineExpiration(searches, -10 * 86400);
            expect(expired.length).toBe(0);
        });

        test('should handle multiple searches with mixed expirations', () => {
            const now = Math.floor(Date.now() / 1000);
            const searches = [
                { searchName: 'Test1', deadlineEpoch: now + 86400 }, // 1 day - will expire
                { searchName: 'Test2', deadlineEpoch: now + 7 * 86400 }, // 7 days - won't expire
                { searchName: 'Test3', deadlineEpoch: now + 2 * 86400 } // 2 days - will expire
            ];
            const expired = checkDeadlineExpiration(searches, -3 * 86400);
            expect(expired.length).toBe(2);
            expect(expired.map(s => s.searchName)).toContain('Test1');
            expect(expired.map(s => s.searchName)).toContain('Test3');
        });
    });

    describe('SPL Query Generation with Negative Values', () => {

        function generateExtendQuery(searches, extensionDays) {
            if (!searches || searches.length === 0) return null;

            var extensionSeconds = extensionDays * 24 * 60 * 60;

            var conditions = searches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            }).join(' OR ');

            return '| inputlookup flagged_searches_lookup ' +
                '| eval remediation_deadline = if(' + conditions + ', remediation_deadline + ' + extensionSeconds + ', remediation_deadline)' +
                '| outputlookup flagged_searches_lookup';
        }

        test('should generate query with positive extension', () => {
            const searches = [{ searchName: 'Test_Search' }];
            const query = generateExtendQuery(searches, 7);

            expect(query).toContain('remediation_deadline + 604800');
        });

        test('should generate query with negative extension', () => {
            const searches = [{ searchName: 'Test_Search' }];
            const query = generateExtendQuery(searches, -3);

            // Negative extension means adding a negative number
            expect(query).toContain('remediation_deadline + -259200');
        });

        test('should handle multiple searches with negative extension', () => {
            const searches = [
                { searchName: 'Search1' },
                { searchName: 'Search2' }
            ];
            const query = generateExtendQuery(searches, -5);

            expect(query).toContain('search_name="Search1" OR search_name="Search2"');
            expect(query).toContain('-432000'); // -5 days in seconds
        });
    });

    describe('Action Message Generation', () => {

        function generateActionMessage(searches, extensionDays) {
            var isReducing = extensionDays < 0;
            var action = isReducing ? "reduced" : "extended";
            var days = Math.abs(extensionDays);

            if (searches.length === 1) {
                return "Deadline for '" + searches[0].searchName + "' " + action + " by " + days + " days.";
            }
            return "Deadlines for " + searches.length + " searches " + action + " by " + days + " days.";
        }

        test('should generate extend message for positive value', () => {
            const searches = [{ searchName: 'Test' }];
            const msg = generateActionMessage(searches, 7);
            expect(msg).toBe("Deadline for 'Test' extended by 7 days.");
        });

        test('should generate reduce message for negative value', () => {
            const searches = [{ searchName: 'Test' }];
            const msg = generateActionMessage(searches, -3);
            expect(msg).toBe("Deadline for 'Test' reduced by 3 days.");
        });

        test('should handle multiple searches reduce', () => {
            const searches = [{ searchName: 'S1' }, { searchName: 'S2' }];
            const msg = generateActionMessage(searches, -5);
            expect(msg).toBe("Deadlines for 2 searches reduced by 5 days.");
        });
    });

    describe('Disable Prompt Message Generation', () => {

        function generateDisablePrompt(searches, extensionDays) {
            var days = Math.abs(extensionDays);
            if (searches.length === 1) {
                return "Reducing by " + days + " days would set '" + searches[0].searchName + "' deadline to the past.\n\nDo you want to disable this search instead?";
            }
            return "Reducing by " + days + " days would set " + searches.length + " searches' deadlines to the past.\n\nDo you want to disable these searches instead?";
        }

        test('should generate prompt for single search', () => {
            const searches = [{ searchName: 'My_Search' }];
            const prompt = generateDisablePrompt(searches, -10);
            expect(prompt).toContain("'My_Search'");
            expect(prompt).toContain("10 days");
            expect(prompt).toContain("disable this search");
        });

        test('should generate prompt for multiple searches', () => {
            const searches = [{ searchName: 'S1' }, { searchName: 'S2' }, { searchName: 'S3' }];
            const prompt = generateDisablePrompt(searches, -5);
            expect(prompt).toContain("3 searches'");
            expect(prompt).toContain("5 days");
            expect(prompt).toContain("disable these searches");
        });
    });

    describe('Log Action Generation', () => {

        function generateLogAction(extensionDays) {
            var isReducing = extensionDays < 0;
            return {
                action: isReducing ? "reduced" : "extended",
                message: isReducing
                    ? "Deadline reduced by " + Math.abs(extensionDays) + " days"
                    : "Deadline extended by " + extensionDays + " days"
            };
        }

        test('should generate extend log action', () => {
            const log = generateLogAction(7);
            expect(log.action).toBe("extended");
            expect(log.message).toBe("Deadline extended by 7 days");
        });

        test('should generate reduce log action', () => {
            const log = generateLogAction(-3);
            expect(log.action).toBe("reduced");
            expect(log.message).toBe("Deadline reduced by 3 days");
        });
    });

    describe('Integration: Full Negative Extension Flow', () => {

        function simulateNegativeExtension(searches, extensionDays) {
            if (!searches || searches.length === 0) {
                return { success: false, error: 'No searches selected' };
            }

            if (extensionDays === 0) {
                return { success: false, error: 'Extension cannot be zero' };
            }

            var extensionSeconds = extensionDays * 24 * 60 * 60;
            var isReducing = extensionDays < 0;
            var now = Math.floor(Date.now() / 1000);

            // Check for expired deadlines
            var expiredSearches = [];
            if (isReducing) {
                expiredSearches = searches.filter(function(s) {
                    if (s.deadlineEpoch) {
                        return (s.deadlineEpoch + extensionSeconds) <= now;
                    }
                    return false;
                });
            }

            if (expiredSearches.length > 0) {
                return {
                    success: false,
                    requiresDisable: true,
                    expiredSearches: expiredSearches,
                    prompt: expiredSearches.length === 1
                        ? "Search '" + expiredSearches[0].searchName + "' would expire"
                        : expiredSearches.length + " searches would expire"
                };
            }

            // Generate query
            var conditions = searches.map(function(s) {
                return 'search_name="' + escapeString(s.searchName) + '"';
            }).join(' OR ');

            return {
                success: true,
                query: '| inputlookup flagged_searches_lookup | eval remediation_deadline = if(' + conditions + ', remediation_deadline + ' + extensionSeconds + ', remediation_deadline) | outputlookup flagged_searches_lookup',
                isReducing: isReducing,
                extensionDays: extensionDays,
                extensionSeconds: extensionSeconds
            };
        }

        test('should successfully reduce deadline when still in future', () => {
            const now = Math.floor(Date.now() / 1000);
            const searches = [
                { searchName: 'Test_Search', deadlineEpoch: now + 10 * 86400 }
            ];

            const result = simulateNegativeExtension(searches, -3);

            expect(result.success).toBe(true);
            expect(result.isReducing).toBe(true);
            expect(result.extensionDays).toBe(-3);
        });

        test('should require disable when deadline would expire', () => {
            const now = Math.floor(Date.now() / 1000);
            const searches = [
                { searchName: 'Test_Search', deadlineEpoch: now + 86400 } // 1 day from now
            ];

            const result = simulateNegativeExtension(searches, -3);

            expect(result.success).toBe(false);
            expect(result.requiresDisable).toBe(true);
            expect(result.expiredSearches.length).toBe(1);
        });

        test('should reject zero extension', () => {
            const searches = [{ searchName: 'Test' }];
            const result = simulateNegativeExtension(searches, 0);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Extension cannot be zero');
        });

        test('should handle positive extension normally', () => {
            const searches = [{ searchName: 'Test' }];
            const result = simulateNegativeExtension(searches, 7);
            expect(result.success).toBe(true);
            expect(result.isReducing).toBe(false);
        });
    });
});
