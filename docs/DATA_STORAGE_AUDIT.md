# Data Storage and Audit Guide

## Overview

The TA-user-governance app uses **CSV-based lookup files** for data storage. This approach provides:

- **Easy auditing**: CSV files can be viewed with any text editor or spreadsheet
- **Portability**: Files are included in app backups automatically
- **Compatibility**: Works reliably without KV store dependencies
- **Version control**: Changes can be tracked if lookups are committed to git

## Data Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA STORAGE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CSV Lookups (Primary Storage)                                  │
│  ├── flagged_searches.csv      → Flagged search records         │
│  ├── governance_audit_log.csv  → Complete audit trail           │
│  ├── governance_settings.csv   → Configuration settings          │
│  ├── governance_search_cache.csv → Cached search analysis       │
│  ├── search_svc_usage.csv      → SVC usage metrics              │
│  └── cron_frequency.csv        → Cron to seconds mapping        │
│                                                                  │
│  KV Store Collections (Defined but CSV preferred)               │
│  ├── flagged_searches          → Alternative storage            │
│  ├── governance_settings       → Alternative storage            │
│  └── governance_audit_log      → Alternative storage            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Lookup File Details

### flagged_searches.csv

Stores all flagged scheduled search records.

| Field | Type | Description |
|-------|------|-------------|
| `search_name` | string | Name of the flagged search |
| `search_owner` | string | Owner username |
| `search_app` | string | App containing the search |
| `flagged_by` | string | Admin who flagged it |
| `flagged_time` | number | Unix timestamp when flagged |
| `notification_sent` | bool | Whether notification was sent |
| `notification_time` | number | Unix timestamp of notification |
| `remediation_deadline` | number | Unix timestamp of deadline |
| `status` | string | pending, notified, review, disabled |
| `reason` | string | Reason for flagging |
| `notes` | string | Additional notes |

### governance_audit_log.csv

Complete audit trail of all governance actions.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | number | Unix timestamp of action |
| `action` | string | Action type (see below) |
| `search_name` | string | Affected search name |
| `performed_by` | string | User who performed action |
| `details` | string | Additional context |

**Action Types:**
- `flagged` - Search was flagged
- `unflagged` - Flag was removed
- `notification_sent` - Email notification sent
- `reminder_sent` - Reminder email sent
- `deadline_extended` - Deadline was extended
- `disabled` - Search was disabled
- `enabled` - Search was re-enabled
- `auto_review` - System marked for review
- `review_approved` - Admin approved remediation
- `review_rejected` - Admin rejected review

### governance_settings.csv

Configuration settings for thresholds and behavior.

| Field | Type | Description |
|-------|------|-------------|
| `setting_name` | string | Setting identifier |
| `setting_value` | string | Setting value |
| `description` | string | Human-readable description |

### governance_search_cache.csv

Cached analysis of all scheduled searches.

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Search name |
| `owner` | string | Search owner |
| `app` | string | App name |
| `cron_schedule` | string | Cron expression |
| `is_suspicious` | number | 1 = suspicious, 0 = normal |
| `suspicious_reasons` | string | Why it's suspicious |
| `avg_runtime` | number | Average runtime in seconds |
| `frequency_seconds` | number | Run frequency in seconds |

## Auditing the Data

### Method 1: Splunk Searches

#### View All Flagged Searches

```spl
| inputlookup flagged_searches_lookup
| table search_name, search_owner, status, flagged_time, remediation_deadline, reason
| sort - flagged_time
```

#### View Audit Log

```spl
| inputlookup governance_audit_log_lookup
| eval time = strftime(timestamp, "%Y-%m-%d %H:%M:%S")
| table time, action, search_name, performed_by, details
| sort - timestamp
```

#### View Searches in Review Status

```spl
| inputlookup flagged_searches_lookup
| where status="review"
| table search_name, search_owner, flagged_time, reason
```

#### View Overdue Searches

```spl
| inputlookup flagged_searches_lookup
| where status IN ("pending", "notified") AND remediation_deadline < now()
| eval overdue_days = round((now() - remediation_deadline) / 86400, 1)
| table search_name, search_owner, status, overdue_days, reason
| sort - overdue_days
```

