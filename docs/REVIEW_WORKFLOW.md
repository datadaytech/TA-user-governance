# Review Workflow Documentation

## Overview

The Review Workflow is an automated process that detects when users have remediated flagged scheduled searches, pauses the enforcement timer, and queues them for admin approval. This provides a balance between automated detection and human oversight.

## Workflow States

### Status Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌───────────┐
│ FLAGGED  │ ──▶ │ NOTIFIED │ ──▶ │  REVIEW  │ ──▶ │ UNFLAGGED │
│ (orange) │     │ (green)  │     │ (purple) │     │ (removed) │
└──────────┘     └──────────┘     └──────────┘     └───────────┘
      │               │                 │
      │               │                 ▼
      │               │          ┌───────────┐
      └───────────────┴─────────▶│ DISABLED  │ (if deadline lapses)
                                 │   (red)   │
                                 └───────────┘
```

### Status Definitions

| Status | Badge Color | Description |
|--------|-------------|-------------|
| `pending` / `flagged` | Orange | Search flagged, awaiting notification |
| `notified` | Green | Owner has been notified, timer counting down |
| `review` | Purple | Search remediated, awaiting admin approval |
| `disabled` | Red | Search was auto-disabled due to lapsed deadline |

## Automated Detection

### How It Works

The system automatically detects when a flagged search has been remediated through scheduled searches that run in the background.

#### Detection Searches

1. **Governance - Detect Remediated Searches** (every 15 minutes)
   - Compares flagged searches against the current suspicious search cache
   - Identifies searches that are no longer flagged as suspicious

2. **Governance - Update Remediated Status** (every 10 minutes)
   - Reads `flagged_searches_lookup`
   - Joins with `governance_search_cache.csv` to check `is_suspicious` flag
   - If a search was `pending` or `notified` but `is_suspicious=0`, updates status to `review`

### Detection Logic

```spl
| inputlookup flagged_searches_lookup
| eval orig_status = status
| join type=left search_name [
    | inputlookup governance_search_cache.csv
    | rename title as search_name
    | table search_name, is_suspicious
]
| eval auto_review = if(orig_status IN ("pending", "notified") AND (is_suspicious=0 OR isnull(is_suspicious)), 1, 0)
| eval status = if(auto_review=1, "review", status)
| outputlookup flagged_searches_lookup
```

### What Triggers Remediation Detection

A search is considered "remediated" when it no longer meets the suspicious criteria:

- **Cron expression changed**: e.g., `* * * * *` changed to `0 0 * * *`
- **Runtime reduced**: Average runtime decreased below threshold
- **Frequency reduced**: Schedule changed to run less frequently
- **Runtime/frequency ratio improved**: No longer exceeds 10% threshold
- **Wasteful patterns removed**: Removed `index=*`, `| join`, etc.

## Countdown Timer

### Display States

The countdown timer in the flagged searches popup shows different states:

| Condition | Display | Color |
|-----------|---------|-------|
| > 5 days remaining | `7d 12h` | Green |
| 2-5 days remaining | `4d 6h` | Yellow |
| 1-2 days remaining | `1d 18h` | Orange |
| < 24 hours | `18h 30m` | Red |
| Deadline passed | `OVERDUE 2d` | Red (pulsing) |
| Review status | `Under Review` | Purple |
| Disabled status | `N/A` | Gray |

### Timer Behavior

- **Active**: Timer counts down in real-time (updates every second)
- **Paused**: When status is `review`, timer shows "Under Review" and stops counting
- **N/A**: When status is `disabled`, timer shows "N/A"

## Admin Actions

### Buttons in Flagged Popup

| Button | Visibility | Action |
|--------|------------|--------|
| **Submit for Review** | When `pending` or `notified` searches exist | Manually submits selected searches for admin review |
| **Approve & Unflag** | When `review` searches exist | Removes search from flagged list entirely |
| **Reject Review** | When `review` searches exist | Resets status to `notified`, restarts timer |
| **Enable** | When `disabled` searches exist | Re-enables disabled searches |

### Approve Workflow

When admin clicks "Approve & Unflag":

1. All selected searches with `review` status are identified
2. Audit log entry is created for each approval
3. Searches are removed from `flagged_searches_lookup`
4. Searches return to normal operation (no longer governed)

### Reject Workflow

When admin clicks "Reject Review":

1. All selected searches with `review` status are identified
2. Status is reset to `notified`
3. Remediation deadline is reset (new countdown starts)
4. Audit log entry is created
5. Owner may receive notification that review was rejected

## Configuration

### Scheduled Search Settings

| Search | Default Schedule | Purpose |
|--------|------------------|---------|
| `Governance - Update Remediated Status` | `*/10 * * * *` | Check for remediated searches |
| `Governance - Detect Remediated Searches` | `*/15 * * * *` | Detect fixed searches |
| `Governance - Update Notification Status` | `*/35 * * * *` | Update notification states |

### Modifying Detection Interval

To change how often the system checks for remediated searches, update the cron schedule in `default/savedsearches.conf`:

```ini
[Governance - Update Remediated Status]
cron_schedule = */5 * * * *  # Check every 5 minutes instead of 10
```

## UI Components

### Status Badge Styling

```css
/* Review status badge */
.status-badge.review {
    background: #6f42c1;
    color: #fff;
}
```

### Countdown Timer Classes

```css
.countdown-normal   { color: #2ea043; }  /* Green - > 5 days */
.countdown-warning  { color: #d29922; }  /* Yellow - 2-5 days */
.countdown-urgent   { color: #f85149; }  /* Orange - 1-2 days */
.countdown-critical { color: #dc4e41; }  /* Red - < 24 hours */
.countdown-overdue  { color: #dc4e41; animation: pulse; }
.countdown-review   { color: #6f42c1; }  /* Purple - Under Review */
.countdown-disabled { color: rgba(255,255,255,0.4); }  /* Gray - N/A */
```

## Audit Trail

All review workflow actions are logged to `governance_audit_log`:

| Action | Description |
|--------|-------------|
| `auto_review` | System automatically marked search for review |
| `review_approved` | Admin approved and unflagged search |
| `review_rejected` | Admin rejected review, timer reset |
| `manual_review_submit` | User manually submitted for review |

## Troubleshooting

### Search Not Auto-Detecting as Remediated

1. **Check cache freshness**: Ensure `Governance - Build Search Cache` has run recently
2. **Verify is_suspicious value**:
   ```spl
   | inputlookup governance_search_cache.csv
   | search title="Your Search Name"
   | table title, is_suspicious, suspicious_reasons
   ```
3. **Check scheduled search is enabled**: Verify `Governance - Update Remediated Status` is enabled

### Review Status Not Appearing

1. **Check flagged_searches_lookup**:
   ```spl
   | inputlookup flagged_searches_lookup
   | search status="review"
   ```
2. **Verify JavaScript loaded**: Check browser console for errors
3. **Force cache refresh**: Bump Splunk's static file cache

### Timer Not Updating

1. **Check JavaScript interval**: Timer updates are handled by `setInterval` in governance.js
2. **Verify popup is active**: Timer only updates when popup overlay is visible
3. **Check browser console**: Look for JavaScript errors

## API Reference

### REST Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/servicesNS/{user}/{app}/saved/searches/{name}/enable` | POST | Re-enable disabled search |
| `/servicesNS/{user}/{app}/saved/searches/{name}/disable` | POST | Disable search |

### Lookup Tables

| Lookup | Purpose |
|--------|---------|
| `flagged_searches_lookup` | Stores all flagged search records |
| `governance_search_cache.csv` | Cached search analysis with `is_suspicious` flag |
| `governance_audit_log` | Audit trail of all actions |
