# Countdown Timer Documentation

## Overview

The countdown timer provides real-time visibility into remediation deadlines for flagged scheduled searches. It displays time remaining until automatic enforcement action and uses color-coded urgency indicators.

## Features

- **Real-time updates**: Timer counts down every second
- **Color-coded urgency**: Visual indicators based on time remaining
- **Overdue detection**: Highlights searches past their deadline
- **Status-aware**: Displays differently for review/disabled statuses
- **Auto-disable integration**: Works with automated enforcement

## Timer Display States

### Active Countdown

When a search is in `pending` or `notified` status:

| Time Remaining | Class | Color | Example |
|----------------|-------|-------|---------|
| > 5 days | `countdown-normal` | Green (#2ea043) | `7d 12h` |
| 2-5 days | `countdown-warning` | Yellow (#d29922) | `4d 6h` |
| 1-2 days | `countdown-urgent` | Orange (#f85149) | `1d 18h` |
| < 24 hours | `countdown-critical` | Red (#dc4e41) | `18h 30m` |

### Special States

| Status | Display | Class | Color |
|--------|---------|-------|-------|
| Overdue | `OVERDUE 2d` | `countdown-overdue` | Red (pulsing) |
| Under Review | `Under Review` | `countdown-review` | Purple (#6f42c1) |
| Disabled | `N/A` | `countdown-disabled` | Gray (40% opacity) |

## Implementation

### JavaScript Function

```javascript
function formatCountdownTimer(deadlineEpoch, status) {
    // Handle disabled status
    if (status === 'disabled') {
        return '<span class="countdown-disabled">N/A</span>';
    }

    // Handle review status (paused timer)
    if (status === 'review') {
        return '<span class="countdown-review">Under Review</span>';
    }

    // Handle missing deadline
    if (!deadlineEpoch) {
        return '<span>-</span>';
    }

    const now = Date.now() / 1000;
    const remaining = deadlineEpoch - now;

    // Handle overdue
    if (remaining <= 0) {
        const overdueDays = Math.abs(Math.floor(remaining / 86400));
        return `<span class="countdown-overdue">OVERDUE ${overdueDays}d</span>`;
    }

    // Calculate time components
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    // Return color-coded display
    if (days > 5) {
        return `<span class="countdown-normal">${days}d ${hours}h</span>`;
    } else if (days > 2) {
        return `<span class="countdown-warning">${days}d ${hours}h</span>`;
    } else if (days > 0) {
        return `<span class="countdown-urgent">${days}d ${hours}h</span>`;
    } else {
        return `<span class="countdown-critical">${hours}h ${minutes}m</span>`;
    }
}
```

### Real-time Updates

The timer updates every second using `setInterval`:

```javascript
// Update timer every second when popup is visible
setInterval(function() {
    if (document.getElementById('metricPopupOverlay').classList.contains('active')) {
        updateCountdownTimers();
    }
}, 1000);
```

## CSS Styling

### Timer Classes

```css
/* Normal - plenty of time remaining */
.countdown-normal {
    color: #2ea043;
    font-weight: 500;
}

/* Warning - getting close */
.countdown-warning {
    color: #d29922;
    font-weight: 600;
}

/* Urgent - time running out */
.countdown-urgent {
    color: #f85149;
    font-weight: 600;
}

/* Critical - less than 24 hours */
.countdown-critical {
    color: #dc4e41;
    font-weight: 700;
}

/* Overdue - deadline passed */
.countdown-overdue {
    color: #dc4e41;
    font-weight: 700;
    animation: countdownPulse 1.5s ease-in-out infinite;
}

/* Review - paused for admin approval */
.countdown-review {
    color: #6f42c1;
    font-weight: 600;
}

/* Disabled - N/A */
.countdown-disabled {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
}
```

### Pulse Animation

```css
@keyframes countdownPulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.02); }
    100% { opacity: 1; transform: scale(1); }
}
```

## Overdue Banner

When one or more flagged searches are overdue, a banner appears at the top of the flagged searches popup:

```html
<div class="overdue-banner" style="
    background: linear-gradient(135deg, #dc4e41, #b8382b);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
">
    <span style="font-size: 24px;">⚠️</span>
    <div>
        <strong>3 searches are overdue!</strong>
        <p>These searches have exceeded their remediation deadline
           and should be disabled or have their deadline extended.</p>
    </div>
</div>
```

## Integration with Enforcement

### Deadline Lapse

When the countdown reaches zero:

1. Timer displays `OVERDUE Xd` with pulsing animation
2. Overdue banner appears in popup
3. `Governance - Check Remediation Deadlines` scheduled search (runs daily) will auto-disable

### Automatic Enforcement

The scheduled search `Governance - Check Remediation Deadlines`:

```spl
| inputlookup flagged_searches_lookup
| where status IN ("pending", "notified") AND remediation_deadline < now()
| foreach search_name [
    | rest /servicesNS/{owner}/{app}/saved/searches/{search_name}/disable method=POST
]
| eval status = "disabled"
| outputlookup flagged_searches_lookup
```

## Data Requirements

### Required Fields in flagged_searches_lookup

| Field | Type | Description |
|-------|------|-------------|
| `remediation_deadline` | number | Unix epoch timestamp of deadline |
| `status` | string | Current status (pending, notified, review, disabled) |

### Calculating Deadline

When a search is flagged, the deadline is set based on the configurable remediation period:

```javascript
const remediationDays = parseInt(settings.remediation_period) || 14;
const deadline = Math.floor(Date.now() / 1000) + (remediationDays * 86400);
```

## Troubleshooting

### Timer Not Counting Down

1. **Check popup is visible**: Timer only updates when `#metricPopupOverlay.active` exists
2. **Verify JavaScript interval**: Look for errors in browser console
3. **Check deadline field**: Ensure `remediation_deadline` is a valid Unix timestamp

### Timer Shows Wrong Time

1. **Timezone issues**: All timestamps should be in Unix epoch (seconds since 1970)
2. **Verify calculation**:
   ```javascript
   const now = Date.now() / 1000;  // JavaScript uses milliseconds
   const remaining = deadlineEpoch - now;
   ```

### Overdue Banner Not Appearing

1. **Check overdue detection logic**:
   ```javascript
   const hasOverdue = searches.some(s =>
       s.remediation_deadline < (Date.now() / 1000) &&
       (s.status === 'pending' || s.status === 'notified')
   );
   ```
2. **Verify status values**: Only `pending` and `notified` trigger overdue detection

## Best Practices

1. **Set reasonable deadlines**: Default 14 days gives users time to remediate
2. **Monitor overdue searches**: Review flagged popup regularly
3. **Use extend deadline sparingly**: Consider why remediation is delayed
4. **Document extensions**: Use audit log to track deadline changes
