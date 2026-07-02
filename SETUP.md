# Setup

The live configs (`config/targets.json`, `config/discord_config.json`) are
gitignored — they hold personal data and secrets. Start from the shipped
examples before running the agent.

## 1. Copy the example configs

```bash
cp config/targets.example.json config/targets.json
cp config/discord_config.example.json config/discord_config.json
```

## 2. Replace the placeholders

In `config/targets.json`:

- `safe_fields` — replace every placeholder with your real values:
  - `YOUR_FIRST_NAME`, `YOUR_LAST_NAME`
  - `your.email@example.com`, `555-555-5555`
  - `https://linkedin.com/in/your-profile`, `https://github.com/your-username`
  - `graduation_date` (`Month Year`), `gpa` (`0.0`)
  - `authorized_to_work`, `require_sponsorship`, `citizenship_status` — each
    is `REPLACE_ME`; set to the real answer (e.g. `Yes`/`No` for the first
    two, your citizenship status for the third)
  - `currently_enrolled` — set to `Yes` or `No` as appropriate
- `ashby_company_slugs`, `lever_company_slugs` — replace `REPLACE_ME` with
  real company slugs, or leave as `REPLACE_ME` to skip those boards.
- `preferred_locations`, `fallback_scope`, `graduation_date` — review and
  personalize.

In `config/discord_config.json`:

- `webhooks.success` — required. A real Discord webhook URL for the
  success channel (`https://discord.com/api/webhooks/<numeric_id>/<token>`).
  This route is also the fallback for the optional summary route.
- `webhooks.needs_review` — required. A real Discord webhook URL for the
  needs-review channel.
- `webhooks.failed` — required. A real Discord webhook URL for the failed
  channel.
- `webhooks.summary` — webhook URL for the batch-summary channel.
  Optional: if absent, the summary is routed to `webhooks.success` at
  runtime.
- A Discord webhook is bound to exactly one channel, so routing each
  outcome to its own channel requires a separate webhook URL per route.
  To keep all outcomes in a single channel during initial setup, point
  every route at the same webhook URL.

## 3. Validate

```bash
bash scripts/validate_local_config.sh
```

- Prints `validate_local_config: OK` on success — config is ready.
- Any `ERROR` line names the file and field to fix (exit code 1).
- Placeholder Ashby/Lever slugs print a `WARNING` but do not block the run.

## 4. Google Sheets sync (Phase 3, optional)

The agent can append every successful application to a Google Sheet
internship tracker. This is optional: if it is not configured, the agent
skips the sync and local job state (`data/applied_jobs.json`,
`data/job_registry.json`) remains the source of truth.

### 4.1 Copy the example config

```bash
cp config/google_sheets_config.example.json config/google_sheets_config.json
```

`config/google_sheets_config.json` is gitignored — it holds the sheet id
and the path to the service-account key. Edit it:

- `spreadsheet_id` — the long id from your sheet URL
  (`https://docs.google.com/spreadsheets/d/<spreadsheet_id>/edit`).
- `worksheet_title` — the tab name to append to (default
  `Internship Tracker`).
- `service_account_key_path` — local path to the service-account JSON
  key (default `config/service-account-key.json`).
- `enabled` — set to `false` to turn sync off without deleting the file.
- `header_range`, `value_input_option`, `insert_data_option` — optional
  append parameters with sensible defaults (`A1:H`, `USER_ENTERED`,
  `INSERT_ROWS`). Leave them as-is unless the sheet needs different
  settings.

### 4.2 Install the Python dependencies

```bash
pip3 install -r requirements.txt
```

This installs the official Google Python client and auth libraries needed
for service-account Sheets writes.

### 4.3 Create the service account and download the key

1. Open the Google Cloud Console → **APIs & Services → Library** and
   enable the **Google Sheets API** for your project.
2. Go to **APIs & Services → Credentials → Create credentials →
   Service account**. Give it any name (e.g. `ares-tracker-sync`).
3. Open the new service account → **Keys → Add key → Create new key →
   JSON**. A JSON key file downloads.
4. Move the downloaded key to the repo:

   ```bash
   mv ~/Downloads/<downloaded-key>.json config/service-account-key.json
   chmod 600 config/service-account-key.json
   ```

   `config/service-account-key.json` is gitignored.

### 4.4 Share the Google Sheet with the service account

Open the service-account key JSON and copy the `client_email` value
(e.g. `ares-tracker-sync@your-project.iam.gserviceaccount.com`). Open
your Google Sheet → **Share** → paste that email → give it **Editor**
access. The helper cannot write until the sheet is shared with this
email.

### 4.5 Validate

```bash
bash scripts/validate_local_config.sh
```

The Sheets config is validated in a Phase 3-appropriate way:

- If `config/google_sheets_config.json` is absent, the validator warns
  and continues — job-board runs are not blocked.
- If present and `enabled: true`, required fields and the
  service-account key path shape are checked. Missing key file or
  placeholder values produce `WARNING` lines but do not break the run.

### 4.6 Test a single append manually

```bash
python3 scripts/sync_internship_tracker.py '{"title":"Test Role","company":"Test Co","date_applied":"2026-07-01","internship_term":"Summer 2026"}'
```

A successful sync prints a JSON result with `"synced": true` and the
appended row. If sync is disabled or unconfigured, the helper prints a
`"skipped": true` result and exits 0 so the application run continues.