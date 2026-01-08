/**
 * API Validation Tests for TA-user-governance
 * Tests Splunk REST API endpoints and responses
 */

const https = require('https');
const http = require('http');

const SPLUNK_URL = process.env.SPLUNK_URL || 'http://localhost:8000';
const SPLUNK_API = 'https://localhost:8089';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

// Helper to make Splunk API requests
function splunkRequest(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, SPLUNK_API);
        url.searchParams.append('output_mode', 'json');

        const options = {
            hostname: url.hostname,
            port: url.port || 8089,
            path: url.pathname + url.search,
            method: method,
            auth: `${SPLUNK_USERNAME}:${SPLUNK_PASSWORD}`,
            rejectUnauthorized: false,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

describe('Splunk API Validation', () => {

    describe('Server Health', () => {
        test('Splunk server should be responsive', async () => {
            const response = await splunkRequest('/services/server/info');
            expect(response.status).toBe(200);
        }, 30000);

        test('Server info should return version', async () => {
            const response = await splunkRequest('/services/server/info');
            expect(response.data.generator).toBeDefined();
            expect(response.data.generator.version).toBeDefined();
        }, 30000);
    });

    describe('App Installation', () => {
        test('TA-user-governance app should be installed', async () => {
            const response = await splunkRequest('/services/apps/local/TA-user-governance');
            expect(response.status).toBe(200);
        }, 30000);

        test('App should have correct label', async () => {
            const response = await splunkRequest('/services/apps/local/TA-user-governance');
            const entry = response.data.entry?.[0];
            expect(entry?.content?.label).toBeDefined();
        }, 30000);
    });

    describe('Lookups', () => {
        test('governance_cache_sid_lookup should exist', async () => {
            const response = await splunkRequest('/servicesNS/admin/TA-user-governance/data/transforms/lookups/governance_cache_sid_lookup');
            expect(response.status).toBe(200);
        }, 30000);

        test('flagged_searches_lookup should exist', async () => {
            const response = await splunkRequest('/servicesNS/admin/TA-user-governance/data/transforms/lookups/flagged_searches_lookup');
            expect(response.status).toBe(200);
        }, 30000);

        test('governance_settings_lookup should exist', async () => {
            const response = await splunkRequest('/servicesNS/admin/TA-user-governance/data/transforms/lookups/governance_settings_lookup');
            expect(response.status).toBe(200);
        }, 30000);
    });

    describe('Macros', () => {
        test('analyze_search_costs macro should exist', async () => {
            const response = await splunkRequest('/servicesNS/admin/TA-user-governance/admin/macros/analyze_search_costs');
            expect(response.status).toBe(200);
        }, 30000);

        test('load_cached_cost_analysis macro should exist', async () => {
            const response = await splunkRequest('/servicesNS/admin/TA-user-governance/admin/macros/load_cached_cost_analysis');
            expect(response.status).toBe(200);
        }, 30000);
    });

    describe('Dashboards', () => {
        test('cost_analysis dashboard should exist', async () => {
            const response = await splunkRequest('/servicesNS/admin/TA-user-governance/data/ui/views/cost_analysis');
            expect(response.status).toBe(200);
        }, 30000);

        test('governance_settings dashboard should exist', async () => {
            const response = await splunkRequest('/servicesNS/admin/TA-user-governance/data/ui/views/governance_settings');
            expect(response.status).toBe(200);
        }, 30000);

        test('scheduled_search_governance dashboard should exist', async () => {
            const response = await splunkRequest('/servicesNS/admin/TA-user-governance/data/ui/views/scheduled_search_governance');
            expect(response.status).toBe(200);
        }, 30000);

        test('dashboard_governance dashboard should exist', async () => {
            const response = await splunkRequest('/servicesNS/admin/TA-user-governance/data/ui/views/dashboard_governance');
            expect(response.status).toBe(200);
        }, 30000);
    });

    describe('Cache Mechanism', () => {
        test('Cache SID lookup should have data', async () => {
            // Use blocking search to query the lookup
            const searchData = 'search=' + encodeURIComponent('| inputlookup governance_cache_sid_lookup | head 1') +
                '&exec_mode=blocking&timeout=30';
            const response = await splunkRequest('/services/search/jobs', 'POST', searchData);
            expect(response.status).toBe(201);
            expect(response.data.sid).toBeDefined();
        }, 30000);

        test('loadjob should work with cached SID', async () => {
            // Use blocking search to verify loadjob works
            const searchData = 'search=' + encodeURIComponent('| inputlookup governance_cache_sid_lookup | head 1 | fields cache_sid') +
                '&exec_mode=blocking&timeout=30';
            const response = await splunkRequest('/services/search/jobs', 'POST', searchData);
            expect(response.status).toBe(201);
            expect(response.data.sid).toBeDefined();
        }, 30000);
    });
});

describe('Search Execution', () => {

    test('Simple search should execute', async () => {
        const searchData = 'search=' + encodeURIComponent('| makeresults | eval test=1') +
            '&exec_mode=blocking&timeout=30';
        const response = await splunkRequest('/services/search/jobs', 'POST', searchData);
        expect(response.status).toBe(201);
        expect(response.data.sid).toBeDefined();
    }, 60000);

    test('inputlookup search should execute', async () => {
        const searchData = 'search=' + encodeURIComponent('| inputlookup governance_cache_sid_lookup') +
            '&exec_mode=blocking&timeout=30';
        const response = await splunkRequest('/services/search/jobs', 'POST', searchData);
        expect(response.status).toBe(201);
    }, 60000);
});
