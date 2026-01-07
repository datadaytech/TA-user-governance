# TA-user-governance

A Splunk app for scheduled search governance, monitoring, and automated enforcement.

## Overview

This app provides administrators with comprehensive visibility into scheduled searches across your Splunk environment. It identifies problematic searches, enables flagging workflows with user notifications, and automates enforcement when issues aren't remediated.

## Features

- **Scheduled Search Discovery**: Automatically discovers all scheduled searches via REST API
- **Suspicious Search Detection**: Identifies searches based on configurable criteria:
  - Runtime/frequency ratio exceeds threshold (default: >10%)
  - High frequency scheduling (default: <=15 min intervals)
  - Long average runtime (default: >5 minutes)
  - Wasteful SPL patterns (`index=*`, `| join`, `| append`, `| transaction`, long time ranges)
- **Flagging Workflow**: Flag searches with reason, automatic deadline tracking
- **Real-time Countdown Timer**: Color-coded countdown showing time remaining until enforcement
- **Automated Review Detection**: System detects when users fix flagged searches and queues for admin approval
- **Review Workflow**: Admin approve/reject process for remediated searches
- **Email Notifications**: Notify search owners when flagged, reminded, or disabled
- **Automated Enforcement**: Auto-disable searches that exceed remediation deadline
- **Dark Theme Support**: Full dark theme integration with Splunk
- **Audit Logging**: Complete audit trail of all governance actions
- **RBAC**: Restricted to `admin` and `sc_admin` roles

## Requirements

- Splunk Enterprise 8.0+
- Admin or sc_admin role access
- SMTP configured in Splunk (for automated email notifications)

## Installation

### Option 1: Direct Installation

```bash
# Copy to Splunk apps directory
cp -r TA-user-governance $SPLUNK_HOME/etc/apps/

# Restart Splunk
$SPLUNK_HOME/bin/splunk restart
```

### Option 2: Install via Splunk Web

1. Package the app: `tar -czvf TA-user-governance.tar.gz TA-user-governance/`
2. Navigate to Apps > Manage Apps > Install app from file
3. Upload the .tar.gz file

## Post-Installation Setup

### 1. Configure Email Domain

Navigate to **User Governance > Settings** and update the email domain setting to match your organization's email domain.

Alternatively, run this search in Splunk:

```spl
| makeresults
| eval setting_name="email_domain", setting_value="yourcompany.com", description="Email domain for user notifications"
| outputlookup governance_settings_lookup
```

### 2. Initialize Default Settings (First Run)

The app will automatically load default settings from `lookups/governance_settings.csv`. To manually initialize:

```spl
| inputlookup governance_settings_default
| outputlookup governance_settings_lookup
```

### 3. Enable Scheduled Searches

Navigate to Settings > Searches, reports, and alerts and enable the governance scheduled searches:
- `Governance - Check Remediation Deadlines` (runs daily at 8am)
- `Governance - Send Initial Notifications` (runs every 30 minutes)
- `Governance - Send Reminder Notifications` (runs daily at 9am)
- `Governance - Update Notification Status` (runs every 35 minutes)

### 4. Configure SMTP (if not already done)

Navigate to Settings > Server settings > Email settings and configure your SMTP server.

## Usage

### Main Dashboard

Access via **Apps > User Governance > Scheduled Search Governance**

The dashboard provides:
- **Summary Metrics**: Total searches, suspicious count, flagged count, pending remediation
- **Suspicious Searches Panel**: Searches meeting suspicious criteria with reasons
- **All Scheduled Searches**: Complete list with filtering options
- **Flagged Searches Management**: Manage flagged searches, extend deadlines, disable

### Flagging a Search

1. Click on a row in the Suspicious Searches or All Scheduled Searches table
2. Click "Flag This Search" or "Flag Selected Search"
3. Enter a reason for flagging
4. The search owner will receive an email notification

### Managing Flagged Searches

- **Send Reminder**: Send a reminder email to the owner
- **Extend Deadline**: Add 7 more days to the remediation deadline
- **Disable Now**: Immediately disable the search and notify owner
- **Unflag / Mark Resolved**: Remove the flag when issue is resolved

### Review Workflow

When a user remediates a flagged search (changes cron, reduces runtime, etc.), the system automatically detects the fix and marks it for admin review:

1. **Automated Detection**: System checks every 10 minutes for searches that are no longer suspicious
2. **Status Changes**: Search status changes from `notified` to `review` (purple badge)
3. **Timer Pauses**: Countdown timer shows "Under Review" instead of counting down
4. **Admin Action Required**: Admin sees "Approve & Unflag" and "Reject Review" buttons
   - **Approve**: Removes search from flagged list (remediation complete)
   - **Reject**: Resets timer, returns to `notified` status

