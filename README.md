# NIK MODS

Dark/blood-red, mobile-first GitHub Pages catalog. It automatically reads and renders app and game listings from `catalog.json`, which is continuously synced from Google Sheets.

## Publish the site
GitHub → Settings → Pages → Deploy from branch → **main** → **/(root)**.

## Catalog sync workflow
The repository includes an automated GitHub Actions workflow (`.github/workflows/sync-catalog.yml`):
- Automatically fetches releases from the linked Google Sheet every 5 minutes or on demand.
- Supports dual CSV export endpoints with fallback.
- Normalizes categories, versions, sizes, and metadata into `catalog.json`.
- Safely updates `catalog.json` on the `main` branch, triggering GitHub Pages updates.

## Anonymous Feedback Setup
The website includes an anonymous feedback modal connecting to a free, secure serverless Cloudflare Worker or Vercel function that delivers feedback to Telegram chat ID `1840373853` without exposing the bot token. See [docs/FEEDBACK_SETUP.md](docs/FEEDBACK_SETUP.md) for full setup instructions.

## Legal notice
Only distribute files you are legally authorized to distribute. Do not use the site for pirated/cracked software, malware, or unauthorized access tools.
