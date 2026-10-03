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

## Anonymous Feedback Backend
The website includes an anonymous feedback modal connecting to a secure, serverless Cloudflare Worker that delivers user messages to Telegram chat ID `1840373853` without exposing bot tokens:
- **Cloudflare Worker deployment:** COMPLETED (`https://nik-mods-feedback.godrp3236.workers.dev`)
- **Telegram secret configuration:** COMPLETED (`TELEGRAM_BOT_TOKEN` configured as encrypted secret in Cloudflare)
- **Website Worker endpoint connection:** COMPLETED (`script.js` connected to live worker endpoint)
- **Remaining task:** Live end-to-end testing (submit test message on live site and verify receipt in Telegram)

For full architectural details, security guarantees, and operations reference, see [docs/FEEDBACK_SETUP.md](docs/FEEDBACK_SETUP.md).

## Legal notice
Only distribute files you are legally authorized to distribute. Do not use the site for pirated/cracked software, malware, or unauthorized access tools.
