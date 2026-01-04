/*
 * Governance Dashboard JavaScript
 * Handles UI interactions for flagging, notifications, and enforcement actions
 *
 * TA-user-governance v1.2.0
 */

require([
    'jquery',
    'underscore',
    'splunkjs/mvc',
    'splunkjs/mvc/searchmanager',
    'splunkjs/mvc/tableview',
    'splunkjs/mvc/simplexml/ready!'
], function($, _, mvc, SearchManager, TableView) {
    "use strict";

    console.log("TA-user-governance: Starting initialization...");
    console.log("TA-user-governance: jQuery version:", $.fn.jquery);
    console.log("TA-user-governance: mvc available:", typeof mvc !== 'undefined');

    // Configuration - loaded from KV store
    var CONFIG = {
        emailDomain: 'example.com',
        remediationDays: 7
    };

    // Get current user
    var currentUser = "admin";
    try {
        currentUser = Splunk.util.getConfigValue("USERNAME") || "admin";
    } catch (e) {
        console.log("Could not get username, using admin");
    }

    // Token model for accessing dashboard tokens
    var defaultTokens = mvc.Components.get("default");
    var submittedTokens = mvc.Components.get("submitted");

    // Helper function to get token value
    function getToken(tokenName) {
        var value = null;
        if (defaultTokens) {
            value = defaultTokens.get(tokenName);
        }
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

    // Helper to escape HTML
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // Helper function to run a search
    function runSearch(searchQuery, callback) {
        var searchId = 'governance_action_' + Date.now();
        var callbackCalled = false;

        console.log("runSearch starting:", searchId);

        var actionSearch = new SearchManager({
            id: searchId,
            search: searchQuery,
            earliest_time: '-1h',
            latest_time: 'now',
            autostart: true
        });

        actionSearch.on('search:start', function() {
            console.log("Search started:", searchId);
        });

        actionSearch.on('search:done', function(state) {
            console.log("Search done:", searchId, state);
            if (!callbackCalled) {
                callbackCalled = true;
                callback(null, state);
            }
        });

        actionSearch.on('search:error', function(err) {
            console.error("Search error:", searchId, err);
            if (!callbackCalled) {
                callbackCalled = true;
                callback(err, null);
            }
        });

        actionSearch.on('search:failed', function(err) {
            console.error("Search failed:", searchId, err);
            if (!callbackCalled) {
                callbackCalled = true;
                callback(err, null);
            }
        });

        // Timeout fallback - assume success after 5 seconds if no response
        setTimeout(function() {
            if (!callbackCalled) {
                console.log("Search timeout, assuming success:", searchId);
                callbackCalled = true;
                callback(null, { timeout: true });
            }
        }, 5000);
    }

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

    // Build email address from username
    function buildEmailAddress(username) {
        if (!username) return '';
        if (username.indexOf('@') > -1) {
            return username;
        }
        return username + '@' + CONFIG.emailDomain;
    }

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
                        // Ignore
                    }
                }
            }
        }, 500);
    }

    // Show toast notification
    function showToast(message) {
        var $toast = $('#cronToast');
        if (!$toast.length) {
            $('body').append('<div class="cron-toast" id="cronToast"></div>');
            $toast = $('#cronToast');
        }
        $toast.text(message).addClass('show');
        setTimeout(function() {
            $toast.removeClass('show');
        }, 3000);
    }

    // ============================================
    // FLAG SEARCH FUNCTIONS
    // ============================================

    function flagSearch(searchName, owner, app, reason) {
        console.log("flagSearch called:", searchName, owner, app, reason);

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

        console.log("Running flag search query...");

        // Show immediate visual feedback
        showToast("Flagging " + searchName + "...");

        // Mark the row as flagged visually
        $('[data-search="' + searchName + '"]').addClass('row-flagged');

        runSearch(searchQuery, function(err, results) {
            console.log("Flag search callback:", err, results);
            if (err) {
                console.error("Error flagging search:", err);
                showToast("Error: " + err);
                $('[data-search="' + searchName + '"]').removeClass('row-flagged');
            } else {
                console.log("Search flagged successfully");
                logAction("flagged", searchName, reason);
                showToast("✓ Flagged: " + searchName);

                var $row = $('[data-search="' + searchName + '"]');

                // Add success checkmark
                if (!$row.find('.flag-success-indicator').length) {
                    $row.css('position', 'relative').append('<span class="flag-success-indicator">✓</span>');
                    setTimeout(function() {
                        $row.find('.flag-success-indicator').fadeOut(300, function() {
                            $(this).remove();
                        });
                    }, 2000);
                }

                // Update the flag icon with animation
                var $flagBtn = $row.find('.quick-flag-btn');
                $flagBtn.css({
                    'transform': 'scale(1.5)',
                    'color': '#dc4e41'
                });
                setTimeout(function() {
                    $flagBtn
                        .css('transform', 'scale(1)')
                        .attr('title', 'Already Flagged')
                        .text('⚐');
                }, 200);

                // Update the "Flagged" column if it exists
                $row.find('td').each(function() {
                    if ($(this).text().trim() === 'No') {
                        $(this).html('<span style="color: #dc4e41; font-weight: 600;">Yes</span>');
                    }
                });

                // NO panel refresh - keep it performant
            }
        });
    }

    // ============================================
    // GLOBAL FUNCTIONS (exposed to window)
    // ============================================

    window.flagSelectedSearch = function() {
        console.log("flagSelectedSearch called");

        var searches = getSelectedSearches();
        if (searches.length === 0) {
            alert("Please select one or more searches using the checkboxes.");
            return;
        }

        // Filter out already flagged
        var unflagged = searches.filter(function(s) { return !s.flagged; });

        if (unflagged.length === 0) {
            alert("All selected searches are already flagged.");
            return;
        }

        // Build consolidated list showing all searches
        var searchList = unflagged.map(function(s) { return "• " + s.searchName; }).join("\n");
        var msg = unflagged.length === 1
            ? "Flag the following search for review?\n\n" + searchList
            : "Flag " + unflagged.length + " searches for review?\n\n" + searchList;

        if (confirm(msg)) {
            // Batch flag all selected searches at once
            flagMultipleSearches(unflagged);
        }
    };

    // Batch flag multiple searches
    function flagMultipleSearches(searches) {
        if (!searches || searches.length === 0) return;

        showToast("Flagging " + searches.length + " search" + (searches.length > 1 ? "es" : "") + "...");

        var now = Math.floor(Date.now() / 1000);
        var deadline = now + (CONFIG.remediationDays * 24 * 60 * 60);

        // Build a union of makeresults for each search
        var unionParts = searches.map(function(s, idx) {
            return '| makeresults ' +
                '| eval search_name="' + escapeString(s.searchName) + '"' +
                ', search_owner="' + escapeString(s.owner) + '"' +
                ', search_app="' + escapeString(s.app) + '"' +
                ', flagged_by="' + escapeString(currentUser) + '"' +
                ', flagged_time=' + now +
                ', notification_sent=0' +
                ', notification_time=0' +
                ', remediation_deadline=' + deadline +
                ', status="pending"' +
                ', reason="' + escapeString(s.reason || 'Manually flagged by administrator') + '"' +
                ', notes=""';
        });

        var searchQuery = unionParts.join(' ') +
            '| table search_name, search_owner, search_app, flagged_by, flagged_time, notification_sent, notification_time, remediation_deadline, status, reason, notes' +
            '| outputlookup append=true flagged_searches_lookup';

        console.log("Batch flag query for " + searches.length + " searches");

        runSearch(searchQuery, function(err, results) {
            if (err) {
                console.error("Error flagging searches:", err);
                showToast("Error flagging searches");
            } else {
                console.log("Successfully flagged " + searches.length + " searches");

                // Log each action
                searches.forEach(function(s) {
                    logAction("flagged", s.searchName, s.reason || "Manually flagged");
                });

                showToast("✓ Flagged " + searches.length + " search" + (searches.length > 1 ? "es" : ""));

                // Update UI for each flagged row
                searches.forEach(function(s) {
                    var $row = $('tr[data-search="' + s.searchName + '"]');
                    $row.addClass('row-flagged').attr('data-flagged', 'true');

                    // Update checkbox data
                    $row.find('.gov-checkbox').attr('data-flagged', 'true');

                    // Add flag indicator if not present
                    var $searchCell = $row.find('td').filter(function() {
                        return $(this).text().indexOf(s.searchName) > -1;
                    }).first();
                    if ($searchCell.length && !$searchCell.find('.flag-indicator').length) {
                        $searchCell.prepend('<span class="flag-indicator" style="color: #dc4e41; margin-right: 6px; font-size: 12px;" title="Flagged for review">🚩</span>');
                    }

                    // Update Flagged column if present
                    $row.find('td').each(function() {
                        if ($(this).text().trim() === 'No') {
                            $(this).html('<span style="color: #dc4e41; font-weight: 600;">Yes</span>');
                        }
                    });
                });

                // Clear selections
                $('.gov-checkbox').prop('checked', false);
                $('.gov-select-all').prop('checked', false);
                selectedSearches = [];

                // Don't auto-refresh - the visual update is already done
                // and the data is persisted. Refresh will happen on next page load.
            }
        });
    }

    window.flagThisSearch = function(searchName, owner, app) {
        console.log("flagThisSearch called:", searchName);
        var reason = prompt("Enter the reason for flagging this search:", "Identified as requiring review by governance team");
        if (reason) {
            flagSearch(searchName, owner, app, reason);
        }
    };

    window.emailOwner = function() {
        console.log("emailOwner called");
        var owner = getToken("selected_owner");
        var searchName = getToken("selected_search");
        var reason = getToken("selected_reason") || "";

        if (!owner || !searchName) {
            alert("Please select a search from the table first.");
            return;
        }

        window.emailThisOwner(owner, searchName, reason);
    };

    window.emailThisOwner = function(owner, searchName, reason) {
        console.log("emailThisOwner called:", owner, searchName);
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

    window.sendReminder = function() {
        console.log("sendReminder called");

        var searches = getSelectedSearches();
        if (searches.length === 0) {
            var searchName = getToken("manage_search");
            var owner = getToken("manage_owner");
            if (!searchName) {
                alert("Please select one or more flagged searches using the checkboxes.");
                return;
            }
            searches = [{ searchName: searchName, owner: owner }];
        }

        // Group by owner for batch emails
        var owners = {};
        searches.forEach(function(s) {
            if (!owners[s.owner]) owners[s.owner] = [];
            owners[s.owner].push(s.searchName);
        });

        var ownerList = Object.keys(owners);
        if (ownerList.length === 1) {
            var owner = ownerList[0];
            var searchList = owners[owner].join("', '");
            var emailAddr = buildEmailAddress(owner);
            var subject = encodeURIComponent("REMINDER: Scheduled Search" + (owners[owner].length > 1 ? "es" : "") + " Require Remediation");
            var body = encodeURIComponent(
                "Hello " + owner + ",\n\n" +
                "This is a reminder that the following scheduled search" + (owners[owner].length > 1 ? "es have" : " has") + " been flagged and require remediation:\n\n" +
                "- " + owners[owner].join("\n- ") + "\n\n" +
                "If no action is taken before the deadline, " + (owners[owner].length > 1 ? "these searches" : "this search") + " will be automatically disabled.\n\n" +
                "Please address " + (owners[owner].length > 1 ? "these issues" : "this issue") + " as soon as possible.\n\n" +
                "Best regards,\n" +
                "Splunk Governance Team"
            );
            window.location.href = "mailto:" + emailAddr + "?subject=" + subject + "&body=" + body;
        } else {
            alert("Selected searches have " + ownerList.length + " different owners. Please select searches from a single owner, or send reminders individually.");
            return;
        }

        searches.forEach(function(s) {
            logAction("reminder_sent", s.searchName, "Reminder email sent");
        });
    };

    window.extendDeadline = function() {
        console.log("extendDeadline called");

        var searches = getSelectedSearches();
        if (searches.length === 0) {
            var searchName = getToken("manage_search");
            if (!searchName) {
                alert("Please select one or more flagged searches using the checkboxes.");
                return;
            }
            searches = [{ searchName: searchName }];
        }

        // Open extend deadline modal
        openExtendModal(searches);
    };

    function openExtendModal(searches) {
        currentExtendSearches = searches;
        currentExtendDays = 7;

        // Build search list HTML
        var listHtml = searches.map(function(s) {
            return '<div class="extend-search-item">' + escapeHtml(s.searchName) + '</div>';
        }).join('');

        $('#extendSearchList').html(listHtml);

        // Reset button states
        $('.extend-days-btn').removeClass('active');
        $('.extend-days-btn[data-days="7"]').addClass('active');
        $('#extendCustomDays').val('');

        updateExtendPreview();
        $('#extendModalOverlay').addClass('active');
    }

    function updateExtendPreview() {
        var newDate = new Date();
        newDate.setDate(newDate.getDate() + currentExtendDays);
        var dateStr = newDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        $('#extendPreviewDate').text(dateStr);
    }

    function performExtendDeadline() {
        var extensionDays = currentExtendDays;
        var searches = currentExtendSearches;

        if (extensionDays <= 0 || !searches.length) {
            alert("Please select a valid extension period.");
            return;
        }

        var extensionSeconds = extensionDays * 24 * 60 * 60;

        // Build condition for multiple searches
        var conditions = searches.map(function(s) {
            return 'search_name="' + escapeString(s.searchName) + '"';
        }).join(' OR ');

        var searchQuery = '| inputlookup flagged_searches_lookup ' +
            '| eval remediation_deadline = if(' + conditions + ', remediation_deadline + ' + extensionSeconds + ', remediation_deadline)' +
            '| outputlookup flagged_searches_lookup';

        showToast("Extending deadline...");
        $('#extendModalOverlay').removeClass('active');

        runSearch(searchQuery, function(err, results) {
            if (err) {
                alert("Error extending deadline: " + err);
            } else {
                searches.forEach(function(s) {
                    logAction("extended", s.searchName, "Deadline extended by " + extensionDays + " days");
                });
                var msg = searches.length === 1
                    ? "Deadline for '" + searches[0].searchName + "' extended by " + extensionDays + " days."
                    : "Deadlines for " + searches.length + " searches extended by " + extensionDays + " days.";
                showToast("✓ " + msg);
                refreshDashboard();
            }
        });
    }

    window.disableNow = function() {
        console.log("disableNow called");

        var searches = getSelectedSearches();
        if (searches.length === 0) {
            var searchName = getToken("manage_search");
            var owner = getToken("manage_owner");
            if (!searchName) {
                alert("Please select one or more flagged searches using the checkboxes.");
                return;
            }
            searches = [{ searchName: searchName, owner: owner }];
        }

        var msg = searches.length === 1
            ? "Are you sure you want to disable '" + searches[0].searchName + "' immediately?"
            : "Are you sure you want to disable " + searches.length + " searches immediately?";

        if (!confirm(msg + "\n\nThis will prevent the search(es) from running until manually re-enabled.")) {
            return;
        }

        // Build condition for multiple searches
        var conditions = searches.map(function(s) {
            return 'search_name="' + escapeString(s.searchName) + '"';
        }).join(' OR ');

        var searchQuery = '| inputlookup flagged_searches_lookup ' +
            '| eval status = if(' + conditions + ', "disabled", status)' +
            '| outputlookup flagged_searches_lookup';

        runSearch(searchQuery, function(err, results) {
            if (err) {
                alert("Error updating status: " + err);
                return;
            }

            searches.forEach(function(s) {
                logAction("disabled", s.searchName, "Search disabled by " + currentUser);
            });

            var resultMsg = searches.length === 1
                ? "Search '" + searches[0].searchName + "' has been marked as disabled."
                : searches.length + " searches have been marked as disabled.";
            showToast(resultMsg);

            refreshDashboard();
        });
    };

    window.unflagSearch = function() {
        console.log("unflagSearch called");

        var searches = getSelectedSearches();
        if (searches.length === 0) {
            var searchName = getToken("manage_search");
            if (!searchName) {
                alert("Please select one or more flagged searches using the checkboxes.");
                return;
            }
            searches = [{ searchName: searchName }];
        }

        var msg = searches.length === 1
            ? "Mark '" + searches[0].searchName + "' as resolved?"
            : "Mark " + searches.length + " searches as resolved?";

        if (!confirm(msg)) {
            return;
        }

        // Build condition for multiple searches
        var conditions = searches.map(function(s) {
            return 'search_name="' + escapeString(s.searchName) + '"';
        }).join(' OR ');

        var searchQuery = '| inputlookup flagged_searches_lookup ' +
            '| eval status = if(' + conditions + ', "resolved", status)' +
            '| outputlookup flagged_searches_lookup';

        runSearch(searchQuery, function(err, results) {
            if (err) {
                alert("Error updating status: " + err);
            } else {
                searches.forEach(function(s) {
                    logAction("unflagged", s.searchName, "Marked as resolved by " + currentUser);
                });
                var resultMsg = searches.length === 1
                    ? "Search '" + searches[0].searchName + "' has been marked as resolved."
                    : searches.length + " searches have been marked as resolved.";
                showToast(resultMsg);
                refreshDashboard();
            }
        });
    };

    window.clearSelection = function() {
        console.log("clearSelection called");
        setToken("selected_search", undefined);
        setToken("selected_owner", undefined);
        setToken("selected_app", undefined);
        setToken("selected_reason", undefined);
        setToken("manage_search", undefined);
        setToken("manage_owner", undefined);
        setToken("manage_status", undefined);
    };

    window.trackSearch = function() {
        console.log("trackSearch called");

        // First try to get from checkbox selections
        var searches = getSelectedSearches();

        if (searches.length === 0) {
            // Fallback to token-based selection
            var searchName = getToken("selected_search");
            var owner = getToken("selected_owner");
            var app = getToken("selected_app");

            if (!searchName) {
                alert("Please select one or more searches using the checkboxes first.");
                return;
            }
            searches = [{ searchName: searchName, owner: owner, app: app, reason: '' }];
        }

        // Build list of searches for confirmation
        var searchList = searches.map(function(s) { return s.searchName; });
        var msg = searches.length === 1
            ? "Track '" + searchList[0] + "' for follow-up?"
            : "Track " + searches.length + " searches for follow-up?\n\n" + searchList.join("\n");

        if (!confirm(msg)) {
            return;
        }

        // Flag all selected searches as tracked
        var trackedSearches = searches.map(function(s) {
            return {
                searchName: s.searchName,
                owner: s.owner,
                app: s.app,
                reason: "Added to tracking list for follow-up monitoring"
            };
        });

        flagMultipleSearches(trackedSearches);
        showToast("✓ " + searches.length + " search" + (searches.length > 1 ? "es" : "") + " now being tracked");
    };

    window.previewImpact = function() {
        console.log("previewImpact called");
        var searchName = getToken("selected_search");
        var owner = getToken("selected_owner");
        var app = getToken("selected_app");

        if (!searchName) {
            alert("Please select a search from the table first.");
            return;
        }

        openImpactModal(searchName, owner, app);
    };

    // ============================================
    // CRON MODAL
    // ============================================

    var cronModalHtml =
        '<div class="cron-modal-overlay" id="cronModalOverlay">' +
            '<div class="cron-modal">' +
                '<div class="cron-modal-header">' +
                    '<h2>Edit Cron Schedule</h2>' +
                    '<button class="cron-modal-close" id="cronModalClose">&times;</button>' +
                '</div>' +
                '<div class="cron-modal-body">' +
                    '<div class="cron-search-info">' +
                        '<div class="cron-search-info-row">' +
                            '<span class="cron-search-info-label">Search Name</span>' +
                            '<span class="cron-search-info-value" id="cronModalSearchName">-</span>' +
                        '</div>' +
                        '<div class="cron-search-info-row">' +
                            '<span class="cron-search-info-label">Owner</span>' +
                            '<span class="cron-search-info-value" id="cronModalOwner">-</span>' +
                        '</div>' +
                        '<div class="cron-search-info-row">' +
                            '<span class="cron-search-info-label">App</span>' +
                            '<span class="cron-search-info-value" id="cronModalApp">-</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="cron-section-title">Quick Presets</div>' +
                    '<div class="cron-preset-grid">' +
                        '<div class="cron-preset-btn" data-cron="*/5 * * * *"><div class="cron-preset-label">Every 5 Min</div><div class="cron-preset-cron">*/5 * * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="*/15 * * * *"><div class="cron-preset-label">Every 15 Min</div><div class="cron-preset-cron">*/15 * * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="*/30 * * * *"><div class="cron-preset-label">Every 30 Min</div><div class="cron-preset-cron">*/30 * * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="0 * * * *"><div class="cron-preset-label">Hourly</div><div class="cron-preset-cron">0 * * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="0 */2 * * *"><div class="cron-preset-label">Every 2 Hours</div><div class="cron-preset-cron">0 */2 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="0 */4 * * *"><div class="cron-preset-label">Every 4 Hours</div><div class="cron-preset-cron">0 */4 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="0 */6 * * *"><div class="cron-preset-label">Every 6 Hours</div><div class="cron-preset-cron">0 */6 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="0 */12 * * *"><div class="cron-preset-label">Twice Daily</div><div class="cron-preset-cron">0 */12 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="0 0 * * *"><div class="cron-preset-label">Daily Midnight</div><div class="cron-preset-cron">0 0 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="0 6 * * *"><div class="cron-preset-label">Daily 6 AM</div><div class="cron-preset-cron">0 6 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="0 0 * * 0"><div class="cron-preset-label">Weekly</div><div class="cron-preset-cron">0 0 * * 0</div></div>' +
                        '<div class="cron-preset-btn" data-cron="0 0 1 * *"><div class="cron-preset-label">Monthly</div><div class="cron-preset-cron">0 0 1 * *</div></div>' +
                    '</div>' +
                    '<div class="cron-section-title">Custom Schedule</div>' +
                    '<div class="cron-input-section">' +
                        '<div class="cron-fields">' +
                            '<div class="cron-field"><label>Minute</label><input type="text" id="cronMinute" value="*" placeholder="0-59"></div>' +
                            '<div class="cron-field"><label>Hour</label><input type="text" id="cronHour" value="*" placeholder="0-23"></div>' +
                            '<div class="cron-field"><label>Day (Month)</label><input type="text" id="cronDayMonth" value="*" placeholder="1-31"></div>' +
                            '<div class="cron-field"><label>Month</label><input type="text" id="cronMonth" value="*" placeholder="1-12"></div>' +
                            '<div class="cron-field"><label>Day (Week)</label><input type="text" id="cronDayWeek" value="*" placeholder="0-6"></div>' +
                        '</div>' +
                        '<div class="cron-helper-section">' +
                            '<div class="cron-helper-title">Syntax Guide</div>' +
                            '<div class="cron-helper-grid">' +
                                '<div class="cron-helper-item"><span class="symbol">*</span><span class="desc">Every value</span></div>' +
                                '<div class="cron-helper-item"><span class="symbol">*/N</span><span class="desc">Every N units</span></div>' +
                                '<div class="cron-helper-item"><span class="symbol">N</span><span class="desc">Specific value</span></div>' +
                                '<div class="cron-helper-item"><span class="symbol">N-M</span><span class="desc">Range N to M</span></div>' +
                                '<div class="cron-helper-item"><span class="symbol">N,M</span><span class="desc">Values N and M</span></div>' +
                                '<div class="cron-helper-item"><span class="symbol">0-6</span><span class="desc">Sun=0, Sat=6</span></div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div id="cronImpactSection" class="cron-impact-section" style="display: none;">' +
                        '<div class="cron-impact-header">Schedule Change Impact</div>' +
                        '<div class="cron-impact-comparison">' +
                            '<div class="cron-impact-old">' +
                                '<div class="cron-impact-label">Current</div>' +
                                '<div class="cron-impact-value" id="cronImpactOld">-</div>' +
                                '<div class="cron-impact-freq" id="cronImpactOldFreq">-</div>' +
                            '</div>' +
                            '<div class="cron-impact-arrow">&#8594;</div>' +
                            '<div class="cron-impact-new">' +
                                '<div class="cron-impact-label">New</div>' +
                                '<div class="cron-impact-value" id="cronImpactNew">-</div>' +
                                '<div class="cron-impact-freq" id="cronImpactNewFreq">-</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="cron-impact-change">' +
                            '<div class="cron-impact-percent" id="cronImpactPercent">-</div>' +
                            '<div class="cron-impact-description" id="cronImpactDesc">-</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="cron-preview">' +
                        '<div class="cron-preview-label">Cron Expression</div>' +
                        '<div class="cron-preview-value" id="cronPreviewValue">* * * * *</div>' +
                        '<div class="cron-preview-description" id="cronDescription">Runs every minute</div>' +
                    '</div>' +
                '</div>' +
                '<div class="cron-modal-footer">' +
                    '<button class="btn btn-secondary" id="cronModalCancel">Cancel</button>' +
                    '<button class="btn btn-primary" id="cronModalSave">Save Schedule</button>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="cron-toast" id="cronToast">Schedule updated!</div>';

    var impactModalHtml =
        '<div class="cron-modal-overlay" id="impactModalOverlay">' +
            '<div class="cron-modal" style="max-width: 800px;">' +
                '<div class="cron-modal-header" style="background: linear-gradient(90deg, rgba(248, 190, 52, 0.15) 0%, transparent 100%);">' +
                    '<h2 style="color: #f8be34;">Preview Impact</h2>' +
                    '<button class="cron-modal-close" id="impactModalClose">&times;</button>' +
                '</div>' +
                '<div class="cron-modal-body">' +
                    '<div class="cron-search-info">' +
                        '<div class="cron-search-info-row">' +
                            '<span class="cron-search-info-label">Search Name</span>' +
                            '<span class="cron-search-info-value" id="impactSearchName">-</span>' +
                        '</div>' +
                        '<div class="cron-search-info-row">' +
                            '<span class="cron-search-info-label">Owner</span>' +
                            '<span class="cron-search-info-value" id="impactOwner">-</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="cron-section-title">If Disabled, This Search Would:</div>' +
                    '<div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; margin-bottom: 20px;">' +
                        '<ul style="margin: 0; padding-left: 20px; color: rgba(255,255,255,0.8);">' +
                            '<li>Stop running at scheduled intervals</li>' +
                            '<li>No longer consume search resources</li>' +
                            '<li>Not trigger any associated alerts</li>' +
                            '<li>Require manual re-enabling to resume</li>' +
                        '</ul>' +
                    '</div>' +
                    '<div class="cron-section-title">Take Action</div>' +
                    '<div style="display: flex; gap: 10px; flex-wrap: wrap;">' +
                        '<button class="btn btn-primary" id="impactFlagBtn">Flag for Review</button>' +
                        '<button class="btn" id="impactEmailBtn">Email Owner</button>' +
                        '<button class="btn btn-warning" id="impactDisableBtn">Disable Now</button>' +
                    '</div>' +
                '</div>' +
                '<div class="cron-modal-footer">' +
                    '<button class="btn btn-secondary" id="impactModalCancel">Close</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    var flaggedModalHtml =
        '<div class="cron-modal-overlay" id="flaggedModalOverlay">' +
            '<div class="cron-modal" style="max-width: 900px;">' +
                '<div class="cron-modal-header" style="background: linear-gradient(90deg, rgba(220, 78, 65, 0.15) 0%, transparent 100%);">' +
                    '<h2 style="color: #dc4e41;">Flagged Searches</h2>' +
                    '<button class="cron-modal-close" id="flaggedModalClose">&times;</button>' +
                '</div>' +
                '<div class="cron-modal-body" style="padding: 0;">' +
                    '<div id="flaggedSearchesList" style="max-height: 500px; overflow-y: auto;"></div>' +
                '</div>' +
                '<div class="cron-modal-footer">' +
                    '<button class="btn btn-secondary" id="flaggedModalCancel">Close</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    var extendModalHtml =
        '<div class="cron-modal-overlay" id="extendModalOverlay">' +
            '<div class="cron-modal" style="max-width: 550px;">' +
                '<div class="cron-modal-header" style="background: linear-gradient(90deg, rgba(0, 212, 255, 0.15) 0%, transparent 100%);">' +
                    '<h2 style="color: #00d4ff;">Extend Deadline</h2>' +
                    '<button class="cron-modal-close" id="extendModalClose">&times;</button>' +
                '</div>' +
                '<div class="cron-modal-body">' +
                    '<div class="extend-modal-content">' +
                        '<div class="extend-search-list" id="extendSearchList"></div>' +
                        '<div class="extend-days-section">' +
                            '<div class="extend-days-label">Select Extension Period</div>' +
                            '<div class="extend-days-grid">' +
                                '<div class="extend-days-btn" data-days="3"><span class="days-value">3</span><span class="days-label">Days</span></div>' +
                                '<div class="extend-days-btn active" data-days="7"><span class="days-value">7</span><span class="days-label">Days</span></div>' +
                                '<div class="extend-days-btn" data-days="14"><span class="days-value">14</span><span class="days-label">Days</span></div>' +
                                '<div class="extend-days-btn" data-days="30"><span class="days-value">30</span><span class="days-label">Days</span></div>' +
                            '</div>' +
                            '<div class="extend-custom-section">' +
                                '<span style="color: rgba(255,255,255,0.6);">Or enter custom:</span>' +
                                '<input type="number" class="extend-custom-input" id="extendCustomDays" min="1" max="365" value="">' +
                                '<span style="color: rgba(255,255,255,0.6);">days</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="extend-deadline-preview">' +
                            '<div class="extend-deadline-preview-label">New Deadline</div>' +
                            '<div class="extend-deadline-preview-date" id="extendPreviewDate">-</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="cron-modal-footer">' +
                    '<button class="btn btn-secondary" id="extendModalCancel">Cancel</button>' +
                    '<button class="btn btn-primary" id="extendModalSave">Extend Deadline</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    var metricPopupHtml =
        '<div class="metric-popup-overlay" id="metricPopupOverlay">' +
            '<div class="metric-popup">' +
                '<div class="metric-popup-header">' +
                    '<div class="metric-popup-value" id="metricPopupValue">0</div>' +
                    '<div class="metric-popup-title" id="metricPopupTitle">Metric</div>' +
                '</div>' +
                '<div class="metric-popup-body">' +
                    '<ul class="metric-popup-list" id="metricPopupList"></ul>' +
                '</div>' +
                '<div class="metric-popup-footer">' +
                    '<button class="btn btn-secondary" id="metricPopupClose">Close</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    var currentCronSearch = { name: '', cron: '', owner: '', app: '' };
    var currentImpactSearch = { name: '', owner: '', app: '' };
    var currentExtendSearches = [];
    var currentExtendDays = 7;
    var selectedRow = { searchName: '', owner: '', app: '', reason: '', tableType: '' };
    var selectedSearches = []; // Array for multi-select

    function initModals() {
        if (!$('#cronModalOverlay').length) {
            $('body').append(cronModalHtml);
        }
        if (!$('#impactModalOverlay').length) {
            $('body').append(impactModalHtml);
        }
        if (!$('#flaggedModalOverlay').length) {
            $('body').append(flaggedModalHtml);
        }
        if (!$('#extendModalOverlay').length) {
            $('body').append(extendModalHtml);
        }
        if (!$('#metricPopupOverlay').length) {
            $('body').append(metricPopupHtml);
        }

        // Extend modal events
        $(document).on('click', '#extendModalClose, #extendModalCancel', function() {
            $('#extendModalOverlay').removeClass('active');
        });

        $(document).on('click', '#extendModalOverlay', function(e) {
            if (e.target === this) {
                $('#extendModalOverlay').removeClass('active');
            }
        });

        $(document).on('click', '.extend-days-btn', function() {
            $('.extend-days-btn').removeClass('active');
            $(this).addClass('active');
            currentExtendDays = parseInt($(this).data('days'));
            $('#extendCustomDays').val('');
            updateExtendPreview();
        });

        $(document).on('input', '#extendCustomDays', function() {
            var val = parseInt($(this).val());
            if (val > 0) {
                $('.extend-days-btn').removeClass('active');
                currentExtendDays = val;
                updateExtendPreview();
            }
        });

        $(document).on('click', '#extendModalSave', function() {
            performExtendDeadline();
        });

        // Metric popup events
        $(document).on('click', '#metricPopupClose', function() {
            $('#metricPopupOverlay').removeClass('active');
        });

        $(document).on('click', '#metricPopupOverlay', function(e) {
            if (e.target === this) {
                $('#metricPopupOverlay').removeClass('active');
            }
        });

        // Flagged modal events
        $(document).on('click', '#flaggedModalClose, #flaggedModalCancel', function() {
            $('#flaggedModalOverlay').removeClass('active');
            setToken("show_flagged_modal", undefined);
        });

        $(document).on('click', '#flaggedModalOverlay', function(e) {
            if (e.target === this) {
                $('#flaggedModalOverlay').removeClass('active');
                setToken("show_flagged_modal", undefined);
            }
        });

        // Watch for flagged modal token
        if (defaultTokens) {
            defaultTokens.on('change:show_flagged_modal', function(model, value) {
                if (value) {
                    openFlaggedModal();
                }
            });
        }

        // Cron modal events
        $(document).on('click', '#cronModalClose, #cronModalCancel', function() {
            $('#cronModalOverlay').removeClass('active');
        });

        $(document).on('click', '#cronModalOverlay', function(e) {
            if (e.target === this) {
                $('#cronModalOverlay').removeClass('active');
            }
        });

        $(document).on('click', '.cron-preset-btn', function() {
            var cron = $(this).data('cron');
            $('.cron-preset-btn').removeClass('active');
            $(this).addClass('active');
            var parts = cron.split(' ');
            $('#cronMinute').val(parts[0]);
            $('#cronHour').val(parts[1]);
            $('#cronDayMonth').val(parts[2]);
            $('#cronMonth').val(parts[3]);
            $('#cronDayWeek').val(parts[4]);
            updateCronPreview();
        });

        $(document).on('input', '#cronMinute, #cronHour, #cronDayMonth, #cronMonth, #cronDayWeek', function() {
            updateCronPreview();
        });

        $(document).on('click', '#cronModalSave', function() {
            var newCron = $('#cronPreviewValue').text();
            var searchName = currentCronSearch.name;
            var owner = currentCronSearch.owner;
            var app = currentCronSearch.app;

            if (!searchName || !app) {
                alert("Missing search information. Please try again.");
                return;
            }

            showToast("Updating schedule...");
            console.log("Updating cron for:", searchName, "in app:", app, "owner:", owner, "to:", newCron);

            // Try using Splunk's service object first
            try {
                var service = mvc.createService();
                var savedSearches = service.savedSearches({ owner: owner, app: app });

                savedSearches.fetch(function(err, savedSearches) {
                    if (err) {
                        console.error("Error fetching saved searches:", err);
                        fallbackRestUpdate();
                        return;
                    }

                    var search = savedSearches.item(searchName);
                    if (!search) {
                        console.log("Search not found in collection, trying REST API");
                        fallbackRestUpdate();
                        return;
                    }

                    search.update({ cron_schedule: newCron }, function(err, search) {
                        if (err) {
                            console.error("Error updating search:", err);
                            fallbackRestUpdate();
                            return;
                        }

                        console.log("Cron schedule updated successfully via SDK");
                        onUpdateSuccess();
                    });
                });
            } catch (e) {
                console.log("SDK method failed, using REST API:", e);
                fallbackRestUpdate();
            }

            function fallbackRestUpdate() {
                // Use REST API directly
                var endpoint = '/en-US/splunkd/__raw/servicesNS/' + encodeURIComponent(owner) + '/' + encodeURIComponent(app) + '/saved/searches/' + encodeURIComponent(searchName);

                console.log("Trying REST endpoint:", endpoint);

                $.ajax({
                    url: endpoint,
                    type: 'POST',
                    data: {
                        cron_schedule: newCron,
                        output_mode: 'json'
                    },
                    success: function(response) {
                        console.log("Cron schedule updated successfully via REST:", response);
                        onUpdateSuccess();
                    },
                    error: function(xhr, status, error) {
                        console.error("REST update failed:", xhr.status, xhr.responseText);
                        alert("Failed to update schedule (Error " + xhr.status + "). Please update manually in Settings > Searches, Reports, and Alerts.");
                    }
                });
            }

            function onUpdateSuccess() {
                logAction("schedule_changed", searchName, "Changed cron from '" + currentCronSearch.cron + "' to '" + newCron + "'");
                showToast("✓ Schedule updated to: " + newCron);
                $('#cronModalOverlay').removeClass('active');

                // Update the displayed cron in the table
                $('.cron-clickable[data-search="' + searchName + '"]').text(newCron).attr('data-cron', newCron);
                currentCronSearch.cron = newCron;

                // Don't auto-refresh - the visual update is done
            }
        });

        // Impact modal events
        $(document).on('click', '#impactModalClose, #impactModalCancel', function() {
            $('#impactModalOverlay').removeClass('active');
        });

        $(document).on('click', '#impactModalOverlay', function(e) {
            if (e.target === this) {
                $('#impactModalOverlay').removeClass('active');
            }
        });

        $(document).on('click', '#impactFlagBtn', function() {
            $('#impactModalOverlay').removeClass('active');
            window.flagThisSearch(currentImpactSearch.name, currentImpactSearch.owner, currentImpactSearch.app);
        });

        $(document).on('click', '#impactEmailBtn', function() {
            $('#impactModalOverlay').removeClass('active');
            window.emailThisOwner(currentImpactSearch.owner, currentImpactSearch.name, 'Identified as requiring review');
        });

        $(document).on('click', '#impactDisableBtn', function() {
            $('#impactModalOverlay').removeClass('active');
            setToken("manage_search", currentImpactSearch.name);
            setToken("manage_owner", currentImpactSearch.owner);
            window.disableNow();
        });

        // Escape key
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                $('#cronModalOverlay').removeClass('active');
                $('#impactModalOverlay').removeClass('active');
            }
        });
    }

    function updateCronPreview() {
        var minute = $('#cronMinute').val() || '*';
        var hour = $('#cronHour').val() || '*';
        var dayMonth = $('#cronDayMonth').val() || '*';
        var month = $('#cronMonth').val() || '*';
        var dayWeek = $('#cronDayWeek').val() || '*';
        var newCron = minute + ' ' + hour + ' ' + dayMonth + ' ' + month + ' ' + dayWeek;
        $('#cronPreviewValue').text(newCron);
        $('#cronDescription').text(describeCron(minute, hour, dayMonth, month, dayWeek));

        // Update impact section
        var oldCron = currentCronSearch.cron;
        if (oldCron && oldCron !== newCron) {
            var oldFreq = getCronFrequencyPerDay(oldCron);
            var newFreq = getCronFrequencyPerDay(newCron);

            $('#cronImpactOld').text(oldCron);
            $('#cronImpactNew').text(newCron);
            $('#cronImpactOldFreq').text(formatFrequency(oldFreq) + '/day');
            $('#cronImpactNewFreq').text(formatFrequency(newFreq) + '/day');

            if (oldFreq > 0 && newFreq > 0) {
                var percentChange = ((newFreq - oldFreq) / oldFreq * 100).toFixed(0);
                var $percent = $('#cronImpactPercent');
                var $desc = $('#cronImpactDesc');

                if (percentChange > 0) {
                    $percent.text('+' + percentChange + '%').removeClass('decrease neutral').addClass('increase');
                    $desc.text('More frequent - higher resource usage');
                } else if (percentChange < 0) {
                    $percent.text(percentChange + '%').removeClass('increase neutral').addClass('decrease');
                    $desc.text('Less frequent - lower resource usage');
                } else {
                    $percent.text('0%').removeClass('increase decrease').addClass('neutral');
                    $desc.text('No change in frequency');
                }
            }

            $('#cronImpactSection').show();
        } else {
            $('#cronImpactSection').hide();
        }
    }

    // Calculate approximate runs per day from cron expression
    function getCronFrequencyPerDay(cron) {
        if (!cron) return 0;
        var parts = cron.split(' ');
        if (parts.length < 5) return 0;

        var minute = parts[0];
        var hour = parts[1];
        var dayMonth = parts[2];
        var month = parts[3];
        var dayWeek = parts[4];

        // Calculate multipliers
        var minuteRuns = parseFieldRuns(minute, 60);
        var hourRuns = parseFieldRuns(hour, 24);
        var dayMonthRuns = parseFieldRuns(dayMonth, 31);
        var monthRuns = parseFieldRuns(month, 12);
        var dayWeekRuns = parseFieldRuns(dayWeek, 7);

        // Simplified calculation - runs per day
        var runsPerHour = minuteRuns;
        var runsPerDay = runsPerHour * hourRuns;

        // Adjust for day of week/month restrictions
        if (dayMonth !== '*' || dayWeek !== '*') {
            if (dayWeek !== '*' && dayWeek !== '0-6' && dayWeek !== '1-7') {
                runsPerDay = runsPerDay * (dayWeekRuns / 7);
            }
        }

        return runsPerDay;
    }

    function parseFieldRuns(field, max) {
        if (field === '*') return 1;
        if (field.indexOf('*/') === 0) {
            var step = parseInt(field.substring(2));
            return Math.ceil(max / step);
        }
        if (field.indexOf(',') > -1) {
            return field.split(',').length;
        }
        if (field.indexOf('-') > -1) {
            var parts = field.split('-');
            return parseInt(parts[1]) - parseInt(parts[0]) + 1;
        }
        return 1;
    }

    function formatFrequency(freq) {
        if (freq >= 1440) return Math.round(freq) + 'x';
        if (freq >= 60) return Math.round(freq) + 'x';
        if (freq >= 1) return Math.round(freq) + 'x';
        if (freq >= 0.1) return freq.toFixed(1) + 'x';
        return '<1x';
    }

    function describeCron(minute, hour, dayMonth, month, dayWeek) {
        if (minute === '*' && hour === '*' && dayMonth === '*' && month === '*' && dayWeek === '*') {
            return 'Runs every minute';
        }
        if (minute.indexOf('*/') === 0) {
            return 'Runs every ' + minute.substring(2) + ' minutes';
        }
        if (minute === '0' && hour === '*') {
            return 'Runs every hour at minute 0';
        }
        if (minute === '0' && hour.indexOf('*/') === 0) {
            return 'Runs every ' + hour.substring(2) + ' hours';
        }
        if (minute === '0' && hour === '0' && dayMonth === '*' && month === '*' && dayWeek === '*') {
            return 'Runs daily at midnight';
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
        return 'Custom schedule';
    }

    function openCronModal(searchName, cronSchedule, owner, app) {
        console.log("Opening cron modal for:", searchName, cronSchedule);
        currentCronSearch = { name: searchName, cron: cronSchedule, owner: owner, app: app };

        $('#cronModalSearchName').text(searchName || '-');
        $('#cronModalOwner').text(owner || '-');
        $('#cronModalApp').text(app || '-');

        var parts = cronSchedule.split(' ');
        if (parts.length >= 5) {
            $('#cronMinute').val(parts[0]);
            $('#cronHour').val(parts[1]);
            $('#cronDayMonth').val(parts[2]);
            $('#cronMonth').val(parts[3]);
            $('#cronDayWeek').val(parts[4]);
        }

        $('.cron-preset-btn').removeClass('active');
        updateCronPreview();
        $('#cronModalOverlay').addClass('active');
    }

    function openImpactModal(searchName, owner, app) {
        console.log("Opening impact modal for:", searchName);
        currentImpactSearch = { name: searchName, owner: owner, app: app };

        $('#impactSearchName').text(searchName || '-');
        $('#impactOwner').text(owner || '-');

        $('#impactModalOverlay').addClass('active');
    }

    function openFlaggedModal() {
        console.log("Opening flagged searches modal");

        // Run search to get flagged searches
        var flaggedSearch = new SearchManager({
            id: 'flagged_modal_search_' + Date.now(),
            search: '| inputlookup flagged_searches_lookup | search status IN ("pending", "notified") | eval days_remaining = round((remediation_deadline - now()) / 86400, 1) | eval flagged_date = strftime(flagged_time, "%Y-%m-%d") | table search_name, search_owner, status, reason, flagged_date, days_remaining | sort days_remaining',
            earliest_time: '-1h',
            latest_time: 'now',
            autostart: true
        });

        $('#flaggedSearchesList').html('<div style="padding: 40px; text-align: center; color: rgba(255,255,255,0.5);">Loading...</div>');
        $('#flaggedModalOverlay').addClass('active');

        flaggedSearch.on('search:done', function() {
            var results = flaggedSearch.data('results');
            if (results) {
                results.on('data', function() {
                    var rows = results.data().rows;
                    var fields = results.data().fields;

                    if (!rows || rows.length === 0) {
                        $('#flaggedSearchesList').html('<div style="padding: 40px; text-align: center; color: rgba(255,255,255,0.5);">No flagged searches</div>');
                        return;
                    }

                    var html = '<table style="width: 100%; border-collapse: collapse;">';
                    html += '<thead><tr style="background: rgba(0,0,0,0.3);">';
                    html += '<th style="padding: 12px; text-align: left; color: #00d4ff; font-size: 11px; text-transform: uppercase;">Search Name</th>';
                    html += '<th style="padding: 12px; text-align: left; color: #00d4ff; font-size: 11px; text-transform: uppercase;">Owner</th>';
                    html += '<th style="padding: 12px; text-align: left; color: #00d4ff; font-size: 11px; text-transform: uppercase;">Status</th>';
                    html += '<th style="padding: 12px; text-align: left; color: #00d4ff; font-size: 11px; text-transform: uppercase;">Days Left</th>';
                    html += '<th style="padding: 12px; text-align: center; color: #00d4ff; font-size: 11px; text-transform: uppercase;">Actions</th>';
                    html += '</tr></thead><tbody>';

                    for (var i = 0; i < rows.length; i++) {
                        var row = rows[i];
                        var searchName = row[0];
                        var owner = row[1];
                        var status = row[2];
                        var reason = row[3];
                        var daysLeft = row[5];

                        var daysColor = '#53a051';
                        if (parseFloat(daysLeft) <= 2) daysColor = '#dc4e41';
                        else if (parseFloat(daysLeft) <= 5) daysColor = '#f8be34';

                        var statusColor = status === 'pending' ? '#f8be34' : '#f1813f';

                        html += '<tr style="border-bottom: 1px solid rgba(255,255,255,0.1);" class="flagged-row" data-search="' + escapeHtml(searchName) + '" data-owner="' + escapeHtml(owner) + '">';
                        html += '<td style="padding: 12px; color: #fff;">' + escapeHtml(searchName) + '</td>';
                        html += '<td style="padding: 12px; color: rgba(255,255,255,0.7);">' + escapeHtml(owner) + '</td>';
                        html += '<td style="padding: 12px;"><span style="background: ' + statusColor + '22; color: ' + statusColor + '; padding: 4px 8px; border-radius: 4px; font-size: 11px;">' + escapeHtml(status) + '</span></td>';
                        html += '<td style="padding: 12px; color: ' + daysColor + '; font-weight: 600;">' + daysLeft + '</td>';
                        html += '<td style="padding: 12px; text-align: center;">';
                        html += '<button class="flagged-action-btn" data-action="remind" data-search="' + escapeHtml(searchName) + '" data-owner="' + escapeHtml(owner) + '" style="background: #006d9c; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 4px; font-size: 11px;">Remind</button>';
                        html += '<button class="flagged-action-btn" data-action="disable" data-search="' + escapeHtml(searchName) + '" data-owner="' + escapeHtml(owner) + '" style="background: #dc4e41; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">Disable</button>';
                        html += '</td>';
                        html += '</tr>';
                    }
                    html += '</tbody></table>';
                    $('#flaggedSearchesList').html(html);
                });
            }
        });
    }

    // Handle flagged modal action buttons
    $(document).on('click', '.flagged-action-btn', function(e) {
        e.stopPropagation();
        var action = $(this).data('action');
        var searchName = $(this).data('search');
        var owner = $(this).data('owner');

        if (action === 'remind') {
            window.emailThisOwner(owner, searchName, 'Reminder: Your search requires attention');
        } else if (action === 'disable') {
            setToken("manage_search", searchName);
            setToken("manage_owner", owner);
            $('#flaggedModalOverlay').removeClass('active');
            window.disableNow();
        }
    });

    window.openCronModal = openCronModal;
    window.openImpactModal = openImpactModal;
    window.openFlaggedModal = openFlaggedModal;
    window.viewFlaggedSearches = openFlaggedModal;
    window.openExtendModal = openExtendModal;

    // ============================================
    // METRIC POPUP FUNCTIONS
    // ============================================

    function openMetricPopup(metricType, value, title) {
        console.log("Opening metric popup:", metricType, value, title);

        $('#metricPopupValue').text(value);
        $('#metricPopupTitle').text(title);
        $('#metricPopupList').html('<li style="text-align: center; color: rgba(255,255,255,0.5);">Loading...</li>');
        $('#metricPopupOverlay').addClass('active');

        // Run search based on metric type
        var searchQuery = '';
        switch (metricType) {
            case 'total':
                searchQuery = '| rest /servicesNS/-/-/saved/searches splunk_server=local | search is_scheduled=1 disabled=0 | rename eai:acl.owner as owner, eai:acl.app as app | table title, owner, app, cron_schedule | head 20';
                break;
            case 'suspicious':
                searchQuery = '| `analyze_scheduled_searches` | search is_suspicious=1 disabled=0 | table title, owner, suspicious_reason | head 20';
                break;
            case 'flagged':
                searchQuery = '| inputlookup flagged_searches_lookup | search status IN ("pending", "notified") | table search_name, search_owner, status, reason | head 20';
                break;
            case 'pending':
                searchQuery = '| inputlookup flagged_searches_lookup | search status="notified" | eval days_left = round((remediation_deadline - now()) / 86400, 1) | table search_name, search_owner, days_left | head 20';
                break;
            case 'disabled':
                searchQuery = '| inputlookup flagged_searches_lookup | search status="disabled" | where flagged_time > relative_time(now(), "-30d") | table search_name, search_owner, reason | head 20';
                break;
            default:
                $('#metricPopupList').html('<li>No data available</li>');
                return;
        }

        var popupSearch = new SearchManager({
            id: 'metric_popup_search_' + Date.now(),
            search: searchQuery,
            earliest_time: '-24h',
            latest_time: 'now',
            autostart: true
        });

        popupSearch.on('search:done', function() {
            var results = popupSearch.data('results');
            if (results) {
                results.on('data', function() {
                    var rows = results.data().rows;
                    var fields = results.data().fields;

                    if (!rows || rows.length === 0) {
                        $('#metricPopupList').html('<li style="text-align: center; color: rgba(255,255,255,0.5);">No items found</li>');
                        return;
                    }

                    var html = '';
                    for (var i = 0; i < rows.length; i++) {
                        var row = rows[i];
                        var name = row[0] || '-';
                        var detail = row[1] || '';
                        if (row[2]) detail += ' | ' + row[2];

                        html += '<li><span class="name">' + escapeHtml(name) + '</span><span class="detail">' + escapeHtml(detail) + '</span></li>';
                    }
                    $('#metricPopupList').html(html);
                });
            }
        });

        popupSearch.on('search:error', function(err) {
            $('#metricPopupList').html('<li style="color: #dc4e41;">Error loading data</li>');
        });
    }

    window.openMetricPopup = openMetricPopup;

    // ============================================
    // TABLE ENHANCEMENT - Make cron clickable
    // ============================================

    function enhanceScheduleColumns() {
        console.log("Enhancing tables...");

        // Find all tables in the dashboard
        $('.dashboard-panel table, .shared-resultstable, .splunk-table').each(function() {
            var $table = $(this);
            var $panel = $table.closest('.dashboard-panel');
            var panelTitle = $panel.find('.panel-title, .panel-head h3, h3').first().text().trim();
            var isFlaggedPanel = panelTitle.indexOf('Flagged') > -1 && panelTitle.indexOf('Pending') > -1;
            var isSuspiciousPanel = panelTitle.indexOf('Suspicious') > -1;

            var scheduleColIndex = -1;
            var searchNameColIndex = -1;
            var ownerColIndex = -1;
            var appColIndex = -1;
            var reasonColIndex = -1;
            var flaggedColIndex = -1;

            // Find column indices from headers (before adding our header)
            var headerOffset = 0;
            $table.find('thead th').each(function(index) {
                var text = $(this).text().trim();
                if (text === 'Schedule') scheduleColIndex = index;
                if (text === 'Search Name') searchNameColIndex = index;
                if (text === 'Owner') ownerColIndex = index;
                if (text === 'App') appColIndex = index;
                if (text === 'Reason') reasonColIndex = index;
                if (text === 'Flagged') flaggedColIndex = index;
            });

            // Add checkbox header if not present
            var $thead = $table.find('thead tr').first();
            if ($thead.length && !$thead.find('.gov-select-header').length) {
                var $firstTh = $thead.find('th').first();
                var checkboxHeader = '<th class="gov-select-header" style="width: 40px !important; min-width: 40px !important; text-align: center !important; padding: 8px !important;"><input type="checkbox" class="gov-select-all" style="width: 18px; height: 18px; cursor: pointer;"></th>';
                if ($firstTh.text().trim().match(/^\d*$/)) {
                    $firstTh.after(checkboxHeader);
                    headerOffset = 1;
                } else {
                    $thead.prepend(checkboxHeader);
                }
            }

            $table.find('tbody tr').each(function() {
                var $row = $(this);
                var $cells = $row.find('td');

                if ($cells.length < 2) return;
                if ($row.hasClass('gov-enhanced')) return;
                $row.addClass('gov-enhanced');

                // Check for row number column
                var hasRowNum = $cells.eq(0).text().trim().match(/^\d+$/);
                var cellOffset = hasRowNum ? 1 : 0;

                // Extract data from correct columns
                var searchName = searchNameColIndex >= 0 ? $cells.eq(searchNameColIndex).text().trim() : '';
                var owner = ownerColIndex >= 0 ? $cells.eq(ownerColIndex).text().trim() : '';
                var app = appColIndex >= 0 ? $cells.eq(appColIndex).text().trim() : '';
                var reason = reasonColIndex >= 0 ? $cells.eq(reasonColIndex).text().trim() : '';

                // Check flagged status from the Flagged column
                var isFlagged = false;
                if (flaggedColIndex >= 0 && $cells.length > flaggedColIndex) {
                    var flaggedText = $cells.eq(flaggedColIndex).text().trim().toLowerCase();
                    isFlagged = (flaggedText === 'yes');
                }

                // In flagged panel, all are flagged
                if (isFlaggedPanel) {
                    isFlagged = true;
                }

                // Clean search name of any existing icons
                searchName = searchName.replace(/^[\s⚑⚐🚩]+/, '').trim();

                if (!searchName) return;

                // Store data on row
                $row.attr('data-search', searchName)
                    .attr('data-owner', owner)
                    .attr('data-app', app)
                    .attr('data-reason', reason)
                    .attr('data-flagged', isFlagged ? 'true' : 'false');

                if (isFlagged) {
                    $row.addClass('row-flagged');
                }

                // Add checkbox cell
                if (!$row.find('.gov-checkbox').length) {
                    var checkboxCell = '<td class="gov-checkbox-cell" style="width: 40px !important; text-align: center !important; padding: 8px !important; vertical-align: middle !important;">' +
                        '<input type="checkbox" class="gov-checkbox" ' +
                        'data-search="' + escapeHtml(searchName) + '" ' +
                        'data-owner="' + escapeHtml(owner) + '" ' +
                        'data-app="' + escapeHtml(app) + '" ' +
                        'data-reason="' + escapeHtml(reason) + '" ' +
                        'data-flagged="' + isFlagged + '" ' +
                        'style="width: 18px; height: 18px; cursor: pointer; margin: 0;">' +
                        '</td>';

                    if (hasRowNum) {
                        $cells.eq(0).after(checkboxCell);
                    } else {
                        $row.prepend(checkboxCell);
                    }
                }

                // Add flag icon ONLY on Search Name column, ONLY if flagged (red flag), NO yellow flags
                if (!isFlaggedPanel && searchNameColIndex >= 0) {
                    var $searchNameCell = $cells.eq(searchNameColIndex);
                    if (!$searchNameCell.find('.flag-indicator').length && isFlagged) {
                        var flagHtml = '<span class="flag-indicator" style="color: #dc4e41; margin-right: 6px; font-size: 12px;" title="Flagged for review">🚩</span>';
                        $searchNameCell.prepend(flagHtml);
                    }
                }

                // Enhance schedule column with cron clickable
                if (scheduleColIndex >= 0 && $cells.length > scheduleColIndex) {
                    var $scheduleCell = $cells.eq(scheduleColIndex);
                    var cronValue = $scheduleCell.text().trim();

                    if (!$scheduleCell.find('.cron-clickable').length && cronValue.match(/^[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+$/)) {
                        $scheduleCell.html('<span class="cron-clickable" data-cron="' + escapeHtml(cronValue) + '" data-search="' + escapeHtml(searchName) + '" data-owner="' + escapeHtml(owner) + '" data-app="' + escapeHtml(app) + '">' + escapeHtml(cronValue) + '</span>');
                    }
                }
            });
        });
    }

    // Handle select all checkbox
    $(document).on('click', '.gov-select-all', function(e) {
        e.stopPropagation();
        var isChecked = this.checked;
        var $table = $(this).closest('table');
        $table.find('.gov-checkbox').each(function() {
            this.checked = isChecked;
        });
        updateSelectedSearches();
    });

    // Handle individual checkbox click
    $(document).on('click', '.gov-checkbox', function(e) {
        e.stopPropagation();
        updateSelectedSearches();

        // Update select-all state
        var $table = $(this).closest('table');
        var total = $table.find('.gov-checkbox').length;
        var checked = $table.find('.gov-checkbox:checked').length;
        $table.find('.gov-select-all').prop('checked', total === checked);
    });

    // Update selected searches array
    function updateSelectedSearches() {
        selectedSearches = [];
        $('.gov-checkbox:checked').each(function() {
            selectedSearches.push({
                searchName: $(this).attr('data-search'),
                owner: $(this).attr('data-owner'),
                app: $(this).attr('data-app'),
                reason: $(this).attr('data-reason') || '',
                flagged: $(this).attr('data-flagged') === 'true'
            });
        });
        console.log("Selected searches:", selectedSearches);

        // Update selection count badge
        updateSelectionBadge(selectedSearches.length);
    }

    // Show/update selection count badge
    function updateSelectionBadge(count) {
        var $badge = $('#selectionCountBadge');
        if (!$badge.length) {
            $('body').append('<div class="selection-count-badge" id="selectionCountBadge"></div>');
            $badge = $('#selectionCountBadge');
        }

        if (count > 0) {
            $badge.text(count + " search" + (count > 1 ? "es" : "") + " selected").addClass('show');
        } else {
            $badge.removeClass('show');
        }
    }

    // Get selected searches for actions
    function getSelectedSearches() {
        return selectedSearches;
    }

    // Flag indicator click - show flagged modal
    $(document).on('click', '.flag-indicator', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showToast("Already flagged - opening details");
        openFlaggedModal();
    });

    // Row click for selection (not on checkbox, cron, or flag)
    $(document).on('click', '.gov-enhanced td:not(.gov-checkbox-cell)', function(e) {
        // Don't handle if clicking on interactive elements
        if ($(e.target).is('input, .cron-clickable, .flag-indicator')) {
            return;
        }

        var $row = $(this).closest('tr');
        var searchName = $row.attr('data-search');
        var owner = $row.attr('data-owner');
        var app = $row.attr('data-app');
        var reason = $row.attr('data-reason');

        if (!searchName) return;

        // Toggle checkbox for this row
        var $checkbox = $row.find('.gov-checkbox');
        $checkbox.prop('checked', !$checkbox.prop('checked'));
        updateSelectedSearches();

        // Update select-all state
        var $table = $row.closest('table');
        var total = $table.find('.gov-checkbox').length;
        var checked = $table.find('.gov-checkbox:checked').length;
        $table.find('.gov-select-all').prop('checked', total === checked);
    });

    // Click handler for cron - use event delegation with high priority
    $(document).on('click', '.cron-clickable', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        var $el = $(this);
        var cron = $el.attr('data-cron') || $el.data('cron');
        var searchName = $el.attr('data-search') || $el.data('search');
        var owner = $el.attr('data-owner') || $el.data('owner');
        var app = $el.attr('data-app') || $el.data('app');

        console.log("Cron clicked:", cron, searchName);
        openCronModal(searchName, cron, owner, app);

        return false;
    });

    // Also capture at document level
    document.addEventListener('click', function(e) {
        var target = e.target;
        if (target.classList && target.classList.contains('cron-clickable')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            var cron = target.getAttribute('data-cron');
            var searchName = target.getAttribute('data-search');
            var owner = target.getAttribute('data-owner');
            var app = target.getAttribute('data-app');

            console.log("Cron clicked (capture):", cron, searchName);
            openCronModal(searchName, cron, owner, app);

            return false;
        }
    }, true);

    // ============================================
    // AUTO-DISABLE CHECK
    // ============================================

    function checkAutoDisable() {
        var now = Math.floor(Date.now() / 1000);

        var updateQuery = '| inputlookup flagged_searches_lookup ' +
            '| eval status = if(status IN ("pending", "notified") AND remediation_deadline < ' + now + ', "disabled", status) ' +
            '| outputlookup flagged_searches_lookup';

        runSearch(updateQuery, function(err, state) {
            if (!err) {
                console.log("Auto-disable check completed");
            }
        });
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    $(document).ready(function() {
        console.log("TA-user-governance: Document ready, initializing...");

        loadConfiguration();
        initModals();

        // Button click handlers - match by text content since IDs may not work in Splunk HTML panels
        $(document).on('click', '.action-buttons button, .action-btn, button.btn', function(e) {
            var btnText = $(this).text().trim().toLowerCase();
            console.log("Button clicked:", btnText);

            if (btnText.indexOf('flag selected') > -1 || btnText.indexOf('flag this') > -1) {
                e.preventDefault();
                window.flagSelectedSearch();
            } else if (btnText.indexOf('preview impact') > -1) {
                e.preventDefault();
                window.previewImpact();
            } else if (btnText.indexOf('track') > -1) {
                e.preventDefault();
                window.trackSearch();
            } else if (btnText.indexOf('email owner') > -1 || btnText.indexOf('email this') > -1) {
                e.preventDefault();
                window.emailOwner();
            } else if (btnText.indexOf('send reminder') > -1) {
                e.preventDefault();
                window.sendReminder();
            } else if (btnText.indexOf('extend deadline') > -1) {
                e.preventDefault();
                window.extendDeadline();
            } else if (btnText.indexOf('disable now') > -1) {
                e.preventDefault();
                window.disableNow();
            } else if (btnText.indexOf('unflag') > -1 || btnText.indexOf('mark resolved') > -1) {
                e.preventDefault();
                window.unflagSearch();
            } else if (btnText.indexOf('clear selection') > -1) {
                e.preventDefault();
                window.clearSelection();
            }
        });

        // Also bind by ID as fallback
        $(document).on('click', '#flag-selected-btn, #flag-btn-2, #flag-this-btn', function(e) {
            e.preventDefault();
            window.flagSelectedSearch();
        });

        $(document).on('click', '#preview-impact-btn, #preview-btn-2, #preview-this-btn', function(e) {
            e.preventDefault();
            window.previewImpact();
        });

        $(document).on('click', '#track-search-btn, #track-btn-2, #track-this-btn', function(e) {
            e.preventDefault();
            window.trackSearch();
        });

        $(document).on('click', '#email-owner-btn, #email-btn-2, #email-this-owner-btn', function(e) {
            e.preventDefault();
            window.emailOwner();
        });

        $(document).on('click', '#send-reminder-btn', function(e) {
            e.preventDefault();
            window.sendReminder();
        });

        $(document).on('click', '#extend-deadline-btn', function(e) {
            e.preventDefault();
            window.extendDeadline();
        });

        $(document).on('click', '#disable-now-btn', function(e) {
            e.preventDefault();
            window.disableNow();
        });

        $(document).on('click', '#unflag-btn', function(e) {
            e.preventDefault();
            window.unflagSearch();
        });

        $(document).on('click', '#clear-selection-btn', function(e) {
            e.preventDefault();
            window.clearSelection();
        });

        // Native capture-phase listener as ultimate fallback
        document.addEventListener('click', function(e) {
            var target = e.target;
            if (target.tagName === 'BUTTON' || (target.tagName === 'DIV' && target.classList.contains('action-btn'))) {
                var text = target.textContent.trim().toLowerCase();
                console.log("Native button click:", text);
            }
        }, true);

        // Direct click handler for "View Flagged" buttons
        $(document).on('click', 'button', function(e) {
            var btnText = $(this).text().trim().toLowerCase();
            if (btnText.indexOf('view flagged') > -1) {
                e.preventDefault();
                e.stopPropagation();
                console.log("View Flagged button clicked");
                openFlaggedModal();
            }
        });

        // Setup click handlers for single value metric panels
        setTimeout(function() {
            setupMetricPanelClickHandlers();
        }, 2000);

        function setupMetricPanelClickHandlers() {
            console.log("Setting up metric panel click handlers");

            // Map of panel titles to metric types
            var metricMap = {
                'Total Scheduled Searches': 'total',
                'Suspicious Searches': 'suspicious',
                'Currently Flagged': 'flagged',
                'Pending Remediation': 'pending',
                'Auto-Disabled (30 Days)': 'disabled'
            };

            $('.dashboard-panel').each(function() {
                var $panel = $(this);
                var $title = $panel.find('.panel-title, h2.panel-title, .panel-head h3').first();
                var titleText = $title.text().trim();

                // Check if this is a single value panel
                var $single = $panel.find('.single-result, .single-value');
                if ($single.length === 0) return;

                // Find matching metric type
                var metricType = null;
                for (var key in metricMap) {
                    if (titleText.indexOf(key) > -1) {
                        metricType = metricMap[key];
                        break;
                    }
                }

                if (!metricType) return;

                // Make panel clickable
                $panel.css('cursor', 'pointer');
                $panel.attr('data-metric-type', metricType);
                $panel.attr('title', 'Click to view details');

                // Remove existing handlers and add new one
                $panel.off('click.metric').on('click.metric', function(e) {
                    if ($(e.target).is('button, a')) return;

                    var type = $(this).attr('data-metric-type');
                    var $singleVal = $(this).find('.single-result, .single-value');
                    var value = $singleVal.text().trim() || '0';
                    var title = $(this).find('.panel-title, h2.panel-title, .panel-head h3').first().text().trim();

                    console.log("Metric panel clicked:", type, value, title);

                    // For flagged, open the flagged modal instead
                    if (type === 'flagged') {
                        openFlaggedModal();
                    } else {
                        openMetricPopup(type, value, title);
                    }
                });
            });
        }

        // Enhance tables multiple times to catch async rendering
        setTimeout(enhanceScheduleColumns, 1000);
        setTimeout(enhanceScheduleColumns, 2000);
        setTimeout(enhanceScheduleColumns, 3000);
        setTimeout(enhanceScheduleColumns, 5000);

        // Watch for table updates
        if (typeof MutationObserver !== 'undefined') {
            var observer = new MutationObserver(function(mutations) {
                clearTimeout(window._enhanceTimer);
                window._enhanceTimer = setTimeout(enhanceScheduleColumns, 300);
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // Check auto-disable
        setTimeout(checkAutoDisable, 5000);
        setInterval(checkAutoDisable, 300000); // Every 5 min

        console.log("TA-user-governance: Initialization complete");
    });

    console.log("TA-user-governance: Script loaded");

});