#### Audit Actions by User

```spl
| inputlookup governance_audit_log_lookup
| stats count by performed_by, action
| sort - count
```

#### Timeline of Actions for Specific Search

```spl
| inputlookup governance_audit_log_lookup
| where search_name="Your Search Name Here"
| eval time = strftime(timestamp, "%Y-%m-%d %H:%M:%S")
| table time, action, performed_by, details
| sort timestamp
```

### Method 2: Direct File Access

CSV files are stored in: `$SPLUNK_HOME/etc/apps/TA-user-governance/lookups/`

#### View files directly:

```bash
# On Splunk server
cat $SPLUNK_HOME/etc/apps/TA-user-governance/lookups/flagged_searches.csv
cat $SPLUNK_HOME/etc/apps/TA-user-governance/lookups/governance_audit_log.csv
```

#### Using Docker:

```bash
docker exec splunk-dev cat /opt/splunk/etc/apps/TA-user-governance/lookups/flagged_searches.csv
docker exec splunk-dev cat /opt/splunk/etc/apps/TA-user-governance/lookups/governance_audit_log.csv
```

### Method 3: Export to CSV

```spl
| inputlookup flagged_searches_lookup
| outputcsv flagged_searches_export.csv
```

Download from: `$SPLUNK_HOME/var/run/splunk/csv/flagged_searches_export.csv`

## Audit Reports

### Weekly Governance Summary

```spl
| inputlookup governance_audit_log_lookup
| where timestamp > relative_time(now(), "-7d")
| stats count by action
| eval category = case(
    action IN ("flagged", "unflagged"), "Flagging",
    action IN ("notification_sent", "reminder_sent"), "Notifications",
    action IN ("disabled", "enabled"), "Enforcement",
    action IN ("auto_review", "review_approved", "review_rejected"), "Reviews",
    1=1, "Other"
)
| stats sum(count) as total by category
```

### Compliance Report - Flagged vs Remediated

```spl
| inputlookup flagged_searches_lookup
| stats count by status
| eval percentage = round(count / sum(count) * 100, 1)."%"
| table status, count, percentage
```

### Overdue Analysis

```spl
| inputlookup flagged_searches_lookup
| where status IN ("pending", "notified")
| eval is_overdue = if(remediation_deadline < now(), 1, 0)
| stats count(eval(is_overdue=1)) as overdue, count(eval(is_overdue=0)) as on_track
| eval overdue_pct = round(overdue / (overdue + on_track) * 100, 1)."%"
```

## Data Retention

### Manual Cleanup

To remove old audit log entries (older than 90 days):

```spl
| inputlookup governance_audit_log_lookup
| where timestamp > relative_time(now(), "-90d")
| outputlookup governance_audit_log_lookup
```

### Archive Old Records

```spl
| inputlookup governance_audit_log_lookup
| where timestamp < relative_time(now(), "-90d")
| outputcsv governance_audit_archive_YYYYMMDD.csv
```

## Backup and Restore

### Backup

```bash
# Backup all lookup files
tar -czvf governance_lookups_backup_$(date +%Y%m%d).tar.gz \
    $SPLUNK_HOME/etc/apps/TA-user-governance/lookups/*.csv
```

### Restore

```bash
# Restore from backup
tar -xzvf governance_lookups_backup_YYYYMMDD.tar.gz \
    -C $SPLUNK_HOME/etc/apps/TA-user-governance/lookups/
```

## Troubleshooting

### Lookup Not Found

```spl
| inputlookup flagged_searches_lookup
```

If this returns an error, check:
1. File exists: `ls $SPLUNK_HOME/etc/apps/TA-user-governance/lookups/`
2. Permissions: Files should be readable by Splunk user
3. transforms.conf: Verify lookup definition exists

### Data Not Updating

1. Check scheduled searches are enabled
2. Verify `outputlookup` commands have write access
3. Check for disk space issues

### Corrupt CSV

If a CSV file becomes corrupt:
1. Check for backup in `lookups/` directory
2. Restore from git or backup
3. Re-initialize with empty header row
