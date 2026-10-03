/**
 * NIK MODS — Anonymous Feedback Serverless Worker
 * 
 * Free serverless backend running on Cloudflare Workers.
 * Securely forwards anonymous user feedback to Telegram Bot (@NIKMODSFeedbackBot)
 * without exposing the TELEGRAM_BOT_TOKEN to the browser or public repository.
 */

const DEFAULT_CHAT_ID = "1840373853";
const MIN_LENGTH = 2;
const MAX_LENGTH = 1000;

// In-memory sliding rate limiter per worker instance
const rateLimits = new Map();
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_PER_WINDOW = 5;

function checkRateLimit(ip) {
  if (!ip || ip === "unknown") return false;
  const now = Date.now();
  const entry = rateLimits.get(ip);

  // Clean old entries if map grows large
  if (rateLimits.size > 2000) {
    for (const [key, val] of rateLimits.entries()) {
      if (now - val.start > RATE_WINDOW_MS) rateLimits.delete(key);
    }
  }

  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    rateLimits.set(ip, { start: now, count: 1 });
    return false;
  }

  if (entry.count >= MAX_PER_WINDOW) {
    return true;
  }

  entry.count += 1;
  return false;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

export default {
  async fetch(request, env) {
    // 1. Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // 2. Only allow POST
    if (request.method !== "POST") {
      return json({ error: "Method not allowed. Use POST." }, 405);
    }

    // 3. Verify server environment configuration
    const botToken = env?.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error("Missing TELEGRAM_BOT_TOKEN secret in environment.");
      return json({ error: "Feedback backend not configured. Please contact administrator." }, 500);
    }

    const chatId = env?.TELEGRAM_CHAT_ID || DEFAULT_CHAT_ID;

    // 4. Rate-limiting check
    const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
    if (checkRateLimit(clientIp)) {
      return json({ error: "Too many feedback requests. Please wait a moment." }, 429);
    }

    // 5. Parse request body
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON format in request body." }, 400);
    }

    // 6. Anti-spam honeypot (silent drop if bot filled hidden field)
    if (payload?._hp_site || payload?.honeypot) {
      return json({ success: true, message: "Feedback sent" }, 200);
    }

    // 7. Validate non-empty message
    const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    if (!message || message.length < MIN_LENGTH) {
      return json({ error: "Feedback message cannot be empty." }, 400);
    }

    if (message.length > MAX_LENGTH) {
      return json({ error: `Feedback message cannot exceed ${MAX_LENGTH} characters.` }, 400);
    }

    // 8. Format Telegram message (purely anonymous, no visitor identity)
    const telegramText = `NIK MODS — Anonymous Feedback\n\n${message}`;

    // 9. Deliver to Telegram Bot API
    try {
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const tgRes = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: telegramText
        })
      });

      const tgData = await tgRes.json().catch(() => null);

      if (!tgRes.ok || !tgData?.ok) {
        console.error("Telegram API error:", tgData);
        return json({ error: "Failed to deliver feedback to Telegram." }, 502);
      }

      return json({ success: true, message: "Thanks for your feedback." }, 200);
    } catch (err) {
      console.error("Network error forwarding to Telegram:", err);
      return json({ error: "Server error delivering feedback. Please try again." }, 500);
    }
  }
};
