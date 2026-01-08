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

    // Funny encouraging messages for when there are 0 items (rotates on each click)
    var zeroItemMessages = [
        "Zero problems? You're basically a search governance superhero. 🦸",
        "Nothing to see here. Your searches are so clean they squeak.",
        "Wow, 0 items. Did you bribe the search scheduler?",
        "All clear! Your Splunk instance just gave you a standing ovation. 👏",
        "Empty list = happy admin. This is the way.",
        "No issues found. Go grab a coffee, you've earned it. ☕",
        "Look at you, running a tight ship! Captain Governance over here.",
        "Zero flags. Either you're great at this or the searches are hiding. 👀",
        "Nothing here but tumbleweeds and excellence. 🌵",
        "Congrats! Your searches are more organized than my sock drawer.",
        "Achievement unlocked: Perfect Governance! Now go home early.",
        "No problematic searches? Are you even using Splunk? 😏",
        "This is cleaner than my production code. Impressive.",
        "0 items. The auditors will be disappointed they can't yell at anyone.",
        "Your governance game is stronger than my coffee. And I like strong coffee.",
        "Nothing to flag means nothing to drag. Well done!",
        "Zero issues. You're making the rest of us look bad. Stop it. 😤",
        "All clear! The search police have left the building.",
        "No items found. Did you just flex on the entire SOC team?",
        "Your searches are so well-behaved they deserve a treat. 🍪",
        "Absolutely nothing wrong. Are you a wizard? 🧙‍♂️",
        "Zero problems detected. The universe is in balance.",
        "Empty list. Time to update your resume with 'Governance Master'.",
        "Nothing here! Your future self thanks your past self.",
        "Clean slate! This is what peak performance looks like.",
        "No flags, no worries. Living the admin dream!",
        "Zero items. You've achieved what others only dream of.",
        "This list is emptier than my bank account after Black Friday. 👌",
        "Flawless execution. Someone give this person a raise!",
        "Nothing to report. Go touch some grass, you've earned it. 🌿",
        "0 issues. The compliance team just shed a tear of joy.",
        "All systems nominal. Houston, we DON'T have a problem.",
        "No items? Check again. Just kidding, you're actually perfect.",
        "Your governance is tighter than my deadline schedules. Respect.",
        "Empty. Clean. Beautiful. Just like my code after review. Just kidding.",
        "Zero flags means zero drama. That's a W in my book. 📚",
        "Nothing to see here, folks. Move along to the coffee machine.",
        "You've got fewer problems than a hello world program.",
        "This is so clean I could eat off it. But I won't. That's weird.",
        "No items found. Did you sacrifice a goat to the search gods?",
        "Your Splunk hygiene is immaculate. Someone's been flossing!",
        "Zero issues. You're the Marie Kondo of scheduled searches.",
        "Nothing problematic here. What's your secret? Asking for a friend.",
        "All clear! Time to add 'Search Whisperer' to your LinkedIn.",
        "No items. The only thing flagged here is your awesomeness. 🚩✨",
        "Empty list energy. I respect it.",
        "Zero findings. The pen testers are jealous.",
        "Your governance is chef's kiss. 👨‍🍳💋",
        "Nothing here but clean data and good vibes.",
        "0 items. Somewhere, a compliance officer is smiling."
    ];
    var lastZeroMessageIndex = -1;

    // Get a random encouraging message (never repeats consecutively)
    function getZeroItemMessage() {
        var newIndex;
        do {
            newIndex = Math.floor(Math.random() * zeroItemMessages.length);
        } while (newIndex === lastZeroMessageIndex && zeroItemMessages.length > 1);
        lastZeroMessageIndex = newIndex;
        return zeroItemMessages[newIndex];
    }

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

    // Fetch last governance action via REST API (fallback)
    function fetchLastGovernanceAction() {
        var localePrefix = '';
        var pathParts = window.location.pathname.split('/');
        if (pathParts.length > 1 && pathParts[1].match(/^[a-z]{2}(-[A-Z]{2})?$/)) {
            localePrefix = '/' + pathParts[1];
        }

        $.ajax({
            url: localePrefix + '/splunkd/__raw/services/search/jobs',
            type: 'POST',
            data: {
                search: '| inputlookup governance_audit_log.csv | sort - timestamp | head 1 | eval display = strftime(timestamp, "%Y-%m-%d %H:%M:%S") . " - " . action . " by " . performed_by | table display',
                exec_mode: 'oneshot',
                output_mode: 'json'
            },
            success: function(response) {
                if (response && response.results && response.results.length > 0) {
                    var display = response.results[0].display;
                    if (display) {
                        $('#lastActionTimestamp').text(display);
                    } else {
                        $('#lastActionTimestamp').text('No actions recorded');
                    }
                } else {
                    $('#lastActionTimestamp').text('No actions recorded');
                }
            },
            error: function() {
                $('#lastActionTimestamp').text('No actions recorded');
            }
        });
    }

    // Format countdown timer display from deadline epoch
    function formatCountdownTimer(deadlineEpoch, status) {
        // If disabled, show N/A
        if (status === 'disabled') {
            return '<span class="countdown-disabled" style="color: rgba(255,255,255,0.4);">N/A</span>';
        }

        // If resolved (unflagged), show N/A - no deadline applies to resolved searches
        if (status === 'resolved') {
            return '<span class="countdown-resolved" style="color: rgba(255,255,255,0.4);">N/A</span>';
        }

        // If under review, show paused timer
        if (status === 'review') {
            return '<span class="countdown-review" style="color: #6f42c1; font-weight: 600;">⏸️ Under Review</span>';
        }

        // If flagged (but not yet notified), show awaiting notification - NO timer yet
        // Timer only starts when admin sends notification (status changes to 'notified')
        if (status === 'flagged' || status === 'pending') {
            return '<span class="countdown-awaiting" style="color: #f1813f; font-weight: 500;">⏸ Awaiting Notification</span>';
        }

        // If status is not notified or expiring, show N/A
        if (status && status !== 'notified' && status !== 'expiring') {
            return '<span class="countdown-inactive" style="color: rgba(255,255,255,0.4);">N/A</span>';
        }

        if (!deadlineEpoch) {
            return '<span style="color: rgba(255,255,255,0.4);">—</span>';
        }

        var now = Date.now() / 1000; // Current time in seconds
        var remaining = deadlineEpoch - now;

        if (remaining <= 0) {
            // Deadline has passed - show overdue
            var overdueDays = Math.abs(Math.floor(remaining / 86400));
            return '<span class="countdown-overdue" style="color: #dc4e41; font-weight: 700; animation: countdownPulse 1s ease-in-out infinite;">⚠️ OVERDUE ' + overdueDays + 'd</span>';
        }

        var days = Math.floor(remaining / 86400);
        var hours = Math.floor((remaining % 86400) / 3600);
        var minutes = Math.floor((remaining % 3600) / 60);
        var seconds = Math.floor(remaining % 60);

        var timerClass = '';
        var timerStyle = '';
        var timerIcon = '';

        if (days === 0 && hours < 24) {
            // Critical - less than 24 hours
            timerClass = 'countdown-critical';
            timerStyle = 'color: #dc4e41; font-weight: 700; animation: countdownPulse 0.5s ease-in-out infinite;';
            timerIcon = '🔴 ';
        } else if (days <= 2) {
            // Urgent - 2 days or less
            timerClass = 'countdown-urgent';
            timerStyle = 'color: #f8be34; font-weight: 600; animation: countdownPulse 1s ease-in-out infinite;';
            timerIcon = '🟡 ';
        } else if (days <= 5) {
            // Warning - 5 days or less
            timerClass = 'countdown-warning';
            timerStyle = 'color: #f1813f; font-weight: 500;';
            timerIcon = '🟠 ';
        } else {
            // Normal
            timerClass = 'countdown-normal';
            timerStyle = 'color: #53a051;';
            timerIcon = '🟢 ';
        }

        // Format the display
        var display;
        if (days > 0) {
            display = timerIcon + days + 'd ' + hours + 'h ' + minutes + 'm';
        } else if (hours > 0) {
            display = timerIcon + hours + 'h ' + minutes + 'm ' + seconds + 's';
        } else {
            display = timerIcon + minutes + 'm ' + seconds + 's';
        }

        return '<span class="' + timerClass + '" style="' + timerStyle + ' font-family: monospace; font-size: 13px;">' + display + '</span>';
    }

    // Start real-time countdown timer updates
    function startCountdownTimer() {
        // Clear any existing interval
        if (window.countdownTimerInterval) {
            clearInterval(window.countdownTimerInterval);
        }

        // Update every second for accurate countdown
        window.countdownTimerInterval = setInterval(function() {
            // Check if popup is still open
            if (!$('#metricPopupOverlay').hasClass('active')) {
                clearInterval(window.countdownTimerInterval);
                window.countdownTimerInterval = null;
                return;
            }

            // Update all countdown cells
            $('.countdown-cell').each(function() {
                var $cell = $(this);
                var deadlineEpoch = parseFloat($cell.attr('data-deadline'));
                var idx = parseInt($cell.attr('data-index'));
                var status = currentMetricSearches[idx] ? currentMetricSearches[idx].status : '';

                if (deadlineEpoch) {
                    $cell.html(formatCountdownTimer(deadlineEpoch, status));
                }
            });
        }, 1000); // Update every second
    }

    // Note: Countdown timer cleanup is now handled by closeMetricPopup() function

    // Check for overdue searches and prompt for auto-disable
    function checkAndPromptOverdueSearches() {
        var overdueSearches = [];
        var now = Date.now() / 1000;

        currentMetricSearches.forEach(function(search, idx) {
            // Only check pending/notified searches with valid deadlines
            if (search.deadlineEpoch &&
                (search.status === 'pending' || search.status === 'notified') &&
                search.deadlineEpoch < now) {
                overdueSearches.push({
                    name: search.name,
                    owner: search.owner,
                    app: search.app,
                    daysOverdue: Math.abs(Math.floor((search.deadlineEpoch - now) / 86400)),
                    index: idx
                });
            }
        });

        if (overdueSearches.length > 0) {
            // Show a notification banner about overdue searches
            var banner = '<div id="overdueBanner" style="' +
                'background: linear-gradient(135deg, rgba(220, 78, 65, 0.9) 0%, rgba(180, 50, 40, 0.9) 100%);' +
                'padding: 12px 16px;' +
                'margin-bottom: 10px;' +
                'border-radius: 8px;' +
                'display: flex;' +
                'align-items: center;' +
                'justify-content: space-between;' +
                'animation: countdownPulse 1.5s ease-in-out infinite;' +
                '">' +
                '<div style="display: flex; align-items: center; gap: 10px;">' +
                '<span style="font-size: 20px;">⚠️</span>' +
                '<span style="font-weight: 600; color: white;">' +
                overdueSearches.length + ' search(es) have exceeded their remediation deadline!' +
                '</span>' +
                '</div>' +
                '<button id="autoDisableOverdue" style="' +
                'background: white;' +
                'color: #dc4e41;' +
                'border: none;' +
                'padding: 8px 16px;' +
                'border-radius: 6px;' +
                'font-weight: 600;' +
                'cursor: pointer;' +
                'transition: all 0.2s;' +
                '">Auto-Disable All</button>' +
                '</div>';

            // Insert banner at top of popup body
            var $popupBody = $('#metricPopupOverlay .metric-popup-body');
            $popupBody.prepend(banner);

            // Handle auto-disable button click
            $('#autoDisableOverdue').on('click', function() {
                autoDisableOverdueSearches(overdueSearches);
            });
        }
    }

    // Auto-disable all overdue searches
    function autoDisableOverdueSearches(overdueSearches) {
        if (!confirm('This will disable ' + overdueSearches.length + ' overdue search(es):\n\n' +
            overdueSearches.map(function(s) {
                return '• ' + s.name + ' (' + s.daysOverdue + ' days overdue)';
            }).join('\n') +
            '\n\nContinue?')) {
            return;
        }

        showToast('Auto-disabling ' + overdueSearches.length + ' overdue search(es)...');

        // Build conditions for all overdue searches
        var conditions = overdueSearches.map(function(s) {
            return 'search_name="' + escapeString(s.name) + '"';
        }).join(' OR ');

        // Update lookup to disable these searches
        var disableQuery = '| inputlookup flagged_searches_lookup ' +
            '| eval status = if(' + conditions + ', "disabled", status)' +
            '| eval notes = if(' + conditions + ', notes + " | AUTO-DISABLED: Deadline exceeded on " + strftime(now(), "%Y-%m-%d %H:%M"), notes)' +
            '| outputlookup flagged_searches_lookup';

        runSearch(disableQuery, function(err) {
            if (err) {
                alert('Error auto-disabling searches: ' + err);
                return;
            }

            // Log each disabled search
            overdueSearches.forEach(function(s) {
                logAction('auto-disabled', s.name, 'Deadline exceeded by ' + s.daysOverdue + ' days - auto-disabled by ' + currentUser);
            });

            // Also disable the actual saved searches via REST API
            disableSearchesViaREST(overdueSearches);

            // Remove the banner
            $('#overdueBanner').fadeOut(300, function() { $(this).remove(); });

            showToast('✓ ' + overdueSearches.length + ' overdue search(es) have been auto-disabled');

            // Refresh the popup data
            setTimeout(function() {
                refreshDashboard();
            }, 1000);
        });
    }

    // Disable searches via REST API (helper function)
    function disableSearchesViaREST(searches) {
        searches.forEach(function(search) {
            var localePrefix = window.location.pathname.split('/')[1];
            if (localePrefix && localePrefix.match(/^[a-z]{2}-[A-Z]{2}$/)) {
                localePrefix = '/' + localePrefix;
            } else {
                localePrefix = '';
            }

            // Try to disable via REST API
            var disableUrl = localePrefix + '/splunkd/__raw/servicesNS/-/-/saved/searches/' +
                encodeURIComponent(search.name) + '/disable';

            $.ajax({
                url: disableUrl,
                type: 'POST',
                data: { output_mode: 'json' },
                error: function(xhr) {
                    console.log('REST disable failed for ' + search.name + ':', xhr.status);
                }
            });
        });
    }

    // Helper to generate status badge HTML
    function getStatusBadges(status) {
        var badges = [];
        var statusLower = (status || '').toLowerCase();

        // Badge styles - color coded by urgency/status
        // Yellow (#f8be34): awaiting action (notified), suspicious
        // Orange (#f1813f): newly flagged (flagged, pending)
        // Red (#dc4e41): expiring soon, critical
        // Gray (#708794): disabled
        // Green (#53a051): active, enabled
        // Purple (#6f42c1): under review
        var badgeStyles = {
            flagged: 'background: #f1813f; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 4px;',
            pending: 'background: #f1813f; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 4px;',
            notified: 'background: #f8be34; color: #000; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 4px;',
            enabled: 'background: #53a051; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 4px;',
            disabled: 'background: #708794; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 4px;',
            expiring: 'background: #dc4e41; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 4px;',
            suspicious: 'background: #f8be34; color: #000; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 4px;',
            active: 'background: #53a051; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 4px;',
            review: 'background: #6f42c1; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 4px;'
        };

        // Badge labels
        var badgeLabels = {
            flagged: 'FLAGGED',
            pending: 'PENDING',
            notified: 'NOTIFIED',
            enabled: 'ENABLED',
            disabled: 'DISABLED',
            expiring: 'EXPIRING',
            suspicious: 'SUSPICIOUS',
            active: 'ACTIVE',
            review: 'UNDER REVIEW'
        };

        // Determine which badges to show
        if (statusLower === 'disabled' || statusLower === 'disabled by governance') {
            badges.push('<span class="status-badge disabled" style="' + badgeStyles.disabled + '">DISABLED</span>');
        } else if (statusLower === 'flagged' || statusLower === 'pending') {
            badges.push('<span class="status-badge flagged" style="' + badgeStyles.flagged + '">FLAGGED</span>');
        } else if (statusLower === 'notified' || statusLower === 'pending remediation') {
            badges.push('<span class="status-badge notified" style="' + badgeStyles.notified + '">NOTIFIED</span>');
        } else if (statusLower === 'enabled') {
            badges.push('<span class="status-badge enabled" style="' + badgeStyles.enabled + '">ENABLED</span>');
        } else if (statusLower === 'expiring') {
            badges.push('<span class="status-badge expiring" style="' + badgeStyles.expiring + '">EXPIRING</span>');
        } else if (statusLower === 'suspicious') {
            badges.push('<span class="status-badge suspicious" style="' + badgeStyles.suspicious + '">SUSPICIOUS</span>');
        } else if (statusLower === 'active') {
            badges.push('<span class="status-badge active" style="' + badgeStyles.active + '">ACTIVE</span>');
        } else if (statusLower === 'review' || statusLower === 'pending review') {
            badges.push('<span class="status-badge review" style="' + badgeStyles.review + '">📋 PENDING REVIEW</span>');
        } else if (statusLower === 'ok' || statusLower === 'resolved') {
            badges.push('<span class="status-badge ok" style="background: #2ecc71; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;">OK</span>');
        } else {
            badges.push('<span class="status-badge" style="background: #666; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px;">' + escapeHtml(status || '-') + '</span>');
        }

        return badges.join('');
    }
    window.getStatusBadges = getStatusBadges;

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

            // Re-enhance tables after Splunk re-renders them
            // Multiple calls at staggered intervals to catch async rendering
            setTimeout(enhanceScheduleColumns, 500);
            setTimeout(enhanceScheduleColumns, 1000);
            setTimeout(enhanceScheduleColumns, 2000);
            setTimeout(enhanceScheduleColumns, 3000);
            setTimeout(enhanceScheduleColumns, 5000);

            // Re-setup metric panel click handlers after refresh
            // Panels may have been recreated with fresh DOM elements
            // Run multiple times with increasing delays to catch async rendering
            setTimeout(function() {
                // Clear existing setup markers so handlers are re-attached
                $('.dashboard-element.single, .dashboard-row .dashboard-cell, .dashboard-panel').removeAttr('data-metric-setup');
                setupMetricPanelClickHandlers();
            }, 500);
            setTimeout(function() {
                setupMetricPanelClickHandlers();
            }, 1500);
            setTimeout(function() {
                setupMetricPanelClickHandlers();
            }, 2500);
            setTimeout(function() {
                setupMetricPanelClickHandlers();
            }, 4000);
        }, 300);
    }

    // Expose refreshDashboard globally for external access (e.g., tests, integrations)
    window.refreshDashboard = refreshDashboard;

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
        // NOTE: deadline is 0 until admin sends notification (then it gets set)
        // This separates "flagged" (identified) from "notified" (timer started)

        // Build query that removes existing entry first, then adds new one (prevents duplicates)
        var searchQuery = '| inputlookup flagged_searches_lookup ' +
            '| search search_name!="' + escapeString(searchName) + '" ' +
            '| append [| makeresults ' +
            '| eval search_name="' + escapeString(searchName) + '"' +
            ', search_owner="' + escapeString(owner) + '"' +
            ', search_app="' + escapeString(app) + '"' +
            ', flagged_by="' + escapeString(currentUser) + '"' +
            ', flagged_time=' + now +
            ', notification_sent=0' +
            ', notification_time=0' +
            ', remediation_deadline=0' +
            ', status="flagged"' +
            ', reason="' + escapeString(reason) + '"' +
            ', notes=""]' +
            '| table search_name, search_owner, search_app, flagged_by, flagged_time, notification_sent, notification_time, remediation_deadline, status, reason, notes' +
            '| outputlookup flagged_searches_lookup';

        console.log("Running flag search query...");

        // Show immediate visual feedback
        showToast("Flagging " + searchName + "...");

        // Find the row - data-search is on the checkbox, not the TR
        var $checkbox = $('.gov-checkbox[data-search="' + searchName + '"]');
        var $row = $checkbox.closest('tr');

        // Mark the row as flagged visually
        $row.addClass('row-flagged');
        $checkbox.attr('data-flagged', 'true');

        runSearch(searchQuery, function(err, results) {
            console.log("Flag search callback:", err, results);
            if (err) {
                console.error("Error flagging search:", err);
                showToast("Error: " + err);
                $row.removeClass('row-flagged');
                $checkbox.attr('data-flagged', 'false');
            } else {
                console.log("Search flagged successfully");
                logAction("flagged", searchName, reason);
                showToast("✓ Flagged: " + searchName);

                // Add permanent flag indicator to the row
                var $firstTd = $row.find('td').first();
                if ($firstTd.length && !$firstTd.find('.flag-indicator').length) {
                    $firstTd.css('position', 'relative').prepend(
                        '<span class="flag-indicator" style="color: #dc4e41; margin-right: 5px;" title="Flagged for review">⚑</span>'
                    );
                }

                // Add success checkmark animation
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

                // Refresh dashboard to update metric panels (Currently Flagged count)
                refreshDashboard();
            }
        });
    }

    // ============================================
    // GLOBAL FUNCTIONS (exposed to window)
    // ============================================

    // Debounce flag to prevent duplicate prompts from multiple event handlers
    var flagInProgress = false;

    window.flagSelectedSearch = function() {
        console.log("flagSelectedSearch called");

        // Prevent duplicate calls from multiple handlers
        if (flagInProgress) {
            console.log("flagSelectedSearch: already in progress, skipping");
            return;
        }
        flagInProgress = true;
        setTimeout(function() { flagInProgress = false; }, 500);

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
        // NOTE: deadline is 0 until admin sends notification (then it gets set)
        // This separates "flagged" (identified) from "notified" (timer started)

        // Build append parts - each entry in its own subsearch to properly union results
        var appendParts = searches.map(function(s, idx) {
            return '| append [| makeresults ' +
                '| eval search_name="' + escapeString(s.searchName) + '"' +
                ', search_owner="' + escapeString(s.owner) + '"' +
                ', search_app="' + escapeString(s.app) + '"' +
                ', flagged_by="' + escapeString(currentUser) + '"' +
                ', flagged_time=' + now +
                ', notification_sent=0' +
                ', notification_time=0' +
                ', remediation_deadline=0' +
                ', status="flagged"' +
                ', reason="' + escapeString(s.reason || 'Manually flagged by administrator') + '"' +
                ', notes=""]';
        });

        // Build list of search names for exclusion
        var searchNamesList = searches.map(function(s) { return '"' + escapeString(s.searchName) + '"'; }).join(', ');

        // First read existing entries (excluding ones we're flagging), then append all new entries
        var searchQuery = '| inputlookup flagged_searches_lookup ' +
            '| search NOT search_name IN (' + searchNamesList + ') ' +
            appendParts.join(' ') +
            '| table search_name, search_owner, search_app, flagged_by, flagged_time, notification_sent, notification_time, remediation_deadline, status, reason, notes ' +
            '| outputlookup flagged_searches_lookup';

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
                    // Find the row via the checkbox (data-search is on checkbox, not TR)
                    var $checkbox = $('.gov-checkbox[data-search="' + s.searchName + '"]');
                    var $row = $checkbox.closest('tr');

                    if ($row.length) {
                        $row.addClass('row-flagged').attr('data-flagged', 'true');

                        // Update checkbox data
                        $checkbox.attr('data-flagged', 'true');

                        // Add flag indicator to the Search Name column (first non-checkbox, non-row-number cell)
                        // Skip checkbox cell and row number cell, then get the first content cell
                        var $cells = $row.find('td');
                        var $searchCell = null;
                        $cells.each(function(idx) {
                            var $cell = $(this);
                            // Skip checkbox cell
                            if ($cell.hasClass('gov-checkbox-cell')) return true;
                            // Skip row number cell (just a number)
                            if ($cell.text().trim().match(/^\d+$/)) return true;
                            // This should be the search name column - verify it contains the search name
                            var cellText = $cell.text().trim().replace(/^[\s⚑⚐🚩⚠️🚫✓]+/, '').trim();
                            if (cellText === s.searchName || cellText.indexOf(s.searchName) > -1) {
                                $searchCell = $cell;
                                return false; // break
                            }
                        });

                        if ($searchCell && $searchCell.length && !$searchCell.find('.flag-indicator').length) {
                            $searchCell.prepend('<span class="flag-indicator" style="color: #dc4e41; margin-right: 6px; font-size: 12px;" title="Flagged for review">🚩</span>');
                        }

                        // Update Flagged column if present
                        $row.find('td').each(function() {
                            if ($(this).text().trim() === 'No') {
                                $(this).html('<span style="color: #dc4e41; font-weight: 600;">Yes</span>');
                            }
                        });
                    } else {
                        console.log("Could not find row for search:", s.searchName);
                    }
                });

                // Clear selections
                $('.gov-checkbox').prop('checked', false);
                $('.gov-select-all').prop('checked', false);
                selectedSearches = [];

                // Refresh dashboard to update metric panels (Currently Flagged count, etc.)
                refreshDashboard();
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

        // Reset button states and set default value
        currentExtendDays = 7;
        $('.extend-days-btn').removeClass('active');
        $('.extend-days-btn[data-days="7"]').addClass('active');
        $('#extendCustomDays').val('7');

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
        console.log("performExtendDeadline called");

        // Read from input - allow negative values for reducing time
        var inputVal = parseInt($('#extendCustomDays').val());
        var extensionDays = !isNaN(inputVal) ? inputVal : currentExtendDays;
        var searches = currentExtendSearches;

        console.log("performExtendDeadline: inputVal=" + inputVal + ", extensionDays=" + extensionDays + ", searches.length=" + (searches ? searches.length : 0));

        if (extensionDays === 0 || !searches || !searches.length) {
            console.log("performExtendDeadline: FAILED validation - extensionDays=" + extensionDays + ", searches=" + JSON.stringify(searches));
            alert("Please enter a non-zero extension value.");
            return;
        }

        var extensionSeconds = extensionDays * 24 * 60 * 60;
        var isReducing = extensionDays < 0;

        // If reducing time, check if any search would have deadline in the past
        if (isReducing) {
            var now = Math.floor(Date.now() / 1000);
            var searchesWithExpiredDeadline = searches.filter(function(s) {
                // If we have deadline info, check if reduction would expire it
                if (s.deadlineEpoch) {
                    return (s.deadlineEpoch + extensionSeconds) <= now;
                }
                // If no deadline info, we'll check after the query
                return false;
            });

            if (searchesWithExpiredDeadline.length > 0) {
                var searchNames = searchesWithExpiredDeadline.map(function(s) { return s.searchName; }).join(', ');
                var disablePrompt = searchesWithExpiredDeadline.length === 1
                    ? "Reducing by " + Math.abs(extensionDays) + " days would set '" + searchesWithExpiredDeadline[0].searchName + "' deadline to the past.\n\nDo you want to disable this search instead?"
                    : "Reducing by " + Math.abs(extensionDays) + " days would set " + searchesWithExpiredDeadline.length + " searches' deadlines to the past.\n\nDo you want to disable these searches instead?";

                if (confirm(disablePrompt)) {
                    // Disable these searches instead
                    disableSearchesFromExtendModal(searchesWithExpiredDeadline);
                    return;
                } else {
                    // User cancelled - abort the reduction
                    return;
                }
            }
        }

        // Build condition for multiple searches
        var conditions = searches.map(function(s) {
            console.log("performExtendDeadline: building condition for search:", s);
            return 'search_name="' + escapeString(s.searchName) + '"';
        }).join(' OR ');

        console.log("performExtendDeadline: conditions=" + conditions);

        // For negative values, we still add (which effectively subtracts)
        var searchQuery = '| inputlookup flagged_searches_lookup ' +
            '| eval remediation_deadline = if(' + conditions + ', remediation_deadline + ' + extensionSeconds + ', remediation_deadline)' +
            '| outputlookup flagged_searches_lookup';

        console.log("performExtendDeadline: executing query:", searchQuery);

        var actionVerb = isReducing ? "Reducing" : "Extending";
        showToast(actionVerb + " deadline...");
        $('#extendModalOverlay').removeClass('active');

        runSearch(searchQuery, function(err, results) {
            console.log("performExtendDeadline: callback - err=" + err);
            if (err) {
                alert("Error " + actionVerb.toLowerCase() + " deadline: " + err);
            } else {
                // After update, check if any deadlines are now in the past (for searches without prior deadline info)
                if (isReducing) {
                    checkAndPromptForExpiredDeadlines(searches, extensionDays);
                }

                searches.forEach(function(s) {
                    var logMsg = isReducing
                        ? "Deadline reduced by " + Math.abs(extensionDays) + " days"
                        : "Deadline extended by " + extensionDays + " days";
                    logAction(isReducing ? "reduced" : "extended", s.searchName, logMsg);
                });
                var msg = searches.length === 1
                    ? "Deadline for '" + searches[0].searchName + "' " + (isReducing ? "reduced" : "extended") + " by " + Math.abs(extensionDays) + " days."
                    : "Deadlines for " + searches.length + " searches " + (isReducing ? "reduced" : "extended") + " by " + Math.abs(extensionDays) + " days.";
                showToast("✓ " + msg);
                refreshDashboard();
            }
        });
    }

    // Disable searches from the extend modal when deadline would go to past
    function disableSearchesFromExtendModal(searches) {
        console.log("disableSearchesFromExtendModal:", searches);

        var localePrefix = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})\//);
        localePrefix = localePrefix ? '/' + localePrefix[1] : '';

        var successCount = 0;
        var failCount = 0;
        var totalCount = searches.length;

        showToast("Disabling " + totalCount + " search(es)...");
        $('#extendModalOverlay').removeClass('active');

        searches.forEach(function(search, idx) {
            var disableUrl = localePrefix + '/splunkd/__raw/servicesNS/-/' +
                encodeURIComponent(search.app || 'search') + '/saved/searches/' +
                encodeURIComponent(search.searchName) + '/disable';

            $.ajax({
                url: disableUrl,
                type: 'POST',
                data: { output_mode: 'json' },
                success: function() {
                    successCount++;
                    logAction("disabled", search.searchName, "Disabled due to deadline expiration");
                    checkComplete();
                },
                error: function(xhr) {
                    console.error("Failed to disable search:", search.searchName, xhr.status);
                    failCount++;
                    checkComplete();
                }
            });

            // Update the lookup status to "disabled"
            var updateQuery = '| inputlookup flagged_searches_lookup | eval status=if(search_name="' + escapeString(search.searchName) + '", "disabled", status) | outputlookup flagged_searches_lookup';
            runSearch(updateQuery);
        });

        function checkComplete() {
            if (successCount + failCount === totalCount) {
                var msg = successCount === totalCount
                    ? "✓ Disabled " + successCount + " search(es)"
                    : "Disabled " + successCount + "/" + totalCount + " search(es)";
                showToast(msg);
                refreshDashboard();
            }
        }
    }

    // Check for expired deadlines after reduction and prompt to disable
    function checkAndPromptForExpiredDeadlines(searches, extensionDays) {
        var conditions = searches.map(function(s) {
            return 'search_name="' + escapeString(s.searchName) + '"';
        }).join(' OR ');

        var checkQuery = '| inputlookup flagged_searches_lookup | search ' + conditions +
            ' | eval days_remaining = round((remediation_deadline - now()) / 86400, 2)' +
            ' | where days_remaining <= 0 AND status!="disabled"' +
            ' | table search_name, search_owner, search_app, days_remaining';

        runSearch(checkQuery, function(err, results) {
            if (!err && results && results.length > 0) {
                var expiredSearches = results.map(function(r) {
                    return {
                        searchName: r.search_name,
                        owner: r.search_owner,
                        app: r.search_app
                    };
                });

                var disablePrompt = expiredSearches.length === 1
                    ? "'" + expiredSearches[0].searchName + "' now has an expired deadline.\n\nDo you want to disable this search?"
                    : expiredSearches.length + " searches now have expired deadlines.\n\nDo you want to disable these searches?";

                if (confirm(disablePrompt)) {
                    disableSearchesFromExtendModal(expiredSearches);
                }
            }
        });
    }

    // Debounce flag for disableNow
    var disableInProgress = false;

    window.disableNow = function() {
        console.log("disableNow called");

        // Prevent duplicate calls
        if (disableInProgress) {
            console.log("disableNow: already in progress, skipping");
            return;
        }
        disableInProgress = true;
        setTimeout(function() { disableInProgress = false; }, 500);

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

    // Disable all flagged searches expiring within 3 days
    window.disableExpiringSoon = function() {
        console.log("disableExpiringSoon called");

        // Get flagged searches expiring within 3 days
        var searchQuery = '| inputlookup flagged_searches_lookup ' +
            '| search status IN ("pending", "notified") ' +
            '| eval days_remaining = round((remediation_deadline - now()) / 86400, 1) ' +
            '| where days_remaining >= 0 AND days_remaining <= 3 ' +
            '| table search_name, search_owner, days_remaining';

        runSearch(searchQuery, function(err, results) {
            if (err) {
                alert("Error finding expiring searches: " + err);
                return;
            }

            if (!results || results.length === 0) {
                alert("No flagged searches are expiring within 3 days.");
                return;
            }

            var searchList = results.map(function(r) {
                return "• " + r.search_name + " (" + r.days_remaining + " days left)";
            }).join("\n");

            var msg = results.length === 1
                ? "Disable the following search that is expiring soon?\n\n" + searchList
                : "Disable " + results.length + " searches that are expiring soon?\n\n" + searchList;

            if (!confirm(msg + "\n\nThis will prevent these searches from running until manually re-enabled.")) {
                return;
            }

            // Build condition for all expiring searches
            var conditions = results.map(function(r) {
                return 'search_name="' + escapeString(r.search_name) + '"';
            }).join(' OR ');

            var disableQuery = '| inputlookup flagged_searches_lookup ' +
                '| eval status = if(' + conditions + ', "disabled", status)' +
                '| outputlookup flagged_searches_lookup';

            showToast("Disabling " + results.length + " expiring search(es)...");

            runSearch(disableQuery, function(disableErr) {
                if (disableErr) {
                    alert("Error disabling searches: " + disableErr);
                } else {
                    results.forEach(function(r) {
                        logAction("disabled", r.search_name, "Auto-disabled by " + currentUser + " (was expiring in " + r.days_remaining + " days)");
                    });
                    showToast("✓ " + results.length + " expiring search(es) have been disabled");
                    refreshDashboard();
                }
            });
        });
    };

    // Debounce flag for unflagSearch
    var unflagInProgress = false;

    window.unflagSearch = function() {
        // Prevent duplicate calls - use longer timeout to handle alert blocking
        if (unflagInProgress) {
            return;
        }
        unflagInProgress = true;
        setTimeout(function() { unflagInProgress = false; }, 3000);

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

        // First try to get from checkbox selections
        var searches = getSelectedSearches();
        var searchName, owner, app;

        if (searches.length > 0) {
            // Use first selected search from checkbox
            searchName = searches[0].searchName;
            owner = searches[0].owner;
            app = searches[0].app;
            console.log("previewImpact: using checkbox selection", searchName);
        } else {
            // Fallback to token-based selection
            searchName = getToken("selected_search");
            owner = getToken("selected_owner");
            app = getToken("selected_app");
            console.log("previewImpact: using token selection", searchName);
        }

        if (!searchName) {
            alert("Please select a search using the checkbox or by clicking on a row.");
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
                    '<div class="cron-section-title">Quick Presets <span style="font-size: 10px; color: rgba(255,255,255,0.5); font-weight: normal;">(with scheduler-friendly offsets)</span></div>' +
                    '<div class="cron-preset-grid">' +
                        '<div class="cron-preset-btn" data-cron="3-59/5 * * * *"><div class="cron-preset-label">Every 5 Min</div><div class="cron-preset-cron">3-59/5 * * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="7,22,37,52 * * * *"><div class="cron-preset-label">Every 15 Min</div><div class="cron-preset-cron">7,22,37,52 * * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="11,41 * * * *"><div class="cron-preset-label">Every 30 Min</div><div class="cron-preset-cron">11,41 * * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="3 * * * *"><div class="cron-preset-label">Hourly</div><div class="cron-preset-cron">3 * * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="7 */2 * * *"><div class="cron-preset-label">Every 2 Hours</div><div class="cron-preset-cron">7 */2 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="13 */4 * * *"><div class="cron-preset-label">Every 4 Hours</div><div class="cron-preset-cron">13 */4 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="17 */6 * * *"><div class="cron-preset-label">Every 6 Hours</div><div class="cron-preset-cron">17 */6 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="23 */12 * * *"><div class="cron-preset-label">Twice Daily</div><div class="cron-preset-cron">23 */12 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="19 0 * * *"><div class="cron-preset-label">Daily ~Midnight</div><div class="cron-preset-cron">19 0 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="11 6 * * *"><div class="cron-preset-label">Daily ~6 AM</div><div class="cron-preset-cron">11 6 * * *</div></div>' +
                        '<div class="cron-preset-btn" data-cron="29 0 * * 0"><div class="cron-preset-label">Weekly</div><div class="cron-preset-cron">29 0 * * 0</div></div>' +
                        '<div class="cron-preset-btn" data-cron="37 0 1 * *"><div class="cron-preset-label">Monthly</div><div class="cron-preset-cron">37 0 1 * *</div></div>' +
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
            '<div class="metric-popup" style="max-width: 950px; width: 90%;">' +
                '<div class="metric-popup-header" style="padding: 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">' +
                    '<div class="metric-popup-value" id="metricPopupValue" style="font-size: 48px; font-weight: 700; color: #5cc05c; line-height: 1.2;">0</div>' +
                    '<div class="metric-popup-title" id="metricPopupTitle" style="font-size: 18px; color: rgba(255,255,255,0.8); margin-top: 8px; white-space: normal; word-wrap: break-word;">Metric</div>' +
                '</div>' +
                '<div class="metric-popup-body" style="max-height: 450px; overflow-y: auto; padding: 15px;">' +
                    '<table class="metric-popup-table" id="metricPopupTable" style="width: 100%; border-collapse: collapse;">' +
                        '<thead id="metricPopupTableHead"></thead>' +
                        '<tbody id="metricPopupTableBody"></tbody>' +
                    '</table>' +
                '</div>' +
                '<div class="metric-popup-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 15px; border-top: 1px solid rgba(255,255,255,0.1); flex-wrap: wrap;">' +
                    '<button class="btn" style="background: #6f42c1; border-color: #6f42c1; color: white; display: none;" id="metricPopupSubmitReview">📋 Submit for Review</button>' +
                    '<button class="btn" style="background: #2ea043; border-color: #2ea043; color: white; display: none;" id="metricPopupApprove">✓ Approve & Unflag</button>' +
                    '<button class="btn" style="background: #f8be34; border-color: #f8be34; color: #000; display: none;" id="metricPopupReject">✗ Reject Review</button>' +
                    '<button class="btn" style="background: #5cc05c; border-color: #5cc05c; color: white; display: none;" id="metricPopupEnable">Enable Selected</button>' +
                    '<button class="btn" style="background: #f0ad4e; border-color: #f0ad4e; color: #000; display: none;" id="metricPopupFlag">🚩 Flag Selected</button>' +
                    '<button class="btn" style="background: #007bff; border-color: #007bff; color: white; display: none;" id="metricPopupNotify">📧 Notify User</button>' +
                    '<button class="btn" style="background: #17a2b8; border-color: #17a2b8; color: white; display: none;" id="metricPopupUnflag">✓ Unflag Selected</button>' +
                    '<button class="btn" style="background: #dc4e41; border-color: #dc4e41; color: white;" id="metricPopupDisable">Disable Selected</button>' +
                    '<button class="btn btn-primary" id="metricPopupExtend">Extend Deadline</button>' +
                    '<button class="btn btn-secondary" id="metricPopupClose">Close</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    // Reason Details Modal - shows why a search was flagged and solutions
    var reasonModalHtml =
        '<div class="cron-modal-overlay" id="reasonModalOverlay">' +
            '<div class="cron-modal" style="max-width: 600px;">' +
                '<div class="cron-modal-header" style="background: linear-gradient(135deg, rgba(248, 190, 52, 0.2) 0%, rgba(241, 129, 63, 0.1) 100%); border-bottom: 2px solid #f8be34;">' +
                    '<h2 style="color: #fff; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px;"><span style="font-size: 22px;">⚡</span>Suspicious Search</h2>' +
                    '<button class="cron-modal-close" id="reasonModalClose">&times;</button>' +
                '</div>' +
                '<div class="cron-modal-body" style="padding: 24px;">' +
                    '<div id="reasonModalContent">' +
                        '<div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; margin-bottom: 20px;">' +
                            '<div style="color: #00d4ff; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Search Name</div>' +
                            '<div id="reasonSearchName" style="color: #fff; font-size: 15px; font-weight: 500; word-break: break-word;"></div>' +
                        '</div>' +
                        '<div style="background: linear-gradient(135deg, rgba(248, 190, 52, 0.15) 0%, rgba(248, 190, 52, 0.05) 100%); border-left: 4px solid #f8be34; border-radius: 0 8px 8px 0; padding: 16px; margin-bottom: 20px;">' +
                            '<div style="color: #f8be34; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;"><span>⚠</span> Issue Detected</div>' +
                            '<div id="reasonDescription" style="color: #fff; font-size: 14px; line-height: 1.5;"></div>' +
                        '</div>' +
                        '<div style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(46, 204, 113, 0.05) 100%); border-left: 4px solid #2ecc71; border-radius: 0 8px 8px 0; padding: 16px;">' +
                            '<div style="color: #2ecc71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;"><span>💡</span> How to Fix</div>' +
                            '<div id="reasonSolutions" style="color: rgba(255,255,255,0.9); font-size: 13px; line-height: 1.6;"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="cron-modal-footer" style="background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.1);">' +
                    '<button class="btn btn-secondary" id="reasonModalCancel">Close</button>' +
                    '<button class="btn" style="background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border: none; color: white; font-weight: 500;" id="reasonModalResolve">✓ Mark Resolved</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    // OK (Whitelist) Confirmation Modal - requires note explaining why search is OK
    var okConfirmModalHtml =
        '<div class="cron-modal-overlay" id="okConfirmModalOverlay">' +
            '<div class="cron-modal" style="max-width: 500px;">' +
                '<div class="cron-modal-header" style="background: linear-gradient(135deg, rgba(83, 160, 81, 0.2) 0%, rgba(46, 160, 67, 0.1) 100%); border-bottom: 2px solid #53a051;">' +
                    '<h2 style="color: #fff; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px;"><span style="font-size: 22px;">✓</span>Mark Search as OK</h2>' +
                    '<button class="cron-modal-close" id="okConfirmModalClose">&times;</button>' +
                '</div>' +
                '<div class="cron-modal-body" style="padding: 24px;">' +
                    '<div id="okConfirmModalContent">' +
                        '<div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; margin-bottom: 20px;">' +
                            '<div style="color: #00d4ff; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Search Name</div>' +
                            '<div id="okConfirmSearchName" style="color: #fff; font-size: 15px; font-weight: 500; word-break: break-word;"></div>' +
                        '</div>' +
                        '<div style="margin-bottom: 20px;">' +
                            '<label style="color: rgba(255,255,255,0.9); font-size: 14px; display: block; margin-bottom: 10px;">' +
                                '<span style="color: #dc4e41;">*</span> Why is this search OK? <span style="color: rgba(255,255,255,0.5); font-size: 12px;">(Required)</span>' +
                            '</label>' +
                            '<textarea id="okConfirmNote" style="width: 100%; height: 100px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #fff; padding: 12px; font-size: 14px; resize: vertical;" placeholder="e.g., This search is essential for security monitoring and has been optimized to run efficiently."></textarea>' +
                        '</div>' +
                        '<div style="background: rgba(83, 160, 81, 0.15); border-left: 4px solid #53a051; border-radius: 0 8px 8px 0; padding: 12px; color: rgba(255,255,255,0.8); font-size: 13px;">' +
                            '<strong>What happens:</strong> This search will be whitelisted and will no longer appear as suspicious. The admin who approved it and the reason will be recorded.' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="cron-modal-footer" style="background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.1);">' +
                    '<button class="btn btn-secondary" id="okConfirmModalCancel">Cancel</button>' +
                    '<button class="btn" style="background: linear-gradient(135deg, #53a051 0%, #2ea043 100%); border: none; color: white; font-weight: 500;" id="okConfirmModalSave">✓ Mark as OK</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    // Search Query Preview Modal - shows the underlying search SPL
    var searchPreviewModalHtml =
        '<div class="cron-modal-overlay" id="searchPreviewModalOverlay">' +
            '<div class="cron-modal" style="max-width: 900px; width: 95%;">' +
                '<div class="cron-modal-header" style="background: linear-gradient(90deg, rgba(0, 212, 255, 0.15) 0%, transparent 100%);">' +
                    '<h2 style="color: #00d4ff;"><span style="margin-right: 8px;">🔍</span>Search Query Preview</h2>' +
                    '<button class="cron-modal-close" id="searchPreviewModalClose">&times;</button>' +
                '</div>' +
                '<div class="cron-modal-body" style="padding: 20px;">' +
                    '<div id="searchPreviewModalContent">' +
                        '<div class="search-preview-section" style="margin-bottom: 15px;">' +
                            '<div class="search-preview-label" style="color: rgba(255,255,255,0.6); font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Search Name</div>' +
                            '<div id="searchPreviewName" style="color: #00d4ff; font-size: 14px; font-weight: 600; word-break: break-word;"></div>' +
                        '</div>' +
                        '<div class="search-preview-section" style="margin-bottom: 15px;">' +
                            '<div style="display: flex; gap: 20px;">' +
                                '<div style="flex: 1;">' +
                                    '<div class="search-preview-label" style="color: rgba(255,255,255,0.6); font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Owner</div>' +
                                    '<div id="searchPreviewOwner" style="color: #ffffff; font-size: 13px;"></div>' +
                                '</div>' +
                                '<div style="flex: 1;">' +
                                    '<div class="search-preview-label" style="color: rgba(255,255,255,0.6); font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">App</div>' +
                                    '<div id="searchPreviewApp" style="color: #ffffff; font-size: 13px;"></div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="search-preview-section">' +
                            '<div class="search-preview-label" style="color: rgba(255,255,255,0.6); font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Search Query (SPL)</div>' +
                            '<div id="searchPreviewQuery" style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 15px; font-family: Monaco, Consolas, monospace; font-size: 12px; color: #e6e6e6; white-space: pre-wrap; word-break: break-word; max-height: 350px; overflow-y: auto; line-height: 1.5;"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="cron-modal-footer">' +
                    '<button class="btn btn-secondary" id="searchPreviewModalCancel">Close</button>' +
                    '<button class="btn" style="background: #00d4ff; border-color: #00d4ff; color: #000;" id="searchPreviewCopy">📋 Copy Query</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    var currentCronSearch = { name: '', cron: '', owner: '', app: '' };
    var currentImpactSearch = { name: '', owner: '', app: '' };
    var currentExtendSearches = [];
    var currentExtendDays = 7;
    var selectedRow = { searchName: '', owner: '', app: '', reason: '', tableType: '' };
    var selectedSearches = []; // Array for multi-select
    var currentReasonSearch = { name: '', reason: '' };
    var currentSearchPreview = { name: '', owner: '', app: '', query: '' };

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
        if (!$('#reasonModalOverlay').length) {
            $('body').append(reasonModalHtml);
        }
        if (!$('#okConfirmModalOverlay').length) {
            $('body').append(okConfirmModalHtml);
        }
        if (!$('#searchPreviewModalOverlay').length) {
            $('body').append(searchPreviewModalHtml);
        }

        // Reason modal events
        $(document).on('click', '#reasonModalClose, #reasonModalCancel', function() {
            $('#reasonModalOverlay').removeClass('active');
        });

        $(document).on('click', '#reasonModalOverlay', function(e) {
            if (e.target === this) {
                $('#reasonModalOverlay').removeClass('active');
            }
        });

        $(document).on('click', '#reasonModalResolve', function() {
            if (currentReasonSearch.name) {
                updateSearchStatus(currentReasonSearch.name, 'resolved');
                $('#reasonModalOverlay').removeClass('active');
            }
        });

        // OK Confirm modal events and data
        var currentOkSearch = { name: '', owner: '', app: '' };

        $(document).on('click', '#okConfirmModalClose, #okConfirmModalCancel', function() {
            $('#okConfirmModalOverlay').removeClass('active');
            currentOkSearch = { name: '', owner: '', app: '' };
        });

        $(document).on('click', '#okConfirmModalOverlay', function(e) {
            if (e.target === this) {
                $('#okConfirmModalOverlay').removeClass('active');
                currentOkSearch = { name: '', owner: '', app: '' };
            }
        });

        $(document).on('click', '#okConfirmModalSave', function() {
            var note = $('#okConfirmNote').val().trim();

            if (!note) {
                alert('Please provide a reason why this search is OK. This is required for audit purposes.');
                $('#okConfirmNote').focus();
                return;
            }

            if (!currentOkSearch.name) {
                alert('No search selected.');
                return;
            }

            // Add to ok_searches_lookup
            var now = Math.floor(Date.now() / 1000);
            var addQuery = '| inputlookup ok_searches_lookup ' +
                '| append [| makeresults ' +
                '| eval search_name="' + escapeString(currentOkSearch.name) + '"' +
                ', search_owner="' + escapeString(currentOkSearch.owner) + '"' +
                ', search_app="' + escapeString(currentOkSearch.app) + '"' +
                ', approved_by="' + escapeString(currentUser) + '"' +
                ', approved_time=' + now +
                ', notes="' + escapeString(note) + '"]' +
                '| dedup search_name ' +
                '| outputlookup ok_searches_lookup';

            showToast('Marking search as OK...');

            runSearch(addQuery, function(err, results) {
                if (err) {
                    console.error('Error marking search as OK:', err);
                    showToast('Error marking search as OK');
                } else {
                    logAction('approved_ok', currentOkSearch.name, 'Whitelisted: ' + note);
                    showToast('✓ ' + currentOkSearch.name + ' marked as OK');

                    // Remove from suspicious display
                    var $row = $('.metric-popup-row').filter(function() {
                        return $(this).find('td:eq(1)').text().trim() === currentOkSearch.name;
                    });
                    $row.fadeOut(300, function() { $(this).remove(); });

                    // Close modal
                    $('#okConfirmModalOverlay').removeClass('active');
                    currentOkSearch = { name: '', owner: '', app: '' };

                    // Refresh dashboard
                    refreshDashboard();
                }
            });
        });

        // Function to open OK confirm modal
        function openOkConfirmModal(searchName, owner, app) {
            currentOkSearch = { name: searchName, owner: owner, app: app };
            $('#okConfirmSearchName').text(searchName);
            $('#okConfirmNote').val('');
            $('#okConfirmModalOverlay').addClass('active');
        }

        window.openOkConfirmModal = openOkConfirmModal;

        // Search preview modal events
        $(document).on('click', '#searchPreviewModalClose, #searchPreviewModalCancel', function() {
            $('#searchPreviewModalOverlay').removeClass('active');
        });

        $(document).on('click', '#searchPreviewModalOverlay', function(e) {
            if (e.target === this) {
                $('#searchPreviewModalOverlay').removeClass('active');
            }
        });

        $(document).on('click', '#searchPreviewCopy', function() {
            var query = currentSearchPreview.query;
            if (query && navigator.clipboard) {
                navigator.clipboard.writeText(query).then(function() {
                    var $btn = $('#searchPreviewCopy');
                    var originalText = $btn.text();
                    $btn.text('✓ Copied!').css('background', '#53a051');
                    setTimeout(function() {
                        $btn.text(originalText).css('background', '#00d4ff');
                    }, 1500);
                });
            }
        });

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
            // Populate custom input with selected preset value
            $('#extendCustomDays').val(currentExtendDays);
            updateExtendPreview();
        });

        $(document).on('input change', '#extendCustomDays', function() {
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

        // Metric popup events - consolidated close handler
        $(document).on('click', '#metricPopupClose', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeMetricPopup();
        });

        $(document).on('click', '#metricPopupOverlay', function(e) {
            if (e.target === this) {
                closeMetricPopup();
            }
        });

        // Centralized close function
        function closeMetricPopup() {
            $('#metricPopupOverlay').removeClass('active');
            window.currentMetricType = null;

            // Clear countdown timer
            if (window.countdownTimerInterval) {
                clearInterval(window.countdownTimerInterval);
                window.countdownTimerInterval = null;
            }

            // Remove any overdue banner
            $('#overdueBanner').remove();
        }
        window.closeMetricPopup = closeMetricPopup;

        // Metric popup row click handler - SINGLE selection only
        $(document).on('click', '.metric-popup-row td', function(e) {
            // Don't process if clicking on status dropdown
            if ($(e.target).closest('.status-dropdown-wrapper').length > 0) {
                return;
            }

            var $row = $(this).closest('tr');
            var wasSelected = $row.hasClass('selected');

            // Remove selection from ALL rows first (single select only)
            $('.metric-popup-row').removeClass('selected');

            // If this row wasn't selected, select it now
            if (!wasSelected) {
                $row.addClass('selected');
            }
            // If it was already selected, it stays deselected (toggle behavior)

            // Update selection count display
            var selectedCount = $('.metric-popup-row.selected').length;
            var $footer = $('#metricPopupOverlay .metric-popup-footer');
            var $countDisplay = $footer.find('.selection-count');

            if (selectedCount > 0) {
                if ($countDisplay.length === 0) {
                    $footer.prepend('<span class="selection-count" style="color: #00d4ff; font-weight: 600; padding: 8px 12px; background: rgba(0,212,255,0.1); border-radius: 4px; margin-right: auto;">1 selected</span>');
                } else {
                    $countDisplay.text('1 selected');
                }
            } else {
                $countDisplay.remove();
            }
        });

        // Status dropdown click handler - show status change menu
        $(document).on('click', '.status-dropdown-wrapper', function(e) {
            e.preventDefault();
            e.stopPropagation();

            var $wrapper = $(this);
            var searchName = $wrapper.data('search');
            var owner = $wrapper.data('owner') || 'unknown';
            var app = $wrapper.data('app') || 'unknown';
            var currentStatus = $wrapper.data('current-status');

            // Remove any existing dropdown menu
            $('.status-dropdown-menu').remove();

            // Check if we're in suspicious modal OR if the row is marked as suspicious (unflagged searches)
            var isSuspiciousModal = window.currentMetricType === 'suspicious';
            var isSuspiciousRow = $wrapper.data('is-suspicious') === true || $wrapper.data('is-suspicious') === 'true';
            var isSuspicious = isSuspiciousModal || isSuspiciousRow;

            // Check if search is already flagged (OK/Suspicious statuses can only be flagged, others have full options)
            var isUnflagged = currentStatus && (currentStatus.toLowerCase() === 'ok' || currentStatus.toLowerCase() === 'suspicious');

            // Status options - varies based on whether this is suspicious (unflagged) or already flagged
            var statuses;
            if (isSuspicious) {
                // For suspicious unflagged searches: can Flag or mark as OK
                statuses = [
                    { value: 'flagged', label: 'Flag for Review', color: '#f1813f' },
                    { value: 'ok', label: 'OK (Whitelist)', color: '#53a051' }
                ];
            } else {
                // For already-flagged searches: full status options
                statuses = [
                    { value: 'flagged', label: 'Flagged', color: '#f1813f' },
                    { value: 'notified', label: 'Notified', color: '#f8be34' },
                    { value: 'review', label: 'Under Review', color: '#6f42c1' },
                    { value: 'disabled', label: 'Disabled', color: '#dc4e41' },
                    { value: 'resolved', label: 'Resolved (Unflag)', color: '#53a051' }
                ];
            }

            var menuHtml = '<div class="status-dropdown-menu" style="position: absolute; z-index: 10000; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); min-width: 160px; max-height: 250px; overflow-y: auto;">';
            statuses.forEach(function(s) {
                var isSelected = currentStatus && currentStatus.toLowerCase().indexOf(s.value) > -1;
                menuHtml += '<div class="status-option" data-status="' + s.value + '" data-search="' + escapeHtml(searchName) + '" data-owner="' + escapeHtml(owner) + '" data-app="' + escapeHtml(app) + '" data-is-suspicious="' + (isSuspiciousModal ? 'true' : 'false') + '" style="padding: 8px 12px; cursor: pointer; color: ' + s.color + '; border-bottom: 1px solid #333;' + (isSelected ? ' background: rgba(255,255,255,0.1);' : '') + '">' +
                    (isSelected ? '✓ ' : '') + s.label + '</div>';
            });
            menuHtml += '</div>';

            $wrapper.append(menuHtml);

            // Smart positioning - flip to above if not enough space below
            var $menu = $wrapper.find('.status-dropdown-menu');
            var wrapperOffset = $wrapper.offset();
            var wrapperHeight = $wrapper.outerHeight();
            var menuHeight = $menu.outerHeight();
            var viewportHeight = $(window).height();
            var scrollTop = $(window).scrollTop();
            var spaceBelow = viewportHeight - (wrapperOffset.top - scrollTop + wrapperHeight);
            var spaceAbove = wrapperOffset.top - scrollTop;

            if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
                // Not enough space below, flip to above
                $menu.css({ bottom: '100%', top: 'auto' });
            } else {
                // Default: show below
                $menu.css({ top: '100%', bottom: 'auto' });
            }

            // Close menu when clicking elsewhere
            $(document).one('click', function() {
                $('.status-dropdown-menu').remove();
            });
        });

        // Handle status option selection
        $(document).on('click', '.status-option', function(e) {
            e.preventDefault();
            e.stopPropagation();

            var newStatus = $(this).data('status');
            var searchName = $(this).data('search');
            var owner = $(this).data('owner') || 'unknown';
            var app = $(this).data('app') || 'unknown';
            var isSuspicious = $(this).data('is-suspicious') === 'true' || $(this).data('is-suspicious') === true;

            // Also get parent wrapper's current status to check if unflagged
            var $wrapper = $(this).closest('.status-dropdown-wrapper');
            var currentStatus = $wrapper.data('current-status') || '';
            var currentStatusLower = currentStatus.toLowerCase();
            var isUnflagged = currentStatusLower === 'ok' || currentStatusLower === 'suspicious';

            // Check if already flagged (pending, notified, disabled, review states)
            var isAlreadyFlagged = currentStatusLower === 'flagged' ||
                                   currentStatusLower === 'pending' ||
                                   currentStatusLower === 'notified' ||
                                   currentStatusLower === 'disabled' ||
                                   currentStatusLower === 'review' ||
                                   currentStatusLower.indexOf('pending') > -1 ||
                                   currentStatusLower.indexOf('disabled') > -1;

            // Close menu
            $('.status-dropdown-menu').remove();

            // If "OK" selected, open confirmation modal with note requirement
            if (newStatus === 'ok') {
                openOkConfirmModal(searchName, owner, app);
                return;
            }

            // If trying to flag an already flagged search, show error
            if (newStatus === 'flagged' && isAlreadyFlagged) {
                alert('This search is already flagged.\n\nCurrent status: ' + currentStatus + '\n\nUse a different status option to change its state.');
                return;
            }

            showToast('Updating status...');

            var updateQuery;

            if ((isSuspicious || isUnflagged) && newStatus === 'flagged') {
                // For suspicious (unflagged) searches, we need to CREATE a new entry in the lookup
                // NOTE: deadline is 0 until admin sends notification (then it gets set)
                var now = Math.floor(Date.now() / 1000);
                var reason = "Suspicious pattern detected";

                updateQuery = '| inputlookup flagged_searches_lookup ' +
                    '| append [| makeresults | eval search_name="' + escapeString(searchName) + '", ' +
                    'search_owner="' + escapeString(owner) + '", ' +
                    'search_app="' + escapeString(app) + '", ' +
                    'flagged_by="' + escapeString(currentUser) + '", ' +
                    'flagged_time=' + now + ', ' +
                    'notification_sent=0, ' +
                    'notification_time=0, ' +
                    'remediation_deadline=0, ' +
                    'status="flagged", ' +
                    'reason="' + escapeString(reason) + '", ' +
                    'notes="" | fields - _time] ' +
                    '| dedup search_name ' +
                    '| outputlookup flagged_searches_lookup';
            } else {
                // For already flagged searches, just update the status
                updateQuery = '| inputlookup flagged_searches_lookup ' +
                    '| eval status = if(search_name="' + escapeString(searchName) + '", "' + newStatus + '", status)' +
                    '| outputlookup flagged_searches_lookup';
            }

            runSearch(updateQuery, function(err, results) {
                if (err) {
                    showToast('Error updating status');
                } else {
                    logAction('status_changed', searchName, 'Status changed to ' + newStatus);
                    showToast('✓ Status updated to ' + newStatus);

                    // Update the badge in the UI
                    var $wrapper = $('.status-dropdown-wrapper[data-search="' + searchName + '"]');
                    $wrapper.data('current-status', newStatus);
                    $wrapper.find('.status-badge').parent().html(getStatusBadges(newStatus) + '<span style="margin-left: 4px; font-size: 10px; opacity: 0.7;">▼</span>');

                    // Refresh dashboard to update counts
                    if (newStatus === 'resolved' || isSuspicious || isUnflagged) {
                        refreshDashboard();
                        // Close modal since item should be gone from current view
                        if (isSuspicious && !isUnflagged) {
                            setTimeout(function() {
                                $('#metricPopupOverlay').removeClass('active');
                            }, 500);
                        }
                    }
                }
            });
        });

        // Metric popup Flag button - for flagging suspicious unflagged searches
        $(document).on('click', '#metricPopupFlag', function() {
            var selectedSearches = getSelectedMetricSearches();
            if (selectedSearches.length === 0) {
                alert('Please select at least one search to flag.');
                return;
            }

            // Filter out already flagged searches (pending, notified, disabled, review)
            var unflaggedSearches = selectedSearches.filter(function(s) {
                var status = (s.status || '').toLowerCase();
                return status !== 'pending' && status !== 'notified' && status !== 'disabled' &&
                       status !== 'review' && status !== 'flagged' &&
                       status.indexOf('pending') === -1 && status.indexOf('disabled') === -1;
            });

            if (unflaggedSearches.length === 0) {
                alert('All selected searches are already flagged.\n\nPlease select unflagged searches or use the Flagged view to manage existing flags.');
                return;
            }

            // Warn if some were already flagged
            if (unflaggedSearches.length < selectedSearches.length) {
                var alreadyFlagged = selectedSearches.length - unflaggedSearches.length;
                if (!confirm(alreadyFlagged + ' search(es) are already flagged and will be skipped.\n\nProceed to flag ' + unflaggedSearches.length + ' remaining search(es)?')) {
                    return;
                }
            }

            console.log('Flagging searches from metric popup:', unflaggedSearches);

            // Close metric popup
            $('#metricPopupOverlay').removeClass('active');

            // Use only unflagged searches from this point
            selectedSearches = unflaggedSearches;

            var reason = "Suspicious pattern detected";
            var remediationDays = CONFIG.remediationDays || 7;
            var now = Math.floor(Date.now() / 1000);
            var remediationDeadline = now + (remediationDays * 86400);

            showToast('Flagging ' + selectedSearches.length + ' search(es)...');

            // Build SINGLE batch query to flag all searches at once (prevents race conditions)
            // Each entry must be in its own append subsearch to union the results
            var appendParts = selectedSearches.map(function(search) {
                return '| append [| makeresults ' +
                    '| eval search_name="' + escapeString(search.name) + '"' +
                    ', search_owner="' + escapeString(search.owner || 'unknown') + '"' +
                    ', search_app="' + escapeString(search.app || 'unknown') + '"' +
                    ', flagged_by="' + escapeString(currentUser) + '"' +
                    ', flagged_time=' + now +
                    ', notification_sent=0' +
                    ', notification_time=0' +
                    ', remediation_deadline=' + remediationDeadline +
                    ', status="pending"' +
                    ', reason="' + escapeString(reason) + '"' +
                    ', notes=""]';
            });

            // Build list of search names to exclude existing entries (prevents duplicates)
            var searchNamesList = selectedSearches.map(function(s) {
                return '"' + escapeString(s.name) + '"';
            }).join(', ');

            // Single query: read existing (excluding these searches) + append all new entries
            var batchQuery = '| inputlookup flagged_searches_lookup ' +
                '| search NOT search_name IN (' + searchNamesList + ') ' +
                appendParts.join(' ') +
                '| table search_name, search_owner, search_app, flagged_by, flagged_time, notification_sent, notification_time, remediation_deadline, status, reason, notes ' +
                '| outputlookup flagged_searches_lookup';

            console.log('Batch flagging ' + selectedSearches.length + ' searches in single query');

            runSearch(batchQuery, function(err, results) {
                if (err) {
                    console.error('Error batch flagging searches:', err);
                    showToast('Error flagging searches');
                    return;
                }

                // Log each action
                selectedSearches.forEach(function(search) {
                    logAction('flagged', search.name, reason);
                });

                showToast('✓ Flagged ' + selectedSearches.length + ' search(es) for governance review');
                refreshDashboard();

                // Build list for extend modal
                var flaggedSearchesForExtend = selectedSearches.map(function(search) {
                    return {
                        searchName: search.name,
                        owner: search.owner,
                        app: search.app,
                        status: 'pending',
                        deadlineEpoch: remediationDeadline,
                        daysRemaining: remediationDays
                    };
                });

                // Offer to extend deadline or view in flagged modal
                setTimeout(function() {
                    var action = confirm(
                        'Successfully flagged ' + selectedSearches.length + ' search(es) with a ' + remediationDays + '-day deadline.\n\n' +
                        'Would you like to adjust the deadline now?\n\n' +
                        'Click OK to open the Extend Deadline modal.\n' +
                        'Click Cancel to view in the Flagged modal.'
                    );

                    if (action) {
                        openExtendModal(flaggedSearchesForExtend);
                    } else {
                        openMetricPopup('flagged', selectedSearches.length, 'Currently Flagged');
                    }
                }, 500);
            });
        });

        // Metric popup Disable button
        $(document).on('click', '#metricPopupDisable', function() {
            var selectedSearches = getSelectedMetricSearches();
            if (selectedSearches.length === 0) {
                alert('Please select at least one search to disable.');
                return;
            }

            if (!confirm('Are you sure you want to disable ' + selectedSearches.length + ' search(es)?')) {
                return;
            }

            console.log('Disabling searches:', selectedSearches);

            var successCount = 0;
            var failCount = 0;
            var totalCount = selectedSearches.length;

            // Get locale from current URL or use empty string for relative path
            var locale = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})\//);
            var localePrefix = locale ? '/' + locale[1] : '';

            // Disable each search via REST API using /disable endpoint
            // See: https://docs.splunk.com/Documentation/SplunkCloud/latest/RESTREF/RESTsearch
            selectedSearches.forEach(function(search, idx) {
                // Try multiple contexts for better compatibility
                var contexts = [
                    { owner: search.owner, app: search.app },
                    { owner: 'nobody', app: search.app },
                    { owner: '-', app: search.app }
                ];

                function tryDisable(ctxIndex) {
                    if (ctxIndex >= contexts.length) {
                        console.error('All disable attempts failed for:', search.name);
                        failCount++;
                        if (successCount + failCount === totalCount) {
                            showDisableComplete(successCount, failCount);
                        }
                        return;
                    }

                    var ctx = contexts[ctxIndex];
                    var disableUrl = localePrefix + '/splunkd/__raw/servicesNS/' + encodeURIComponent(ctx.owner) + '/' + encodeURIComponent(ctx.app) + '/saved/searches/' + encodeURIComponent(search.name) + '/disable';

                    console.log('Trying disable URL (' + (ctxIndex + 1) + '/' + contexts.length + '):', disableUrl);

                    $.ajax({
                        url: disableUrl,
                        type: 'POST',
                        data: {},  // No data needed for /disable endpoint
                        success: function() {
                            console.log('Successfully disabled:', search.name, 'using context:', ctx);
                            successCount++;

                            // Update the lookup status to "disabled" so it persists when modal reopens
                            var updateQuery = '| inputlookup flagged_searches_lookup | eval status=if(search_name="' + escapeString(search.name) + '", "disabled", status) | outputlookup flagged_searches_lookup';
                            runSearch(updateQuery, function(err) {
                                if (err) {
                                    console.error('Failed to update lookup for:', search.name, err);
                                } else {
                                    console.log('Updated lookup status to disabled for:', search.name);
                                }
                            });

                            // Also update the governance_search_cache.csv to mark as disabled
                            var updateCacheQuery = '| inputlookup governance_search_cache.csv | eval disabled=if(title="' + escapeString(search.name) + '", "1", disabled) | outputlookup governance_search_cache.csv';
                            runSearch(updateCacheQuery, function(err) {
                                if (err) {
                                    console.error('Failed to update cache for:', search.name, err);
                                }
                            });

                            updateDisabledRowUI(search);
                            if (successCount + failCount === totalCount) {
                                showDisableComplete(successCount, failCount);
                            }
                        },
                        error: function(xhr) {
                            console.log('Disable failed for context', ctx, 'Status:', xhr.status);
                            // Try next context
                            tryDisable(ctxIndex + 1);
                        }
                    });
                }

                // Helper to update row UI after successful disable
                function updateDisabledRowUI(search) {
                    var $row = $('.metric-popup-row[data-search-name="' + escapeHtml(search.name).replace(/"/g, '\\"') + '"]');
                    if ($row.length === 0) {
                        $row = $('.metric-popup-row').filter(function() {
                            return $(this).find('td:eq(1)').text().trim() === search.name;
                        });
                    }

                    if ($row.length > 0) {
                        var $statusCell = $row.find('.status-cell');
                        var currentBadges = $statusCell.html() || '';

                        var wasFlagged = currentBadges.indexOf('FLAGGED') > -1 ||
                                         currentBadges.indexOf('NOTIFIED') > -1 ||
                                         currentBadges.indexOf('EXPIRING') > -1 ||
                                         currentBadges.indexOf('SUSPICIOUS') > -1;

                        var newBadges = '';
                        if (wasFlagged) {
                            newBadges = '<div style="display: flex; flex-direction: column; gap: 4px;">' +
                                '<div>' +
                                    '<span class="status-badge flagged" style="background: #f8991d; color: #000; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 4px;">FLAGGED</span>' +
                                    '<span class="status-badge disabled" style="background: #dc4e41; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;">DISABLED</span>' +
                                '</div>' +
                                '<span style="font-size: 10px; color: #f8991d; font-style: italic;">⚠ Needs unflagging</span>' +
                            '</div>';
                            $row.addClass('needs-unflag');
                            $row.css({ 'background-color': 'rgba(248, 153, 29, 0.15)', 'border-left': '3px solid #f8991d' });
                        } else {
                            newBadges = '<span class="status-badge disabled" style="background: #dc4e41; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;">DISABLED</span>';
                            $row.css({ 'background-color': 'rgba(220, 78, 65, 0.1)', 'opacity': '0.8' });
                        }

                        $statusCell.html(newBadges);
                        $row.css('background-color', 'rgba(220, 78, 65, 0.4)');
                        setTimeout(function() {
                            $row.css('background-color', wasFlagged ? 'rgba(248, 153, 29, 0.15)' : 'rgba(220, 78, 65, 0.1)');
                        }, 1500);
                        $row.find('.metric-row-checkbox').prop('checked', false);
                        $row.find('td:eq(1)').css('text-decoration', 'line-through');
                    }
                }

                // Start disable attempt
                tryDisable(0);
            });

            // Log the action
            logGovernanceAction('disable', selectedSearches.map(function(s) { return s.name; }).join(', '), 'admin', 'Disabled via metric modal');
        });

        // Metric popup Enable button - re-enable disabled searches
        $(document).on('click', '#metricPopupEnable', function() {
            var selectedSearches = getSelectedMetricSearches();
            if (selectedSearches.length === 0) {
                alert('Please select at least one search to enable.');
                return;
            }

            // Filter to only disabled searches (case-insensitive)
            var disabledSearches = selectedSearches.filter(function(s) {
                return s.status && s.status.toLowerCase() === 'disabled';
            });

            if (disabledSearches.length === 0) {
                alert('No disabled searches selected. Select searches with DISABLED status to enable them.');
                return;
            }

            if (!confirm('Are you sure you want to re-enable ' + disabledSearches.length + ' search(es)?\n\nThis will allow them to run on their schedule again.')) {
                return;
            }

            console.log('Enabling searches:', disabledSearches);

            var successCount = 0;
            var failCount = 0;
            var failedSearches = [];
            var totalCount = disabledSearches.length;

            // Get locale from current URL or use empty string for relative path
            var locale = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})\//);
            var localePrefix = locale ? '/' + locale[1] : '';

            // Helper function to try enabling a search with fallback contexts
            // Uses Splunk REST API /enable endpoint as per documentation
            // See: https://docs.splunk.com/Documentation/SplunkCloud/latest/RESTREF/RESTsearch
            function tryEnableSearch(search, contexts, contextIndex, onSuccess, onAllFailed) {
                if (contextIndex >= contexts.length) {
                    onAllFailed();
                    return;
                }

                var ctx = contexts[contextIndex];
                // Use /enable endpoint as recommended by Splunk REST API documentation
                var enableUrl = localePrefix + '/splunkd/__raw/servicesNS/' + encodeURIComponent(ctx.owner) + '/' + encodeURIComponent(ctx.app) + '/saved/searches/' + encodeURIComponent(search.name) + '/enable';

                console.log('Trying enable URL (' + (contextIndex + 1) + '/' + contexts.length + ') for ' + search.name + ':', enableUrl);

                $.ajax({
                    url: enableUrl,
                    type: 'POST',
                    data: {},  // No data needed for /enable endpoint
                    success: function() {
                        console.log('Successfully enabled:', search.name, 'using context:', ctx);
                        onSuccess();
                    },
                    error: function(xhr) {
                        console.log('Enable failed for context', ctx, 'Status:', xhr.status);
                        // Try next context
                        tryEnableSearch(search, contexts, contextIndex + 1, onSuccess, onAllFailed);
                    }
                });
            }

            // Enable each search via REST API and update lookup
            disabledSearches.forEach(function(search, idx) {
                // Build list of contexts to try (original, then fallbacks)
                // Using 'nobody' for shared resources as per Splunk best practices
                var contexts = [
                    { owner: search.owner, app: search.app },
                    { owner: 'nobody', app: search.app },  // Shared app context
                    { owner: search.owner, app: 'search' },  // Default search app
                    { owner: '-', app: search.app },  // Any owner (wildcard)
                    { owner: '-', app: '-' }  // Any owner, any app (wildcard)
                ];

                // Remove duplicates
                var seenContexts = {};
                contexts = contexts.filter(function(ctx) {
                    var key = ctx.owner + '|' + ctx.app;
                    if (seenContexts[key]) return false;
                    seenContexts[key] = true;
                    return true;
                });

                console.log('Enable contexts for ' + search.name + ':', contexts);

                tryEnableSearch(search, contexts, 0,
                    // onSuccess
                    function() {
                        successCount++;

                        // Update the lookup status from "disabled" to "enabled"
                        var updateQuery = '| inputlookup flagged_searches_lookup | eval status=if(search_name="' + escapeString(search.name) + '", "enabled", status) | outputlookup flagged_searches_lookup';
                        runSearch(updateQuery, function(err) {
                            if (err) {
                                console.error('Failed to update lookup for:', search.name, err);
                            }
                        });

                        // Update the row's status badge to show NOTIFIED instead of DISABLED
                        var $row = $('.metric-popup-row[data-search-name="' + escapeHtml(search.name).replace(/"/g, '\\"') + '"]');
                        if ($row.length === 0) {
                            $row = $('.metric-popup-row').filter(function() {
                                return $(this).find('td:eq(1)').text().trim() === search.name;
                            });
                        }

                        if ($row.length > 0) {
                            var $statusCell = $row.find('.status-cell');
                            var newBadges = '<span class="status-badge enabled" style="background: #2ea043; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;">ENABLED</span>';
                            $statusCell.html(newBadges);
                            $row.removeClass('needs-unflag');
                            $row.css({
                                'background-color': '',
                                'border-left': '',
                                'opacity': ''
                            });
                            $row.find('td:eq(1)').css('text-decoration', '');
                            $row.css('background-color', 'rgba(46, 160, 67, 0.4)');
                            setTimeout(function() {
                                $row.css('background-color', '');
                            }, 1500);

                            var index = parseInt($row.attr('data-index'));
                            if (currentMetricSearches[index]) {
                                currentMetricSearches[index].status = 'enabled';
                            }
                        }

                        if (successCount + failCount === totalCount) {
                            showEnableComplete(successCount, failCount, failedSearches);
                            updateEnableButtonVisibility();
                        }
                    },
                    // onAllFailed
                    function() {
                        console.error('All enable attempts failed for:', search.name);
                        failCount++;
                        failedSearches.push({
                            name: search.name,
                            owner: search.owner,
                            app: search.app,
                            status: 404,
                            reason: 'Search not found in any context - may have been deleted or moved'
                        });

                        if (successCount + failCount === totalCount) {
                            showEnableComplete(successCount, failCount, failedSearches);
                            updateEnableButtonVisibility();
                        }
                    }
                );
            });

            // Log the action
            logGovernanceAction('enable', disabledSearches.map(function(s) { return s.name; }).join(', '), 'admin', 'Re-enabled via metric modal');
        });

        // Show completion message for enable action
        function showEnableComplete(successCount, failCount, failedSearches) {
            var $footer = $('#metricPopupOverlay .metric-popup-footer');
            var $msg = $footer.find('.enable-message');
            if ($msg.length === 0) {
                $msg = $('<div class="enable-message" style="margin-right: auto; font-weight: 600;"></div>');
                $footer.prepend($msg);
            }

            var html = '';
            if (failCount === 0) {
                html = '<span style="color: #5cc05c;">✓ ' + successCount + ' search(es) re-enabled</span>';
            } else {
                html = '<span style="color: #f8991d;">' + successCount + ' enabled, ' + failCount + ' failed</span>';
                // Show detailed failure info
                if (failedSearches && failedSearches.length > 0) {
                    var failDetails = failedSearches.map(function(f) {
                        return f.name + ': ' + f.reason;
                    }).join('\n');
                    console.error('Failed searches:', failDetails);
                    // Add hover tooltip with failure details
                    html += '<span style="margin-left: 8px; cursor: help; color: #dc4e41;" title="' + escapeHtml(failDetails) + '">ⓘ</span>';
                }
            }

            $msg.html(html);
            setTimeout(function() {
                $msg.fadeOut(function() { $(this).remove(); });
            }, 5000);
        }

        // Update Enable button visibility based on disabled searches in modal
        function updateEnableButtonVisibility() {
            var hasDisabled = currentMetricSearches.some(function(s) {
                return s.status === 'disabled';
            });
            if (hasDisabled) {
                $('#metricPopupEnable').show();
            } else {
                $('#metricPopupEnable').hide();
            }
        }

        // Update all review-related button visibility based on search statuses
        function updateReviewButtonsVisibility() {
            var hasDisabled = currentMetricSearches.some(function(s) {
                return s.status === 'disabled';
            });
            var hasPendingOrNotified = currentMetricSearches.some(function(s) {
                return s.status === 'pending' || s.status === 'notified';
            });
            var hasReview = currentMetricSearches.some(function(s) {
                return s.status === 'review';
            });

            // Enable button - show if any disabled
            if (hasDisabled) {
                $('#metricPopupEnable').show();
            } else {
                $('#metricPopupEnable').hide();
            }

            // Submit for Review button - show if any pending/notified (can submit remediation for review)
            if (hasPendingOrNotified) {
                $('#metricPopupSubmitReview').show();
            } else {
                $('#metricPopupSubmitReview').hide();
            }

            // Approve & Reject buttons - show if any in review status (admin actions)
            if (hasReview) {
                $('#metricPopupApprove').show();
                $('#metricPopupReject').show();
            } else {
                $('#metricPopupApprove').hide();
                $('#metricPopupReject').hide();
            }
        }

        // Show/hide buttons based on metric type (suspicious unflagged vs flagged)
        function updateMetricTypeButtons(metricType) {
            // Hide all action buttons first, then show relevant ones
            $('#metricPopupFlag').hide();
            $('#metricPopupNotify').hide();
            $('#metricPopupUnflag').hide();
            $('#metricPopupExtend').hide();
            $('#metricPopupDisable').hide();

            if (metricType === 'suspicious') {
                // For suspicious unflagged searches: show Flag only
                $('#metricPopupFlag').show();
            } else if (metricType === 'flagged' || metricType === 'expiring') {
                // For flagged/expiring searches: show Notify, Extend, Disable, Unflag
                // Notify = send notification to user (starts timer)
                // Extend = add more days to deadline (only for notified searches)
                $('#metricPopupNotify').show();
                $('#metricPopupUnflag').show();
                $('#metricPopupExtend').show();
                $('#metricPopupDisable').show();
            } else if (metricType === 'disabled') {
                // For disabled searches: show Unflag/Enable
                $('#metricPopupUnflag').show();
            } else {
                // Default (total): show Disable only
                $('#metricPopupDisable').show();
            }
        }

        // Show completion message for disable action
        function showDisableComplete(successCount, failCount) {
            var $footer = $('#metricPopupOverlay .metric-popup-footer');
            var $msg = $footer.find('.disable-message');
            if ($msg.length === 0) {
                $msg = $('<div class="disable-message" style="margin-right: auto; font-weight: 600;"></div>');
                $footer.prepend($msg);
            }

            // Count items needing unflag
            var needsUnflagCount = $('.metric-popup-row.needs-unflag').length;

            var html = '';
            if (failCount === 0) {
                html = '<span style="color: #5cc05c;">' + successCount + ' search(es) disabled</span>';
            } else {
                html = '<span style="color: #f8991d;">' + successCount + ' disabled, ' + failCount + ' failed</span>';
            }

            if (needsUnflagCount > 0) {
                html += '<br><span style="color: #f8991d; font-size: 12px;">⚠ ' + needsUnflagCount + ' flagged item(s) now need unflagging</span>';
            }

            $msg.html(html);

            // Refresh the dashboard to update the underlying table with new status
            refreshDashboard();

            // Don't auto-clear if there are items needing attention
            if (needsUnflagCount === 0) {
                setTimeout(function() {
                    $msg.fadeOut(function() { $(this).remove(); });
                }, 5000);
            }
        }

        // Metric popup Unflag button - remove searches from flagged list
        $(document).on('click', '#metricPopupUnflag', function() {
            var selectedSearches = getSelectedMetricSearches();
            if (selectedSearches.length === 0) {
                alert('Please select at least one search to unflag.');
                return;
            }

            if (!confirm('Are you sure you want to unflag ' + selectedSearches.length + ' search(es)?\n\nThis will remove them from governance tracking.')) {
                return;
            }

            console.log('Unflagging searches:', selectedSearches);

            // Build condition for removing from lookup
            var conditions = selectedSearches.map(function(s) {
                return 'search_name!="' + escapeString(s.name) + '"';
            }).join(' AND ');

            var unflagQuery = '| inputlookup flagged_searches_lookup | where ' + conditions + ' | outputlookup flagged_searches_lookup';

            showToast('Unflagging ' + selectedSearches.length + ' search(es)...');

            runSearch(unflagQuery, function(err, results) {
                if (err) {
                    console.error('Error unflagging:', err);
                    showToast('Error unflagging searches');
                } else {
                    // Log actions
                    selectedSearches.forEach(function(s) {
                        logAction('unflagged', s.name, 'Removed from governance tracking');
                    });

                    showToast('✓ Unflagged ' + selectedSearches.length + ' search(es)');

                    // Update UI - remove unflagged rows from modal
                    selectedSearches.forEach(function(s) {
                        var $row = $('.metric-popup-row').filter(function() {
                            return $(this).find('td:eq(1)').text().trim() === s.name;
                        });
                        $row.fadeOut(300, function() { $(this).remove(); });
                    });

                    // Refresh dashboard
                    refreshDashboard();
                }
            });
        });

        // Metric popup Notify button - sends notification to user and starts timer
        $(document).on('click', '#metricPopupNotify', function() {
            var selectedSearches = getSelectedMetricSearches();
            if (selectedSearches.length === 0) {
                alert('Please select at least one search to notify.');
                return;
            }

            // Filter to only searches with status "flagged" (not yet notified)
            var flaggedSearches = selectedSearches.filter(function(s) {
                var status = (s.status || '').toLowerCase();
                return status === 'flagged' || status === 'pending';
            });

            if (flaggedSearches.length === 0) {
                alert('No searches awaiting notification.\n\nOnly searches with status "Flagged" can be notified.\nSearches already notified will have their timer running.');
                return;
            }

            // Build email preview message
            var emailPreview = flaggedSearches.map(function(s) {
                return '📧 To: ' + s.owner + '@' + CONFIG.emailDomain + '\n' +
                       '   Subject: Action Required: Scheduled Search Flagged\n' +
                       '   Search: "' + s.name + '"\n' +
                       '   Reason: ' + (s.reason || 'Flagged by administrator') + '\n' +
                       '   Days to remediate: ' + CONFIG.remediationDays;
            }).join('\n\n');

            if (!confirm('Send notification to ' + flaggedSearches.length + ' search owner(s)?\n\n' +
                         'This will:\n' +
                         '• Change status from "Flagged" to "Notified"\n' +
                         '• Start the ' + CONFIG.remediationDays + '-day remediation timer\n\n' +
                         'EMAIL PREVIEW:\n' + emailPreview)) {
                return;
            }

            console.log('Notifying users for searches:', flaggedSearches);

            // Calculate new deadline
            var now = Math.floor(Date.now() / 1000);
            var deadline = now + (CONFIG.remediationDays * 24 * 60 * 60);

            // Build update query - change status to "notified" and set deadline
            var searchNamesList = flaggedSearches.map(function(s) { return '"' + escapeString(s.name) + '"'; }).join(', ');

            var updateQuery = '| inputlookup flagged_searches_lookup ' +
                '| eval status = if(search_name IN (' + searchNamesList + ') AND (status="flagged" OR status="pending"), "notified", status) ' +
                '| eval remediation_deadline = if(search_name IN (' + searchNamesList + ') AND (status="notified"), ' + deadline + ', remediation_deadline) ' +
                '| eval notification_sent = if(search_name IN (' + searchNamesList + '), 1, notification_sent) ' +
                '| eval notification_time = if(search_name IN (' + searchNamesList + ') AND notification_time=0, ' + now + ', notification_time) ' +
                '| outputlookup flagged_searches_lookup';

            showToast('Notifying ' + flaggedSearches.length + ' user(s)...');

            runSearch(updateQuery, function(err, results) {
                if (err) {
                    console.error('Error notifying users:', err);
                    showToast('Error sending notifications');
                } else {
                    // Log actions
                    flaggedSearches.forEach(function(s) {
                        logAction('notified', s.name, 'User notification sent, timer started');
                    });

                    // Show success toast with email simulation
                    showToast('✓ Notified ' + flaggedSearches.length + ' user(s) - Timer started (' + CONFIG.remediationDays + ' days)');

                    // Update UI - change status badge and show countdown
                    flaggedSearches.forEach(function(s) {
                        var $row = $('.metric-popup-row').filter(function() {
                            return $(this).find('td:eq(1)').text().trim() === s.name;
                        });

                        if ($row.length) {
                            // Update status badge
                            var $statusCell = $row.find('.status-cell');
                            var newBadgeHtml = '<div class="status-dropdown-wrapper" data-search="' + escapeHtml(s.name) + '" data-owner="' + escapeHtml(s.owner) + '" data-app="' + escapeHtml(s.app) + '" data-current-status="notified" style="cursor: pointer; position: relative;" title="Click to change status">' +
                                '<span class="status-badge notified" style="background: #f8be34; color: #000; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;">NOTIFIED</span>' +
                                '<span style="margin-left: 4px; font-size: 10px; opacity: 0.7;">▼</span>' +
                                '</div>';
                            $statusCell.html(newBadgeHtml);

                            // Update countdown cell
                            var $countdownCell = $row.find('.countdown-cell');
                            if ($countdownCell.length) {
                                $countdownCell.attr('data-deadline', deadline);
                                $countdownCell.html(formatCountdownTimer(deadline, 'notified'));
                            }

                            // Update row data
                            $row.attr('data-current-status', 'notified');
                            $row.removeClass('selected');
                        }
                    });

                    // Restart countdown timer to pick up new deadlines
                    startCountdownTimer();

                    // Refresh dashboard
                    refreshDashboard();
                }
            });
        });

        // Metric popup Extend button
        $(document).on('click', '#metricPopupExtend', function() {
            var selectedSearches = getSelectedMetricSearches();
            if (selectedSearches.length === 0) {
                alert('Please select at least one search to extend.');
                return;
            }

            // Check if any selected searches are NOT flagged (must be in pending/notified/disabled/review status)
            var flaggedStatuses = ['pending', 'notified', 'disabled', 'review', 'flagged', 'expiring'];
            var nonFlaggedSearches = selectedSearches.filter(function(s) {
                var status = (s.status || '').toLowerCase();
                return !flaggedStatuses.some(function(fs) { return status.indexOf(fs) > -1; });
            });

            if (nonFlaggedSearches.length > 0) {
                var names = nonFlaggedSearches.map(function(s) { return s.name; }).join('\n• ');
                alert('Cannot extend deadline: The following search(es) are not flagged:\n\n• ' + names + '\n\nOnly flagged searches can have their deadline extended. Please flag these searches first.');
                return;
            }

            // Map metric popup format (name, owner, app) to expected format (searchName, owner, app)
            // Include deadlineEpoch for negative extension validation
            var mappedSearches = selectedSearches.map(function(s) {
                return {
                    searchName: s.name,
                    owner: s.owner,
                    app: s.app,
                    status: s.status,
                    deadlineEpoch: s.deadlineEpoch,
                    daysRemaining: s.daysRemaining
                };
            });

            // Close metric popup and open extend modal
            $('#metricPopupOverlay').removeClass('active');
            openExtendModal(mappedSearches);
        });

        // Submit for Review button - allows users to submit remediated searches for admin review
        $(document).on('click', '#metricPopupSubmitReview', function() {
            var selectedSearches = getSelectedMetricSearches();
            if (selectedSearches.length === 0) {
                alert('Please select at least one search to submit for review.');
                return;
            }

            // Filter to only pending/notified searches (not disabled or already in review)
            var eligibleSearches = selectedSearches.filter(function(s) {
                return s.status === 'pending' || s.status === 'notified';
            });

            if (eligibleSearches.length === 0) {
                alert('No eligible searches selected. Only flagged/notified searches can be submitted for review.');
                return;
            }

            if (!confirm('Submit ' + eligibleSearches.length + ' search(es) for admin review?\n\nThis will pause the remediation timer while an admin reviews your changes.\n\nSearches:\n• ' + eligibleSearches.map(function(s) { return s.name; }).join('\n• '))) {
                return;
            }

            submitForReview(eligibleSearches);
        });

        // Approve & Unflag button - admin action to approve reviewed searches
        $(document).on('click', '#metricPopupApprove', function() {
            var selectedSearches = getSelectedMetricSearches();
            if (selectedSearches.length === 0) {
                alert('Please select at least one search to approve.');
                return;
            }

            // Filter to only searches in review status
            var reviewSearches = selectedSearches.filter(function(s) {
                return s.status === 'review';
            });

            if (reviewSearches.length === 0) {
                alert('No searches in review status selected. Only searches pending review can be approved.');
                return;
            }

            if (!confirm('Approve and unflag ' + reviewSearches.length + ' search(es)?\n\nThis will remove them from the flagged list.\n\nSearches:\n• ' + reviewSearches.map(function(s) { return s.name; }).join('\n• '))) {
                return;
            }

            approveReviews(reviewSearches);
        });

        // Reject Review button - admin action to reject and reset timer
        $(document).on('click', '#metricPopupReject', function() {
            var selectedSearches = getSelectedMetricSearches();
            if (selectedSearches.length === 0) {
                alert('Please select at least one search to reject.');
                return;
            }

            // Filter to only searches in review status
            var reviewSearches = selectedSearches.filter(function(s) {
                return s.status === 'review';
            });

            if (reviewSearches.length === 0) {
                alert('No searches in review status selected. Only searches pending review can be rejected.');
                return;
            }

            // Prompt for rejection reason
            var reason = prompt('Enter rejection reason (will be sent to the search owner):\n\nSearches:\n• ' + reviewSearches.map(function(s) { return s.name; }).join('\n• '));
            if (!reason) {
                return;
            }

            rejectReviews(reviewSearches, reason);
        });

        // Submit for review function
        function submitForReview(searches) {
            showToast('Submitting ' + searches.length + ' search(es) for review...');

            var conditions = searches.map(function(s) {
                return 'search_name="' + escapeString(s.name) + '"';
            }).join(' OR ');

            var reviewQuery = '| inputlookup flagged_searches_lookup ' +
                '| eval status = if(' + conditions + ', "review", status)' +
                '| eval review_submitted_time = if(' + conditions + ', now(), review_submitted_time)' +
                '| eval review_submitted_by = if(' + conditions + ', "' + currentUser + '", review_submitted_by)' +
                '| eval notes = if(' + conditions + ', notes + " | SUBMITTED FOR REVIEW on " + strftime(now(), "%Y-%m-%d %H:%M") + " by ' + currentUser + '", notes)' +
                '| outputlookup flagged_searches_lookup';

            runSearch(reviewQuery, function(err) {
                if (err) {
                    alert('Error submitting for review: ' + err);
                    return;
                }

                searches.forEach(function(s) {
                    logAction('submit-review', s.name, 'Submitted for admin review by ' + currentUser);
                });

                showToast('✓ ' + searches.length + ' search(es) submitted for review');

                // Refresh modal content (don't close the modal)
                setTimeout(function() {
                    refreshDashboard();
                    // Re-open the same modal type to refresh its data
                    if (window.currentMetricType) {
                        var currentType = window.currentMetricType;
                        var currentTitle = $('#metricPopupTitle').text();
                        var currentValue = $('#metricPopupValue').text();
                        openMetricPopup(currentType, currentValue, currentTitle);
                    }
                }, 1000);
            });
        }

        // Approve reviews function
        function approveReviews(searches) {
            showToast('Approving ' + searches.length + ' search(es)...');

            var conditions = searches.map(function(s) {
                return 'search_name="' + escapeString(s.name) + '"';
            }).join(' OR ');

            // Change status to "resolved" (effectively unflagging)
            var approveQuery = '| inputlookup flagged_searches_lookup ' +
                '| eval status = if(' + conditions + ', "resolved", status)' +
                '| eval review_approved_time = if(' + conditions + ', now(), review_approved_time)' +
                '| eval review_approved_by = if(' + conditions + ', "' + currentUser + '", review_approved_by)' +
                '| eval notes = if(' + conditions + ', notes + " | APPROVED on " + strftime(now(), "%Y-%m-%d %H:%M") + " by ' + currentUser + '", notes)' +
                '| outputlookup flagged_searches_lookup';

            runSearch(approveQuery, function(err) {
                if (err) {
                    alert('Error approving reviews: ' + err);
                    return;
                }

                searches.forEach(function(s) {
                    logAction('approve-review', s.name, 'Review approved and unflagged by ' + currentUser);
                });

                showToast('✓ ' + searches.length + ' search(es) approved and unflagged');

                // Refresh modal content (don't close the modal)
                setTimeout(function() {
                    refreshDashboard();
                    // Re-open the same modal type to refresh its data
                    if (window.currentMetricType) {
                        var currentType = window.currentMetricType;
                        var currentTitle = $('#metricPopupTitle').text();
                        var currentValue = $('#metricPopupValue').text();
                        openMetricPopup(currentType, currentValue, currentTitle);
                    }
                }, 1000);
            });
        }

        // Reject reviews function
        function rejectReviews(searches, reason) {
            showToast('Rejecting ' + searches.length + ' review(s)...');

            var conditions = searches.map(function(s) {
                return 'search_name="' + escapeString(s.name) + '"';
            }).join(' OR ');

            // Reset status to "notified" and extend deadline by 7 days
            var rejectQuery = '| inputlookup flagged_searches_lookup ' +
                '| eval status = if(' + conditions + ', "notified", status)' +
                '| eval remediation_deadline = if(' + conditions + ', now() + (7 * 86400), remediation_deadline)' +
                '| eval review_rejected_time = if(' + conditions + ', now(), review_rejected_time)' +
                '| eval review_rejected_by = if(' + conditions + ', "' + currentUser + '", review_rejected_by)' +
                '| eval notes = if(' + conditions + ', notes + " | REVIEW REJECTED on " + strftime(now(), "%Y-%m-%d %H:%M") + " by ' + currentUser + ': ' + escapeString(reason) + ' - Deadline extended 7 days", notes)' +
                '| outputlookup flagged_searches_lookup';

            runSearch(rejectQuery, function(err) {
                if (err) {
                    alert('Error rejecting reviews: ' + err);
                    return;
                }

                searches.forEach(function(s) {
                    logAction('reject-review', s.name, 'Review rejected by ' + currentUser + ': ' + reason);
                });

                showToast('✗ ' + searches.length + ' review(s) rejected - timer reset with 7 days');

                // Refresh modal content (don't close the modal)
                setTimeout(function() {
                    refreshDashboard();
                    // Re-open the same modal type to refresh its data
                    if (window.currentMetricType) {
                        var currentType = window.currentMetricType;
                        var currentTitle = $('#metricPopupTitle').text();
                        var currentValue = $('#metricPopupValue').text();
                        openMetricPopup(currentType, currentValue, currentTitle);
                    }
                }, 1000);
            });
        }

        function getSelectedMetricSearches() {
            var selected = [];
            $('.metric-popup-row.selected').each(function() {
                var index = parseInt($(this).attr('data-index'));
                if (currentMetricSearches[index]) {
                    selected.push(currentMetricSearches[index]);
                }
            });
            return selected;
        }

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

            // Watch for last action display token
            defaultTokens.on('change:last_action_display', function(model, value) {
                // Check for valid value (not empty, null, or unexpanded token)
                if (value && !value.includes('$result.') && value !== 'null') {
                    $('#lastActionTimestamp').text(value);
                } else {
                    // Token didn't expand properly - try fallback
                    fetchLastGovernanceAction();
                }
            });

            // Also check the token value immediately (in case it was already set)
            var existingLastAction = defaultTokens.get('last_action_display');
            if (existingLastAction && !existingLastAction.includes('$result.') && existingLastAction !== 'null') {
                $('#lastActionTimestamp').text(existingLastAction);
            }

            // Fallback: fetch last action directly via REST after a delay
            setTimeout(function() {
                var currentText = $('#lastActionTimestamp').text();
                if (currentText === 'Loading...' || currentText.includes('$result.') || currentText === '$result.display$') {
                    fetchLastGovernanceAction();
                }
            }, 3000);

            // Watch for metric popup token (old format)
            defaultTokens.on('change:show_metric_popup', function(model, value) {
                if (value) {
                    var metricValue = defaultTokens.get('metric_value') || '0';
                    var titleMap = {
                        'total': 'Total Scheduled Searches',
                        'suspicious': 'Suspicious Searches',
                        'flagged': 'Currently Flagged',
                        'pending': 'Pending Remediation',
                        'disabled': 'Auto-Disabled (30 Days)'
                    };
                    var title = titleMap[value] || value;

                    console.log("Token triggered metric popup:", value, metricValue, title);

                    // If token returns "0", try to get actual value from the DOM
                    if (metricValue === '0' || metricValue === 0) {
                        var panelSelector = '#' + value + '_metric_panel .single-result';
                        var $panel = $(panelSelector);
                        if ($panel.length) {
                            var actualValue = $panel.text().trim();
                            if (actualValue && actualValue !== '0') {
                                console.log("Token had '0', using DOM value instead:", actualValue);
                                metricValue = actualValue;
                            }
                        }
                    }

                    // Always use openMetricPopup - it has the unified UI for all metric types
                    // The old openFlaggedModal was a separate modal but we now use the unified popup
                    openMetricPopup(value, metricValue, title);

                    // Clear the token so it can be triggered again
                    setTimeout(function() {
                        defaultTokens.unset('show_metric_popup');
                        defaultTokens.unset('metric_value');
                    }, 100);
                }
            });

            // Watch for metric popup token (new format from dashboard drilldown)
            defaultTokens.on('change:metric_popup_type', function(model, value) {
                if (value) {
                    var metricValue = defaultTokens.get('metric_popup_value') || '0';
                    var metricTitle = defaultTokens.get('metric_popup_title') || value;

                    console.log("Drilldown triggered metric popup:", value, metricValue, metricTitle);

                    // If drilldown returns "0", try to get actual value from the DOM
                    // $click.value$ returns "0" for single value panels instead of the actual number
                    if (metricValue === '0' || metricValue === 0) {
                        var panelSelector = '#' + value + '_metric_panel .single-result';
                        var $panel = $(panelSelector);
                        if ($panel.length) {
                            var actualValue = $panel.text().trim();
                            if (actualValue && actualValue !== '0') {
                                console.log("Drilldown had '0', using DOM value instead:", actualValue);
                                metricValue = actualValue;
                            }
                        }
                    }

                    openMetricPopup(value, metricValue, metricTitle);

                    // Clear the tokens so drilldown can be triggered again
                    setTimeout(function() {
                        defaultTokens.unset('metric_popup_type');
                        defaultTokens.unset('metric_popup_value');
                        defaultTokens.unset('metric_popup_title');
                    }, 100);
                }
            });

            // Watch for dashboard popup token (from Dashboard Governance page)
            defaultTokens.on('change:dashboard_popup_type', function(model, value) {
                if (value) {
                    var dashboardValue = defaultTokens.get('dashboard_popup_value') || '0';
                    var dashboardTitle = defaultTokens.get('dashboard_popup_title') || value;

                    console.log("Drilldown triggered dashboard popup:", value, dashboardValue, dashboardTitle);

                    openDashboardPopup(value, dashboardValue, dashboardTitle);

                    // Clear the tokens so drilldown can be triggered again
                    setTimeout(function() {
                        defaultTokens.unset('dashboard_popup_type');
                        defaultTokens.unset('dashboard_popup_value');
                        defaultTokens.unset('dashboard_popup_title');
                    }, 100);
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
                // First, find the search with wildcard context to get the real owner/app
                var locale = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})\//);
                var localePrefix = locale ? '/' + locale[1] : '';
                var findEndpoint = localePrefix + '/splunkd/__raw/servicesNS/-/-/saved/searches/' + encodeURIComponent(searchName) + '?output_mode=json';

                console.log("Finding search at:", findEndpoint);

                $.ajax({
                    url: findEndpoint,
                    type: 'GET',
                    success: function(response) {
                        // Extract actual owner and app from the response
                        var entry = response.entry && response.entry[0];
                        if (entry && entry.acl) {
                            var realOwner = entry.acl.owner || owner;
                            var realApp = entry.acl.app || app;
                            console.log("Found search - owner:", realOwner, "app:", realApp);
                            updateWithContext(realOwner, realApp);
                        } else {
                            console.log("Search found but no ACL info, trying contexts...");
                            tryContexts(0);
                        }
                    },
                    error: function(xhr, status, error) {
                        console.log("Search not found with wildcard, trying specific contexts...");
                        tryContexts(0);
                    }
                });

                function updateWithContext(ctxOwner, ctxApp) {
                    var endpoint = localePrefix + '/splunkd/__raw/servicesNS/' + encodeURIComponent(ctxOwner) + '/' + encodeURIComponent(ctxApp) + '/saved/searches/' + encodeURIComponent(searchName);
                    console.log("Updating at:", endpoint);

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
                            console.error("REST update failed at", ctxOwner + "/" + ctxApp, ":", xhr.status, xhr.responseText);
                            // Fall back to context tries
                            tryContexts(0);
                        }
                    });
                }

                // Try multiple contexts as fallback
                var contexts = [
                    { owner: owner, app: app },
                    { owner: 'nobody', app: app },
                    { owner: 'admin', app: app }
                ];

                function tryContexts(ctxIndex) {
                    if (ctxIndex >= contexts.length) {
                        alert("Failed to update schedule. Please update manually in Settings > Searches, Reports, and Alerts.");
                        return;
                    }

                    var ctx = contexts[ctxIndex];
                    var endpoint = localePrefix + '/splunkd/__raw/servicesNS/' + encodeURIComponent(ctx.owner) + '/' + encodeURIComponent(ctx.app) + '/saved/searches/' + encodeURIComponent(searchName);

                    console.log("Trying context:", ctx.owner + "/" + ctx.app);

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
                            console.error("Context failed:", xhr.status);
                            tryContexts(ctxIndex + 1);
                        }
                    });
                }
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

        // Escape key - close ALL modals
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                $('#cronModalOverlay').removeClass('active');
                $('#impactModalOverlay').removeClass('active');
                $('#flaggedModalOverlay').removeClass('active');
                $('#extendModalOverlay').removeClass('active');
                // Use the closeMetricPopup function for metric popup
                if (typeof window.closeMetricPopup === 'function') {
                    window.closeMetricPopup();
                } else {
                    $('#metricPopupOverlay').removeClass('active');
                }
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

    // Get recommended solutions based on the suspicious reason
    function getReasonSolutions(reason) {
        var solutions = [];
        var lowerReason = (reason || '').toLowerCase();

        if (lowerReason.indexOf('high runtime') > -1 || lowerReason.indexOf('runtime ratio') > -1 || lowerReason.indexOf('excessive runtime') > -1) {
            solutions.push('<li><strong>Replace with tstats:</strong> <code>| tstats count WHERE index=* BY host</code> is 10-100x faster than stats</li>');
            solutions.push('<li><strong>Add early filters:</strong> Move <code>WHERE</code> clauses before <code>stats</code> - filter first, aggregate second</li>');
            solutions.push('<li><strong>Use summary indexing:</strong> Pre-aggregate with <code>collect</code> or <code>mcollect</code> for repeated queries</li>');
            solutions.push('<li><strong>Limit fields:</strong> Add <code>| fields field1, field2</code> early to reduce memory usage</li>');
            solutions.push('<li><strong>Reduce time range:</strong> Change from 24h to 1h if fresher data works for your use case</li>');
        } else if (lowerReason.indexOf('frequent') > -1 || lowerReason.indexOf('runs every') > -1 || lowerReason.indexOf('schedule') > -1) {
            solutions.push('<li><strong>Batch it:</strong> Change from */5 to */15 or 0 * * * * (hourly) - most alerts don\'t need 5-min granularity</li>');
            solutions.push('<li><strong>Use real-time alerts:</strong> For true urgency, use real-time search instead of frequent scheduled</li>');
            solutions.push('<li><strong>Stagger execution:</strong> Change <code>*/5 * * * *</code> to <code>3,8,13,18... * * * *</code> to spread load</li>');
            solutions.push('<li><strong>Enable acceleration:</strong> For reports, enable Report Acceleration in Settings > Searches</li>');
        } else if (lowerReason.indexOf('wildcard') > -1 || lowerReason.indexOf('all index') > -1 || lowerReason.indexOf('index=*') > -1) {
            solutions.push('<li><strong>Target specific indexes:</strong> Replace <code>index=*</code> with <code>index=main index=security</code></li>');
            solutions.push('<li><strong>Use index prefixes:</strong> <code>index=prod_*</code> is faster than <code>index=*</code></li>');
            solutions.push('<li><strong>Add sourcetype filter:</strong> <code>sourcetype=access_log</code> reduces search scope significantly</li>');
            solutions.push('<li><strong>Create a data model:</strong> For repeated queries, accelerated data models are much faster</li>');
        } else if (lowerReason.indexOf('expensive') > -1 || lowerReason.indexOf('cost') > -1 || lowerReason.indexOf('resource') > -1) {
            solutions.push('<li><strong>Simplify subsearches:</strong> Replace <code>[search ...]</code> with lookups or append where possible</li>');
            solutions.push('<li><strong>Avoid eval in stats:</strong> Pre-calculate eval fields before <code>| stats</code></li>');
            solutions.push('<li><strong>Use dedup wisely:</strong> <code>dedup 10 host</code> is faster than <code>dedup host</code></li>');
            solutions.push('<li><strong>Consider archival:</strong> If data is rarely accessed, move to frozen tier</li>');
        } else if (lowerReason.indexOf('owner') > -1 || lowerReason.indexOf('orphan') > -1 || lowerReason.indexOf('unknown') > -1) {
            solutions.push('<li><strong>Transfer ownership:</strong> In Settings > Searches, change owner to active user or splunk-system-user</li>');
            solutions.push('<li><strong>Document purpose:</strong> Add description field explaining what this search does and why</li>');
            solutions.push('<li><strong>Set up alerts:</strong> Configure email alerts so someone is notified if it fails</li>');
            solutions.push('<li><strong>Consider deletion:</strong> If no one claims it after 30 days, it may be safe to disable</li>');
        } else if (lowerReason.indexOf('transaction') > -1 || lowerReason.indexOf('join') > -1) {
            solutions.push('<li><strong>Replace transaction:</strong> Use <code>stats values() BY</code> instead - 5-10x faster</li>');
            solutions.push('<li><strong>Replace join:</strong> Use <code>| append</code> + <code>| stats</code> or lookups instead</li>');
            solutions.push('<li><strong>Limit transaction scope:</strong> Add <code>maxspan=1h</code> and <code>maxevents=1000</code></li>');
            solutions.push('<li><strong>Pre-aggregate:</strong> Create a summary index with the grouped data</li>');
        } else {
            solutions.push('<li><strong>Validate business need:</strong> Confirm with stakeholders if this search is still required</li>');
            solutions.push('<li><strong>Schedule off-peak:</strong> Move to run at 2-5 AM local time when cluster is less busy</li>');
            solutions.push('<li><strong>Add monitoring:</strong> Set up job inspector alerts for searches exceeding 5 min runtime</li>');
            solutions.push('<li><strong>Document:</strong> Add a description explaining purpose, owner contact, and SLA requirements</li>');
        }

        var html = '<ul style="margin: 0; padding-left: 0; list-style: none;">';
        solutions.forEach(function(sol, idx) {
            html += '<li style="padding: 10px 12px; margin-bottom: 8px; background: rgba(46, 204, 113, 0.08); border-radius: 6px; border-left: 3px solid #2ecc71; font-size: 13px; line-height: 1.5;">' + sol.replace('<li>', '').replace('</li>', '') + '</li>';
        });
        html += '</ul>';
        return html;
    }

    // Open the reason details modal
    function showReasonModal(searchName, reason) {
        currentReasonSearch = { name: searchName, reason: reason };

        $('#reasonSearchName').text(searchName || 'Unknown');

        if (reason && reason.trim()) {
            // Format the reason more descriptively
            var formattedReason = formatReasonDescription(reason);
            $('#reasonDescription').html(formattedReason);
        } else {
            $('#reasonDescription').html('<p style="margin: 0; color: rgba(255,255,255,0.6);">No specific reason recorded. This search may have been flagged manually or detected as suspicious by an automated rule.</p>');
        }

        $('#reasonSolutions').html(getReasonSolutions(reason));

        $('#reasonModalOverlay').addClass('active');
    }

    // Format the reason with more descriptive context
    function formatReasonDescription(reason) {
        if (!reason) return '';

        var lowerReason = reason.toLowerCase();
        var icon = '⚠️';
        var category = 'Performance Issue';
        var impact = '';

        // Determine icon and category based on reason
        if (lowerReason.indexOf('join') > -1 || lowerReason.indexOf('transaction') > -1) {
            icon = '🔗';
            category = 'Expensive Command';
            impact = 'Join and transaction commands are memory-intensive and can cause indexer slowdowns during peak hours.';
        } else if (lowerReason.indexOf('runtime') > -1 || lowerReason.indexOf('exceeds') > -1) {
            icon = '⏱️';
            category = 'High Runtime';
            impact = 'Search runs longer than its schedule allows, potentially causing overlapping executions and queue buildup.';
        } else if (lowerReason.indexOf('every 5 min') > -1 || lowerReason.indexOf('frequency') > -1 || lowerReason.indexOf('frequent') > -1) {
            icon = '🔄';
            category = 'High Frequency';
            impact = 'Running every 5 minutes or less creates significant load. Consider if this frequency is truly necessary.';
        } else if (lowerReason.indexOf('wildcard') > -1 || lowerReason.indexOf('index=*') > -1) {
            icon = '🔍';
            category = 'Broad Search Scope';
            impact = 'Searching all indexes scans massive amounts of data. Targeting specific indexes can improve performance 10x.';
        } else if (lowerReason.indexOf('expensive') > -1 || lowerReason.indexOf('cost') > -1) {
            icon = '💰';
            category = 'Resource Cost';
            impact = 'This search consumes significant computing resources that could affect other users and searches.';
        } else if (lowerReason.indexOf('owner') > -1 || lowerReason.indexOf('orphan') > -1) {
            icon = '👤';
            category = 'Ownership Issue';
            impact = 'The search owner may no longer be active. This creates risk if the search fails with no one to respond.';
        }

        var html = '<div style="display: flex; flex-direction: column; gap: 12px;">' +
            '<div style="display: flex; align-items: center; gap: 10px;">' +
                '<span style="font-size: 24px;">' + icon + '</span>' +
                '<div>' +
                    '<div style="color: #f8be34; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">' + category + '</div>' +
                    '<div style="color: #fff; font-size: 15px; font-weight: 500;">' + escapeHtml(reason) + '</div>' +
                '</div>' +
            '</div>';

        if (impact) {
            html += '<div style="background: rgba(0,0,0,0.2); border-radius: 6px; padding: 10px 12px; color: rgba(255,255,255,0.8); font-size: 13px; line-height: 1.5;">' +
                '<strong style="color: #f8be34;">Impact:</strong> ' + impact +
            '</div>';
        }

        html += '</div>';
        return html;
    }

    // Show search query preview modal - fetches the actual search SPL from REST API
    function showSearchPreviewModal(searchName, owner, app) {
        currentSearchPreview = { name: searchName, owner: owner, app: app, query: '' };

        $('#searchPreviewName').text(searchName || 'Unknown');
        $('#searchPreviewOwner').text(owner || '-');
        $('#searchPreviewApp').text(app || '-');
        $('#searchPreviewQuery').html('<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">Loading search query...</div>');

        $('#searchPreviewModalOverlay').addClass('active');

        // Fetch the search query from REST API
        var localePrefix = '';
        var pathParts = window.location.pathname.split('/');
        if (pathParts.length > 1 && pathParts[1].match(/^[a-z]{2}(-[A-Z]{2})?$/)) {
            localePrefix = '/' + pathParts[1];
        }

        var endpoint = localePrefix + '/splunkd/__raw/servicesNS/-/-/saved/searches/' + encodeURIComponent(searchName) + '?output_mode=json';

        $.ajax({
            url: endpoint,
            type: 'GET',
            success: function(response) {
                if (response && response.entry && response.entry.length > 0) {
                    var entry = response.entry[0];
                    var searchQuery = entry.content && entry.content.search ? entry.content.search : 'No search query found';

                    currentSearchPreview.query = searchQuery;

                    // Format the query with syntax highlighting
                    var formattedQuery = formatSplunkQuery(searchQuery);
                    $('#searchPreviewQuery').html(formattedQuery);
                } else {
                    $('#searchPreviewQuery').html('<div style="color: #dc4e41;">Unable to load search query</div>');
                }
            },
            error: function(xhr, status, error) {
                console.error('Error fetching search:', error);
                $('#searchPreviewQuery').html('<div style="color: #dc4e41;">Error loading search: ' + escapeHtml(error) + '</div>');
            }
        });
    }

    // Format SPL query with safe syntax highlighting using placeholder approach
    function formatSplunkQuery(query) {
        if (!query) return '';

        // First escape HTML to prevent XSS
        var text = escapeHtml(query);

        // Use unique placeholders that won't appear in SPL to avoid cascading regex issues
        var placeholders = [];
        var phIndex = 0;

        function addPlaceholder(content, style) {
            var ph = '\uE000' + phIndex + '\uE001';
            placeholders.push({ ph: ph, content: content, style: style });
            phIndex++;
            return ph;
        }

        // Step 1: Protect quoted strings first
        text = text.replace(/"([^"]+)"/g, function(match, p1) {
            return addPlaceholder('"' + p1 + '"', 'color: #a5d6ff');
        });

        // Step 2: Format pipes with newlines
        text = text.replace(/\s*\|\s*/g, function() {
            return '\n' + addPlaceholder('|', 'color: #00d4ff; font-weight: bold') + ' ';
        });

        // Step 3: Highlight commands (first word after pipe or at start)
        var lines = text.split('\n');
        var formattedLines = lines.map(function(line) {
            if (!line.trim()) return line;
            // First word after pipe placeholder is a command
            if (line.indexOf('\uE000') === 0) {
                return line.replace(/(\uE000\d+\uE001 )(\w+)/, function(match, ph, cmd) {
                    return ph + addPlaceholder(cmd, 'color: #ff7b72; font-weight: 600');
                });
            } else {
                // First line without pipe - highlight first word as command
                return line.replace(/^(\w+)/, function(match) {
                    return addPlaceholder(match, 'color: #ff7b72; font-weight: 600');
                });
            }
        });
        text = formattedLines.join('\n');

        // Step 4: Highlight field=value pairs (but not inside placeholders)
        text = text.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*=)/g, function(match, field) {
            // Skip if already a placeholder
            if (match.indexOf('\uE000') >= 0) return match;
            return addPlaceholder(field, 'color: #f8be34');
        });

        // Step 5: Highlight keywords
        var keywords = ['BY', 'AS', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'OUTPUT', 'OUTPUTNEW', 'FROM', 'INTO'];
        keywords.forEach(function(kw) {
            var regex = new RegExp('\\b(' + kw + ')\\b', 'gi');
            text = text.replace(regex, function(match) {
                return addPlaceholder(match, 'color: #ff7b72');
            });
        });

        // Step 6: Replace all placeholders with actual HTML spans
        placeholders.forEach(function(p) {
            text = text.replace(p.ph, '<span style="' + p.style + '">' + p.content + '</span>');
        });

        // Clean up any leading newline
        text = text.replace(/^\n/, '');

        return text;
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
                        html += '<button class="flagged-action-btn" data-action="unflag" data-search="' + escapeHtml(searchName) + '" data-owner="' + escapeHtml(owner) + '" style="background: #53a051; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 4px; font-size: 11px;">Unflag</button>';
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
        var $row = $(this).closest('tr');

        if (action === 'remind') {
            window.emailThisOwner(owner, searchName, 'Reminder: Your search requires attention');
        } else if (action === 'unflag') {
            if (!confirm('Unflag "' + searchName + '" and remove from governance tracking?')) {
                return;
            }

            // Remove from lookup by filtering it out
            var unflagQuery = '| inputlookup flagged_searches_lookup | where search_name!="' + escapeString(searchName) + '" | outputlookup flagged_searches_lookup';

            showToast('Unflagging search...');

            runSearch(unflagQuery, function(err, results) {
                if (err) {
                    showToast('Error unflagging search');
                } else {
                    logAction('unflagged', searchName, 'Removed from governance tracking');
                    showToast('✓ ' + searchName + ' unflagged');

                    // Remove the row from the modal
                    $row.fadeOut(300, function() {
                        $(this).remove();
                        // If no more rows, show empty message
                        if ($('.flagged-row').length === 0) {
                            $('#flaggedSearchesList').html('<div style="padding: 40px; text-align: center; color: rgba(255,255,255,0.5);">No flagged searches</div>');
                        }
                    });

                    // Refresh dashboard
                    refreshDashboard();
                }
            });
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
    // DASHBOARD GOVERNANCE FUNCTIONS
    // ============================================

    window.flagSelectedDashboard = function() {
        var searches = getSelectedSearches();
        if (searches.length === 0) {
            alert("Please select one or more dashboards using the checkboxes.");
            return;
        }

        var dashboardList = searches.map(function(s) { return "• " + s.searchName; }).join("\n");
        var msg = searches.length === 1
            ? "Flag the following dashboard for review?\n\n" + dashboardList
            : "Flag " + searches.length + " dashboards for review?\n\n" + dashboardList;

        if (confirm(msg)) {
            searches.forEach(function(s) {
                logAction("flagged_dashboard", s.searchName, "Dashboard flagged for review - owner: " + s.owner);
            });
            showToast("✓ " + searches.length + " dashboard(s) flagged for review");
        }
    };

    window.emailDashboardOwner = function() {
        var searches = getSelectedSearches();
        if (searches.length === 0) {
            alert("Please select one or more dashboards using the checkboxes.");
            return;
        }

        var owners = {};
        searches.forEach(function(s) {
            if (!owners[s.owner]) owners[s.owner] = [];
            owners[s.owner].push(s.searchName);
        });

        var ownerList = Object.keys(owners).map(function(o) {
            return o + " (" + owners[o].length + " dashboard" + (owners[o].length > 1 ? "s" : "") + ")";
        }).join("\n");

        alert("Email would be sent to:\n\n" + ownerList + "\n\n(Email integration not configured)");
    };

    window.openDashboard = function() {
        var searches = getSelectedSearches();
        if (searches.length === 0) {
            alert("Please select a dashboard using the checkbox.");
            return;
        }

        var dashboard = searches[0];
        var url = "/app/" + dashboard.app + "/" + dashboard.searchName;
        window.open(url, "_blank");
    };

    // ============================================
    // DASHBOARD POPUP FUNCTIONS
    // ============================================

    var currentDashboardSearches = [];
    var lastDashboardPopupOpenTime = 0;

    function openDashboardPopup(dashboardType, value, title) {
        // Debounce: prevent double-opens within 500ms
        var now = Date.now();
        if (now - lastDashboardPopupOpenTime < 500) {
            console.log("Debounced dashboard popup open - too soon after last open");
            return;
        }
        lastDashboardPopupOpenTime = now;

        // If popup is already open with same type, ignore
        if ($('#metricPopupOverlay').hasClass('active') && window.currentDashboardType === dashboardType) {
            console.log("Dashboard popup already open for this type");
            return;
        }

        console.log("Opening dashboard popup:", dashboardType, value, title);
        currentDashboardSearches = [];

        $('#metricPopupValue').text(value);
        $('#metricPopupTitle').text(title);
        $('#metricPopupTableHead').html('<tr><th>Dashboard</th><th>Owner</th><th>App</th><th>Sharing</th><th>Size (KB)</th></tr>');
        $('#metricPopupTableBody').html('<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">Loading...</td></tr>');
        $('#metricPopupOverlay').addClass('active');

        // Store current dashboard type
        window.currentDashboardType = dashboardType;

        // Build search query based on dashboard type
        var searchQuery = '';
        switch (dashboardType) {
            case 'total':
                searchQuery = '| rest /servicesNS/-/-/data/ui/views splunk_server=local | search isDashboard=1 isVisible=1 | rename eai:acl.app as app, eai:acl.owner as owner, eai:acl.sharing as sharing | eval data_size_kb = round(len(\'eai:data\') / 1024, 1) | table label, owner, app, sharing, data_size_kb | sort - data_size_kb | head 50';
                break;
            case 'complex':
                searchQuery = '| rest /servicesNS/-/-/data/ui/views splunk_server=local | search isDashboard=1 isVisible=1 | eval data_len = len(\'eai:data\') | where data_len > 10000 | rename eai:acl.app as app, eai:acl.owner as owner, eai:acl.sharing as sharing | eval data_size_kb = round(data_len / 1024, 1) | table label, owner, app, sharing, data_size_kb | sort - data_size_kb | head 50';
                break;
            case 'private':
                searchQuery = '| rest /servicesNS/-/-/data/ui/views splunk_server=local | search isDashboard=1 isVisible=1 | rename eai:acl.app as app, eai:acl.owner as owner, eai:acl.sharing as sharing | where sharing="user" | eval data_size_kb = round(len(\'eai:data\') / 1024, 1) | table label, owner, app, sharing, data_size_kb | sort - data_size_kb | head 50';
                break;
            case 'app':
                searchQuery = '| rest /servicesNS/-/-/data/ui/views splunk_server=local | search isDashboard=1 isVisible=1 | rename eai:acl.app as app, eai:acl.owner as owner, eai:acl.sharing as sharing | where sharing="app" | eval data_size_kb = round(len(\'eai:data\') / 1024, 1) | table label, owner, app, sharing, data_size_kb | sort - data_size_kb | head 50';
                break;
            case 'global':
                searchQuery = '| rest /servicesNS/-/-/data/ui/views splunk_server=local | search isDashboard=1 isVisible=1 | rename eai:acl.app as app, eai:acl.owner as owner, eai:acl.sharing as sharing | where sharing="global" | eval data_size_kb = round(len(\'eai:data\') / 1024, 1) | table label, owner, app, sharing, data_size_kb | sort - data_size_kb | head 50';
                break;
            default:
                searchQuery = '| rest /servicesNS/-/-/data/ui/views splunk_server=local | search isDashboard=1 isVisible=1 | rename eai:acl.app as app, eai:acl.owner as owner, eai:acl.sharing as sharing | eval data_size_kb = round(len(\'eai:data\') / 1024, 1) | table label, owner, app, sharing, data_size_kb | sort - data_size_kb | head 50';
        }

        // Run search using SearchManager
        var dashboardSearch = new SearchManager({
            id: 'dashboard_popup_search_' + Date.now(),
            search: searchQuery,
            earliest_time: '-24h',
            latest_time: 'now',
            autostart: true
        });

        dashboardSearch.on('search:done', function() {
            var results = dashboardSearch.data('results');
            if (results) {
                results.on('data', function() {
                    var rows = results.data().rows;
                    var fields = results.data().fields;

                    if (!rows || rows.length === 0) {
                        $('#metricPopupTableBody').html('<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">No dashboards found</td></tr>');
                        return;
                    }

                    currentDashboardSearches = [];
                    var html = '';

                    for (var i = 0; i < rows.length; i++) {
                        var row = rows[i];
                        var name = row[0] || '';
                        var owner = row[1] || '';
                        var app = row[2] || '';
                        var sharing = row[3] || '';
                        var sizeKb = row[4] || '0';

                        currentDashboardSearches.push({
                            name: name,
                            owner: owner,
                            app: app,
                            sharing: sharing,
                            sizeKb: sizeKb
                        });

                        // Color code sharing type
                        var sharingBadge = '';
                        if (sharing === 'global') {
                            sharingBadge = '<span style="background: #006d9c; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px;">Global</span>';
                        } else if (sharing === 'app') {
                            sharingBadge = '<span style="background: #53a051; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px;">App</span>';
                        } else {
                            sharingBadge = '<span style="background: #f8be34; color: black; padding: 2px 8px; border-radius: 3px; font-size: 11px;">Private</span>';
                        }

                        // Color code size
                        var sizeColor = parseFloat(sizeKb) > 25 ? '#dc4e41' : (parseFloat(sizeKb) > 10 ? '#f8be34' : '#53a051');

                        html += '<tr class="metric-popup-row" data-index="' + i + '" data-dashboard-name="' + escapeHtml(name) + '" style="cursor: pointer;">' +
                            '<td style="padding: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</td>' +
                            '<td style="padding: 8px;">' + escapeHtml(owner) + '</td>' +
                            '<td style="padding: 8px;">' + escapeHtml(app) + '</td>' +
                            '<td style="padding: 8px;">' + sharingBadge + '</td>' +
                            '<td style="padding: 8px; color: ' + sizeColor + '; font-weight: 600;">' + sizeKb + '</td>' +
                            '</tr>';
                    }

                    $('#metricPopupTableBody').html(html);
                });
            }
        });

        dashboardSearch.on('search:error', function(err) {
            console.error("Dashboard search error:", err);
            $('#metricPopupTableBody').html('<tr><td colspan="6" style="text-align: center; color: #dc4e41; padding: 20px;">Error loading dashboards</td></tr>');
        });
    }

    window.openDashboardPopup = openDashboardPopup;

    // ============================================
    // METRIC POPUP FUNCTIONS
    // ============================================

    var currentMetricSearches = [];
    var lastPopupOpenTime = 0;

    function openMetricPopup(metricType, value, title) {
        // Debounce: prevent double-opens within 500ms (from both drilldown and click handlers)
        var now = Date.now();
        if (now - lastPopupOpenTime < 500) {
            console.log("Debounced metric popup open - too soon after last open");
            return;
        }
        lastPopupOpenTime = now;

        // If popup is already open with same type, ignore
        if ($('#metricPopupOverlay').hasClass('active') && window.currentMetricType === metricType) {
            console.log("Popup already open for this metric type");
            return;
        }

        console.log("Opening metric popup:", metricType, value, title);
        currentMetricSearches = [];

        $('#metricPopupValue').text(value);
        $('#metricPopupTitle').text(title);

        // If value is 0, show funny message immediately without loading
        if (value === '0' || value === 0 || parseInt(value) === 0) {
            var colCount = (metricType === 'flagged' || metricType === 'expiring') ? 7 : 6;
            var funnyMessage = getZeroItemMessage();
            if (metricType === 'flagged' || metricType === 'expiring') {
                $('#metricPopupTableHead').html('<tr><th>#</th><th>Search Name</th><th>Status</th><th>⏱ Time Remaining</th><th>Owner</th><th>App</th><th>Reason</th></tr>');
            } else if (metricType === 'suspicious') {
                $('#metricPopupTableHead').html('<tr><th>#</th><th>Search Name</th><th>Status</th><th>Owner</th><th>App</th><th style="min-width: 200px;">⚠️ Why Suspicious</th></tr>');
            } else {
                $('#metricPopupTableHead').html('<tr><th>#</th><th>Search Name</th><th>Status</th><th>Owner</th><th>App</th><th>Details</th></tr>');
            }
            $('#metricPopupTableBody').html('<tr><td colspan="' + colCount + '" style="text-align: center; color: #5cc05c; padding: 30px; font-size: 14px;"><div style="font-size: 36px; margin-bottom: 10px;">🎉</div>' + funnyMessage + '</td></tr>');
            $('#metricPopupOverlay').addClass('active');
            window.currentMetricType = metricType;
            updateMetricTypeButtons(metricType);
            return; // Skip the search since there's nothing to load
        }

        // Add "Time Remaining" column for flagged/expiring metrics ONLY (not suspicious)
        if (metricType === 'flagged' || metricType === 'expiring') {
            $('#metricPopupTableHead').html('<tr><th>#</th><th>Search Name</th><th>Status</th><th>⏱ Time Remaining</th><th>Owner</th><th>App</th><th>Reason</th></tr>');
            $('#metricPopupTableBody').html('<tr><td colspan="7" style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">Loading...</td></tr>');
        } else if (metricType === 'suspicious') {
            // Suspicious searches show detailed reason - NO days remaining column
            $('#metricPopupTableHead').html('<tr><th>#</th><th>Search Name</th><th>Status</th><th>Owner</th><th>App</th><th style="min-width: 200px;">⚠️ Why Suspicious</th></tr>');
            $('#metricPopupTableBody').html('<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">Loading...</td></tr>');
        } else {
            $('#metricPopupTableHead').html('<tr><th>#</th><th>Search Name</th><th>Status</th><th>Owner</th><th>App</th><th>Details</th></tr>');
            $('#metricPopupTableBody').html('<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">Loading...</td></tr>');
        }
        $('#metricPopupOverlay').addClass('active');

        // Stop any existing countdown timer
        if (window.countdownTimerInterval) {
            clearInterval(window.countdownTimerInterval);
            window.countdownTimerInterval = null;
        }

        // Store current metric type for status updates
        window.currentMetricType = metricType;

        // Run search based on metric type - using cached data with status info
        var searchQuery = '';
        switch (metricType) {
            case 'total':
                searchQuery = '| inputlookup governance_search_cache.csv | where disabled="0" OR disabled=0 | lookup flagged_searches_lookup search_name as title OUTPUT status as flag_status | eval status_display=if(isnotnull(flag_status), flag_status, "active") | table title, owner, app, status_display, frequency_label | head 50';
                break;
            case 'suspicious':
                // Exclude both flagged searches AND searches marked as OK (whitelisted)
                searchQuery = '| inputlookup governance_search_cache.csv | where (disabled="0" OR disabled=0) AND is_suspicious=1 | lookup flagged_searches_lookup search_name as title OUTPUT status as flag_status | lookup ok_searches_lookup search_name as title OUTPUT approved_time as ok_approved | where (isnull(flag_status) OR flag_status="") AND isnull(ok_approved) | eval status_display="suspicious" | table title, owner, app, status_display, suspicious_reason | head 50';
                break;
            case 'flagged':
                searchQuery = '| inputlookup flagged_searches_lookup | search status IN ("flagged", "pending", "notified", "disabled", "review") | dedup search_name | eval status_display=status | eval deadline_epoch=remediation_deadline | eval days_remaining=round((remediation_deadline - now()) / 86400, 2) | table search_name, search_owner, search_app, status_display, reason, status, deadline_epoch, days_remaining | head 50';
                break;
            case 'expiring':
                searchQuery = '| inputlookup flagged_searches_lookup | search status="pending" OR status="notified" | dedup search_name | eval days_remaining = round((remediation_deadline - now()) / 86400, 1) | where days_remaining >= 0 AND days_remaining <= 3 | eval status_display="expiring" | table search_name, search_owner, search_app, status_display, days_remaining, reason | head 50';
                break;
            case 'disabled':
                searchQuery = '| inputlookup flagged_searches_lookup | search status="disabled" | dedup search_name | eval days_ago = (now() - flagged_time) / 86400 | where days_ago <= 7 | eval status_display="disabled" | table search_name, search_owner, search_app, status_display, reason | head 50';
                break;
            default:
                $('#metricPopupTableBody').html('<tr><td colspan="6" style="text-align: center;">No data available</td></tr>');
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

                    var colCount = (metricType === 'flagged' || metricType === 'expiring') ? 7 : 6;
                    if (!rows || rows.length === 0) {
                        var funnyMessage = getZeroItemMessage();
                        $('#metricPopupTableBody').html('<tr><td colspan="' + colCount + '" style="text-align: center; color: #5cc05c; padding: 30px; font-size: 14px;"><div style="font-size: 36px; margin-bottom: 10px;">🎉</div>' + funnyMessage + '</td></tr>');
                        return;
                    }

                    currentMetricSearches = [];
                    var html = '';
                    var hasFlaggedCountdown = (metricType === 'flagged' || metricType === 'expiring');

                    for (var i = 0; i < rows.length; i++) {
                        var row = rows[i];
                        var name = row[0] || '-';
                        var owner = row[1] || '-';
                        var app = row[2] || '-';
                        var statusDisplay = row[3] || 'active';
                        var detail = row[4] || '-';
                        var extra = row[5] || '';
                        var deadlineEpoch = (hasFlaggedCountdown && row[6]) ? parseFloat(row[6]) : null;
                        var daysRemaining = (hasFlaggedCountdown && row[7]) ? parseFloat(row[7]) : null;

                        currentMetricSearches.push({
                            name: name,
                            owner: owner,
                            app: app,
                            status: statusDisplay,
                            deadlineEpoch: deadlineEpoch,
                            daysRemaining: daysRemaining
                        });

                        // Create status badge(s) - make clickable for status change
                        var statusBadge = getStatusBadges(statusDisplay);
                        var clickableStatus = '<div class="status-dropdown-wrapper" data-search="' + escapeHtml(name) + '" data-owner="' + escapeHtml(owner) + '" data-app="' + escapeHtml(app) + '" data-current-status="' + escapeHtml(statusDisplay) + '" style="cursor: pointer; position: relative;" title="Click to change status">' +
                            statusBadge +
                            '<span style="margin-left: 4px; font-size: 10px; opacity: 0.7;">▼</span>' +
                            '</div>';

                        html += '<tr class="metric-popup-row" data-index="' + i + '" data-search-name="' + escapeHtml(name) + '" style="cursor: pointer;">' +
                            '<td style="padding: 8px; width: 40px; text-align: center; color: rgba(255,255,255,0.4); font-size: 11px;">' + (i + 1) + '</td>' +
                            '<td style="padding: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</td>' +
                            '<td style="padding: 8px;" class="status-cell">' + clickableStatus + '</td>';

                        // Add countdown timer column for flagged/expiring metrics
                        if (hasFlaggedCountdown) {
                            html += '<td style="padding: 8px;" class="countdown-cell" data-deadline="' + (deadlineEpoch || '') + '" data-index="' + i + '">' +
                                formatCountdownTimer(deadlineEpoch, statusDisplay) + '</td>';
                        }

                        html += '<td style="padding: 8px;">' + escapeHtml(owner) + '</td>' +
                            '<td style="padding: 8px;">' + escapeHtml(app) + '</td>';

                        // For suspicious searches, show the reason prominently with highlighting
                        if (metricType === 'suspicious' && detail && detail !== '-') {
                            html += '<td style="padding: 8px; background: rgba(248, 190, 52, 0.15); border-left: 3px solid #f8be34; color: #f8be34; font-weight: 500;">' +
                                '<span title="' + escapeHtml(detail) + '">' + escapeHtml(detail) + '</span></td>';
                        } else {
                            html += '<td style="padding: 8px; color: rgba(255,255,255,0.6);">' + escapeHtml(detail || '-') + '</td>';
                        }

                        html += '</tr>';
                    }
                    $('#metricPopupTableBody').html(html);

                    // Start countdown timer if this is a flagged/expiring metric
                    if (hasFlaggedCountdown) {
                        startCountdownTimer();

                        // Check for overdue searches and prompt for auto-disable
                        checkAndPromptOverdueSearches();
                    }

                    // Show/hide buttons based on search statuses
                    updateReviewButtonsVisibility();

                    // Show/hide buttons based on metric type
                    updateMetricTypeButtons(metricType);
                });
            }
        });

        popupSearch.on('search:error', function(err) {
            $('#metricPopupTableBody').html('<tr><td colspan="5" style="text-align: center; color: #dc4e41; padding: 20px;">Error loading data</td></tr>');
        });
    }

    window.openMetricPopup = openMetricPopup;

    // Handle click on metric popup items - drill down to flagged panel
    $(document).on('click', '.metric-popup-item', function(e) {
        var searchName = $(this).attr('data-search-name');
        console.log("Metric popup item clicked:", searchName);

        if (!searchName) return;

        // Close the metric popup
        $('#metricPopupOverlay').removeClass('active');

        // Find the flagged searches panel
        var $flaggedPanel = $('.dashboard-panel').filter(function() {
            return $(this).find('.panel-title, h3').text().indexOf('Flagged Searches') > -1;
        });

        if ($flaggedPanel.length) {
            // Scroll to the flagged panel
            $('html, body').animate({
                scrollTop: $flaggedPanel.offset().top - 100
            }, 500);

            // Find and highlight the row with this search name
            setTimeout(function() {
                var $targetRow = $flaggedPanel.find('tr[data-search="' + searchName + '"]');
                if ($targetRow.length) {
                    // Highlight the row
                    $targetRow.addClass('row-selected');
                    var $checkbox = $targetRow.find('.gov-checkbox');
                    if ($checkbox.length) {
                        $checkbox.prop('checked', true);
                    }
                    updateSelectedSearches();

                    // Pulse animation for visibility
                    $targetRow.css({
                        'box-shadow': '0 0 20px rgba(0, 212, 255, 0.5)',
                        'transition': 'box-shadow 0.3s ease'
                    });
                    setTimeout(function() {
                        $targetRow.css('box-shadow', '');
                    }, 2000);

                    showToast("Found: " + searchName);
                } else {
                    // Search might be in a different table, try All Scheduled Searches
                    var $allSearches = $('tr[data-search="' + searchName + '"]');
                    if ($allSearches.length) {
                        $('html, body').animate({
                            scrollTop: $allSearches.first().offset().top - 100
                        }, 500);
                        $allSearches.first().addClass('row-selected');
                        $allSearches.first().find('.gov-checkbox').prop('checked', true);
                        updateSelectedSearches();
                        showToast("Found: " + searchName);
                    } else {
                        showToast("Search not found in current view");
                    }
                }
            }, 600);
        } else {
            showToast("Flagged panel not found");
        }
    });

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
            var isCostPanel = panelTitle.indexOf('Highest Cost') > -1 || panelTitle.indexOf('Cost Impact') > -1;
            var isActivityPanel = panelTitle.indexOf('Activity') > -1 || panelTitle.indexOf('Audit') > -1 || panelTitle.indexOf('History') > -1;
            var isConfigTable = $table.attr('id') === 'cost_config_table' || panelTitle.indexOf('Current Cost Configuration') > -1 || panelTitle.indexOf('Configuration') > -1;

            // Skip checkbox enhancement - using status dropdown for all status changes instead
            var skipCheckboxes = true;

            var scheduleColIndex = -1;
            var searchNameColIndex = -1;
            var ownerColIndex = -1;
            var appColIndex = -1;
            var reasonColIndex = -1;
            var flaggedColIndex = -1;
            var statusColIndex = -1;
            var dashboardColIndex = -1;
            var isDashboardTable = false;

            // Find column indices from headers (before adding our header)
            var headerOffset = 0;
            $table.find('thead th').each(function(index) {
                var text = $(this).text().trim();
                if (text === 'Schedule') scheduleColIndex = index;
                if (text === 'Search Name') searchNameColIndex = index;
                if (text === 'Dashboard') { dashboardColIndex = index; isDashboardTable = true; }
                if (text === 'Owner') ownerColIndex = index;
                if (text === 'App') appColIndex = index;
                if (text === 'Reason') reasonColIndex = index;
                if (text === 'Flagged') flaggedColIndex = index;
                if (text === 'Status') statusColIndex = index;
            });

            // Use Dashboard column as search name for dashboard tables
            if (isDashboardTable && dashboardColIndex >= 0) {
                searchNameColIndex = dashboardColIndex;
            }

            // Add checkbox header if not present (skip for cost-only panels)
            var $thead = $table.find('thead tr').first();
            if (!skipCheckboxes && $thead.length && !$thead.find('.gov-select-header').length) {
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

                // Track if this is a fresh row or being re-enhanced
                var isNewRow = !$row.hasClass('gov-enhanced');

                // Check for row number column
                var hasRowNum = $cells.eq(0).text().trim().match(/^\d+$/);
                var cellOffset = hasRowNum ? 1 : 0;

                // Extract data from correct columns
                var searchName = searchNameColIndex >= 0 ? $cells.eq(searchNameColIndex).text().trim() : '';
                var owner = ownerColIndex >= 0 ? $cells.eq(ownerColIndex).text().trim() : '';
                var app = appColIndex >= 0 ? $cells.eq(appColIndex).text().trim() : '';
                var reason = reasonColIndex >= 0 ? $cells.eq(reasonColIndex).text().trim() : '';

                // Check flagged status from the Flagged column or Status column
                var isFlagged = false;
                if (flaggedColIndex >= 0 && $cells.length > flaggedColIndex) {
                    var flaggedText = $cells.eq(flaggedColIndex).text().trim().toLowerCase();
                    isFlagged = (flaggedText === 'yes');
                }
                // Also check Status column for flagged states
                if (!isFlagged && statusColIndex >= 0 && $cells.length > statusColIndex) {
                    var statusText = $cells.eq(statusColIndex).text().trim().toLowerCase();
                    isFlagged = (statusText === 'flagged' || statusText === 'pending remediation' || statusText === 'disabled by governance');
                }
                // Also check if search name already has a flag emoji
                if (!isFlagged && searchNameColIndex >= 0 && $cells.length > searchNameColIndex) {
                    var searchCellText = $cells.eq(searchNameColIndex).text().trim();
                    isFlagged = (searchCellText.indexOf('🚩') > -1 || searchCellText.indexOf('⚠️') > -1 || searchCellText.indexOf('🚫') > -1);
                }

                // In flagged panel, all are flagged
                if (isFlaggedPanel) {
                    isFlagged = true;
                }

                // Clean search name of any existing icons (status icons prepended by the search)
                searchName = searchName.replace(/^[\s⚑⚐🚩⚠️🚫✓⚡]+/, '').trim();

                if (!searchName) return;

                // Store data on row (always update in case data changed)
                $row.attr('data-search', searchName)
                    .attr('data-owner', owner)
                    .attr('data-app', app)
                    .attr('data-reason', reason)
                    .attr('data-flagged', isFlagged ? 'true' : 'false');

                if (isFlagged) {
                    $row.addClass('row-flagged');
                } else {
                    $row.removeClass('row-flagged');
                }

                // Mark as enhanced (for checkbox - only add once)
                if (isNewRow) {
                    $row.addClass('gov-enhanced');

                    // Add checkbox cell (skip for cost-only panels) - only on first pass
                    if (!skipCheckboxes && !$row.find('.gov-checkbox').length) {
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
                }

                // Add flag icon ONLY on Search Name column, ONLY if flagged (red flag), NO yellow flags
                // This runs on every pass to ensure flag indicator persists after refresh
                if (!isFlaggedPanel && isFlagged && searchName) {
                    // Find the cell containing the search name by matching content (more reliable than index)
                    // Use same emoji regex as line 3318 to match all possible status icons
                    var $searchNameCell = $cells.filter(function() {
                        var cellText = $(this).text().trim().replace(/^[\s⚑⚐🚩⚠️🚫✓⚡🔴]+/, '').trim();
                        return cellText === searchName;
                    }).first();

                    // Fallback to index if content matching fails
                    if (!$searchNameCell.length && searchNameColIndex >= 0) {
                        $searchNameCell = $cells.eq(searchNameColIndex);
                    }

                    if ($searchNameCell.length && !$searchNameCell.find('.flag-indicator').length) {
                        var flagHtml = '<span class="flag-indicator" style="color: #dc4e41; margin-right: 6px; font-size: 12px;" title="Flagged for review">🚩</span>';
                        $searchNameCell.prepend(flagHtml);
                    }
                }

                // Add disabled indicator next to search name if search is disabled
                var isDisabled = false;
                if (statusColIndex >= 0 && $cells.length > statusColIndex) {
                    var $statusCell = $cells.eq(statusColIndex);
                    // Get status from the dropdown wrapper data attribute (more reliable)
                    var $wrapper = $statusCell.find('.status-dropdown-wrapper');
                    var statusText;
                    if ($wrapper.length) {
                        statusText = ($wrapper.data('current-status') || '').toLowerCase();
                    } else {
                        // Fallback to badge text only (not entire cell to avoid dropdown menu text)
                        var $badge = $statusCell.find('.status-badge');
                        statusText = ($badge.length ? $badge.text() : $statusCell.text()).trim().toLowerCase();
                    }
                    isDisabled = (statusText === 'disabled' || statusText === 'auto-disabled');
                }

                if (isDisabled && searchName) {
                    var $searchNameCell = $cells.filter(function() {
                        var cellText = $(this).text().trim().replace(/^[\s⚑⚐🚩⚠️🚫✓⚡🔴]+/, '').trim();
                        return cellText === searchName;
                    }).first();

                    if (!$searchNameCell.length && searchNameColIndex >= 0) {
                        $searchNameCell = $cells.eq(searchNameColIndex);
                    }

                    if ($searchNameCell.length && !$searchNameCell.find('.disabled-indicator').length) {
                        var disabledHtml = '<span class="disabled-indicator" style="color: #708794; margin-right: 6px; font-size: 12px;" title="Search is disabled">🔴</span>';
                        $searchNameCell.prepend(disabledHtml);
                    }
                    $row.addClass('row-disabled');
                }

                // Add blue lightning bolt for suspicious (unflagged) searches
                var isSuspicious = false;
                if (statusColIndex >= 0 && $cells.length > statusColIndex) {
                    var $statusCell = $cells.eq(statusColIndex);
                    // Get status from the dropdown wrapper data attribute (more reliable)
                    var $wrapper = $statusCell.find('.status-dropdown-wrapper');
                    var suspStatusText;
                    if ($wrapper.length) {
                        suspStatusText = ($wrapper.data('current-status') || '').toLowerCase();
                    } else {
                        // Fallback to badge text only (not entire cell to avoid dropdown menu text)
                        var $badge = $statusCell.find('.status-badge');
                        suspStatusText = ($badge.length ? $badge.text() : $statusCell.text()).trim().toLowerCase();
                    }
                    isSuspicious = (suspStatusText === 'suspicious');
                }

                if (isSuspicious && !isFlagged && searchName) {
                    var $searchNameCell = $cells.filter(function() {
                        var cellText = $(this).text().trim().replace(/^[\s⚑⚐🚩⚠️🚫✓⚡🔴]+/, '').trim();
                        return cellText === searchName;
                    }).first();

                    if (!$searchNameCell.length && searchNameColIndex >= 0) {
                        $searchNameCell = $cells.eq(searchNameColIndex);
                    }

                    if ($searchNameCell.length && !$searchNameCell.find('.suspicious-indicator').length) {
                        var suspiciousHtml = '<span class="suspicious-indicator" style="color: #f8be34; margin-right: 6px; font-size: 12px;" title="Suspicious search pattern detected">⚡</span>';
                        $searchNameCell.prepend(suspiciousHtml);
                    }
                    $row.addClass('row-suspicious');
                }

                // Add magnifying glass icon to view search query (on the right side of search name)
                if (searchNameColIndex >= 0 && $cells.length > searchNameColIndex && searchName) {
                    var $searchNameCell = $cells.eq(searchNameColIndex);

                    // Only add if not already present
                    if (!$searchNameCell.find('.search-preview-icon').length) {
                        var previewHtml = '<span class="search-preview-icon" ' +
                            'data-search="' + escapeHtml(searchName) + '" ' +
                            'data-owner="' + escapeHtml(owner) + '" ' +
                            'data-app="' + escapeHtml(app) + '" ' +
                            'style="color: #00d4ff; margin-left: 8px; font-size: 12px; cursor: pointer; opacity: 0.7; transition: opacity 0.2s;" ' +
                            'title="View search query">🔍</span>';
                        $searchNameCell.append(previewHtml);
                    }
                }

                // Make status column interactive with dropdown (like modal)
                if (statusColIndex >= 0 && $cells.length > statusColIndex) {
                    var $statusCell = $cells.eq(statusColIndex);
                    var currentStatus = $statusCell.text().trim();

                    // Only add dropdown if not already enhanced
                    if (!$statusCell.find('.status-dropdown-wrapper').length && currentStatus) {
                        var statusBadge = getStatusBadges(currentStatus);
                        var dropdownHtml = '<div class="status-dropdown-wrapper" ' +
                            'data-search="' + escapeHtml(searchName) + '" ' +
                            'data-owner="' + escapeHtml(owner) + '" ' +
                            'data-app="' + escapeHtml(app) + '" ' +
                            'data-current-status="' + escapeHtml(currentStatus) + '" ' +
                            'data-is-suspicious="' + isSuspicious + '" ' +
                            'style="cursor: pointer; position: relative; display: inline-block;" title="Click to change status">' +
                            statusBadge +
                            '<span style="margin-left: 4px; font-size: 10px; opacity: 0.7;">▼</span>' +
                            '</div>';
                        $statusCell.html(dropdownHtml);
                    }
                }

                // Enhance schedule column with cron clickable
                // ALWAYS check this - Splunk may replace cell content on refresh
                if (scheduleColIndex >= 0 && $cells.length > scheduleColIndex) {
                    var $scheduleCell = $cells.eq(scheduleColIndex);
                    var cronValue = $scheduleCell.text().trim();

                    // If cron-clickable is missing but should exist, re-add it
                    if (!$scheduleCell.find('.cron-clickable').length && cronValue.match(/^[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+$/)) {
                        $scheduleCell.html('<span class="cron-clickable" data-cron="' + escapeHtml(cronValue) + '" data-search="' + escapeHtml(searchName) + '" data-owner="' + escapeHtml(owner) + '" data-app="' + escapeHtml(app) + '">' + escapeHtml(cronValue) + '</span>');
                    }
                }

                // Enhance Reason column to be clickable for showing details modal
                if (reasonColIndex >= 0 && $cells.length > reasonColIndex) {
                    var $reasonCell = $cells.eq(reasonColIndex);
                    var reasonValue = $reasonCell.text().trim();

                    // Only enhance if there's a reason and not already enhanced
                    if (reasonValue && !$reasonCell.find('.reason-clickable').length) {
                        var truncatedReason = reasonValue.length > 40 ? reasonValue.substring(0, 40) + '...' : reasonValue;
                        var reasonHtml = '<span class="reason-clickable" ' +
                            'data-search="' + escapeHtml(searchName) + '" ' +
                            'data-reason="' + escapeHtml(reasonValue) + '" ' +
                            'style="cursor: pointer; color: #f8be34; text-decoration: underline; text-decoration-style: dotted;" ' +
                            'title="Click to view details and solutions">' +
                            escapeHtml(truncatedReason) +
                            '<span style="margin-left: 4px; font-size: 10px;">ℹ️</span>' +
                            '</span>';
                        $reasonCell.html(reasonHtml);
                    }
                }
            });
        });
    }

    // Handle select all checkbox - use 'change' event (SINGLE handler - removed duplicate)
    $(document).on('change', '.gov-select-all', function(e) {
        e.stopPropagation();
        e.stopImmediatePropagation();

        var $selectAll = $(this);
        var isChecked = $selectAll.prop('checked');

        console.log("Select-all changed, now:", isChecked);

        // Get the table this select-all belongs to
        var $table = $selectAll.closest('table');

        // Update all checkboxes in this table
        $table.find('.gov-checkbox').each(function() {
            $(this).prop('checked', isChecked);
            $(this).attr('data-selected', isChecked ? 'true' : 'false');
            // Update row visual state
            var $row = $(this).closest('tr');
            if (isChecked) {
                $row.addClass('row-selected');
            } else {
                $row.removeClass('row-selected');
            }
        });

        updateSelectedSearches();
        updateBulkActionVisibility();
    });

    // Handle individual checkbox change - use 'change' event, NOT 'click'
    // The browser toggles the checkbox on click even with appearance:none
    // Using 'change' ensures we respond AFTER the browser has toggled the state
    $(document).on('change', '.gov-checkbox', function(e) {
        e.stopPropagation();

        var $checkbox = $(this);
        var isChecked = $checkbox.prop('checked');

        console.log("Checkbox changed, now:", isChecked);

        // Update row visual state
        var $row = $checkbox.closest('tr');
        if (isChecked) {
            $row.addClass('row-selected');
        } else {
            $row.removeClass('row-selected');
        }

        updateSelectedSearches();

        // Update select-all state
        var $table = $(this).closest('table');
        var total = $table.find('.gov-checkbox').length;
        var checked = $table.find('.gov-checkbox:checked').length;
        $table.find('.gov-select-all').prop('checked', total === checked);
    });

    // Handle checkbox click - use data attribute for selection state
    // The native checkbox behavior is unreliable due to Splunk framework interference
    // So we track selection state via data-selected attribute and sync to checked property
    $(document).on('click', '.gov-checkbox', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        var $checkbox = $(this);
        var wasSelected = $checkbox.attr('data-selected') === 'true';
        var newState = !wasSelected;

        // Update our data attribute (source of truth)
        $checkbox.attr('data-selected', newState ? 'true' : 'false');

        // Sync to checked property (for visual display)
        // Use setTimeout to ensure it happens after any framework resets
        setTimeout(function() {
            $checkbox.prop('checked', newState);
        }, 0);

        // Trigger change event
        $checkbox.trigger('change');
    });

    // Handle select-all click - same approach with data attribute
    $(document).on('click', '.gov-select-all', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        var $selectAll = $(this);
        var wasSelected = $selectAll.attr('data-selected') === 'true';
        var newState = !wasSelected;

        $selectAll.attr('data-selected', newState ? 'true' : 'false');

        setTimeout(function() {
            $selectAll.prop('checked', newState);
        }, 0);

        $selectAll.trigger('change');
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

    // Click handler for search preview icon - opens search query modal
    $(document).on('click', '.search-preview-icon', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        var $el = $(this);
        var searchName = $el.attr('data-search') || $el.data('search');
        var owner = $el.attr('data-owner') || $el.data('owner');
        var app = $el.attr('data-app') || $el.data('app');

        console.log("Search preview clicked:", searchName);
        showSearchPreviewModal(searchName, owner, app);

        return false;
    });

    // Hover effect for search preview icon
    $(document).on('mouseenter', '.search-preview-icon', function() {
        $(this).css('opacity', '1');
    });

    $(document).on('mouseleave', '.search-preview-icon', function() {
        $(this).css('opacity', '0.7');
    });

    // Row click for selection (not on checkbox, cron, or flag)
    $(document).on('click', '.gov-enhanced td:not(.gov-checkbox-cell)', function(e) {
        // Don't handle if clicking on interactive elements
        if ($(e.target).is('input, .cron-clickable, .flag-indicator, .search-preview-icon')) {
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
        var newState = !$checkbox.prop('checked');
        $checkbox.prop('checked', newState);

        // Update row visual state
        if (newState) {
            $row.addClass('row-selected');
        } else {
            $row.removeClass('row-selected');
        }

        updateSelectedSearches();

        // Update select-all state
        var $table = $row.closest('table');
        var total = $table.find('.gov-checkbox').length;
        var checked = $table.find('.gov-checkbox:checked').length;
        $table.find('.gov-select-all').prop('checked', total === checked);
    });

    // Click handler for reason column - opens reason details modal
    $(document).on('click', '.reason-clickable', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        var $el = $(this);
        var searchName = $el.attr('data-search') || $el.data('search');
        var reason = $el.attr('data-reason') || $el.data('reason');

        console.log("Reason clicked:", searchName, reason);
        showReasonModal(searchName, reason);

        return false;
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

        // SINGLE consolidated button handler - handles ALL action buttons
        // Uses stopImmediatePropagation to prevent duplicate handling
        // Checks both text content AND button ID
        $(document).on('click', '.action-buttons button, .action-btn, button.btn, #flag-selected-btn, #flag-btn-2, #flag-this-btn, #preview-impact-btn, #preview-btn-2, #preview-this-btn, #track-search-btn, #track-btn-2, #track-this-btn, #email-owner-btn, #email-btn-2, #email-this-owner-btn, #send-reminder-btn, #extend-deadline-btn, #disable-now-btn, #disable-expiring-btn, #unflag-btn, #unflag-btn-2, #unflag-selected-btn, #unflag-this-btn, #clear-selection-btn', function(e) {
            // IMMEDIATELY stop propagation to prevent any other handlers
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            var $btn = $(this);
            var btnText = $btn.text().trim().toLowerCase();
            var btnId = $btn.attr('id') || '';

            // Prevent duplicate handling - check if already handled via data attribute
            if ($btn.data('gov-handled')) {
                console.log("Button already handled, skipping");
                return;
            }
            $btn.data('gov-handled', true);
            setTimeout(function() { $btn.data('gov-handled', false); }, 1000);

            console.log("Button clicked:", btnText, "id:", btnId);

            var handled = false;

            // Check by ID first (more specific), then by text content
            // IMPORTANT: Check for "unflag" BEFORE "flag" since "unflag" contains "flag"
            if (btnId.indexOf('unflag') > -1 || btnText.indexOf('unflag') > -1 || btnText.indexOf('mark resolved') > -1) {
                handled = true;
                window.unflagSearch();
            } else if (btnId === 'flag-this-btn' || btnText.indexOf('flag this') > -1) {
                // "Flag This Search" button - uses token values
                handled = true;
                var searchName = getToken("selected_search");
                var owner = getToken("selected_owner");
                var app = getToken("selected_app");
                if (searchName) {
                    window.flagThisSearch(searchName, owner, app);
                } else {
                    alert("Please select a search first.");
                }
            } else if (btnId.indexOf('flag') > -1 || btnText.indexOf('flag selected') > -1) {
                handled = true;
                window.flagSelectedSearch();
            } else if (btnId.indexOf('preview') > -1 || btnText.indexOf('preview impact') > -1) {
                handled = true;
                window.previewImpact();
            } else if (btnId.indexOf('track') > -1 || btnText.indexOf('track') > -1) {
                handled = true;
                window.trackSearch();
            } else if (btnId === 'email-this-owner-btn' || btnText.indexOf('email this') > -1) {
                // "Email This Owner" button - uses token values
                handled = true;
                var ownerEmail = getToken("selected_owner");
                var searchNameEmail = getToken("selected_search");
                if (ownerEmail && searchNameEmail) {
                    window.emailThisOwner(ownerEmail, searchNameEmail);
                } else {
                    alert("Please select a search first.");
                }
            } else if (btnId.indexOf('email') > -1 || btnText.indexOf('email owner') > -1) {
                handled = true;
                window.emailOwner();
            } else if (btnId === 'send-reminder-btn' || btnText.indexOf('send reminder') > -1) {
                handled = true;
                window.sendReminder();
            } else if (btnId === 'extend-deadline-btn' || (btnText.indexOf('extend deadline') > -1 && btnId !== 'metricPopupExtend' && btnId !== 'extendModalSave')) {
                // Exclude metricPopupExtend and extendModalSave which have their own specific handlers
                handled = true;
                window.extendDeadline();
            } else if (btnId === 'disable-expiring-btn' || btnText.indexOf('disable expiring') > -1) {
                handled = true;
                window.disableExpiringSoon();
            } else if (btnId === 'disable-now-btn' || btnText.indexOf('disable now') > -1) {
                handled = true;
                window.disableNow();
            } else if (btnId === 'clear-selection-btn' || btnText.indexOf('clear selection') > -1) {
                handled = true;
                window.clearSelection();
            } else if (btnText.indexOf('view flagged') > -1 || btnText.indexOf('view all flagged') > -1) {
                handled = true;
                openFlaggedModal();
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        });

        // Setup click handlers for single value metric panels - run multiple times for async rendering
        // H3 titles load asynchronously from search results, so we need longer delays
        setTimeout(function() { setupMetricPanelClickHandlers(); }, 2000);
        setTimeout(function() { setupMetricPanelClickHandlers(); }, 4000);
        setTimeout(function() { setupMetricPanelClickHandlers(); }, 6000);
        setTimeout(function() { setupMetricPanelClickHandlers(); }, 8000);
        setTimeout(function() { setupMetricPanelClickHandlers(); }, 10000);

        // Direct click handler on single value viz elements as fallback
        $(document).on('click', '.single-result, .single-value, .viz-single-value', function(e) {
            var $viz = $(this);
            // Use .dashboard-element.single which is the actual parent in Splunk's DOM structure
            var $panel = $viz.closest('.dashboard-element.single, .dashboard-element, .dashboard-cell, .dashboard-panel');
            var metricType = $panel.attr('data-metric-type');

            if (!metricType) {
                // Try to find from title - look for h3 in panel-head or directly
                var title = $panel.find('.panel-head h3').first().text().trim().toLowerCase();
                if (!title) {
                    title = $panel.find('h3').first().text().trim().toLowerCase();
                }
                if (title.indexOf('total') > -1) metricType = 'total';
                else if (title.indexOf('suspicious') > -1 || title.indexOf('unflagged') > -1) metricType = 'suspicious';
                else if (title.indexOf('flagged') > -1) metricType = 'flagged';
                else if (title.indexOf('expiring') > -1) metricType = 'expiring';
                else if (title.indexOf('disabled') > -1) metricType = 'disabled';
            }

            if (metricType) {
                e.preventDefault();
                e.stopPropagation();
                var value = $viz.text().trim() || '0';
                var displayTitle = $panel.find('.panel-title, h2, h3').first().text().trim();
                console.log("Single value clicked:", metricType, value, displayTitle);
                openMetricPopup(metricType, value, displayTitle);
            }
        });

        function setupMetricPanelClickHandlers() {
            console.log("Setting up metric panel click handlers");

            // Map of panel titles to metric types - matches dashboard titles
            var metricMap = {
                'Total Scheduled Searches': 'total',
                'Suspicious (Unflagged)': 'suspicious',
                'Suspicious Searches': 'suspicious',
                'Currently Flagged': 'flagged',
                'Expiring Soon': 'expiring',
                'Pending Remediation': 'pending',
                'Auto-Disabled (This Period)': 'disabled',
                'Auto-Disabled': 'disabled'
            };

            // Alternative partial matches for flexibility
            var partialMatches = {
                'total': ['total scheduled', 'scheduled searches'],
                'suspicious': ['suspicious', 'unflagged'],
                'flagged': ['flagged', 'currently flagged'],
                'expiring': ['expiring', 'days'],
                'disabled': ['disabled', 'auto-disabled']
            };

            // Find all panels with single value visualizations
            // Target .dashboard-element.single which contains the metric panels
            $('.dashboard-element.single, .dashboard-row .dashboard-cell, .dashboard-panel').each(function() {
                var $panel = $(this);

                // Skip if already setup
                if ($panel.attr('data-metric-setup') === 'true') return;

                // Check if this has a single value viz first
                var hasSingleViz = $panel.find('.single-result, .single-value, .viz-single-value').length > 0;
                if (!hasSingleViz) return;

                // Try multiple ways to find the title
                var titleText = '';

                // Look for h3 in panel-head first (Splunk's actual structure)
                var $titleEl = $panel.find('.panel-head h3').first();
                if ($titleEl.length) {
                    titleText = $titleEl.text().trim();
                }
                // Try any h3 as fallback
                if (!titleText) {
                    $titleEl = $panel.find('h3').first();
                    if ($titleEl.length) {
                        titleText = $titleEl.text().trim();
                    }
                }
                if (!titleText) {
                    $titleEl = $panel.find('.panel-title').first();
                    if ($titleEl.length) {
                        titleText = $titleEl.text().trim();
                    }
                }
                if (!titleText) {
                    $titleEl = $panel.find('h2').first();
                    if ($titleEl.length) {
                        titleText = $titleEl.text().trim();
                    }
                }

                // Skip if no title found
                if (!titleText) return;

                // Find matching metric type - try exact match first
                var metricType = null;
                var titleLower = titleText.toLowerCase();
                for (var key in metricMap) {
                    if (titleText.indexOf(key) > -1) {
                        metricType = metricMap[key];
                        break;
                    }
                }

                // Try partial matches if no exact match
                if (!metricType) {
                    for (var type in partialMatches) {
                        var patterns = partialMatches[type];
                        for (var i = 0; i < patterns.length; i++) {
                            if (titleLower.indexOf(patterns[i]) > -1) {
                                metricType = type;
                                break;
                            }
                        }
                        if (metricType) break;
                    }
                }

                if (!metricType) {
                    console.log("No metric type match for:", titleText);
                    return;
                }

                console.log("Setting up click handler for:", titleText, "->", metricType);

                // Mark as setup
                $panel.attr('data-metric-setup', 'true');
                $panel.attr('data-metric-type', metricType);
                $panel.css('cursor', 'pointer');

                // Add click handler
                $panel.off('click.metric').on('click.metric', function(e) {
                    // Don't trigger if clicking on a button or link
                    if ($(e.target).closest('button, a').length) return;

                    var type = $(this).attr('data-metric-type');

                    // Get the displayed value
                    var $singleVal = $(this).find('.single-result, .single-value, .viz-single-value .single-result');
                    var value = $singleVal.first().text().trim() || '0';

                    // Get title
                    var title = $(this).find('.panel-title, h2, h3').first().text().trim();

                    console.log("Metric panel clicked:", type, value, title);

                    // Always use openMetricPopup for consistent unified UI
                    openMetricPopup(type, value, title);
                });
            });
        }

        // Enhance tables multiple times to catch async rendering
        setTimeout(enhanceScheduleColumns, 1000);
        setTimeout(enhanceScheduleColumns, 2000);
        setTimeout(enhanceScheduleColumns, 3000);
        setTimeout(enhanceScheduleColumns, 5000);
        setTimeout(enhanceScheduleColumns, 8000);

        // Watch for table updates with multiple debounced calls
        if (typeof MutationObserver !== 'undefined') {
            var observer = new MutationObserver(function(mutations) {
                // Check if any mutations affected tables
                var tableAffected = mutations.some(function(m) {
                    return m.target.tagName === 'TABLE' ||
                           m.target.tagName === 'TBODY' ||
                           m.target.tagName === 'TR' ||
                           $(m.target).closest('table').length > 0 ||
                           $(m.target).find('table').length > 0;
                });

                // Always run enhancement on mutation, with staggered timing
                clearTimeout(window._enhanceTimer);
                clearTimeout(window._enhanceTimer2);
                clearTimeout(window._enhanceTimer3);

                // Multiple staggered calls to catch various render timings
                window._enhanceTimer = setTimeout(enhanceScheduleColumns, 500);
                window._enhanceTimer2 = setTimeout(enhanceScheduleColumns, 1500);
                if (tableAffected) {
                    // If table was affected, run extra enhancement
                    window._enhanceTimer3 = setTimeout(enhanceScheduleColumns, 3000);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // Also re-enhance on Splunk search completion events
        $(document).on('search:done search:progress', function() {
            setTimeout(enhanceScheduleColumns, 500);
            setTimeout(enhanceScheduleColumns, 1500);
            // Also re-setup metric panel handlers in case panels were refreshed
            setTimeout(setupMetricPanelClickHandlers, 2000);
        });

        // Check auto-disable
        setTimeout(checkAutoDisable, 5000);
        setInterval(checkAutoDisable, 300000); // Every 5 min

        console.log("TA-user-governance: Initialization complete");
    });

    console.log("TA-user-governance: Script loaded");

});

// Global fallback for onclick handlers - these are set outside require() for immediate availability
(function() {
    // Fallback viewFlaggedSearches if not already defined
    if (typeof window.viewFlaggedSearches !== 'function') {
        window.viewFlaggedSearches = function() {
            console.log("viewFlaggedSearches fallback called");
            // Wait for the real function to be available
            var checkInterval = setInterval(function() {
                if (typeof window.openFlaggedModal === 'function') {
                    clearInterval(checkInterval);
                    window.openFlaggedModal();
                }
            }, 100);
            // Timeout after 3 seconds
            setTimeout(function() {
                clearInterval(checkInterval);
                if (typeof window.openFlaggedModal !== 'function') {
                    alert("Loading... please try again in a moment.");
                }
            }, 3000);
        };
    }

    // Click delegation for View Flagged buttons (fallback)
    document.addEventListener('click', function(e) {
        var target = e.target;
        if (target.tagName === 'BUTTON' || (target.tagName === 'A' && target.classList.contains('btn'))) {
            var text = target.textContent.toLowerCase();
            if (text.indexOf('view') > -1 && text.indexOf('flagged') > -1) {
                e.preventDefault();
                e.stopPropagation();
                console.log("View Flagged button clicked (native handler)");
                if (typeof window.openFlaggedModal === 'function') {
                    window.openFlaggedModal();
                } else if (typeof window.viewFlaggedSearches === 'function') {
                    window.viewFlaggedSearches();
                }
            }
        }
    }, true);
})();
