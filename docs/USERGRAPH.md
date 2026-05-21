# User Registration Graph (`/plotusers`)

Displays an interactive Plotly chart of cumulative Web VPython user registrations over time.

## How It Works

- **`/plotusers`** — public route, renders the chart (1 Datastore read per load)
- **`/admin/update-user-count`** — cron-only endpoint, appends current month's count (2 reads + 1 write)
- Data is stored in a single `Setting` entity with key `user_count_history` as a JSON array of `{month, count}` points

## One-Time Migration

Run this once against production to build the initial history from all existing `User.joinDate` fields (~315k reads, ~$0.16):

```bash
GOOGLE_CLOUD_PROJECT=glowscript python ide/shell_cmds/buildUserHistory.py
```

## Cloud Scheduler Setup

Create a job in [GCP Console → Cloud Scheduler](https://console.cloud.google.com/cloudscheduler):

| Field | Value |
|-------|-------|
| **Name** | `update-user-count-monthly` |
| **Region** | same region as App Engine app |
| **Frequency** | `0 6 1 * *` |
| **Timezone** | UTC |
| **Target type** | HTTP |
| **URL** | `https://glowscript.org/admin/update-user-count` |
| **HTTP method** | GET |
| **Auth header** | None |

Under **Headers**, add:

| Key | Value |
|-----|-------|
| `X-Appengine-Cron` | `true` |

After creating the job, click **Run now** to verify — you should get a 200 response and see a new data point appended to the `user_count_history` Setting.

> Note: `__Stat_Kind__` stats can lag up to 48h, so the count from a manual test run may be slightly stale. This is expected and acceptable for a monthly cadence.
