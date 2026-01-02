#!/usr/bin/env python
"""
send_notification.py - Send email notifications for governance actions

This script handles sending email notifications to search owners when their
scheduled searches are flagged, reminded, or disabled.

Usage:
    Called by alert action or manually with appropriate parameters
"""

import sys
import os
import json
import time

# Add Splunk lib to path
sys.path.insert(0, os.path.join(os.environ.get('SPLUNK_HOME', '/opt/splunk'), 'lib', 'python3.7', 'site-packages'))

import splunk.rest as rest


def get_session_key():
    """Get session key from stdin or environment."""
    if not sys.stdin.isatty():
        session_key = sys.stdin.readline().strip()
        if session_key:
            return session_key
    return os.environ.get('SPLUNK_SESSION_KEY', '')


def send_email(session_key, to_address, subject, body, content_type='text/plain'):
    """
    Send an email using Splunk's email infrastructure.

    Args:
        session_key: Splunk session key
        to_address: Recipient email address
        subject: Email subject
        body: Email body text
        content_type: Content type (text/plain or text/html)

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Escape the body for SPL
        escaped_body = body.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')

        # Build the search query with sendemail
        search_query = f'''| makeresults
| eval to="{to_address}"
| eval subject="{subject}"
| eval body="{escaped_body}"
| sendemail to=to subject=subject message=body sendresults=false content_type="{content_type}"'''

        uri = '/services/search/jobs'
        response, content = rest.simpleRequest(
            uri,
            sessionKey=session_key,
            postargs={
                'search': search_query,
                'exec_mode': 'oneshot',
                'output_mode': 'json'
            },
            method='POST'
        )

        return response.status in [200, 201]

    except Exception as e:
        print(f"Error sending email: {str(e)}", file=sys.stderr)
        return False


def get_email_template(template_type, **kwargs):
    """
    Get email template based on notification type.

    Args:
        template_type: Type of notification (initial, reminder, disabled)
        **kwargs: Template variables

    Returns:
        tuple: (subject, body)
    """
    templates = {
        'initial': {
            'subject': "Action Required: Scheduled Search '{search_name}' Flagged for Review",
            'body': """Hello {owner},

Your scheduled search has been flagged by the Splunk governance team for the following reason(s):

{reason}

Search Details:
- Name: {search_name}
- App: {app}
- Schedule: {schedule}
- Average Runtime: {avg_runtime}

You have {days} days to remediate this issue. If no action is taken by {deadline}, the search will be automatically disabled.

Recommended Actions:
1. Review your search for efficiency improvements
2. Consider reducing the search frequency if possible
3. Optimize the search query to reduce runtime
4. Contact the governance team if you need assistance

Please review and optimize your search, or contact the governance team if you believe this is in error.

Best regards,
Splunk Governance Team
"""
        },
        'reminder': {
            'subject': "REMINDER: Scheduled Search '{search_name}' Requires Remediation",
            'body': """Hello {owner},

This is a reminder that your scheduled search '{search_name}' has been flagged and requires remediation.

IMPORTANT: You have {days_remaining} days remaining before your search is automatically disabled.

Original Reason for Flagging:
{reason}

Search Details:
- Name: {search_name}
- App: {app}
- Deadline: {deadline}

Please address this issue as soon as possible to avoid service disruption.

If you have already fixed the issue, please contact the governance team to have the flag removed.

Best regards,
Splunk Governance Team
"""
        },
        'disabled': {
            'subject': "Notice: Your Scheduled Search '{search_name}' Has Been Disabled",
            'body': """Hello {owner},

Your scheduled search '{search_name}' has been automatically disabled by the Splunk governance system.

This action was taken because the remediation deadline ({deadline}) has passed without the identified issues being addressed.

Original Reason for Flagging:
{reason}

To restore this search, please:
1. Review and address the issues that were identified
2. Contact the Splunk governance team with proof of remediation
3. Request re-enablement of your search

