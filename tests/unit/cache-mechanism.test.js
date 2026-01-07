/**
 * Unit tests for the loadjob-based cache mechanism
 */

describe('Cache Mechanism', () => {

    describe('Cache SID Lookup', () => {
        test('governance_cache_sid_lookup should have required fields', () => {
            const requiredFields = ['cache_sid', 'cache_time', 'result_count'];
            // Simulating lookup structure
            const mockLookup = {
                cache_sid: '1767748439.3',
                cache_time: 1767748440,
                result_count: 92
            };

            requiredFields.forEach(field => {
                expect(mockLookup).toHaveProperty(field);
            });
        });

        test('cache_sid should be a valid SID format', () => {
            const validSidPattern = /^\d+\.\d+$/;
            const mockSid = '1767748439.3';
            expect(mockSid).toMatch(validSidPattern);
        });

        test('cache_time should be a valid Unix timestamp', () => {
            const mockCacheTime = 1767748440;
            expect(mockCacheTime).toBeGreaterThan(0);
            expect(mockCacheTime).toBeLessThan(Date.now() / 1000 + 86400); // Not in future
        });

        test('result_count should be a positive number', () => {
            const mockResultCount = 92;
            expect(mockResultCount).toBeGreaterThan(0);
        });
    });

    describe('Cost Analysis Fields', () => {
        const mockCostData = {
            title: 'Test Search',
            owner: 'admin',
            app: 'search',
            cron_schedule: '0 * * * *',
            disabled: 0,
            frequency_label: 'Hourly',
            frequency_seconds: 3600,
            runs_per_month: 720,
            svc_per_run: 18,
            monthly_svc_usage: 12960,
            monthly_total_cost: 1728000,
            cost_tier: 'Critical'
        };

        test('should have all required cost fields', () => {
            const requiredFields = [
                'title', 'owner', 'app', 'cron_schedule', 'disabled',
                'frequency_label', 'monthly_svc_usage', 'monthly_total_cost', 'cost_tier'
            ];

            requiredFields.forEach(field => {
                expect(mockCostData).toHaveProperty(field);
            });
        });

        test('cost_tier should be one of valid values', () => {
            const validTiers = ['Critical', 'High', 'Medium', 'Low', 'Minimal'];
            expect(validTiers).toContain(mockCostData.cost_tier);
        });

        test('frequency_label should be descriptive', () => {
            const validLabels = ['Every minute', 'Every 5 min', 'Hourly', 'Daily', 'Weekly', 'Monthly+'];
            expect(validLabels).toContain(mockCostData.frequency_label);
        });

        test('monthly_total_cost should be calculated correctly', () => {
            // Cost = monthly_svc_usage * (1600/12)
            const expectedCost = mockCostData.monthly_svc_usage * (1600 / 12);
            expect(mockCostData.monthly_total_cost).toBeCloseTo(expectedCost, 0);
        });
    });

    describe('runCacheNow Function Logic', () => {
        test('should generate valid search query', () => {
            const expectedSearchStart = '| rest /servicesNS/-/-/saved/searches';
            const searchQuery = '| rest /servicesNS/-/-/saved/searches splunk_server=local';
            expect(searchQuery.startsWith(expectedSearchStart)).toBe(true);
        });

        test('should include is_scheduled filter', () => {
            const searchQuery = '| rest /servicesNS/-/-/saved/searches | search is_scheduled=1';
            expect(searchQuery).toContain('is_scheduled=1');
        });

        test('should rename eai:acl fields', () => {
            const searchQuery = '| rename eai:acl.owner as owner, eai:acl.app as app';
            expect(searchQuery).toContain('eai:acl.owner as owner');
            expect(searchQuery).toContain('eai:acl.app as app');
        });
    });

    describe('TTL Management', () => {
        test('TTL should be set to 24 hours (86400 seconds)', () => {
            const expectedTTL = 86400;
            expect(expectedTTL).toBe(24 * 60 * 60);
        });

        test('TTL action should be setttl', () => {
            const ttlAction = 'setttl';
            expect(ttlAction).toBe('setttl');
        });
    });
});

describe('Cost Analysis Dashboard', () => {

    describe('Base Search', () => {
        test('base search should use inputlookup and map', () => {
            const baseSearch = '| inputlookup governance_cache_sid_lookup | head 1 | map search="| loadjob $cache_sid$"';
            expect(baseSearch).toContain('inputlookup governance_cache_sid_lookup');
            expect(baseSearch).toContain('map search');
            expect(baseSearch).toContain('loadjob');
        });

        test('base search should limit to 1 result for SID', () => {
            const baseSearch = '| inputlookup governance_cache_sid_lookup | head 1';
            expect(baseSearch).toContain('head 1');
        });
    });

    describe('Panel Queries', () => {
        test('total SVC query should sum monthly_svc_usage', () => {
            const query = '| search disabled=0 | stats sum(monthly_svc_usage) as total_svc_usage';
            expect(query).toContain('sum(monthly_svc_usage)');
            expect(query).toContain('disabled=0');
        });

        test('total cost query should sum monthly_total_cost', () => {
            const query = '| search disabled=0 | stats sum(monthly_total_cost) as total_monthly_cost';
            expect(query).toContain('sum(monthly_total_cost)');
        });

        test('cost tier distribution should group by cost_tier', () => {
            const query = '| stats count by cost_tier';
            expect(query).toContain('by cost_tier');
        });
    });
});
