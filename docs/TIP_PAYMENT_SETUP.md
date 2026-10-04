# NIK MODS — Tip Me a Coffee & Payment Architecture

Complete payment integration architecture for the "Tip Me a Coffee" system on NIK MODS. Designed for seamless, verified UPI payments (via UroPay or another legitimate payment gateway) with strict security guarantees.

---

## 1. Architectural Overview

```
Visitor Browser (GitHub Pages)
       │
       │  1. POST /api/tip/order { amount: 50 } (No credentials in browser)
       ▼
Cloudflare Worker (nik-mods-payment)
  [Encrypted Secrets: UROPAY_API_KEY, UROPAY_WEBHOOK_SECRET]
       │
       │  2. Forward order creation with API key
       ▼
Payment Provider (e.g. UroPay)
       │
       │  3. Returns { orderId, upiIntentUrl, qrImageUrl }
       ▼
Cloudflare Worker ──> Visitor Browser
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
  UPI Intent (Mobile)                     Dynamic QR Code (Desktop)
  [Opens GPay/PhonePe/Paytm/BHIM]         [Scanned with any UPI App]
       │                                       │
       └───────────────────┬───────────────────┘
                           ▼
                  User Pays via Bank UPI
                           │
                           ▼
             NPCI / Banking Network Confirms
                           │
                           ▼
               Payment Provider Webhook
       │  (Signed with HMAC-SHA256 Secret)
       ▼
Cloudflare Worker (POST /api/tip/webhook)
  [Verifies Cryptographic Signature]
       │
       ▼
  Stores { orderId, verified: true } in KV
       ▲
       │  4. Polls GET /api/tip/status?orderId=... (every 3s)
Visitor Browser
       │
       ▼
  5. UI Displays "Tip Sent!" (ONLY after verified confirmation)
```

---

## 2. Security & Verification Guarantees

1. **Zero Secret Exposure:**
   - No API keys, merchant tokens, or webhook secrets are ever present in client-side code (`index.html`, `script.js`, `style.css`).
   - Secrets are configured solely as encrypted environment variables/secrets in Cloudflare Workers (`npx wrangler secret put ...`).

2. **No Fake Success:**
   - The UI never assumes success based on a timer or the user returning to the tab.
   - Success state is only reachable if `checkPaymentStatus()` returns `{ verified: true }` confirmed by a cryptographically verified webhook.

3. **Pending Gateway Notice:**
   - While the gateway provider credentials are not connected, the UI shows a clear, professional "Gateway Setup in Progress" notice with the configured UPI ID and copy function, rather than faking a transaction.

4. **Duplicate Request Prevention:**
   - The payment button and order creator guard against concurrent clicks while a request is actively processing.

---

## 3. Configuration Reference

### Single Source of Truth for UPI ID
In `script.js`:
```javascript
const CONFIG = {
  // Configured once here; never hardcoded across multiple files:
  UPI_ID: "nikmods@upi",
  PAYMENT_GATEWAY_ENABLED: false, // Set to true once worker & provider are connected
  PAYMENT_ORDER_ENDPOINT: "",     // e.g. "https://nik-mods-payment.godrp3236.workers.dev/api/tip/order"
  PAYMENT_STATUS_ENDPOINT: ""     // e.g. "https://nik-mods-payment.godrp3236.workers.dev/api/tip/status"
};
```

---

## 4. Connecting UroPay (Future Steps)

When you are ready to connect UroPay:

1. **Obtain UroPay API Credentials:**
   - Merchant ID
   - API Key / Bearer Token
   - Webhook Secret Key

2. **Add Cloudflare Secrets:**
   ```bash
   npx wrangler secret put UROPAY_API_KEY
   npx wrangler secret put UROPAY_WEBHOOK_SECRET
   npx wrangler secret put UROPAY_MERCHANT_ID
   ```

3. **Configure Webhook URL in UroPay Dashboard:**
   Set the webhook URL to:
   `https://<your-worker>.workers.dev/api/tip/webhook`

4. **Enable Frontend Integration:**
   In `script.js`, update:
   ```javascript
   CONFIG.PAYMENT_GATEWAY_ENABLED = true;
   CONFIG.PAYMENT_ORDER_ENDPOINT = "https://<your-worker>.workers.dev/api/tip/order";
   CONFIG.PAYMENT_STATUS_ENDPOINT = "https://<your-worker>.workers.dev/api/tip/status";
   ```