Search Details:
- Name: {search_name}
- App: {app}
- Original Deadline: {deadline}
- Disabled On: {disabled_date}

If you have questions or believe this was done in error, please contact the governance team immediately.

Best regards,
Splunk Governance Team
"""
        },
        'extended': {
            'subject': "Notice: Deadline Extended for Scheduled Search '{search_name}'",
            'body': """Hello {owner},

The remediation deadline for your flagged scheduled search '{search_name}' has been extended.

New Deadline: {new_deadline}

Please use this additional time to address the identified issues:
{reason}

This extension was granted by {extended_by}.

Best regards,
Splunk Governance Team
"""
        }
    }

    template = templates.get(template_type, templates['initial'])

    try:
        subject = template['subject'].format(**kwargs)
        body = template['body'].format(**kwargs)
        return subject, body
    except KeyError as e:
        return template['subject'], f"Missing template variable: {e}"


def log_notification(session_key, notification_type, search_name, recipient):
    """Log the notification to the audit log."""
    try:
        uri = '/servicesNS/nobody/TA-user-governance/storage/collections/data/governance_audit_log'

        log_entry = {
            'timestamp': int(time.time()),
            'action': f'{notification_type}_notification_sent',
            'search_name': search_name,
            'performed_by': 'system',
            'details': f'{notification_type.capitalize()} notification sent to {recipient}'
        }

        response, content = rest.simpleRequest(
            uri,
            sessionKey=session_key,
            postargs=json.dumps(log_entry),
            method='POST',
            rawResult=True
        )

        return response.status in [200, 201]

    except Exception as e:
        print(f"Error logging notification: {str(e)}", file=sys.stderr)
        return False


def main():
    """Main entry point."""

    # Parse arguments
    notification_type = 'initial'
    search_name = None
    owner = None
    app = 'unknown'
    reason = 'No reason specified'
    schedule = 'unknown'
    avg_runtime = 'unknown'
    days = 7
    days_remaining = 0
    deadline = 'unknown'
    new_deadline = 'unknown'
    disabled_date = 'unknown'
    extended_by = 'governance team'

    for arg in sys.argv[1:]:
        if '=' in arg:
            key, value = arg.split('=', 1)
            value = value.strip('"\'')

            if key == 'type':
                notification_type = value
            elif key == 'search_name':
                search_name = value
            elif key == 'owner':
                owner = value
            elif key == 'app':
                app = value
            elif key == 'reason':
                reason = value
            elif key == 'schedule':
                schedule = value
            elif key == 'avg_runtime':
                avg_runtime = value
            elif key == 'days':
                days = int(value)
            elif key == 'days_remaining':
                days_remaining = int(value)
            elif key == 'deadline':
                deadline = value
            elif key == 'new_deadline':
                new_deadline = value
            elif key == 'disabled_date':
                disabled_date = value
            elif key == 'extended_by':
                extended_by = value

    if not search_name or not owner:
        print("Error: search_name and owner parameters are required", file=sys.stderr)
        sys.exit(1)

    # Get session key
    session_key = get_session_key()

    if not session_key:
        print("Error: Could not obtain session key", file=sys.stderr)
        sys.exit(1)

    # Get email template
    subject, body = get_email_template(
        notification_type,
        search_name=search_name,
        owner=owner,
        app=app,
        reason=reason,
        schedule=schedule,
        avg_runtime=avg_runtime,
        days=days,
        days_remaining=days_remaining,
        deadline=deadline,
        new_deadline=new_deadline,
        disabled_date=disabled_date,
        extended_by=extended_by
    )

    # Construct email address (assuming company.com domain)
    to_address = f"{owner}@company.com"

    # Send the email
    if send_email(session_key, to_address, subject, body):
        print(f"SUCCESS: {notification_type.capitalize()} notification sent to {to_address}")
        log_notification(session_key, notification_type, search_name, to_address)
        sys.exit(0)
    else:
        print(f"FAILED: Could not send notification to {to_address}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
