#!/usr/bin/env python
"""
disable_search.py - Disable a scheduled search via Splunk REST API

This script is used by the governance app to automatically disable
scheduled searches that have exceeded their remediation deadline.

Usage:
    Called by alert action or scripted input with search_name parameter
"""

import sys
import os
import json
import time

# Add Splunk lib to path
sys.path.insert(0, os.path.join(os.environ.get('SPLUNK_HOME', '/opt/splunk'), 'lib', 'python3.7', 'site-packages'))

import splunk.rest as rest
import splunk.entity as entity
from splunk.clilib import cli_common as cli


def get_session_key():
    """Get session key from stdin (when run as alert action) or environment."""
    if not sys.stdin.isatty():
        # Running as alert action - read session key from stdin
        session_key = sys.stdin.readline().strip()
        if session_key:
            return session_key

    # Fallback to environment or config
    return os.environ.get('SPLUNK_SESSION_KEY', '')


def disable_scheduled_search(session_key, search_name, app=None, owner=None):
    """
    Disable a scheduled search using Splunk REST API.

    Args:
        session_key: Splunk session key for authentication
        search_name: Name of the saved search to disable
        app: App context (optional, will search all if not specified)
        owner: Owner context (optional)

    Returns:
        dict: Result with success status and message
    """
    try:
        # Build the REST endpoint path
        if app and owner:
            uri = f'/servicesNS/{owner}/{app}/saved/searches/{search_name}'
        else:
            # Search for the saved search across all apps/owners
            uri = '/servicesNS/-/-/saved/searches'

            # First, find the search
            response, content = rest.simpleRequest(
                uri,
                sessionKey=session_key,
                getargs={
                    'search': f'name="{search_name}"',
                    'output_mode': 'json'
                }
            )

            if response.status != 200:
                return {
                    'success': False,
                    'message': f'Failed to find search: HTTP {response.status}'
                }

            results = json.loads(content)
            if not results.get('entry'):
                return {
                    'success': False,
                    'message': f'Search "{search_name}" not found'
                }

            # Get the first matching search
            search_entry = results['entry'][0]
            uri = search_entry['links']['edit']

        # Disable the search
        response, content = rest.simpleRequest(
            uri,
            sessionKey=session_key,
            postargs={
                'disabled': '1'
            },
            method='POST'
        )

        if response.status in [200, 201]:
            return {
                'success': True,
                'message': f'Successfully disabled search "{search_name}"'
            }
        else:
            return {
                'success': False,
                'message': f'Failed to disable search: HTTP {response.status}'
            }

    except Exception as e:
        return {
            'success': False,
            'message': f'Error disabling search: {str(e)}'
        }


def update_kv_store_status(session_key, search_name, new_status):
    """
    Update the status of a flagged search in the KV store.

    Args:
        session_key: Splunk session key
        search_name: Name of the search to update
        new_status: New status value (e.g., 'disabled')
    """
    try:
        # Get the KV store entry
        uri = '/servicesNS/nobody/TA-user-governance/storage/collections/data/flagged_searches'

        response, content = rest.simpleRequest(
            uri,
            sessionKey=session_key,
            getargs={'output_mode': 'json'}
        )

        if response.status != 200:
            return False

        entries = json.loads(content)

        for entry in entries:
            if entry.get('search_name') == search_name:
                # Update the entry
                entry['status'] = new_status
                entry['notification_time'] = int(time.time())

                update_uri = f"{uri}/{entry['_key']}"

                response, content = rest.simpleRequest(
                    update_uri,
                    sessionKey=session_key,
                    postargs=json.dumps(entry),
                    method='POST',
                    rawResult=True
                )

                return response.status in [200, 201]

        return False

    except Exception as e:
        print(f"Error updating KV store: {str(e)}", file=sys.stderr)
        return False


def log_action(session_key, action, search_name, details):
    """
    Log an action to the governance audit log KV store.
    """
    try:
        uri = '/servicesNS/nobody/TA-user-governance/storage/collections/data/governance_audit_log'

        log_entry = {
            'timestamp': int(time.time()),
            'action': action,
            'search_name': search_name,
            'performed_by': 'system',
            'details': details
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
        print(f"Error logging action: {str(e)}", file=sys.stderr)
        return False


def send_disable_notification(session_key, search_name, owner, app):
    """
    Send an email notification that the search has been disabled.
    This uses Splunk's sendemail command via a one-shot search.
    """
    try:
        # Build email content
        subject = f"Notice: Your Scheduled Search '{search_name}' Has Been Disabled"
        body = f"""Hello {owner},

Your scheduled search '{search_name}' in the '{app}' app has been automatically disabled by the Splunk governance system.

This action was taken because the remediation deadline has passed without the identified issues being addressed.

To restore this search, please:
1. Review and fix the issues that were flagged
2. Contact the Splunk governance team to request re-enablement

If you have questions, please reach out to the governance team.

Best regards,
Splunk Governance System
"""

        # Use Splunk's sendemail command
        search_query = f'''| makeresults
| sendemail to="{owner}@company.com"
  subject="{subject}"
  message="{body.replace('"', '\\"').replace('\n', '\\n')}"
  sendresults=false'''

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
        print(f"Error sending notification: {str(e)}", file=sys.stderr)
        return False


def main():
    """Main entry point for the disable search script."""

    # Parse arguments
    search_name = None
    app = None
    owner = None
    send_email = True

    # Read arguments from command line or stdin
    for arg in sys.argv[1:]:
        if arg.startswith('search_name='):
            search_name = arg.split('=', 1)[1].strip('"\'')
        elif arg.startswith('app='):
            app = arg.split('=', 1)[1].strip('"\'')
        elif arg.startswith('owner='):
            owner = arg.split('=', 1)[1].strip('"\'')
        elif arg.startswith('send_email='):
            send_email = arg.split('=', 1)[1].lower() in ('true', '1', 'yes')

    if not search_name:
        print("Error: search_name parameter is required", file=sys.stderr)
        sys.exit(1)

    # Get session key
    session_key = get_session_key()

    if not session_key:
        print("Error: Could not obtain session key", file=sys.stderr)
        sys.exit(1)

    # Disable the search
    result = disable_scheduled_search(session_key, search_name, app, owner)

    if result['success']:
        print(f"SUCCESS: {result['message']}")

        # Update KV store status
        update_kv_store_status(session_key, search_name, 'disabled')

        # Log the action
        log_action(session_key, 'disabled', search_name, 'Auto-disabled due to exceeded remediation deadline')

        # Send notification if enabled
        if send_email and owner:
            send_disable_notification(session_key, search_name, owner, app or 'unknown')

        sys.exit(0)
    else:
        print(f"FAILED: {result['message']}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
