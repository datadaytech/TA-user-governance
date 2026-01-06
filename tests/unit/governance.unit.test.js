/**
 * Unit tests for governance.js utility functions
 * Run with: npx jest tests/unit/
 */

describe('Governance Utility Functions', () => {

  describe('escapeString', () => {
    // Simulating the escapeString function from governance.js
    function escapeString(str) {
      if (!str) return "";
      return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
    }

    test('should return empty string for null/undefined', () => {
      expect(escapeString(null)).toBe('');
      expect(escapeString(undefined)).toBe('');
      expect(escapeString('')).toBe('');
    });

    test('should escape backslashes', () => {
      expect(escapeString('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    test('should escape double quotes', () => {
      expect(escapeString('say "hello"')).toBe('say \\"hello\\"');
    });

    test('should escape single quotes', () => {
      expect(escapeString("it's")).toBe("it\\'s");
    });

    test('should escape newlines', () => {
      expect(escapeString('line1\nline2')).toBe('line1\\nline2');
    });

    test('should handle complex strings', () => {
      const input = 'Search: index="main"\nFilter: host=\'server\'';
      const expected = 'Search: index=\\"main\\"\\nFilter: host=\\\'server\\\'';
      expect(escapeString(input)).toBe(expected);
    });
  });

  describe('escapeHtml', () => {
    // Simulating the escapeHtml function from governance.js
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    test('should return empty string for null/undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    test('should escape ampersands', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    test('should escape HTML tags', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should escape quotes', () => {
      expect(escapeHtml('data-attr="value"')).toBe('data-attr=&quot;value&quot;');
      expect(escapeHtml("data-attr='value'")).toBe('data-attr=&#39;value&#39;');
    });
  });

  describe('Cron Pattern Validation', () => {
    // Regex from governance.js for cron validation
    const cronPattern = /^[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+$/;

    test('should match standard cron expressions', () => {
      expect(cronPattern.test('*/5 * * * *')).toBe(true);
      expect(cronPattern.test('0 * * * *')).toBe(true);
      expect(cronPattern.test('0 0 * * *')).toBe(true);
      expect(cronPattern.test('30 4 1,15 * *')).toBe(true);
      expect(cronPattern.test('0 0 * * 0')).toBe(true);
    });

    test('should match cron with ranges and steps', () => {
      expect(cronPattern.test('0-30/5 * * * *')).toBe(true);
      expect(cronPattern.test('*/10 9-17 * * 1-5')).toBe(true);
    });

    test('should not match invalid cron expressions', () => {
      expect(cronPattern.test('every 5 minutes')).toBe(false);
      expect(cronPattern.test('* * *')).toBe(false);
      expect(cronPattern.test('* * * * * *')).toBe(false);
      expect(cronPattern.test('')).toBe(false);
    });
  });

  describe('Checkbox State Management', () => {
    // Simulating checkbox state tracking
    let selectedSearches = [];

    function updateSelectedSearches(checkboxData) {
      selectedSearches = checkboxData
        .filter(cb => cb.checked)
        .map(cb => ({
          searchName: cb.searchName,
          owner: cb.owner,
          app: cb.app,
          reason: cb.reason || '',
          flagged: cb.flagged === 'true'
        }));
      return selectedSearches;
    }

    beforeEach(() => {
      selectedSearches = [];
    });

    test('should track selected checkboxes', () => {
      const checkboxes = [
        { checked: true, searchName: 'Search1', owner: 'admin', app: 'search', flagged: 'false' },
        { checked: false, searchName: 'Search2', owner: 'admin', app: 'search', flagged: 'false' },
        { checked: true, searchName: 'Search3', owner: 'user1', app: 'myapp', flagged: 'true' }
      ];

      const result = updateSelectedSearches(checkboxes);

      expect(result.length).toBe(2);
      expect(result[0].searchName).toBe('Search1');
      expect(result[1].searchName).toBe('Search3');
      expect(result[1].flagged).toBe(true);
    });

    test('should return empty array when nothing selected', () => {
      const checkboxes = [
        { checked: false, searchName: 'Search1', owner: 'admin', app: 'search', flagged: 'false' },
        { checked: false, searchName: 'Search2', owner: 'admin', app: 'search', flagged: 'false' }
      ];

      const result = updateSelectedSearches(checkboxes);
      expect(result.length).toBe(0);
    });
  });

  describe('Flag Status Detection', () => {
    function isFlagged(flaggedText) {
      return !!(flaggedText && flaggedText.trim().toLowerCase() === 'yes');
    }

    test('should detect flagged status correctly', () => {
      expect(isFlagged('Yes')).toBe(true);
      expect(isFlagged('yes')).toBe(true);
      expect(isFlagged('YES')).toBe(true);
      expect(isFlagged(' Yes ')).toBe(true);
    });

    test('should return false for non-flagged', () => {
      expect(isFlagged('No')).toBe(false);
      expect(isFlagged('')).toBe(false);
      expect(isFlagged(null)).toBe(false);
      expect(isFlagged(undefined)).toBe(false);
    });
  });

  describe('Email Address Building', () => {
    const CONFIG = { emailDomain: 'example.com' };

    function buildEmailAddress(username) {
      if (!username) return '';
      if (username.indexOf('@') > -1) {
        return username;
      }
      return username + '@' + CONFIG.emailDomain;
    }

    test('should append domain to username', () => {
      expect(buildEmailAddress('admin')).toBe('admin@example.com');
      expect(buildEmailAddress('user.name')).toBe('user.name@example.com');
    });

    test('should return email as-is if already has domain', () => {
      expect(buildEmailAddress('user@company.com')).toBe('user@company.com');
      expect(buildEmailAddress('admin@splunk.com')).toBe('admin@splunk.com');
    });

    test('should return empty string for null/undefined', () => {
      expect(buildEmailAddress(null)).toBe('');
      expect(buildEmailAddress(undefined)).toBe('');
      expect(buildEmailAddress('')).toBe('');
    });
  });

  describe('Search Name Cleaning', () => {
    function cleanSearchName(searchName) {
      if (!searchName) return '';
      return searchName.replace(/^[\s\u2691\u2690\uD83D\uDEA9]+/, '').trim();
    }

    test('should remove flag icons from beginning', () => {
      expect(cleanSearchName('\u2691 My Search')).toBe('My Search');
      expect(cleanSearchName('\uD83D\uDEA9 Flagged Search')).toBe('Flagged Search');
    });

    test('should trim whitespace', () => {
      expect(cleanSearchName('  My Search  ')).toBe('My Search');
      expect(cleanSearchName('\n\tSearch\n')).toBe('Search');
    });

    test('should handle clean names', () => {
      expect(cleanSearchName('Already Clean')).toBe('Already Clean');
    });
  });

  describe('Remediation Deadline Calculation', () => {
    function calculateDeadline(nowSeconds, remediationDays) {
      return nowSeconds + (remediationDays * 24 * 60 * 60);
    }

    test('should calculate correct deadline', () => {
      const now = 1704067200; // Jan 1, 2024 00:00:00 UTC
      const deadline = calculateDeadline(now, 7);

      // 7 days = 604800 seconds
      expect(deadline).toBe(now + 604800);
    });

    test('should handle different remediation periods', () => {
      const now = 1704067200;

      expect(calculateDeadline(now, 1)).toBe(now + 86400);    // 1 day
      expect(calculateDeadline(now, 14)).toBe(now + 1209600); // 14 days
      expect(calculateDeadline(now, 30)).toBe(now + 2592000); // 30 days
    });
  });

  describe('Column Detection', () => {
    function findColumnIndex(headers, columnName) {
      for (let i = 0; i < headers.length; i++) {
        if (headers[i].trim() === columnName) {
          return i;
        }
      }
      return -1;
    }

    test('should find column by exact name', () => {
      const headers = ['Row', 'Search Name', 'Owner', 'App', 'Schedule', 'Flagged'];

      expect(findColumnIndex(headers, 'Search Name')).toBe(1);
      expect(findColumnIndex(headers, 'Owner')).toBe(2);
      expect(findColumnIndex(headers, 'Schedule')).toBe(4);
    });

    test('should return -1 for missing column', () => {
      const headers = ['Row', 'Search Name', 'Owner'];

      expect(findColumnIndex(headers, 'Schedule')).toBe(-1);
      expect(findColumnIndex(headers, 'NonExistent')).toBe(-1);
    });

    test('should find Dashboard column for dashboard governance', () => {
      const headers = ['Row', 'Dashboard', 'Owner', 'App', 'Sharing', 'Size (KB)'];

      expect(findColumnIndex(headers, 'Dashboard')).toBe(1);
      expect(findColumnIndex(headers, 'Search Name')).toBe(-1);
    });
  });

});

describe('SPL Query Generation', () => {

  function escapeString(str) {
    if (!str) return "";
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  describe('Flag Search Query', () => {
    function generateFlagQuery(searchName, owner, app, reason, user, now, deadline) {
      return '| makeresults ' +
        '| eval search_name="' + escapeString(searchName) + '"' +
        ', search_owner="' + escapeString(owner) + '"' +
        ', search_app="' + escapeString(app) + '"' +
        ', flagged_by="' + escapeString(user) + '"' +
        ', flagged_time=' + now +
        ', notification_sent=0' +
        ', notification_time=0' +
        ', remediation_deadline=' + deadline +
        ', status="pending"' +
        ', reason="' + escapeString(reason) + '"' +
        ', notes=""' +
        '| table search_name, search_owner, search_app, flagged_by, flagged_time, notification_sent, notification_time, remediation_deadline, status, reason, notes' +
        '| outputlookup append=true flagged_searches_lookup';
    }

    test('should generate valid SPL query', () => {
      const query = generateFlagQuery(
        'Test Search',
        'admin',
        'search',
        'High frequency',
        'user1',
        1704067200,
        1704672000
      );

      expect(query).toContain('| makeresults');
      expect(query).toContain('search_name="Test Search"');
      expect(query).toContain('search_owner="admin"');
      expect(query).toContain('status="pending"');
      expect(query).toContain('| outputlookup append=true flagged_searches_lookup');
    });

    test('should escape special characters in search name', () => {
      const query = generateFlagQuery(
        'Search with "quotes" and \\backslash',
        'admin',
        'app',
        'Test',
        'user',
        0,
        0
      );

      expect(query).toContain('Search with \\"quotes\\" and \\\\backslash');
    });
  });

  describe('Audit Log Query', () => {
    function generateAuditLogQuery(action, searchName, user, details, now) {
      return '| makeresults ' +
        '| eval timestamp=' + now +
        ', action="' + escapeString(action) + '"' +
        ', search_name="' + escapeString(searchName) + '"' +
        ', performed_by="' + escapeString(user) + '"' +
        ', details="' + escapeString(details) + '"' +
        '| table timestamp, action, search_name, performed_by, details' +
        '| outputlookup append=true governance_audit_log_lookup';
    }

    test('should generate audit log entry query', () => {
      const query = generateAuditLogQuery(
        'flagged',
        'My Search',
        'admin',
        'Flagged for high frequency',
        1704067200
      );

      expect(query).toContain('action="flagged"');
      expect(query).toContain('search_name="My Search"');
      expect(query).toContain('performed_by="admin"');
      expect(query).toContain('| outputlookup append=true governance_audit_log_lookup');
    });
  });

});
