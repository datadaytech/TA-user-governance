# TA-user-governance Testing Documentation

## Test Suite Overview

This document describes the comprehensive testing infrastructure for the TA-user-governance Splunk app.

### Test Structure

```
tests/
├── unit/                    # Jest unit tests (176 tests)
│   ├── governance.unit.test.js
│   ├── extend-deadline.test.js
│   ├── negative-extension.test.js
│   ├── unflag.test.js
│   ├── review-status.test.js
│   ├── cache-mechanism.test.js
│   └── status-labels.test.js
├── api/                     # API tests
│   └── splunk-api.test.js
├── smoke/                   # Smoke tests (10 tests)
│   └── smoke.spec.js
├── integration/             # Integration tests
│   └── status-workflow.test.js
├── e2e/                     # End-to-end tests
│   ├── status-labels.spec.js
│   └── workflows/
│       └── complete-governance-workflow.spec.js
├── visual/                  # Visual regression tests
│   └── visual-regression.spec.js
├── fixtures.js              # Playwright fixtures
├── jest.config.js           # Jest configuration
├── jest.setup.js            # Jest setup
├── playwright.config.js     # Playwright configuration
└── package.json             # Test dependencies
```

## Running Tests

### Prerequisites

1. Splunk must be running locally or via Docker
2. Environment variables set:
   - `SPLUNK_URL=http://localhost:8000`
   - `SPLUNK_USERNAME=admin`
   - `SPLUNK_PASSWORD=changeme123`

### Test Commands

```bash
# Unit tests only
npm run test:unit

# Unit tests with coverage
npm run test:unit:coverage

# Smoke tests
npm run test:smoke

# API tests
npm run test:api

# Visual regression tests
npm run test:visual

# E2E tests
npm run test:e2e

# Integration tests
npm run test:integration

# Full pre-PR validation
npm run pre-pr

# Quick validation
npm run validate:quick
```

## Test Categories

### Unit Tests (176 tests)

Pure JavaScript logic testing without Splunk dependency:

- **governance.unit.test.js**: Core governance functions
- **extend-deadline.test.js**: Deadline extension logic
- **negative-extension.test.js**: Negative value validation
- **unflag.test.js**: Unflag/resolve functionality
- **review-status.test.js**: Status review logic
- **cache-mechanism.test.js**: Cache operations
- **status-labels.test.js**: Status label transitions and validation

### Smoke Tests (10 tests)

Quick validation of critical paths:

1. SMOKE-1: App loads successfully
2. SMOKE-2: Visual indicators render
3. SMOKE-3: Metric panels are clickable
4. SMOKE-4: All dashboards load
5. SMOKE-5: Status dropdown renders in tables
6. SMOKE-6: Cron modal opens on click
7. SMOKE-7: Settings page displays configuration
8. SMOKE-8: Audit page displays logs
9. SMOKE-9: Cost Analysis renders charts
10. SMOKE-10: Selection mechanism works

### API Tests

Tests for Splunk REST API endpoints:

- Authentication
- App installation verification
- Saved searches API
- Lookup API operations
- Search jobs API
- Macros API
- Views API
- Flag operations
- Audit logging

### Integration Tests

Full workflow testing:

- Status transitions (Suspicious -> Flagged -> Notified -> Review -> Disabled/Resolved)
- Extend deadline flow
- Unflag/resolve flow

### Visual Regression Tests

Screenshot comparison for UI consistency:

- Dashboard views
- Component styling (checkboxes, dropdowns, modals)
- Color consistency
- Table styling

### E2E Tests

Complete user journey testing:

- Standard governance workflow
- Auto-disable flow
- Bulk operations

## Status Workflow

The app supports the following status workflow:

```
Suspicious (unflagged)
    │
    ▼ (Flag)
Pending (Flagged) ──────────────────────────────────────────────┐
    │                                                            │
    ├──► Notified (Owner notified, deadline active) ──┬──────────┤
    │                                                  │         │
    ├──► Pending Review (Under active review) ────────┼──────────┤
    │                                                  │         │
    └──► Disabled (Auto-disabled, falls off chart) ◄──┴──────────┘
                                                      │
                                                      ▼
                                            Resolved (Unflagged)
```

### Status Rules

1. **Suspicious** searches can only be changed to **Pending (Flagged)**
2. **Flagged** searches remain flagged through Notified and Pending Review states
3. **Disabled** and **Resolved** statuses remove the search from the flagged count
4. All status changes are logged to the audit page

## Custom Jest Matchers

The test suite includes custom Jest matchers:

```javascript
expect(value).toBeValidEpoch();        // Validate epoch timestamp
expect(value).toBeValidCron();          // Validate cron expression
expect(value).toBeValidGovernanceStatus(); // Validate status value
```

## Test Fixtures

Playwright fixtures provide authenticated page access:

```javascript
const { test } = require('./fixtures');

test('example', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    // Page is already logged in to Splunk
});
```

## Coverage Reports

Coverage reports are generated in:
- `coverage/lcov-report/index.html` - HTML coverage report
- `test-reports/unit-test-report.html` - Unit test HTML report

## Troubleshooting

### Tests Timing Out

If E2E tests timeout, the Splunk instance may be under load:
1. Clear any queued searches: `| rest /services/search/jobs | delete`
2. Increase test timeout in playwright.config.js
3. Ensure Splunk has adequate resources

### Visual Indicators Not Rendering

If checkboxes or cron clickables are missing:
1. Wait longer for page to load
2. Check console for JavaScript errors
3. Verify governance.js is properly deployed

### Modal Not Opening

If modals don't open after refresh:
1. Verify `window.refreshDashboard` is available
2. Check that setupMetricPanelClickHandlers is being called
3. Increase wait time after refresh

## Adding New Tests

### Unit Test

```javascript
describe('New Feature', () => {
    test('should do something', () => {
        expect(newFunction()).toBe(expectedValue);
    });
});
```

### E2E Test

```javascript
const { test, expect } = require('./fixtures');

test('new e2e test', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/en-US/app/TA-user-governance/governance_dashboard');
    // Test logic
});
```
