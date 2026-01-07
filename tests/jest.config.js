/**
 * Jest Configuration for TA-user-governance
 * Comprehensive testing configuration for unit and integration tests
 */

module.exports = {
    testEnvironment: 'node',
    verbose: true,
    collectCoverage: true,
    coverageDirectory: './coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 75,
            lines: 75,
            statements: 75
        }
    },
    testMatch: [
        '**/unit/**/*.test.js',
        '**/integration/**/*.test.js'
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/playwright-report/',
        '/test-results/'
    ],
    modulePathIgnorePatterns: [
        '<rootDir>/node_modules/'
    ],
    setupFilesAfterEnv: ['./jest.setup.js'],
    reporters: [
        'default',
        ['jest-html-reporter', {
            pageTitle: 'TA-user-governance Test Report',
            outputPath: './test-reports/unit-test-report.html',
            includeFailureMsg: true,
            includeSuiteFailure: true
        }]
    ],
    maxWorkers: '50%',
    testTimeout: 30000
};
