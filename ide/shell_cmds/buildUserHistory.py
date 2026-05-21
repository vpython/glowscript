"""
One-time migration: read all User joinDates, build monthly cumulative history,
store in Setting entity 'user_count_history'.

Usage (production):
    GOOGLE_CLOUD_PROJECT=glowscript python ide/shell_cmds/buildUserHistory.py

Usage (local emulator):
    DATASTORE_EMULATOR_HOST=localhost:8081 python ide/shell_cmds/buildUserHistory.py

Usage (dry-run on first N users, no write):
    GOOGLE_CLOUD_PROJECT=glowscript-py38 python ide/shell_cmds/buildUserHistory.py --limit 500

Usage (limited run + write):
    GOOGLE_CLOUD_PROJECT=glowscript-py38 python ide/shell_cmds/buildUserHistory.py --limit 500 --write

Cost: ~$0.16 (reads ~315k User entities). Run once only.
"""

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import json
import os
import sys

from google.cloud import ndb
from ide.models import User, Setting


def build_history(client, limit=None, write=True):
    monthly_new = defaultdict(int)
    count = 0
    skipped = 0

    with client.context():
        query = User.query()
        if limit:
            query = query.fetch(limit)
        else:
            query = query.iter()  # NDB iterates in batches — does not load all into memory

        for user in query:
            count += 1
            if count % 10000 == 0:
                print(f"  {count} users processed...")

            join_date = getattr(user, 'joinDate', None)
            if join_date:
                month_str = join_date.strftime('%Y-%m')
                monthly_new[month_str] += 1
            else:
                skipped += 1

        print(f"Done: {count} users, {skipped} skipped (no joinDate)")
        expected = count - skipped

        sorted_months = sorted(monthly_new.keys())
        cumulative = 0
        points = []
        for month in sorted_months:
            cumulative += monthly_new[month]
            points.append({'month': month, 'count': cumulative})

        if points and points[-1]['count'] != expected:
            print(f"WARNING: cumulative total {points[-1]['count']} != expected {expected}")

        history = {
            'updated': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            'points': points,
        }

        print(f"Built {len(points)} monthly data points")
        if points:
            print(f"Latest: {points[-1]}")

        if not write:
            print("Dry-run: skipping Datastore write (pass --write to persist)")
            return

        existing = ndb.Key('Setting', 'user_count_history').get()
        if not existing:
            existing = Setting(id='user_count_history')
        existing.value = json.dumps(history)
        try:
            existing.put()
        except Exception as e:
            print(f"ERROR: Failed to store user history: {e}", file=sys.stderr)
            sys.exit(1)

        print(f"Stored {len(points)} monthly data points")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=None,
                        help='Process only the first N users (implies dry-run unless --write is also set)')
    parser.add_argument('--write', action='store_true',
                        help='Write results to Datastore (required when using --limit; always writes without --limit)')
    args = parser.parse_args()

    write = args.write if args.limit else True

    project = os.environ.get('GOOGLE_CLOUD_PROJECT', 'glowscript')
    emulator = os.environ.get('DATASTORE_EMULATOR_HOST')
    client = ndb.Client(project=project)
    print(f"Connecting to {'emulator at ' + emulator if emulator else 'production Datastore'}...")
    if args.limit:
        print(f"Limit: {args.limit} users ({'will write' if write else 'dry-run, no write'})")
    try:
        build_history(client, limit=args.limit, write=write)
    finally:
        client.close()
