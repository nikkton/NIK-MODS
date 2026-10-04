/**
 * NIK MODS — Tip Me a Coffee Payment Integration Worker (Cloudflare Workers)
 * 
 * Clean backend architecture designed for verified payment gateways (e.g. UroPay).
 * 
 * ============================================================================
 * ARCHITECTURE & VERIFICATION FLOW:
 * ============================================================================
 * 1. Visitor opens Tip Me a Coffee on website and selects amount (e.g. ₹50)
 * 2. Frontend calls POST /api/tip/order -> this worker
 * 3. Worker creates payment order with provider (using secret UROPAY_API_KEY)
 * 4. Provider returns real order (orderId, upiIntentUrl, qrImageUrl)
 * 5. Visitor pays in their preferred UPI app (GPay, PhonePe, Paytm, BHIM)
 * 6. Provider verifies payment on banking network and sends signed webhook
 * 7. POST /api/tip/webhook verifies provider signature (using secret UROPAY_WEBHOOK_SECRET)
 * 8. Worker marks order as VERIFIED in KV storage
 * 9. Frontend polls GET /api/tip/status?orderId=...
 * 10. Only when status is VERIFIED does frontend show "Tip Sent!"
 * 
 * ============================================================================
 * SECURITY GUARANTEES:
 * ============================================================================
 * - ZERO secrets in client-side code (HTML, CSS, JS).
 * - Provider credentials MUST NEVER be committed to Git or exposed publicly.
 * - Credentials must be stored as Cloudflare Worker Secrets:
 *     npx wrangler secret put UROPAY_API_KEY
 *     npx wrangler secret put UROPAY_WEBHOOK_SECRET
 *     npx wrangler secret put UROPAY_MERCHANT_ID
 * ============================================================================
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Signature, Authorization",
  "Access-Control-Max-Age": "86400"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS
    }
  });
}

/**
 * 1. createPaymentOrder()
 * 
 * Backend handler for creating a payment order with the payment provider.
 * When real provider is connected:
 * - Reads env.UROPAY_API_KEY
 * - Sends request to provider API
 * - Returns { orderId, upiIntentUrl, qrImageUrl, amount }
 */
async function createPaymentOrder(request, env) {
  // Check if provider is configured in environment
  const apiKey = env?.UROPAY_API_KEY;
  if (!apiKey) {
    return json({
      status: "UNCONFIGURED",
      message: "Payment gateway credentials not configured in backend environment."
    }, 200);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const amount = Number(body?.amount);
  if (!amount || amount < 1) {
    return json({ error: "Amount must be at least ₹1" }, 400);
  }

  const note = String(body?.note || "Support NIK MODS").slice(0, 100);

  /*
   * =========================================================================
   * PLACEHOLDER: PROVIDER API CALL
   * =========================================================================
   * When connecting UroPay or other provider, execute HTTP call here:
   * 
   * const providerResponse = await fetch("https://api.uropay.example/v1/order/create", {
   *   method: "POST",
   *   headers: {
   *     "Authorization": `Bearer ${env.UROPAY_API_KEY}`,
   *     "Content-Type": "application/json"
   *   },
   *   body: JSON.stringify({
   *     merchant_id: env.UROPAY_MERCHANT_ID,
   *     amount: amount,
   *     currency: "INR",
   *     note: note,
   *     webhook_url: "https://your-worker.workers.dev/api/tip/webhook"
   *   })
   * });
   * const providerData = await providerResponse.json();
   * 
   * Save initial pending status in KV:
   * if (env.PAYMENT_KV) {
   *   await env.PAYMENT_KV.put(`order:${providerData.order_id}`, JSON.stringify({
   *     orderId: providerData.order_id,
   *     amount: amount,
   *     verified: false,
   *     createdAt: Date.now()
   *   }), { expirationTtl: 86400 });
   * }
   * 
   * return json({
   *   status: "READY",
   *   orderId: providerData.order_id,
   *   upiIntentUrl: providerData.upi_intent_url,
   *   qrImageUrl: providerData.qr_image_url,
   *   amount: amount
   * });
   * =========================================================================
   */

  return json({
    status: "UNCONFIGURED",
    message: "Payment provider integration ready for connection."
  }, 200);
}

/**
 * 2. handlePaymentWebhook()
 * 
 * Verifies provider cryptographic webhook signatures.
 * IMPORTANT: NEVER trust unverified webhooks!
 * 
 * Provider sends signature in headers (e.g. X-UroPay-Signature or similar HMAC-SHA256).
 */
async function handlePaymentWebhook(request, env) {
  const webhookSecret = env?.UROPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Missing UROPAY_WEBHOOK_SECRET in environment.");
    return json({ error: "Webhook not configured" }, 500);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-uropay-signature") || request.headers.get("x-signature") || "";

  /*
   * =========================================================================
   * PLACEHOLDER: CRYPTOGRAPHIC SIGNATURE VERIFICATION
   * =========================================================================
   * Verify HMAC-SHA256 signature against webhookSecret:
   * 
   * const isValid = await verifyHmacSignature(rawBody, signature, webhookSecret);
   * if (!isValid) {
   *   return json({ error: "Invalid webhook signature" }, 401);
   * }
   * 
   * const event = JSON.parse(rawBody);
   * if (event.status === "SUCCESS" || event.status === "COMPLETED") {
   *   if (env.PAYMENT_KV) {
   *     await env.PAYMENT_KV.put(`order:${event.order_id}`, JSON.stringify({
   *       orderId: event.order_id,
   *       amount: event.amount,
   *       verified: true,
   *       transactionId: event.txn_id,
   *       verifiedAt: Date.now()
   *     }), { expirationTtl: 86400 * 7 });
   *   }
   * }
   * =========================================================================
   */

  return json({ success: true, message: "Webhook received" }, 200);
}

/**
 * 3. checkPaymentStatus()
 * 
 * Checks whether an order has been marked as verified by the webhook.
 */
async function checkPaymentStatus(url, env) {
  const orderId = url.searchParams.get("orderId");
  if (!orderId) {
    return json({ error: "Missing orderId parameter" }, 400);
  }

  // If KV storage is configured, read verified status
  if (env?.PAYMENT_KV) {
    const data = await env.PAYMENT_KV.get(`order:${orderId}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return json({
          orderId,
          verified: Boolean(parsed.verified),
          status: parsed.verified ? "SUCCESS" : "PENDING"
        });
      } catch {}
    }
  }

  return json({
    orderId,
    verified: false,
    status: "PENDING"
  });
}

export default {
  async fetch(request, env) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // 2. Route matching
    if (request.method === "POST" && url.pathname.endsWith("/api/tip/order")) {
      return createPaymentOrder(request, env);
    }

    if (request.method === "POST" && url.pathname.endsWith("/api/tip/webhook")) {
      return handlePaymentWebhook(request, env);
    }

    if (request.method === "GET" && url.pathname.endsWith("/api/tip/status")) {
      return checkPaymentStatus(url, env);
    }

    return json({ error: "Route not found" }, 404);
  }
};
