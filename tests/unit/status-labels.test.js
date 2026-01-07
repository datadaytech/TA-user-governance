/**
 * Unit Tests for Status Label Logic
 * Tests validation, transitions, and color mapping
 */

describe('Status Labels Unit Tests', () => {

    // Mock status configuration
    const STATUS_CONFIG = {
        suspicious: { label: 'Suspicious', color: '#F8BE34', canFlagOnly: true },
        pending: { label: 'Flagged', color: '#f8991d', isFlagged: true },
        notified: { label: 'Notified', color: '#f8be34', isFlagged: true },
        review: { label: 'Pending Review', color: '#6f42c1', isFlagged: true },
        disabled: { label: 'Disabled', color: '#dc4e41', isFlagged: false },
        resolved: { label: 'Resolved (Unflag)', color: '#53a051', isFlagged: false }
    };

    const VALID_TRANSITIONS = {
        suspicious: ['pending'],
        pending: ['notified', 'review', 'disabled', 'resolved'],
        notified: ['review', 'disabled', 'resolved'],
        review: ['disabled', 'resolved'],
        disabled: [],
        resolved: []
    };

    describe('Status Configuration', () => {

        test('should have all required statuses', () => {
            const requiredStatuses = ['suspicious', 'pending', 'notified', 'review', 'disabled', 'resolved'];
            requiredStatuses.forEach(status => {
                expect(STATUS_CONFIG[status]).toBeDefined();
            });
        });

        test('should have labels for all statuses', () => {
            Object.values(STATUS_CONFIG).forEach(config => {
                expect(config.label).toBeDefined();
                expect(typeof config.label).toBe('string');
                expect(config.label.length).toBeGreaterThan(0);
            });
        });

        test('should have colors for all statuses', () => {
            Object.values(STATUS_CONFIG).forEach(config => {
                expect(config.color).toBeDefined();
                expect(config.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
            });
        });

        test('should mark suspicious as canFlagOnly', () => {
            expect(STATUS_CONFIG.suspicious.canFlagOnly).toBe(true);
        });

        test('should mark disabled and resolved as not flagged', () => {
            expect(STATUS_CONFIG.disabled.isFlagged).toBe(false);
            expect(STATUS_CONFIG.resolved.isFlagged).toBe(false);
        });

        test('should mark pending, notified, review as flagged', () => {
            expect(STATUS_CONFIG.pending.isFlagged).toBe(true);
            expect(STATUS_CONFIG.notified.isFlagged).toBe(true);
            expect(STATUS_CONFIG.review.isFlagged).toBe(true);
        });
    });

    describe('Status Validation', () => {

        const isValidStatus = (status) => {
            return Object.keys(STATUS_CONFIG).includes(status);
        };

        test('should validate known statuses', () => {
            expect(isValidStatus('suspicious')).toBe(true);
            expect(isValidStatus('pending')).toBe(true);
            expect(isValidStatus('notified')).toBe(true);
            expect(isValidStatus('review')).toBe(true);
            expect(isValidStatus('disabled')).toBe(true);
            expect(isValidStatus('resolved')).toBe(true);
        });

        test('should reject invalid statuses', () => {
            expect(isValidStatus('unknown')).toBe(false);
            expect(isValidStatus('')).toBe(false);
            expect(isValidStatus(null)).toBe(false);
            expect(isValidStatus(undefined)).toBe(false);
            expect(isValidStatus('PENDING')).toBe(false); // Case sensitive
        });
    });

    describe('Status Transitions', () => {

        const canTransition = (from, to) => {
            if (!VALID_TRANSITIONS[from]) return false;
            return VALID_TRANSITIONS[from].includes(to);
        };

        test('suspicious can only transition to pending (flagged)', () => {
            expect(canTransition('suspicious', 'pending')).toBe(true);
            expect(canTransition('suspicious', 'notified')).toBe(false);
            expect(canTransition('suspicious', 'review')).toBe(false);
            expect(canTransition('suspicious', 'disabled')).toBe(false);
            expect(canTransition('suspicious', 'resolved')).toBe(false);
        });

        test('pending can transition to all other flagged states or unflagged states', () => {
            expect(canTransition('pending', 'notified')).toBe(true);
            expect(canTransition('pending', 'review')).toBe(true);
            expect(canTransition('pending', 'disabled')).toBe(true);
            expect(canTransition('pending', 'resolved')).toBe(true);
        });

        test('notified can transition to review, disabled, or resolved', () => {
            expect(canTransition('notified', 'review')).toBe(true);
            expect(canTransition('notified', 'disabled')).toBe(true);
            expect(canTransition('notified', 'resolved')).toBe(true);
            expect(canTransition('notified', 'pending')).toBe(false);
        });

        test('review can transition to disabled or resolved', () => {
            expect(canTransition('review', 'disabled')).toBe(true);
            expect(canTransition('review', 'resolved')).toBe(true);
            expect(canTransition('review', 'pending')).toBe(false);
            expect(canTransition('review', 'notified')).toBe(false);
        });

        test('disabled is terminal - no transitions', () => {
            expect(VALID_TRANSITIONS.disabled.length).toBe(0);
            expect(canTransition('disabled', 'resolved')).toBe(false);
        });

        test('resolved is terminal - no transitions', () => {
            expect(VALID_TRANSITIONS.resolved.length).toBe(0);
            expect(canTransition('resolved', 'pending')).toBe(false);
        });
    });

    describe('Status Display Logic', () => {

        const getDisplayLabel = (status) => {
            return STATUS_CONFIG[status]?.label || 'Unknown';
        };

        const getStatusColor = (status) => {
            return STATUS_CONFIG[status]?.color || '#cccccc';
        };

        test('should return correct display labels', () => {
            expect(getDisplayLabel('suspicious')).toBe('Suspicious');
            expect(getDisplayLabel('pending')).toBe('Flagged');
            expect(getDisplayLabel('notified')).toBe('Notified');
            expect(getDisplayLabel('review')).toBe('Pending Review');
            expect(getDisplayLabel('disabled')).toBe('Disabled');
            expect(getDisplayLabel('resolved')).toBe('Resolved (Unflag)');
        });

        test('should return Unknown for invalid status', () => {
            expect(getDisplayLabel('invalid')).toBe('Unknown');
            expect(getDisplayLabel(null)).toBe('Unknown');
        });

        test('should return correct colors', () => {
            expect(getStatusColor('suspicious')).toBe('#F8BE34');
            expect(getStatusColor('pending')).toBe('#f8991d');
            expect(getStatusColor('disabled')).toBe('#dc4e41');
            expect(getStatusColor('resolved')).toBe('#53a051');
        });

        test('should return fallback color for invalid status', () => {
            expect(getStatusColor('invalid')).toBe('#cccccc');
        });
    });

    describe('Flagged Count Logic', () => {

        const isFlagged = (status) => {
            return STATUS_CONFIG[status]?.isFlagged === true;
        };

        test('suspicious is NOT flagged (separate count)', () => {
            expect(isFlagged('suspicious')).toBe(false);
        });

        test('pending, notified, review are flagged', () => {
            expect(isFlagged('pending')).toBe(true);
            expect(isFlagged('notified')).toBe(true);
            expect(isFlagged('review')).toBe(true);
        });

        test('disabled is NOT flagged (falls off)', () => {
            expect(isFlagged('disabled')).toBe(false);
        });

        test('resolved is NOT flagged', () => {
            expect(isFlagged('resolved')).toBe(false);
        });

        test('should count correctly for a list of searches', () => {
            const searches = [
                { name: 'Search1', status: 'pending' },
                { name: 'Search2', status: 'notified' },
                { name: 'Search3', status: 'review' },
                { name: 'Search4', status: 'disabled' },
                { name: 'Search5', status: 'resolved' },
                { name: 'Search6', status: 'suspicious' }
            ];

            const flaggedCount = searches.filter(s => isFlagged(s.status)).length;
            expect(flaggedCount).toBe(3); // pending, notified, review

            const suspiciousCount = searches.filter(s => s.status === 'suspicious').length;
            expect(suspiciousCount).toBe(1);

            const disabledCount = searches.filter(s => s.status === 'disabled').length;
            expect(disabledCount).toBe(1);
        });
    });

    describe('Status Dropdown Options', () => {

        const getDropdownOptions = (currentStatus, isSuspiciousModal = false) => {
            if (isSuspiciousModal) {
                return [{ value: 'pending', label: 'Flag for Review' }];
            }

            return [
                { value: 'pending', label: 'Flagged' },
                { value: 'notified', label: 'Notified' },
                { value: 'review', label: 'Pending Review' },
                { value: 'disabled', label: 'Disabled' },
                { value: 'resolved', label: 'Resolved (Unflag)' }
            ].filter(opt => opt.value !== currentStatus);
        };

        test('suspicious modal should only show Flag option', () => {
            const options = getDropdownOptions('suspicious', true);
            expect(options.length).toBe(1);
            expect(options[0].value).toBe('pending');
            expect(options[0].label).toBe('Flag for Review');
        });

        test('flagged modal should show all options except current', () => {
            const options = getDropdownOptions('pending', false);
            expect(options.length).toBe(4);
            expect(options.some(o => o.value === 'pending')).toBe(false);
            expect(options.some(o => o.value === 'notified')).toBe(true);
            expect(options.some(o => o.value === 'review')).toBe(true);
            expect(options.some(o => o.value === 'disabled')).toBe(true);
            expect(options.some(o => o.value === 'resolved')).toBe(true);
        });

        test('notified status should show all options except notified', () => {
            const options = getDropdownOptions('notified', false);
            expect(options.length).toBe(4);
            expect(options.some(o => o.value === 'notified')).toBe(false);
        });
    });

    describe('Audit Log Entry Generation', () => {

        const generateAuditEntry = (action, searchName, oldStatus, newStatus, performedBy) => {
            return {
                timestamp: Math.floor(Date.now() / 1000),
                action: action,
                search_name: searchName,
                old_status: oldStatus || '',
                new_status: newStatus || '',
                performed_by: performedBy,
                details: `Status changed from ${oldStatus || 'none'} to ${newStatus}`
            };
        };

        test('should generate valid audit entry for status change', () => {
            const entry = generateAuditEntry('status_change', 'Test_Search', 'pending', 'notified', 'admin');

            expect(entry.action).toBe('status_change');
            expect(entry.search_name).toBe('Test_Search');
            expect(entry.old_status).toBe('pending');
            expect(entry.new_status).toBe('notified');
            expect(entry.performed_by).toBe('admin');
            expect(entry.timestamp).toBeValidEpoch();
        });

        test('should handle initial flag (no old status)', () => {
            const entry = generateAuditEntry('flag', 'New_Search', null, 'pending', 'admin');

            expect(entry.old_status).toBe('');
            expect(entry.new_status).toBe('pending');
            expect(entry.details).toContain('none to pending');
        });

        test('should handle unflag (resolved)', () => {
            const entry = generateAuditEntry('unflag', 'Old_Search', 'review', 'resolved', 'admin');

            expect(entry.old_status).toBe('review');
            expect(entry.new_status).toBe('resolved');
        });
    });

    describe('Edge Cases', () => {

        test('should handle null/undefined status gracefully', () => {
            const getLabel = (status) => STATUS_CONFIG[status]?.label || 'Unknown';

            expect(getLabel(null)).toBe('Unknown');
            expect(getLabel(undefined)).toBe('Unknown');
            expect(getLabel('')).toBe('Unknown');
        });

        test('should handle status with different casing', () => {
            const normalizeStatus = (status) => {
                if (!status) return null;
                return status.toString().toLowerCase().trim();
            };

            expect(normalizeStatus('PENDING')).toBe('pending');
            expect(normalizeStatus('Notified')).toBe('notified');
            expect(normalizeStatus('  review  ')).toBe('review');
        });

        test('should handle concurrent status updates correctly', () => {
            // Simulating concurrent updates - last write wins
            let currentStatus = 'pending';
            const updates = [];

            const updateStatus = (newStatus) => {
                const oldStatus = currentStatus;
                currentStatus = newStatus;
                updates.push({ old: oldStatus, new: newStatus, time: Date.now() });
            };

            updateStatus('notified');
            updateStatus('review');

            expect(currentStatus).toBe('review');
            expect(updates.length).toBe(2);
        });
    });
});
