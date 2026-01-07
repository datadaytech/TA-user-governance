/**
 * Jest Setup File
 * Global setup and configuration for all Jest tests
 */

// Set test timeout
jest.setTimeout(30000);

// Mock console.log to reduce noise during tests (optional)
// global.console.log = jest.fn();

// Global test utilities
global.testUtils = {
    /**
     * Create a mock search object
     */
    createMockSearch: (overrides = {}) => ({
        searchName: 'Test_Search',
        owner: 'admin',
        app: 'search',
        cron_schedule: '*/5 * * * *',
        disabled: 0,
        ...overrides
    }),

    /**
     * Create a mock flagged search
     */
    createMockFlaggedSearch: (overrides = {}) => ({
        search_name: 'Flagged_Test_Search',
        search_owner: 'admin',
        search_app: 'search',
        flag_status: 'pending',
        flag_reason: 'Test reason',
        flagged_by: 'admin',
        flagged_time: Math.floor(Date.now() / 1000),
        remediation_deadline: Math.floor(Date.now() / 1000) + (30 * 86400),
        ...overrides
    }),

    /**
     * Create a mock Splunk response
     */
    createMockSplunkResponse: (results = []) => ({
        results: results,
        messages: [],
        preview: false
    }),

    /**
     * Wait for a specified time (async)
     */
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Extend expect with custom matchers
expect.extend({
    /**
     * Check if a value is a valid epoch timestamp
     */
    toBeValidEpoch(received) {
        const pass = typeof received === 'number' &&
                     received > 0 &&
                     received < 9999999999;
        return {
            message: () =>
                `expected ${received} to be a valid epoch timestamp`,
            pass
        };
    },

    /**
     * Check if a cron expression is valid
     */
    toBeValidCron(received) {
        const cronRegex = /^(\*|(\d+|\*)\/\d+|\d+(-\d+)?(,\d+(-\d+)?)*)\s+(\*|(\d+|\*)\/\d+|\d+(-\d+)?(,\d+(-\d+)?)*)\s+(\*|(\d+|\*)\/\d+|\d+(-\d+)?(,\d+(-\d+)?)*)\s+(\*|(\d+|\*)\/\d+|\d+(-\d+)?(,\d+(-\d+)?)*)\s+(\*|(\d+|\*)\/\d+|\d+(-\d+)?(,\d+(-\d+)?)*)$/;
        const pass = typeof received === 'string' && cronRegex.test(received.trim());
        return {
            message: () =>
                `expected "${received}" to be a valid cron expression`,
            pass
        };
    },

    /**
     * Check if a status is valid governance status
     */
    toBeValidGovernanceStatus(received) {
        const validStatuses = ['pending', 'notified', 'review', 'disabled', 'resolved', 'suspicious'];
        const pass = validStatuses.includes(received);
        return {
            message: () =>
                `expected "${received}" to be a valid governance status (${validStatuses.join(', ')})`,
            pass
        };
    }
});

// Log test environment info
console.log('\n========================================');
console.log('  TA-user-governance Test Environment');
console.log('========================================');
console.log(`Node Version: ${process.version}`);
console.log(`Test Environment: ${process.env.NODE_ENV || 'test'}`);
console.log('========================================\n');
