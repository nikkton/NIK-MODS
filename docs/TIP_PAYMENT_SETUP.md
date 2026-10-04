# NIK MODS — Tip Me a Coffee & Payment Architecture

Production-grade verified payment integration architecture for the "Tip Me a Coffee" system on NIK MODS. Designed for seamless, verified UPI payments via FamGateway and Cloudflare Workers with strict zero-secret security guarantees.

---

## 1. Architectural Overview

```
Visitor Browser (GitHub Pages / tip.html)
       │
       │  1. POST /create-order { amount: 50 } (No API keys in browser)
       ▼
Cloudflare Worker (nik-mods-payments)
  [Encrypted Secret: FAMGATEWAY_API_KEY]
       │
       │  2. Forward order creation to FamGateway API
       ▼
FamGateway REST API (/api/create-order)
       │
       │  3. Returns dynamic order { order_id, upi_intent, qr_url, checkout_url }
       ▼
Cloudflare Worker ──> Visitor Browser
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
  UPI Intent (Android/Mobile)             Dynamic QR Code (Desktop/Mobile)
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
                FamGateway Webhook
       │  (Signed with HMAC-SHA256 Secret)
       ▼
Cloudflare Worker (POST /webhook)
  [Verifies Cryptographic Signature]
       │
       ▼
  Records confirmed payment
       ▲
       │  4. Polls GET /status?order_id=... (every 2-3s)
Visitor Browser
       │
       ▼
  5. UI Displays "Thank you ❤️ / Payment verified" (ONLY after verified confirmation)
```

---

## 2. Security & Verification Guarantees

1. **Zero Secret Exposure:**
   - No API keys, merchant tokens, or webhook secrets are ever present in client-side code (`tip.html`, `index.html`, `script.js`, `style.css`).
   - Secrets are configured solely as encrypted environment variables in Cloudflare Workers (`npx wrangler secret put FAMGATEWAY_API_KEY`).

2. **No Fake Success:**
   - The UI never assumes success based on a timer, button clicks, opening a UPI app, or returning to the tab.
   - Success state is only reachable when the backend confirms the payment has been verified.

3. **Safe Dynamic Checkout:**
   - Uses FamGateway's dynamic UPI QR and intent generation with strict bank UTR deduplication and 5-minute order safety windows.

4. **Duplicate Request Prevention:**
   - The payment button and order creator guard against concurrent clicks while an order is actively processing.

---

## 3. Configuration Reference

### Active Cloudflare Worker Endpoints
- **Service URL:** `https://nik-mods-payments.godrp3236.workers.dev`
- **POST `/create-order`**: Initiates a dynamic FamGateway order
- **GET `/status?order_id=...`**: Verifies payment confirmation
- **POST `/webhook`**: Receives FamGateway signed webhooks

---

## 4. Frontend Integration

- Dedicated page: `tip.html`
- Presets: ₹10, ₹25, ₹50, ₹100, ₹250, ₹500
- Custom amount validation: min ₹1, max ₹10,000
- Navigation entry added to NIK MODS main drawer menu
