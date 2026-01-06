/**
 * Unit tests for review status functionality
 */

describe('Review Status Functionality', () => {

  // Mock the status badge function
  const getStatusBadges = (status) => {
    const badgeStyles = {
      flagged: 'background: #f8991d; color: #000;',
      pending: 'background: #f8991d; color: #000;',
      notified: 'background: #5cc05c; color: #000;',
      enabled: 'background: #2ea043; color: #fff;',
      disabled: 'background: #dc4e41; color: #fff;',
      review: 'background: #6f42c1; color: #fff;'
    };

    const badgeLabels = {
      flagged: 'FLAGGED',
      pending: 'FLAGGED',
      notified: 'NOTIFIED',
      enabled: 'ENABLED',
      disabled: 'DISABLED',
      review: 'PENDING REVIEW'
    };

    const statusLower = (status || '').toLowerCase();
    if (badgeStyles[statusLower]) {
      return `<span class="status-badge ${statusLower}" style="${badgeStyles[statusLower]}">${badgeLabels[statusLower]}</span>`;
    }
    return `<span class="status-badge">${status || '-'}</span>`;
  };

  // Mock the countdown timer formatter
  const formatCountdownTimer = (deadlineEpoch, status) => {
    if (status === 'disabled') {
      return '<span class="countdown-disabled">N/A</span>';
    }

    if (status === 'review') {
      return '<span class="countdown-review">Under Review</span>';
    }

    if (!deadlineEpoch) {
      return '<span>-</span>';
    }

    const now = Date.now() / 1000;
    const remaining = deadlineEpoch - now;

    if (remaining <= 0) {
      const overdueDays = Math.abs(Math.floor(remaining / 86400));
      return `<span class="countdown-overdue">OVERDUE ${overdueDays}d</span>`;
    }

    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    if (days > 5) {
      return `<span class="countdown-normal">${days}d ${hours}h</span>`;
    } else if (days > 2) {
      return `<span class="countdown-warning">${days}d ${hours}h</span>`;
    } else if (days > 0) {
      return `<span class="countdown-urgent">${days}d ${hours}h</span>`;
    } else {
      return `<span class="countdown-critical">${hours}h ${minutes}m</span>`;
    }
  };

  describe('getStatusBadges', () => {

    test('should return review badge for review status', () => {
      const badge = getStatusBadges('review');
      expect(badge).toContain('PENDING REVIEW');
      expect(badge).toContain('#6f42c1'); // Purple color
    });

    test('should return flagged badge for pending status', () => {
      const badge = getStatusBadges('pending');
      expect(badge).toContain('FLAGGED');
      expect(badge).toContain('#f8991d'); // Orange color
    });

    test('should return notified badge for notified status', () => {
      const badge = getStatusBadges('notified');
      expect(badge).toContain('NOTIFIED');
      expect(badge).toContain('#5cc05c'); // Green color
    });

    test('should return disabled badge for disabled status', () => {
      const badge = getStatusBadges('disabled');
      expect(badge).toContain('DISABLED');
      expect(badge).toContain('#dc4e41'); // Red color
    });

    test('should return enabled badge for enabled status', () => {
      const badge = getStatusBadges('enabled');
      expect(badge).toContain('ENABLED');
      expect(badge).toContain('#2ea043'); // Green color
    });

    test('should handle uppercase status', () => {
      const badge = getStatusBadges('REVIEW');
      expect(badge).toContain('PENDING REVIEW');
    });

    test('should handle null status', () => {
      const badge = getStatusBadges(null);
      expect(badge).toContain('-');
    });

    test('should handle unknown status', () => {
      const badge = getStatusBadges('unknown');
      expect(badge).toContain('unknown');
    });

  });

  describe('formatCountdownTimer', () => {

    test('should return "Under Review" for review status', () => {
      const timer = formatCountdownTimer(Date.now() / 1000 + 86400, 'review');
      expect(timer).toContain('Under Review');
      expect(timer).toContain('countdown-review');
    });

    test('should return "N/A" for disabled status', () => {
      const timer = formatCountdownTimer(Date.now() / 1000 + 86400, 'disabled');
      expect(timer).toContain('N/A');
      expect(timer).toContain('countdown-disabled');
    });

    test('should return "-" for null deadline', () => {
      const timer = formatCountdownTimer(null, 'pending');
      expect(timer).toContain('-');
    });

    test('should return overdue message for past deadline', () => {
      const pastDeadline = Date.now() / 1000 - (2 * 86400); // 2 days ago
      const timer = formatCountdownTimer(pastDeadline, 'pending');
      expect(timer).toContain('OVERDUE');
      expect(timer).toContain('countdown-overdue');
    });

    test('should return normal countdown for deadline > 5 days', () => {
      const futureDeadline = Date.now() / 1000 + (7 * 86400); // 7 days from now
      const timer = formatCountdownTimer(futureDeadline, 'pending');
      expect(timer).toContain('countdown-normal');
      expect(timer).toMatch(/\d+d/);
    });

    test('should return warning countdown for deadline 2-5 days', () => {
      const futureDeadline = Date.now() / 1000 + (3 * 86400); // 3 days from now
      const timer = formatCountdownTimer(futureDeadline, 'pending');
      expect(timer).toContain('countdown-warning');
    });

    test('should return urgent countdown for deadline 1-2 days', () => {
      const futureDeadline = Date.now() / 1000 + (1.5 * 86400); // 1.5 days from now
      const timer = formatCountdownTimer(futureDeadline, 'pending');
      expect(timer).toContain('countdown-urgent');
    });

    test('should return critical countdown for deadline < 1 day', () => {
      const futureDeadline = Date.now() / 1000 + (12 * 3600); // 12 hours from now
      const timer = formatCountdownTimer(futureDeadline, 'pending');
      expect(timer).toContain('countdown-critical');
      expect(timer).toMatch(/\d+h/);
    });

  });

  describe('Review Button Visibility Logic', () => {

    const updateReviewButtonsVisibility = (searches) => {
      const hasDisabled = searches.some(s => s.status === 'disabled');
      const hasPendingOrNotified = searches.some(s => s.status === 'pending' || s.status === 'notified');
      const hasReview = searches.some(s => s.status === 'review');

      return {
        enableButton: hasDisabled,
        submitReviewButton: hasPendingOrNotified,
        approveButton: hasReview,
        rejectButton: hasReview
      };
    };

    test('should show Submit for Review when pending searches exist', () => {
      const searches = [
        { name: 'search1', status: 'pending' },
        { name: 'search2', status: 'disabled' }
      ];
      const visibility = updateReviewButtonsVisibility(searches);
      expect(visibility.submitReviewButton).toBe(true);
    });

    test('should show Approve/Reject when review searches exist', () => {
      const searches = [
        { name: 'search1', status: 'review' },
        { name: 'search2', status: 'pending' }
      ];
      const visibility = updateReviewButtonsVisibility(searches);
      expect(visibility.approveButton).toBe(true);
      expect(visibility.rejectButton).toBe(true);
    });

    test('should show Enable when disabled searches exist', () => {
      const searches = [
        { name: 'search1', status: 'disabled' },
        { name: 'search2', status: 'review' }
      ];
      const visibility = updateReviewButtonsVisibility(searches);
      expect(visibility.enableButton).toBe(true);
    });

    test('should hide Submit for Review when only review/disabled searches', () => {
      const searches = [
        { name: 'search1', status: 'review' },
        { name: 'search2', status: 'disabled' }
      ];
      const visibility = updateReviewButtonsVisibility(searches);
      expect(visibility.submitReviewButton).toBe(false);
    });

    test('should hide Approve/Reject when no review searches', () => {
      const searches = [
        { name: 'search1', status: 'pending' },
        { name: 'search2', status: 'notified' }
      ];
      const visibility = updateReviewButtonsVisibility(searches);
      expect(visibility.approveButton).toBe(false);
      expect(visibility.rejectButton).toBe(false);
    });

    test('should handle empty search array', () => {
      const visibility = updateReviewButtonsVisibility([]);
      expect(visibility.enableButton).toBe(false);
      expect(visibility.submitReviewButton).toBe(false);
      expect(visibility.approveButton).toBe(false);
      expect(visibility.rejectButton).toBe(false);
    });

  });

  describe('Overdue Search Detection', () => {

    const checkOverdueSearches = (searches) => {
      const now = Date.now() / 1000;
      return searches.filter(s => {
        return s.deadlineEpoch &&
               (s.status === 'pending' || s.status === 'notified') &&
               s.deadlineEpoch < now;
      });
    };

    test('should detect overdue pending searches', () => {
      const searches = [
        { name: 'search1', status: 'pending', deadlineEpoch: Date.now() / 1000 - 86400 },
        { name: 'search2', status: 'pending', deadlineEpoch: Date.now() / 1000 + 86400 }
      ];
      const overdue = checkOverdueSearches(searches);
      expect(overdue.length).toBe(1);
      expect(overdue[0].name).toBe('search1');
    });

    test('should not flag review status as overdue', () => {
      const searches = [
        { name: 'search1', status: 'review', deadlineEpoch: Date.now() / 1000 - 86400 }
      ];
      const overdue = checkOverdueSearches(searches);
      expect(overdue.length).toBe(0);
    });

    test('should not flag disabled status as overdue', () => {
      const searches = [
        { name: 'search1', status: 'disabled', deadlineEpoch: Date.now() / 1000 - 86400 }
      ];
      const overdue = checkOverdueSearches(searches);
      expect(overdue.length).toBe(0);
    });

    test('should handle searches without deadlines', () => {
      const searches = [
        { name: 'search1', status: 'pending', deadlineEpoch: null }
      ];
      const overdue = checkOverdueSearches(searches);
      expect(overdue.length).toBe(0);
    });

  });

});
