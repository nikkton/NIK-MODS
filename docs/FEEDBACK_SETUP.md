# NIK MODS — Anonymous Feedback Backend Setup

This document describes how to deploy the secure, free serverless backend for anonymous feedback and connect it to the NIK MODS website.

---

## 1. Architecture Overview

```
Visitor Browser (GitHub Pages)
       │
       │  POST { message } (No identity collected, no bot token exposed)
       ▼
Cloudflare Worker (Free Serverless Edge)
  [Encrypted Secret: TELEGRAM_BOT_TOKEN]
       │
       │  POST https://api.telegram.org/bot<TOKEN>/sendMessage
       ▼
Telegram Bot (@NIKMODSFeedbackBot)
       │
       ▼
Your Telegram Chat (ID: 1840373853)
```

### Security & Privacy Guarantees
- **Zero Token Exposure:** The bot token `TELEGRAM_BOT_TOKEN` is NEVER exposed to the browser, JavaScript, CSS, or git repository.
- **Anonymous:** No names, emails, phone numbers, Telegram usernames, or visitor identity information are collected or forwarded.
- **Spam Protection:** Includes an invisible honeypot field and in-memory rate limiting to prevent spam.

---

## 2. Deployment: Cloudflare Workers (Recommended & Free)

Cloudflare Workers provides **100,000 requests per day for free forever**, with no credit card required.

### Method A: Cloudflare Web Dashboard (Quickest — ~2 minutes)

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com/).
2. On the left navigation, click **Compute (Workers & Pages)** → **Create Application** → **Worker**.
3. Name your worker (for example: `nik-mods-feedback`), then click **Deploy**.
4. In the worker overview, click **Edit code**.
5. Replace all code in `worker.js` with the contents of [`worker/feedback-worker.js`](../worker/feedback-worker.js) from this repository.
6. Click **Deploy** in the top right.
7. Return to the worker page, click the **Settings** tab → **Variables and Secrets**.
8. Under **Secrets**, click **Add**:
   - **Variable name**: `TELEGRAM_BOT_TOKEN`
   - **Type**: `Secret` (encrypted)
   - **Value**: Paste your bot token (from `@BotFather` / GitHub Actions Secret)
   - Click **Save and Deploy**.
9. Copy your Worker URL from the dashboard (e.g., `https://nik-mods-feedback.<your-subdomain>.workers.dev`).

### Method B: Wrangler CLI (Alternative)

If you prefer deploying via terminal:
```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Add the encrypted secret
npx wrangler secret put TELEGRAM_BOT_TOKEN
# (paste your bot token when prompted)

# 3. Deploy the worker
npx wrangler deploy
```

---

## 3. Connect the Worker to NIK MODS Website

Once your worker is deployed:

1. Open [`script.js`](../script.js).
2. Set `FEEDBACK_ENDPOINT` to your Cloudflare Worker URL:
   ```javascript
   const CONFIG = {
     CATALOG_URL: "catalog.json",
     DEFAULT_ICON: "assets/nik-logo.svg",
     FEEDBACK_ENDPOINT: "https://nik-mods-feedback.<your-subdomain>.workers.dev"
   };
   ```
3. Commit and push the change to `main`.
4. The feedback form is now live and functional!

---

## 4. Alternative: Vercel Serverless Function

If you ever deploy or mirror NIK MODS on Vercel:
1. The [`api/feedback.js`](../api/feedback.js) file is pre-configured.
2. In your Vercel Project Settings → **Environment Variables**, add:
   - `TELEGRAM_BOT_TOKEN`: `<your-bot-token>`
3. In [`script.js`](../script.js), set:
   ```javascript
   FEEDBACK_ENDPOINT: "/api/feedback"
   ```

---

## 5. Verification Checklist

- [x] Workflow catalog sync runs every 5 minutes (`*/5 * * * *`).
- [x] Website wording updated to `"Latest releases, curated for NIK MODS."`.
- [x] Telegram channel link added to header (`https://t.me/nikxtech`).
- [x] Feedback button in footer opens a clean, dark modal.
- [x] Form asks only for the feedback message (no personal info).
- [x] Submission shows `"Thanks for your feedback."`.
- [x] Telegram bot token is never exposed to the client.
