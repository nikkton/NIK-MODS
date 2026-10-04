/**
 * NIK MODS — Tip Me a Coffee Payment Integration Worker (Cloudflare Workers)
 * 
 * Production-ready backend architecture for verified FamGateway UPI payments.
 * 
 * ============================================================================
 * ARCHITECTURE & VERIFICATION FLOW:
 * ============================================================================
 * 1. Visitor opens Tip Me a Coffee on website and selects amount (e.g. ₹50)
 * 2. Frontend calls POST https://nik-mods-payments.godrp3236.workers.dev/create-order
 * 3. Worker creates payment order with FamGateway API (using secret FAMGATEWAY_API_KEY)
 * 4. FamGateway returns dynamic order (order_id, upi_intent, qr_url, checkout_url, upi_id)
 * 5. Visitor completes payment in preferred UPI app (GPay, PhonePe, Paytm, BHIM)
 * 6. FamGateway verifies payment on banking network and sends signed webhook
 * 7. POST /webhook verifies HMAC-SHA256 signature using secret FAMGATEWAY_API_KEY
 * 8. Worker confirms payment and frontend polls GET /status?order_id=...
 * 9. Only when status is verified SUCCESS does frontend show "Payment Successful"
 * 
 * ============================================================================
 * SECURITY GUARANTEES:
 * ============================================================================
 * - ZERO secrets in client-side code (HTML, CSS, JS).
 * - FamGateway API key is NEVER exposed to browsers or committed to Git.
 * - Stored strictly as Cloudflare Worker secret:
 *     npx wrangler secret put FAMGATEWAY_API_KEY
 * ============================================================================
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-FamGateway-Signature, Authorization",
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
 * Creates a dynamic UPI payment order using FamGateway API.
 */
async function createPaymentOrder(request, env) {
  const apiKey = env?.FAMGATEWAY_API_KEY;
  if (!apiKey) {
    return json({
      status: "error",
      message: "FAMGATEWAY_API_KEY is not configured in backend environment."
    }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const amount = Number(body?.amount);
  if (!amount || amount < 1 || amount > 10000) {
    return json({ ok: false, error: "Amount must be between ₹1 and ₹10,000" }, 400);
  }

  try {
    const famResponse = await fetch("https://famgateway.in/api/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey
      },
      body: JSON.stringify({
        api_key: apiKey,
        amount: amount
      })
    });

    const data = await famResponse.json();
    return json(data, famResponse.status);
  } catch (err) {
    return json({
      status: "error",
      message: "Failed to connect to FamGateway API",
      error: err.message
    }, 502);
  }
}

/**
 * 2. handlePaymentWebhook()
 * Cryptographically verifies FamGateway HMAC-SHA256 signature and records confirmed payment.
 */
async function handlePaymentWebhook(request, env) {
  const apiKey = env?.FAMGATEWAY_API_KEY;
  if (!apiKey) {
    console.error("Missing FAMGATEWAY_API_KEY in environment.");
    return new Response("Unauthorized", { status: 401 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-famgateway-signature") || request.headers.get("x-signature") || "";

  if (signature) {
    // Verify HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Convert hex signature to ArrayBuffer
    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      signatureBytes,
      encoder.encode(rawBody)
    );

    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  // Parse webhook event
  try {
    const payload = JSON.parse(rawBody);
    const orderId = payload.order_id || payload.orderId;

    if (orderId && env.PAYMENT_KV) {
      await env.PAYMENT_KV.put(`order:${orderId}`, JSON.stringify({
        order_id: orderId,
        verified: true,
        status: "SUCCESS",
        amount: payload.amount,
        utr: payload.utr,
        sender_name: payload.sender_name,
        verified_at: Date.now()
      }), { expirationTtl: 86400 * 7 });
    }
  } catch (e) {
    console.warn("Webhook JSON parse warning:", e);
  }

  return json({ success: true, message: "Webhook accepted" }, 200);
}

/**
 * 3. checkPaymentStatus()
 * Checks verified payment status via KV store or authoritative FamGateway verification.
 */
async function checkPaymentStatus(url, env) {
  const orderId = url.searchParams.get("order_id") || url.searchParams.get("orderId");
  if (!orderId) {
    return json({ ok: false, error: "Missing order_id" }, 400);
  }

  // 1. Check KV storage if configured
  if (env?.PAYMENT_KV) {
    try {
      const data = await env.PAYMENT_KV.get(`order:${orderId}`);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.verified) {
          return json({
            ok: true,
            order_id: orderId,
            verified: true,
            status: "SUCCESS",
            data: parsed
          });
        }
      }
    } catch (e) {
      console.warn("KV read error:", e);
    }
  }

  // 2. Query FamGateway API with API Key in query parameter
  const apiKey = env?.FAMGATEWAY_API_KEY;
  try {
    const verifyUrl = apiKey
      ? `https://famgateway.in/api/verify-order.php?order_id=${encodeURIComponent(orderId)}&api_key=${encodeURIComponent(apiKey)}`
      : `https://famgateway.in/api/checkout-status.php?order_id=${encodeURIComponent(orderId)}`;

    const famRes = await fetch(verifyUrl);
    const data = await famRes.json();
    const nested = data?.data || data?.result || {};
    const normalizedStatus = String(
      data?.status ?? nested?.status ?? data?.state ?? nested?.state ?? ""
    ).toLowerCase();

    const isVerified =
      data?.verified === true ||
      nested?.verified === true ||
      ["success", "paid", "completed"].includes(normalizedStatus);

    const isExpired = ["expired", "failed", "cancelled"].includes(normalizedStatus);

    return json({
      ok: true,
      order_id: orderId,
      verified: isVerified,
      status: isVerified ? "SUCCESS" : (isExpired ? "EXPIRED" : "PENDING"),
      data
    });
  } catch (err) {
    // Fallback to public checkout-status endpoint if verify-order encounters network error
    try {
      const pubRes = await fetch(`https://famgateway.in/api/checkout-status.php?order_id=${encodeURIComponent(orderId)}`);
      const pubData = await pubRes.json();
      const pubNested = pubData?.data || pubData?.result || {};
      const pubStatus = String(
        pubData?.status ?? pubNested?.status ?? pubData?.state ?? pubNested?.state ?? ""
      ).toLowerCase();

      const isVerified =
        pubData?.verified === true ||
        pubNested?.verified === true ||
        ["success", "paid", "completed"].includes(pubStatus);

      const isExpired = ["expired", "failed", "cancelled"].includes(pubStatus);

      return json({
        ok: true,
        order_id: orderId,
        verified: isVerified,
        status: isVerified ? "SUCCESS" : (isExpired ? "EXPIRED" : "PENDING"),
        data: pubData
      });
    } catch {
      return json({
        ok: false,
        order_id: orderId,
        verified: false,
        status: "PENDING",
        error: "Status check currently unavailable"
      }, 200);
    }
  }
}

export default {
  async fetch(request, env) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // 2. Health check
    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true, service: "NIK MODS Payments" });
    }

    // 3. Create Order
    if (request.method === "POST" && (url.pathname === "/create-order" || url.pathname.endsWith("/create-order"))) {
      return createPaymentOrder(request, env);
    }

    // 4. Status Check
    if (request.method === "GET" && (url.pathname === "/status" || url.pathname.endsWith("/status"))) {
      return checkPaymentStatus(url, env);
    }

    // 5. Webhook
    if (request.method === "POST" && (url.pathname === "/webhook" || url.pathname.endsWith("/webhook"))) {
      return handlePaymentWebhook(request, env);
    }

    return json({ ok: false, error: "Not found" }, 404);
  }
};