See [docs/REVIEW_WORKFLOW.md](docs/REVIEW_WORKFLOW.md) for detailed documentation.

### Countdown Timer

The flagged searches popup displays real-time countdown timers with color-coded urgency:

| Time Remaining | Color | Meaning |
|----------------|-------|---------|
| > 5 days | Green | Plenty of time |
| 2-5 days | Yellow | Getting close |
| 1-2 days | Orange | Time running out |
| < 24 hours | Red | Critical |
| Past deadline | Red (pulsing) | OVERDUE |

See [docs/COUNTDOWN_TIMER.md](docs/COUNTDOWN_TIMER.md) for detailed documentation.

### Settings Dashboard

Access via **Apps > User Governance > Governance Settings**

Configure:
- Runtime ratio threshold (%)
- High frequency threshold (seconds)
- Long runtime threshold (seconds)
- Remediation period (days)
- Email domain
- Admin notification email

## Configuration Files

| File | Purpose |
|------|---------|
| `default/app.conf` | App metadata |
| `default/authorize.conf` | Role-based access control |
| `default/collections.conf` | KV store definitions |
| `default/transforms.conf` | KV store lookups |
| `default/macros.conf` | SPL search macros |
| `default/savedsearches.conf` | Automated enforcement searches |
| `lookups/governance_settings.csv` | Default configuration settings |

## KV Store Collections

### flagged_searches
Stores flagged search records with status tracking.

| Field | Type | Description |
|-------|------|-------------|
| search_name | string | Name of the flagged search |
| search_owner | string | Owner username |
| search_app | string | App containing the search |
| flagged_by | string | Admin who flagged it |
| flagged_time | number | Unix timestamp when flagged |
| remediation_deadline | number | Unix timestamp of deadline |
| status | string | pending, notified, disabled, resolved |
| reason | string | Reason for flagging |

### governance_settings
Stores configurable thresholds and settings.

### governance_audit_log
Audit trail of all governance actions.

## Known Issues

### KV Store Error on Apple Silicon (M1/M2/M3 Macs)

When running Splunk in Docker on Apple Silicon Macs, you may see this error:

```
KV Store process terminated abnormally (exit code 4, status PID killed by signal 4: Illegal instruction)
```

**This does NOT affect this app.** The TA-user-governance app uses **CSV-based lookups**, not KV Store. All functionality (flagging, unflagging, audit logs, settings) works correctly despite this error.

The error occurs because Splunk's embedded MongoDB binary doesn't support ARM architecture under x86 emulation.

## Troubleshooting

### Dashboard shows no data
- Ensure you have scheduled searches in your environment
- Verify the app is installed correctly
- Check that you have admin or sc_admin role

### Emails not sending
- Verify SMTP is configured in Splunk
- Check the email domain setting matches your organization
- Review `_internal` index for email errors

### Flagging not persisting
- This app uses CSV lookups, not KV Store
- Verify lookup permissions: `ls -la $SPLUNK_HOME/etc/apps/TA-user-governance/lookups/`
- Test lookup access: `| inputlookup flagged_searches_lookup`
- KV Store errors do NOT affect this app (see Known Issues above)

## Support

For issues and feature requests, please open an issue in the repository.

## License

MIT License - See LICENSE file for details.

## Documentation

- [Review Workflow](docs/REVIEW_WORKFLOW.md) - Automated remediation detection and admin approval process
- [Countdown Timer](docs/COUNTDOWN_TIMER.md) - Real-time countdown with color-coded urgency
- [Data Storage & Audit Guide](docs/DATA_STORAGE_AUDIT.md) - CSV lookup storage, audit queries, and data management

## Version History

### 1.8.7
- Added automated review detection for remediated searches
- Added review workflow with admin approve/reject buttons
- Added real-time countdown timer with color-coded urgency
- Added overdue search detection with banner alerts
- Added "Under Review" status with purple badge
- Added dark theme support (`supported_themes = light,dark`)
- Fixed panel title visibility on Scheduled Search Governance page
- Added comprehensive unit tests (57 tests) and Playwright tests (7 tests)

### 1.0.0
- Initial release
- Scheduled search discovery and analysis
- Suspicious search detection with configurable thresholds
- Flagging workflow with email notifications
- Automated enforcement with deadline tracking
- Settings dashboard for configuration
- Complete audit logging
