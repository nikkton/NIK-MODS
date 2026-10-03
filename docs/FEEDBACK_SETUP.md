# NIK MODS — Anonymous Feedback Backend

Secure serverless backend for anonymous user feedback on NIK MODS, delivering visitor messages directly to Telegram while strictly protecting visitor privacy and secret credentials.

---

## 1. Setup Status

The feedback system setup is complete and connected.

| Step | Component | Status | Details |
|---|---|---|---|
| **1** | **Cloudflare Worker Deployment** | **COMPLETED** | Worker `nik-mods-feedback` is live at `https://nik-mods-feedback.godrp3236.workers.dev` |
| **2** | **Telegram Secret Configuration** | **COMPLETED** | `TELEGRAM_BOT_TOKEN` is configured as an encrypted secret in Cloudflare (never committed or exposed) |
| **3** | **Website Endpoint Connection** | **COMPLETED** | `script.js` configured with `https://nik-mods-feedback.godrp3236.workers.dev` |
| **4** | **End-to-End Live Testing** | **PENDING LIVE TEST** | Send a live test message from the website modal and verify receipt in Telegram chat `1840373853` |

---

## 2. Architecture Overview

```
Visitor Browser (GitHub Pages)
       │
       │  POST { message } (No identity collected, zero bot token exposure)
       ▼
Cloudflare Worker (nik-mods-feedback)
  [Encrypted Secret: TELEGRAM_BOT_TOKEN]
       │
       │  POST https://api.telegram.org/bot<TOKEN>/sendMessage
       ▼
Telegram Bot (@NIKMODSFeedbackBot)
       │
       ▼
Destination Telegram Chat (ID: 1840373853)
```

### Security & Privacy Guarantees
- **Zero Token Exposure:** The bot token `TELEGRAM_BOT_TOKEN` is NEVER exposed to the browser, client-side JavaScript, CSS, or git repository.
- **Strictly Anonymous:** No names, emails, phone numbers, IP addresses, Telegram usernames, or visitor identity details are forwarded to Telegram or logged.
- **Spam & Abuse Protection:** Includes an invisible honeypot field (`_hp_site`) and in-memory rate limiting (max 5 submissions per minute per IP).
- **CORS Restricted:** Validated HTTP POST and preflight OPTIONS handling.

---

## 3. Configuration Reference

### Active Cloudflare Worker
- **Name:** `nik-mods-feedback`
- **Live Endpoint URL:** `https://nik-mods-feedback.godrp3236.workers.dev`
- **Worker Code:** [`worker/feedback-worker.js`](../worker/feedback-worker.js)
- **Wrangler Configuration:** [`wrangler.toml`](../wrangler.toml)
- **Environment Variables & Secrets:**
  - `TELEGRAM_CHAT_ID`: `1840373853` (defined in `wrangler.toml`)
  - `TELEGRAM_BOT_TOKEN`: Encrypted Secret (configured in Cloudflare)

### Website Integration
Configured in [`script.js`](../script.js):
```javascript
const CONFIG = {
  CATALOG_URL: "catalog.json",
  DEFAULT_ICON: "assets/nik-logo.svg",
  FEEDBACK_ENDPOINT: "https://nik-mods-feedback.godrp3236.workers.dev"
};
```

---

## 4. Maintenance & Operations Reference

The Worker and website connection are already fully deployed. The following instructions are preserved for future maintenance, code updates, or secret rotation.

### Updating Worker Code (Optional / Future Maintenance)
If code inside `worker/feedback-worker.js` is modified:
```bash
# 1. Login to Cloudflare via Wrangler CLI
npx wrangler login

# 2. Deploy updates to the existing worker
npx wrangler deploy
```
Or edit the code in the [Cloudflare Dashboard](https://dash.cloudflare.com/) under **Workers & Pages** → **nik-mods-feedback** → **Edit code**.

### Rotating the Telegram Secret (Optional / Future Maintenance)
If the Telegram bot token ever needs to be updated:
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
```
Or update it in the Cloudflare Dashboard under **nik-mods-feedback** → **Settings** → **Variables and Secrets** → **Secrets**.

---

## 5. Alternative Backend: Vercel Function (Reference)

If the site is ever mirrored or hosted on Vercel:
1. The [`api/feedback.js`](../api/feedback.js) serverless function is pre-configured.
2. In Vercel Project Settings → **Environment Variables**, set:
   - `TELEGRAM_BOT_TOKEN`: `<your-bot-token>`
   - `TELEGRAM_CHAT_ID`: `1840373853`
3. Set `FEEDBACK_ENDPOINT: "/api/feedback"` in `script.js`.

---

## 6. Verification Checklist

- [x] Cloudflare Worker deployed (`nik-mods-feedback` at `https://nik-mods-feedback.godrp3236.workers.dev`)
- [x] Telegram bot token configured as encrypted secret in Cloudflare
- [x] Website `script.js` connected to the active Worker endpoint
- [x] Token audit: Zero bot tokens or secrets committed to repository
- [x] Anti-spam honeypot and rate limiting implemented
- [x] Feedback modal UI and status notifications ready
- [ ] Live end-to-end feedback delivery test (submit test message on live site and verify receipt in Telegram chat `1840373853`)
