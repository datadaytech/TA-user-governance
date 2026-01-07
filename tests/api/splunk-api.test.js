/**
 * Splunk REST API Tests
 * Tests for all Splunk REST API endpoints used by TA-user-governance
 */

const axios = require('axios');
const https = require('https');

// Splunk connection config
const SPLUNK_URL = process.env.SPLUNK_URL || 'https://localhost:8089';
const SPLUNK_USERNAME = process.env.SPLUNK_USERNAME || 'admin';
const SPLUNK_PASSWORD = process.env.SPLUNK_PASSWORD || 'changeme123';

// Create axios instance with auth
const splunkApi = axios.create({
    baseURL: SPLUNK_URL,
    auth: {
        username: SPLUNK_USERNAME,
        password: SPLUNK_PASSWORD
    },
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    }),
    timeout: 30000
});

describe('Splunk REST API Tests', () => {

    describe('Authentication', () => {
        test('should authenticate successfully with valid credentials', async () => {
            const response = await splunkApi.get('/services/authentication/current-context', {
                params: { output_mode: 'json' }
            });

            expect(response.status).toBe(200);
            expect(response.data.entry).toBeDefined();
            expect(response.data.entry[0].content.username).toBe(SPLUNK_USERNAME);
        });

        test('should reject invalid credentials', async () => {
            const badApi = axios.create({
                baseURL: SPLUNK_URL,
                auth: {
                    username: 'baduser',
                    password: 'badpassword'
                },
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            });

            await expect(badApi.get('/services/authentication/current-context'))
                .rejects.toThrow();
        });
    });

    describe('App Installation', () => {
        test('should verify TA-user-governance app is installed', async () => {
            const response = await splunkApi.get('/servicesNS/-/TA-user-governance/apps/local/TA-user-governance', {
                params: { output_mode: 'json' }
            });

            expect(response.status).toBe(200);
            expect(response.data.entry).toBeDefined();
            expect(response.data.entry[0].name).toBe('TA-user-governance');
        });

        test('should verify app is enabled', async () => {
            const response = await splunkApi.get('/servicesNS/-/TA-user-governance/apps/local/TA-user-governance', {
                params: { output_mode: 'json' }
            });

            const appContent = response.data.entry[0].content;
            expect(appContent.disabled).toBe(false);
        });
    });

    describe('Saved Searches API', () => {
        test('should list all saved searches', async () => {
            const response = await splunkApi.get('/servicesNS/-/-/saved/searches', {
                params: {
                    output_mode: 'json',
                    count: 10
                }
            });

            expect(response.status).toBe(200);
            expect(response.data.entry).toBeDefined();
            expect(Array.isArray(response.data.entry)).toBe(true);
        });

        test('should list scheduled searches only', async () => {
            const response = await splunkApi.get('/servicesNS/-/-/saved/searches', {
                params: {
                    output_mode: 'json',
                    search: 'is_scheduled=1',
                    count: 100
                }
            });

            expect(response.status).toBe(200);
            // All returned searches should have is_scheduled=1
            response.data.entry.forEach(search => {
                expect(search.content.is_scheduled).toBe(true);
            });
        });

        test('should get saved search details', async () => {
            // First get list of searches
            const listResponse = await splunkApi.get('/servicesNS/-/-/saved/searches', {
                params: { output_mode: 'json', count: 1 }
            });

            if (listResponse.data.entry.length > 0) {
                const searchName = listResponse.data.entry[0].name;
                const owner = listResponse.data.entry[0].acl.owner;
                const app = listResponse.data.entry[0].acl.app;

                const detailResponse = await splunkApi.get(`/servicesNS/${owner}/${app}/saved/searches/${encodeURIComponent(searchName)}`, {
                    params: { output_mode: 'json' }
                });

                expect(detailResponse.status).toBe(200);
                expect(detailResponse.data.entry[0].name).toBe(searchName);
            }
        });
    });

    describe('Lookup API', () => {
        test('should be able to query flagged_searches_lookup', async () => {
            const response = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: '| inputlookup flagged_searches_lookup | head 10',
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(response.status).toBe(200);
        });

        test('should be able to query governance_audit_log', async () => {
            const response = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: '| inputlookup governance_audit_log | head 10',
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(response.status).toBe(200);
        });

        test('should be able to query governance_settings_lookup', async () => {
            const response = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: '| inputlookup governance_settings_lookup | head 10',
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(response.status).toBe(200);
        });
    });

    describe('Search Jobs API', () => {
        test('should create and retrieve a search job', async () => {
            // Create a search job
            const createResponse = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: '| makeresults | eval test="api_test"',
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(createResponse.status).toBe(200);
            expect(createResponse.data.results).toBeDefined();
        });

        test('should execute a governance-related search', async () => {
            const response = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: '| rest /servicesNS/-/-/saved/searches splunk_server=local | search is_scheduled=1 | head 5 | table title, cron_schedule, disabled',
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(response.status).toBe(200);
        });
    });

    describe('Macros API', () => {
        test('should list governance macros', async () => {
            const response = await splunkApi.get('/servicesNS/admin/TA-user-governance/admin/macros', {
                params: {
                    output_mode: 'json',
                    count: 0
                }
            });

            expect(response.status).toBe(200);
            expect(response.data.entry).toBeDefined();
        });

        test('should verify key macros exist', async () => {
            const response = await splunkApi.get('/servicesNS/admin/TA-user-governance/admin/macros', {
                params: {
                    output_mode: 'json',
                    count: 0
                }
            });

            const macroNames = response.data.entry.map(m => m.name);
            // Check for expected macros
            const expectedMacros = [
                'remediation_days',
                'cost_per_gb',
                'cost_per_cpu_second'
            ];

            expectedMacros.forEach(macro => {
                expect(macroNames).toContain(macro);
            });
        });
    });

    describe('Views API', () => {
        test('should verify governance dashboards exist', async () => {
            const response = await splunkApi.get('/servicesNS/-/TA-user-governance/data/ui/views', {
                params: {
                    output_mode: 'json',
                    count: 0
                }
            });

            expect(response.status).toBe(200);

            const viewNames = response.data.entry.map(v => v.name);
            const expectedViews = [
                'governance_dashboard',
                'scheduled_search_governance',
                'governance_settings',
                'cost_analysis',
                'governance_audit'
            ];

            expectedViews.forEach(view => {
                expect(viewNames).toContain(view);
            });
        });
    });

    describe('Flag Operations API', () => {
        const testSearchName = `API_Test_Search_${Date.now()}`;

        test('should be able to flag a search via lookup', async () => {
            const now = Math.floor(Date.now() / 1000);
            const deadline = now + (30 * 86400);

            const response = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: `| inputlookup flagged_searches_lookup
                        | append [| makeresults
                            | eval search_name="${testSearchName}",
                                search_owner="admin",
                                search_app="search",
                                flag_status="pending",
                                flag_reason="API Test",
                                flagged_by="api_test",
                                flagged_time=${now},
                                remediation_deadline=${deadline}]
                        | dedup search_name
                        | outputlookup flagged_searches_lookup`,
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(response.status).toBe(200);
        });

        test('should verify flagged search exists', async () => {
            const response = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: `| inputlookup flagged_searches_lookup | search search_name="${testSearchName}"`,
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(response.status).toBe(200);
            expect(response.data.results.length).toBe(1);
            expect(response.data.results[0].flag_status).toBe('pending');
        });

        test('should be able to update flag status', async () => {
            const response = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: `| inputlookup flagged_searches_lookup
                        | eval flag_status=if(search_name="${testSearchName}", "notified", flag_status)
                        | outputlookup flagged_searches_lookup`,
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(response.status).toBe(200);

            // Verify update
            const verifyResponse = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: `| inputlookup flagged_searches_lookup | search search_name="${testSearchName}"`,
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(verifyResponse.data.results[0].flag_status).toBe('notified');
        });

        test('should be able to unflag (resolve) a search', async () => {
            const response = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: `| inputlookup flagged_searches_lookup
                        | search search_name!="${testSearchName}"
                        | outputlookup flagged_searches_lookup`,
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(response.status).toBe(200);

            // Verify removal
            const verifyResponse = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: `| inputlookup flagged_searches_lookup | search search_name="${testSearchName}"`,
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(verifyResponse.data.results.length).toBe(0);
        });
    });

    describe('Audit Logging API', () => {
        test('should be able to write audit log entry', async () => {
            const now = Math.floor(Date.now() / 1000);
            const response = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: `| inputlookup governance_audit_log
                        | append [| makeresults
                            | eval timestamp=${now},
                                action="api_test",
                                search_name="API_Test_Search",
                                performed_by="api_test_user",
                                details="Testing audit log API"]
                        | outputlookup governance_audit_log`,
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(response.status).toBe(200);
        });

        test('should be able to retrieve audit log entries', async () => {
            const response = await splunkApi.post('/servicesNS/admin/TA-user-governance/search/jobs', {
                search: '| inputlookup governance_audit_log | head 20 | sort -timestamp',
                earliest_time: '-1h',
                latest_time: 'now',
                output_mode: 'json',
                exec_mode: 'oneshot'
            });

            expect(response.status).toBe(200);
            // Audit log should have entries
            expect(response.data.results.length).toBeGreaterThan(0);
        });
    });
});
