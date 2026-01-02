/*
 * Governance Dashboard JavaScript
 * Handles UI interactions for flagging, notifications, and enforcement actions
 *
 * TA-user-governance v1.0.0
 */

require([
    'jquery',
    'splunkjs/mvc',
    'splunkjs/mvc/searchmanager',
    'splunkjs/mvc/simplexml/ready!'
], function($, mvc, SearchManager) {

    // Configuration - loaded from KV store
    var CONFIG = {
        emailDomain: 'example.com',  // Default, will be overwritten from settings
        remediationDays: 7
    };

    // Get current user
    var currentUser = Splunk.util.getConfigValue("USERNAME") || "admin";

    // Token model for accessing dashboard tokens
    var defaultTokens = mvc.Components.get("default");
    var submittedTokens = mvc.Components.get("submitted");

    // Load configuration from KV store
    function loadConfiguration() {
        var configSearch = new SearchManager({
            id: 'config_loader_' + Date.now(),
            search: '| inputlookup governance_settings_lookup | table setting_name, setting_value',
            earliest_time: '-1h',
            latest_time: 'now',
            autostart: true
        });

        configSearch.on('search:done', function(state) {
            var results = configSearch.data('results');
            if (results) {
                results.on('data', function() {
                    var rows = results.data().rows;
                    if (rows) {
                        rows.forEach(function(row) {
                            if (row[0] === 'email_domain') {
                                CONFIG.emailDomain = row[1];
                            } else if (row[0] === 'remediation_days') {
                                CONFIG.remediationDays = parseInt(row[1]) || 7;
                            }
                        });
                    }
                    console.log("Governance config loaded:", CONFIG);
                });
            }
        });
    }

    // Helper function to get token value
    function getToken(tokenName) {
        var value = defaultTokens ? defaultTokens.get(tokenName) : null;
        if (!value && submittedTokens) {
            value = submittedTokens.get(tokenName);
        }
        return value;
    }

    // Helper function to set token
    function setToken(tokenName, value) {
        if (defaultTokens) {
            defaultTokens.set(tokenName, value);
        }
        if (submittedTokens) {
            submittedTokens.set(tokenName, value);
        }
    }

    // Helper function to run a search
    function runSearch(searchQuery, callback) {
        var searchId = 'governance_action_' + Date.now();
        var actionSearch = new SearchManager({
            id: searchId,
            search: searchQuery,
            earliest_time: '-1h',
            latest_time: 'now',
            autostart: true
        });

        actionSearch.on('search:done', function(state) {
            if (state.content.resultCount >= 0) {
                callback(null, state);
            }
        });

        actionSearch.on('search:error', function(err) {
            callback(err, null);
        });

        actionSearch.on('search:failed', function(err) {
            callback(err, null);
        });
    }

    // Build email address from username
    function buildEmailAddress(username) {
        if (username.indexOf('@') > -1) {
            return username; // Already an email
        }
        return username + '@' + CONFIG.emailDomain;
    }

    // Flag a scheduled search
    window.flagSelectedSearch = function() {
        var searchName = getToken("selected_search");
        var owner = getToken("selected_owner");
        var app = getToken("selected_app");
        var reason = getToken("selected_reason") || "Manually flagged by administrator";

        if (!searchName) {
            alert("Please select a search from the table first.");
            return;
        }

        flagSearch(searchName, owner, app, reason);
    };

    window.flagThisSearch = function(searchName, owner, app) {
        var reason = prompt("Enter the reason for flagging this search:", "Identified as requiring review by governance team");
        if (reason) {
            flagSearch(searchName, owner, app, reason);
        }
    };

    function flagSearch(searchName, owner, app, reason) {
        var now = Math.floor(Date.now() / 1000);
        var deadline = now + (CONFIG.remediationDays * 24 * 60 * 60);

        var searchQuery = '| makeresults ' +
            '| eval search_name="' + escapeString(searchName) + '"' +
            ', search_owner="' + escapeString(owner) + '"' +
            ', search_app="' + escapeString(app) + '"' +
            ', flagged_by="' + escapeString(currentUser) + '"' +
            ', flagged_time=' + now +
            ', notification_sent=0' +
            ', notification_time=0' +
            ', remediation_deadline=' + deadline +
            ', status="pending"' +
            ', reason="' + escapeString(reason) + '"' +
            ', notes=""' +
            '| table search_name, search_owner, search_app, flagged_by, flagged_time, notification_sent, notification_time, remediation_deadline, status, reason, notes' +
            '| outputlookup append=true flagged_searches_lookup';

        runSearch(searchQuery, function(err, results) {
            if (err) {
                alert("Error flagging search: " + err);
            } else {
                logAction("flagged", searchName, reason);
                alert("Search '" + searchName + "' has been flagged.\n\nOwner (" + owner + ") will be notified.\nDeadline: " + CONFIG.remediationDays + " days from now.");
                refreshDashboard();
            }
        });
    }

    // Send email to owner
    window.emailOwner = function() {
        var owner = getToken("selected_owner");
        var searchName = getToken("selected_search");
        var reason = getToken("selected_reason") || "";

        if (!owner || !searchName) {
            alert("Please select a search from the table first.");
            return;
        }

        emailThisOwner(owner, searchName, reason);
    };

    window.emailThisOwner = function(owner, searchName, reason) {
        reason = reason || "Your scheduled search has been identified as requiring review.";
        var emailAddr = buildEmailAddress(owner);
        var subject = encodeURIComponent("Action Required: Scheduled Search '" + searchName + "' Flagged for Review");
        var body = encodeURIComponent(
            "Hello " + owner + ",\n\n" +
            "Your scheduled search has been flagged by the Splunk governance team for the following reason(s):\n\n" +
            "- " + reason + "\n\n" +
            "Search Details:\n" +
            "- Name: " + searchName + "\n\n" +
            "You have " + CONFIG.remediationDays + " days to remediate this issue. If no action is taken by the deadline, the search will be automatically disabled.\n\n" +
            "Please review and optimize your search, or contact the governance team if you believe this is in error.\n\n" +
            "Best regards,\n" +
            "Splunk Governance Team"
        );

        window.location.href = "mailto:" + emailAddr + "?subject=" + subject + "&body=" + body;
    };

    // Send reminder email
    window.sendReminder = function() {
        var searchName = getToken("manage_search");
        var owner = getToken("manage_owner");

        if (!searchName) {
            alert("Please select a flagged search first.");
            return;
        }

        var emailAddr = buildEmailAddress(owner);
        var subject = encodeURIComponent("REMINDER: Scheduled Search '" + searchName + "' Requires Remediation");
        var body = encodeURIComponent(
            "Hello " + owner + ",\n\n" +
            "This is a reminder that your scheduled search '" + searchName + "' has been flagged and requires remediation.\n\n" +
            "If no action is taken before the deadline, the search will be automatically disabled.\n\n" +
            "Please address this issue as soon as possible.\n\n" +
            "Best regards,\n" +
            "Splunk Governance Team"
        );

        window.location.href = "mailto:" + emailAddr + "?subject=" + subject + "&body=" + body;
        logAction("reminder_sent", searchName, "Reminder email sent");
    };

    // Extend deadline
    window.extendDeadline = function() {
        var searchName = getToken("manage_search");

        if (!searchName) {
            alert("Please select a flagged search first.");
            return;
        }

        var extensionDays = CONFIG.remediationDays;
        var extensionSeconds = extensionDays * 24 * 60 * 60;

        var searchQuery = '| inputlookup flagged_searches_lookup ' +
            '| eval remediation_deadline = if(search_name="' + escapeString(searchName) + '", remediation_deadline + ' + extensionSeconds + ', remediation_deadline)' +
            '| outputlookup flagged_searches_lookup';

        runSearch(searchQuery, function(err, results) {
            if (err) {
                alert("Error extending deadline: " + err);
            } else {
                logAction("extended", searchName, "Deadline extended by " + extensionDays + " days");
                alert("Deadline for '" + searchName + "' has been extended by " + extensionDays + " days.");
                refreshDashboard();
            }
        });
    };

    // Disable search now
    window.disableNow = function() {
        var searchName = getToken("manage_search");
        var owner = getToken("manage_owner");

        if (!searchName) {
            alert("Please select a flagged search first.");
            return;
        }

        if (!confirm("Are you sure you want to disable '" + searchName + "' immediately?\n\nThis will prevent the search from running until manually re-enabled.")) {
            return;
        }

        // Update status in KV store
        var searchQuery = '| inputlookup flagged_searches_lookup ' +
            '| eval status = if(search_name="' + escapeString(searchName) + '", "disabled", status)' +
            '| outputlookup flagged_searches_lookup';

        runSearch(searchQuery, function(err, results) {
            if (err) {
                alert("Error updating status: " + err);
                return;
            }

            logAction("disabled", searchName, "Search disabled by " + currentUser);
            alert("Search '" + searchName + "' has been marked as disabled.\n\nNote: You may need to manually disable the search in Splunk's Settings > Searches, reports, and alerts.");

            // Send notification email
            var emailAddr = buildEmailAddress(owner);
            var subject = encodeURIComponent("Notice: Your Scheduled Search '" + searchName + "' Has Been Disabled");
            var body = encodeURIComponent(
                "Hello " + owner + ",\n\n" +
                "Your scheduled search '" + searchName + "' has been disabled by the Splunk governance team.\n\n" +
                "To restore this search, please contact the governance team after addressing the identified issues.\n\n" +
                "Best regards,\n" +
                "Splunk Governance Team"
            );

            window.open("mailto:" + emailAddr + "?subject=" + subject + "&body=" + body, "_blank");
            refreshDashboard();
        });
    };

    // Unflag / Mark as resolved
    window.unflagSearch = function() {
        var searchName = getToken("manage_search");

        if (!searchName) {
            alert("Please select a flagged search first.");
            return;
        }

        if (!confirm("Mark '" + searchName + "' as resolved and remove from flagged list?")) {
            return;
        }

        var searchQuery = '| inputlookup flagged_searches_lookup ' +
            '| eval status = if(search_name="' + escapeString(searchName) + '", "resolved", status)' +
            '| outputlookup flagged_searches_lookup';

        runSearch(searchQuery, function(err, results) {
            if (err) {
                alert("Error updating status: " + err);
            } else {
                logAction("unflagged", searchName, "Marked as resolved by " + currentUser);
                alert("Search '" + searchName + "' has been marked as resolved.");
                refreshDashboard();
            }
        });
    };

    // Clear selection
    window.clearSelection = function() {
        setToken("selected_search", undefined);
        setToken("selected_owner", undefined);
        setToken("selected_app", undefined);
        setToken("selected_reason", undefined);
        setToken("manage_search", undefined);
        setToken("manage_owner", undefined);
        setToken("manage_status", undefined);
    };

    // Log action to audit log
    function logAction(action, searchName, details) {
        var now = Math.floor(Date.now() / 1000);
        var searchQuery = '| makeresults ' +
            '| eval timestamp=' + now +
            ', action="' + escapeString(action) + '"' +
            ', search_name="' + escapeString(searchName) + '"' +
            ', performed_by="' + escapeString(currentUser) + '"' +
            ', details="' + escapeString(details) + '"' +
            '| table timestamp, action, search_name, performed_by, details' +
            '| outputlookup append=true governance_audit_log_lookup';

        runSearch(searchQuery, function(err, results) {
            if (err) {
                console.error("Error logging action:", err);
            }
        });
    }

    // Refresh dashboard panels
    function refreshDashboard() {
        setTimeout(function() {
            var managers = mvc.Components.getInstances();
            for (var i = 0; i < managers.length; i++) {
                var manager = managers[i];
                if (manager && typeof manager.startSearch === 'function') {
                    try {
                        manager.startSearch();
                    } catch (e) {
                        // Ignore errors from non-search managers
                    }
                }
            }
        }, 500);
    }

    // Helper to escape strings for SPL
    function escapeString(str) {
        if (!str) return "";
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }

    // ============================================
    // CRON SCHEDULE MODAL FUNCTIONALITY
    // ============================================

    var cronModal = {
        currentSearch: { name: '', cron: '', owner: '', app: '' },

        // Create and inject the modal HTML into the page
        init: function() {
            if ($('#cronModalOverlay').length) return; // Already initialized

            var modalHtml = `
                <div class="cron-modal-overlay" id="cronModalOverlay">
                    <div class="cron-modal">
                        <div class="cron-modal-header">
                            <h2>⏰ Edit Cron Schedule</h2>
                            <button class="cron-modal-close" onclick="cronModal.close()">&times;</button>
                        </div>
                        <div class="cron-modal-body">
                            <div class="cron-search-info">
                                <div class="cron-search-info-row">
                                    <span class="cron-search-info-label">Search Name</span>
                                    <span class="cron-search-info-value" id="cronModalSearchName">-</span>
                                </div>
                                <div class="cron-search-info-row">
                                    <span class="cron-search-info-label">Owner</span>
                                    <span class="cron-search-info-value" id="cronModalOwner">-</span>
                                </div>
                                <div class="cron-search-info-row">
                                    <span class="cron-search-info-label">App</span>
                                    <span class="cron-search-info-value" id="cronModalApp">-</span>
                                </div>
                            </div>

                            <div class="cron-section-title">Quick Presets</div>
                            <div class="cron-preset-grid">
                                <div class="cron-preset-btn" onclick="cronModal.selectPreset('0 * * * *', this)">
                                    <div class="cron-preset-label">Hourly</div>
                                    <div class="cron-preset-cron">0 * * * *</div>
                                </div>
                                <div class="cron-preset-btn" onclick="cronModal.selectPreset('0 */2 * * *', this)">
                                    <div class="cron-preset-label">Every 2 Hours</div>
                                    <div class="cron-preset-cron">0 */2 * * *</div>
                                </div>
                                <div class="cron-preset-btn" onclick="cronModal.selectPreset('0 */4 * * *', this)">
                                    <div class="cron-preset-label">Every 4 Hours</div>
                                    <div class="cron-preset-cron">0 */4 * * *</div>
                                </div>
                                <div class="cron-preset-btn" onclick="cronModal.selectPreset('0 */6 * * *', this)">
                                    <div class="cron-preset-label">Every 6 Hours</div>
                                    <div class="cron-preset-cron">0 */6 * * *</div>
                                </div>
                                <div class="cron-preset-btn" onclick="cronModal.selectPreset('0 0 * * *', this)">
                                    <div class="cron-preset-label">Daily</div>
                                    <div class="cron-preset-cron">0 0 * * *</div>
                                </div>
                                <div class="cron-preset-btn" onclick="cronModal.selectPreset('0 0 * * 0', this)">
                                    <div class="cron-preset-label">Weekly</div>
                                    <div class="cron-preset-cron">0 0 * * 0</div>
                                </div>
                                <div class="cron-preset-btn" onclick="cronModal.selectPreset('0 0 1 * *', this)">
                                    <div class="cron-preset-label">Monthly</div>
                                    <div class="cron-preset-cron">0 0 1 * *</div>
                                </div>
                                <div class="cron-preset-btn" onclick="cronModal.selectPreset('0 6 * * 1-5', this)">
                                    <div class="cron-preset-label">Weekdays 6AM</div>
                                    <div class="cron-preset-cron">0 6 * * 1-5</div>
                                </div>
                            </div>

                            <div class="cron-section-title">Custom Schedule</div>
                            <div class="cron-input-section">
                                <div class="cron-fields">
                                    <div class="cron-field">
                                        <label>Minute</label>
                                        <input type="text" id="cronMinute" value="*" oninput="cronModal.updatePreview()">
                                    </div>
                                    <div class="cron-field">
                                        <label>Hour</label>
                                        <input type="text" id="cronHour" value="*" oninput="cronModal.updatePreview()">
                                    </div>
                                    <div class="cron-field">
                                        <label>Day (Month)</label>
                                        <input type="text" id="cronDayMonth" value="*" oninput="cronModal.updatePreview()">
                                    </div>
                                    <div class="cron-field">
                                        <label>Month</label>
                                        <input type="text" id="cronMonth" value="*" oninput="cronModal.updatePreview()">
                                    </div>
                                    <div class="cron-field">
                                        <label>Day (Week)</label>
                                        <input type="text" id="cronDayWeek" value="*" oninput="cronModal.updatePreview()">
                                    </div>
                                </div>
                            </div>

                            <div class="cron-preview">
                                <div class="cron-preview-label">Cron Expression</div>
                                <div class="cron-preview-value" id="cronPreviewValue">* * * * *</div>
                                <div class="cron-preview-description" id="cronDescription">Runs every minute</div>
                                <div class="cron-next-runs">
                                    <div class="cron-next-runs-title">Next Scheduled Runs</div>
                                    <div id="cronNextRuns"></div>
                                </div>
                            </div>
                        </div>
                        <div class="cron-modal-footer">
                            <button class="btn btn-secondary" onclick="cronModal.close()">Cancel</button>
                            <button class="btn btn-primary" onclick="cronModal.save()">Save Schedule</button>
                        </div>
                    </div>
                </div>
                <div class="cron-toast" id="cronToast">Schedule updated successfully!</div>
            `;

            $('body').append(modalHtml);

            // Close on overlay click
            $('#cronModalOverlay').on('click', function(e) {
                if (e.target === this) {
                    cronModal.close();
                }
            });

            // Close on escape key
            $(document).on('keydown', function(e) {
                if (e.key === 'Escape' && $('#cronModalOverlay').hasClass('active')) {
                    cronModal.close();
                }
            });
        },

        // Open the modal with search details
        open: function(searchName, cronSchedule, owner, app) {
            this.currentSearch = { name: searchName, cron: cronSchedule, owner: owner, app: app };

            $('#cronModalSearchName').text(searchName);
            $('#cronModalOwner').text(owner);
            $('#cronModalApp').text(app);

            // Parse and set cron fields
            var parts = cronSchedule.split(' ');
            if (parts.length >= 5) {
                $('#cronMinute').val(parts[0]);
                $('#cronHour').val(parts[1]);
                $('#cronDayMonth').val(parts[2]);
                $('#cronMonth').val(parts[3]);
                $('#cronDayWeek').val(parts[4]);
            }

            // Clear active preset
            $('.cron-preset-btn').removeClass('active');

            this.updatePreview();
            $('#cronModalOverlay').addClass('active');
        },

        // Close the modal
        close: function() {
            $('#cronModalOverlay').removeClass('active');
        },

        // Select a preset
        selectPreset: function(cron, element) {
            $('.cron-preset-btn').removeClass('active');
            $(element).addClass('active');

            var parts = cron.split(' ');
            $('#cronMinute').val(parts[0]);
            $('#cronHour').val(parts[1]);
            $('#cronDayMonth').val(parts[2]);
            $('#cronMonth').val(parts[3]);
            $('#cronDayWeek').val(parts[4]);

            this.updatePreview();
        },

        // Update the preview
        updatePreview: function() {
            var minute = $('#cronMinute').val() || '*';
            var hour = $('#cronHour').val() || '*';
            var dayMonth = $('#cronDayMonth').val() || '*';
            var month = $('#cronMonth').val() || '*';
            var dayWeek = $('#cronDayWeek').val() || '*';

            var cron = minute + ' ' + hour + ' ' + dayMonth + ' ' + month + ' ' + dayWeek;
            $('#cronPreviewValue').text(cron);

            var description = this.describeCron(minute, hour, dayMonth, month, dayWeek);
            $('#cronDescription').text(description);

            this.generateNextRuns(minute, hour, dayMonth, month, dayWeek);
        },

        // Describe the cron expression
        describeCron: function(minute, hour, dayMonth, month, dayWeek) {
            if (minute === '*' && hour === '*' && dayMonth === '*' && month === '*' && dayWeek === '*') {
                return 'Runs every minute';
            }
            if (minute.indexOf('*/') === 0) {
                var interval = minute.substring(2);
                return 'Runs every ' + interval + ' minute' + (interval > 1 ? 's' : '');
            }
            if (minute === '0' && hour === '*') {
                return 'Runs every hour at minute 0';
            }
            if (minute === '0' && hour.indexOf('*/') === 0) {
                var interval = hour.substring(2);
                return 'Runs every ' + interval + ' hour' + (interval > 1 ? 's' : '');
            }
            if (minute === '0' && hour === '0' && dayMonth === '*' && month === '*' && dayWeek === '*') {
                return 'Runs daily at midnight';
            }
            if (minute === '0' && hour !== '*' && dayMonth === '*' && month === '*' && dayWeek === '*') {
                var hourNum = parseInt(hour);
                var ampm = hourNum >= 12 ? 'PM' : 'AM';
                var hour12 = hourNum % 12 || 12;
                return 'Runs daily at ' + hour12 + ':00 ' + ampm;
            }
            if (minute === '0' && hour === '0' && dayMonth === '*' && month === '*' && dayWeek === '0') {
                return 'Runs weekly on Sunday at midnight';
            }
            if (minute === '0' && hour === '0' && dayMonth === '1' && month === '*' && dayWeek === '*') {
                return 'Runs monthly on the 1st at midnight';
            }
            if (dayWeek === '1-5') {
                return 'Runs on weekdays at ' + hour + ':' + (minute === '0' ? '00' : minute);
            }

            var desc = 'Runs ';
            if (minute !== '*') desc += 'at minute ' + minute + ' ';
            if (hour !== '*') desc += 'at hour ' + hour + ' ';
            if (dayMonth !== '*') desc += 'on day ' + dayMonth + ' ';
            if (month !== '*') desc += 'in month ' + month + ' ';
            if (dayWeek !== '*') desc += 'on weekday ' + dayWeek;

            return desc.trim() || 'Custom schedule';
        },

        // Generate next run times
        generateNextRuns: function(minute, hour, dayMonth, month, dayWeek) {
            var now = new Date();
            var runs = [];

            for (var i = 0; i < 3; i++) {
                var nextRun = new Date(now);

                if (minute === '*' || minute.indexOf('*/') === 0) {
                    var interval = minute === '*' ? 1 : parseInt(minute.substring(2));
                    nextRun.setMinutes(nextRun.getMinutes() + (i * interval) + 1);
                    nextRun.setSeconds(0);
                } else if (hour === '*' || hour.indexOf('*/') === 0) {
                    var hourInterval = hour === '*' ? 1 : parseInt(hour.substring(2));
                    nextRun.setHours(nextRun.getHours() + (i * hourInterval));
                    nextRun.setMinutes(parseInt(minute) || 0);
                    nextRun.setSeconds(0);
                } else {
                    nextRun.setDate(nextRun.getDate() + i);
                    nextRun.setHours(parseInt(hour) || 0);
                    nextRun.setMinutes(parseInt(minute) || 0);
                    nextRun.setSeconds(0);
                }

                runs.push(nextRun.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                }));
            }

            var html = runs.map(function(run) {
                return '<div class="cron-next-run-item">' + run + '</div>';
            }).join('');

            $('#cronNextRuns').html(html);
        },

        // Save the schedule
        save: function() {
            var newCron = $('#cronPreviewValue').text();
            var searchName = this.currentSearch.name;
            var app = this.currentSearch.app;
            var owner = this.currentSearch.owner;

            // Log the action
            logAction("schedule_changed", searchName, "Changed cron from '" + this.currentSearch.cron + "' to '" + newCron + "'");

            // Show success toast
            this.showToast("Schedule updated to: " + newCron);
            this.close();

            // Note: Actual schedule update via REST API would require additional permissions
            // For now, this logs the change. In production, you'd use:
            // POST /servicesNS/{owner}/{app}/saved/searches/{name}
            // with body: cron_schedule={newCron}

            alert("Schedule Change Logged!\n\nSearch: " + searchName + "\nNew Schedule: " + newCron + "\n\nNote: To apply this change, update the search in Settings > Searches, Reports, and Alerts, or use the Splunk REST API.");

            refreshDashboard();
        },

        // Show toast notification
        showToast: function(message) {
            $('#cronToast').text(message).addClass('show');
            setTimeout(function() {
                $('#cronToast').removeClass('show');
            }, 3000);
        }
    };

    // Make cronModal available globally
    window.cronModal = cronModal;

    // ============================================
    // TABLE ENHANCEMENT FOR CRON CLICKING
    // ============================================

    function enhanceScheduleColumns() {
        // Find all Splunk tables - they use various class names
        $('[data-cid], .table-chrome, .splunk-table, .shared-resultstable').each(function() {
            var $table = $(this);
            var scheduleColIndex = -1;
            var searchNameColIndex = -1;
            var ownerColIndex = -1;
            var appColIndex = -1;

            // Find header element - Splunk uses thead or .shared-resultstable-headertablerow
            var $headers = $table.find('thead th, .shared-resultstable-headertablerow th, th');

            // Find column indices
            $headers.each(function(index) {
                var headerText = $(this).text().trim();
                if (headerText === 'Schedule') scheduleColIndex = index;
                if (headerText === 'Search Name') searchNameColIndex = index;
                if (headerText === 'Owner') ownerColIndex = index;
                if (headerText === 'App') appColIndex = index;
            });

            if (scheduleColIndex < 0) return; // No Schedule column found

            // Process each row
            $table.find('tbody tr, .shared-resultstable-tablerow').each(function() {
                var $row = $(this);
                var $cells = $row.find('td');

                if ($cells.length <= scheduleColIndex) return;

                var $scheduleCell = $cells.eq(scheduleColIndex);
                var cronValue = $scheduleCell.text().trim();

                // Skip if already enhanced or not a valid cron
                if ($scheduleCell.find('.cron-clickable').length) return;
                if (!cronValue.match(/^[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+$/)) return;

                // Get row data
                var searchName = searchNameColIndex >= 0 && $cells.length > searchNameColIndex ?
                    $cells.eq(searchNameColIndex).text().trim() :
                    ($cells.length > 1 ? $cells.eq(1).text().trim() : '');
                var owner = ownerColIndex >= 0 && $cells.length > ownerColIndex ?
                    $cells.eq(ownerColIndex).text().trim() : '';
                var app = appColIndex >= 0 && $cells.length > appColIndex ?
                    $cells.eq(appColIndex).text().trim() : '';

                // Wrap in clickable span
                $scheduleCell.html(
                    '<span class="cron-clickable" ' +
                    'data-cron="' + escapeHtml(cronValue) + '" ' +
                    'data-search="' + escapeHtml(searchName) + '" ' +
                    'data-owner="' + escapeHtml(owner) + '" ' +
                    'data-app="' + escapeHtml(app) + '">' +
                    escapeHtml(cronValue) + '</span>'
                );
            });
        });
    }

    // Helper to escape HTML attributes
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ============================================
    // CLICK HANDLER - Uses capture phase to beat drilldown
    // ============================================

    // Use capture phase to intercept click before Splunk's drilldown
    document.addEventListener('click', function(e) {
        var $target = $(e.target);

        // Check if clicked on cron-clickable or inside it
        var $cronElement = $target.hasClass('cron-clickable') ? $target : $target.closest('.cron-clickable');

        if ($cronElement.length) {
            // STOP the event completely - prevent Splunk drilldown
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            var cron = $cronElement.data('cron') || $cronElement.attr('data-cron');
            var searchName = $cronElement.data('search') || $cronElement.attr('data-search');
            var owner = $cronElement.data('owner') || $cronElement.attr('data-owner');
            var app = $cronElement.data('app') || $cronElement.attr('data-app');

            console.log("Opening cron modal for:", searchName, cron);
            cronModal.open(searchName, cron, owner, app);
            return false;
        }
    }, true); // true = capture phase

    // ============================================
    // PREVIEW IMPACT MODAL
    // ============================================

    var impactModal = {
        init: function() {
            if ($('#impactModalOverlay').length) return;

            var modalHtml = `
                <div class="cron-modal-overlay" id="impactModalOverlay">
                    <div class="cron-modal" style="max-width: 800px;">
                        <div class="cron-modal-header" style="background: linear-gradient(90deg, rgba(248, 190, 52, 0.15) 0%, transparent 100%);">
                            <h2 style="color: #f8be34;">📊 Preview Impact</h2>
                            <button class="cron-modal-close" onclick="impactModal.close()">&times;</button>
                        </div>
                        <div class="cron-modal-body">
                            <div class="cron-search-info">
                                <div class="cron-search-info-row">
                                    <span class="cron-search-info-label">Search Name</span>
                                    <span class="cron-search-info-value" id="impactSearchName">-</span>
                                </div>
                                <div class="cron-search-info-row">
                                    <span class="cron-search-info-label">Owner</span>
                                    <span class="cron-search-info-value" id="impactOwner">-</span>
                                </div>
                                <div class="cron-search-info-row">
                                    <span class="cron-search-info-label">Current Status</span>
                                    <span class="cron-search-info-value" id="impactStatus">-</span>
                                </div>
                            </div>

                            <div class="cron-section-title">Resource Usage Analysis</div>
                            <div class="impact-metrics" id="impactMetrics">
                                <div class="impact-loading">Loading metrics...</div>
                            </div>

                            <div class="cron-section-title">If Disabled, This Search Would:</div>
                            <div class="impact-consequences" id="impactConsequences">
                                <ul style="margin: 10px 0; padding-left: 20px; color: rgba(255,255,255,0.8);">
                                    <li>Stop running at scheduled intervals</li>
                                    <li>No longer consume search resources</li>
                                    <li>Not trigger any associated alerts</li>
                                    <li>Require manual re-enabling to resume</li>
                                </ul>
                            </div>

                            <div class="cron-section-title">Recommended Actions</div>
                            <div id="impactRecommendations" style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; border: 1px solid rgba(255,255,255,0.1);">
                                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
                                    <button class="btn btn-primary" onclick="impactModal.takeAction('flag')">Flag for Review</button>
                                    <button class="btn" onclick="impactModal.takeAction('email')">Email Owner</button>
                                    <button class="btn btn-warning" onclick="impactModal.takeAction('disable')">Disable Now</button>
                                </div>
                            </div>
                        </div>
                        <div class="cron-modal-footer">
                            <button class="btn btn-secondary" onclick="impactModal.close()">Close</button>
                        </div>
                    </div>
                </div>
            `;

            $('body').append(modalHtml);

            $('#impactModalOverlay').on('click', function(e) {
                if (e.target === this) impactModal.close();
            });

            $(document).on('keydown', function(e) {
                if (e.key === 'Escape' && $('#impactModalOverlay').hasClass('active')) {
                    impactModal.close();
                }
            });
        },

        currentSearch: { name: '', owner: '', app: '' },

        open: function(searchName, owner, app, metrics) {
            this.currentSearch = { name: searchName, owner: owner, app: app };

            $('#impactSearchName').text(searchName || '-');
            $('#impactOwner').text(owner || '-');
            $('#impactStatus').text(metrics && metrics.status ? metrics.status : 'Active');

            // Show metrics
            var metricsHtml = `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 10px;">
                    <div style="background: rgba(0,0,0,0.3); padding: 16px; border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="font-size: 24px; font-weight: bold; color: #00d4ff;">${metrics && metrics.avgRuntime ? metrics.avgRuntime : 'N/A'}</div>
                        <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">AVG RUNTIME</div>
                    </div>
                    <div style="background: rgba(0,0,0,0.3); padding: 16px; border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="font-size: 24px; font-weight: bold; color: ${metrics && parseFloat(metrics.runtimeRatio) > 10 ? '#dc4e41' : '#53a051'};">${metrics && metrics.runtimeRatio ? metrics.runtimeRatio + '%' : 'N/A'}</div>
                        <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">RUNTIME RATIO</div>
                    </div>
                    <div style="background: rgba(0,0,0,0.3); padding: 16px; border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="font-size: 24px; font-weight: bold; color: #f8be34;">${metrics && metrics.frequency ? metrics.frequency : 'N/A'}</div>
                        <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">FREQUENCY</div>
                    </div>
                </div>
            `;
            $('#impactMetrics').html(metricsHtml);

            $('#impactModalOverlay').addClass('active');
        },

        close: function() {
            $('#impactModalOverlay').removeClass('active');
        },

        takeAction: function(action) {
            var name = this.currentSearch.name;
            var owner = this.currentSearch.owner;
            var app = this.currentSearch.app;

            this.close();

            switch(action) {
                case 'flag':
                    flagThisSearch(name, owner, app);
                    break;
                case 'email':
                    emailThisOwner(owner, name, 'Identified as requiring review by governance team');
                    break;
                case 'disable':
                    setToken("manage_search", name);
                    setToken("manage_owner", owner);
                    disableNow();
                    break;
            }
        }
    };

    window.impactModal = impactModal;

    // Preview Impact button handler
    window.previewImpact = function() {
        var searchName = getToken("selected_search");
        var owner = getToken("selected_owner");
        var app = getToken("selected_app");

        if (!searchName) {
            alert("Please select a search from the table first.");
            return;
        }

        // Get metrics from the table row if available
        var metrics = {
            avgRuntime: '-',
            runtimeRatio: '-',
            frequency: '-',
            status: 'Active'
        };

        // Try to find metrics from the selected row
        $('table tbody tr').each(function() {
            var $row = $(this);
            var $cells = $row.find('td');
            var foundName = false;

            $cells.each(function() {
                if ($(this).text().trim() === searchName) {
                    foundName = true;
                }
            });

            if (foundName) {
                // Find metric columns
                $('table thead th').each(function(idx) {
                    var header = $(this).text().trim();
                    if (header === 'Avg Runtime' && $cells.length > idx) {
                        metrics.avgRuntime = $cells.eq(idx).text().trim();
                    }
                    if (header === 'Runtime %' && $cells.length > idx) {
                        metrics.runtimeRatio = $cells.eq(idx).text().trim().replace('%', '');
                    }
                    if (header === 'Frequency' && $cells.length > idx) {
                        metrics.frequency = $cells.eq(idx).text().trim();
                    }
                    if (header === 'Status' && $cells.length > idx) {
                        metrics.status = $cells.eq(idx).text().trim();
                    }
                });
            }
        });

        impactModal.open(searchName, owner, app, metrics);
    };

    // ============================================
    // TRACK SEARCH FUNCTIONALITY
    // ============================================

    window.trackSearch = function() {
        var searchName = getToken("selected_search");
        var owner = getToken("selected_owner");
        var app = getToken("selected_app");

        if (!searchName) {
            alert("Please select a search from the table first.");
            return;
        }

        // Check if already tracked
        var checkQuery = '| inputlookup flagged_searches_lookup | search search_name="' + escapeString(searchName) + '" status IN ("pending", "notified") | stats count';

        runSearch(checkQuery, function(err, state) {
            if (err) {
                console.error("Error checking track status:", err);
                // Proceed with flagging anyway
                flagSearch(searchName, owner, app, "Added to tracking list");
            } else {
                // Flag it if not already tracked
                flagSearch(searchName, owner, app, "Added to tracking list for monitoring");
                cronModal.showToast("Search is now being tracked");
            }
        });
    };

    // ============================================
    // DISABLE SEARCH OVER TIME (Auto-Disable)
    // ============================================

    // This runs on page load to check for searches past deadline
    function checkAutoDisable() {
        var now = Math.floor(Date.now() / 1000);

        var checkQuery = '| inputlookup flagged_searches_lookup ' +
            '| search status IN ("pending", "notified") ' +
            '| eval is_overdue = if(remediation_deadline < ' + now + ', 1, 0) ' +
            '| search is_overdue=1 ' +
            '| table search_name, search_owner, search_app, remediation_deadline';

        runSearch(checkQuery, function(err, state) {
            if (err) {
                console.error("Error checking for overdue searches:", err);
                return;
            }

            var results = state.content.resultCount;
            if (results > 0) {
                console.log("Found " + results + " searches past deadline - auto-disable scheduled");

                // Update their status to disabled
                var updateQuery = '| inputlookup flagged_searches_lookup ' +
                    '| eval status = if(status IN ("pending", "notified") AND remediation_deadline < ' + now + ', "disabled", status) ' +
                    '| outputlookup flagged_searches_lookup';

                runSearch(updateQuery, function(err2, state2) {
                    if (!err2) {
                        console.log("Auto-disabled overdue searches");
                        refreshDashboard();
                    }
                });
            }
        });
    }

    // ============================================
    // INITIALIZE
    // ============================================

    $(document).ready(function() {
        console.log("TA-user-governance: Governance Dashboard initializing...");

        // Load configuration from KV store
        loadConfiguration();

        // Initialize modals
        cronModal.init();
        impactModal.init();

        // Enhance schedule columns after initial table render
        setTimeout(enhanceScheduleColumns, 1500);
        setTimeout(enhanceScheduleColumns, 3000);
        setTimeout(enhanceScheduleColumns, 5000);

        // Use MutationObserver to detect table changes (replaces deprecated DOMNodeInserted)
        var tableObserver = new MutationObserver(function(mutations) {
            clearTimeout(window._enhanceTimeout);
            window._enhanceTimeout = setTimeout(enhanceScheduleColumns, 300);
        });

        // Observe the dashboard body for table changes
        var dashboardBody = document.querySelector('.dashboard-body') || document.body;
        tableObserver.observe(dashboardBody, {
            childList: true,
            subtree: true
        });

        // Also observe when searches complete
        var managers = mvc.Components.getInstances();
        for (var i = 0; i < managers.length; i++) {
            var manager = managers[i];
            if (manager && manager.on && typeof manager.on === 'function') {
                try {
                    manager.on('search:done', function() {
                        setTimeout(enhanceScheduleColumns, 500);
                    });
                } catch (e) {
                    // Ignore non-search managers
                }
            }
        }

        // Check for auto-disable on load
        setTimeout(checkAutoDisable, 5000);

        // Check periodically (every 5 minutes)
        setInterval(checkAutoDisable, 5 * 60 * 1000);

        console.log("TA-user-governance: Governance Dashboard initialized");
    });

});
