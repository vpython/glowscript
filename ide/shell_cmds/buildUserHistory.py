"""
One-time migration: read all User joinDates, build monthly cumulative history,
store in Setting entity 'user_count_history'.

Usage (production):
    GOOGLE_CLOUD_PROJECT=glowscript python ide/shell_cmds/buildUserHistory.py

Usage (local emulator):
    DATASTORE_EMULATOR_HOST=localhost:8081 python ide/shell_cmds/buildUserHistory.py

Cost: ~$0.16 (reads ~315k User entities). Run once only.
"""

from collections import defaultdict
from datetime import datetime, timezone
import json
import os

from google.cloud import ndb
from ide.models import User, Setting


def build_history(client):
    monthly_new = defaultdict(int)
    count = 0
    skipped = 0

    with client.context():
        for user in User.query():  # NDB iterates in batches — does not load all into memory
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

        sorted_months = sorted(monthly_new.keys())
        cumulative = 0
        points = []
        for month in sorted_months:
            cumulative += monthly_new[month]
            points.append({'month': month, 'count': cumulative})

        history = {
            'updated': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            'points': points,
        }

        existing = ndb.Key('Setting', 'user_count_history').get()
        if not existing:
            existing = Setting(id='user_count_history')
        existing.value = json.dumps(history)
        existing.put()

        print(f"Stored {len(points)} monthly data points")
        if points:
            print(f"Latest: {points[-1]}")


if __name__ == '__main__':
    project = os.environ.get('GOOGLE_CLOUD_PROJECT', 'glowscript')
    emulator = os.environ.get('DATASTORE_EMULATOR_HOST')
    client = ndb.Client(project='glowscript-dev' if emulator else project)
    print(f"Connecting to {'emulator at ' + emulator if emulator else 'production Datastore'}...")
    build_history(client)
