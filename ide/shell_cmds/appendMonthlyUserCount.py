"""
Append a single month's new user count to user_count_history in Datastore.

Queries only users whose joinDate falls within the target month — far cheaper
than rebuilding the full history via buildUserHistory.py (~$0.16).

Usage:
    GOOGLE_CLOUD_PROJECT=glowscript python ide/shell_cmds/appendMonthlyUserCount.py --month 2026-05
    GOOGLE_CLOUD_PROJECT=glowscript python ide/shell_cmds/appendMonthlyUserCount.py --month 2026-05 --write
"""

import argparse
from datetime import datetime, timezone
import json
import os
import sys

from google.cloud import ndb
from ide.models import User, Setting


def append_month(client, month_str, write=False):
    try:
        year, month = int(month_str[:4]), int(month_str[5:7])
    except (ValueError, IndexError):
        print(f"ERROR: invalid month format '{month_str}', expected YYYY-MM", file=sys.stderr)
        sys.exit(1)

    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

    with client.context():
        new_users = User.query(User.joinDate >= start, User.joinDate < end).count()
        print(f"New users in {month_str}: {new_users}")

        history_setting = ndb.Key('Setting', 'user_count_history').get()
        if not history_setting or not history_setting.value or history_setting.value == 'NOT SET':
            print("ERROR: no existing user_count_history found — run buildUserHistory.py first", file=sys.stderr)
            sys.exit(1)

        try:
            history = json.loads(history_setting.value)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"ERROR: could not parse user_count_history: {e}", file=sys.stderr)
            sys.exit(1)

        points = history.get('points', [])

        if any(p['month'] == month_str for p in points):
            print(f"ERROR: {month_str} already exists in history — remove it first if you want to replace it", file=sys.stderr)
            sys.exit(1)

        last_count = points[-1]['count'] if points else 0
        new_cumulative = last_count + new_users
        print(f"Previous cumulative: {last_count}  →  new cumulative: {new_cumulative}")

        points.append({'month': month_str, 'count': new_cumulative})
        history['points'] = points
        history['updated'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        if not write:
            print("Dry-run: skipping write (pass --write to persist)")
            return

        history_setting.value = json.dumps(history)
        history_setting.put()
        print(f"Stored updated history ({len(points)} points, latest: {points[-1]})")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--month', required=True, help='Month to append, e.g. 2026-05')
    parser.add_argument('--write', action='store_true', help='Write results to Datastore (default: dry-run)')
    args = parser.parse_args()

    project = os.environ.get('GOOGLE_CLOUD_PROJECT', 'glowscript')
    emulator = os.environ.get('DATASTORE_EMULATOR_HOST')
    client = ndb.Client(project=project)
    print(f"Connecting to {'emulator at ' + emulator if emulator else 'production Datastore'}...")
    try:
        append_month(client, args.month, write=args.write)
    finally:
        client.close()
