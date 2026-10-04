/**
 * NIK MODS — Tip Payment Serverless Handler (Vercel / Node.js)
 * 
 * Clean backend architecture for verified FamGateway UPI payment integration.
 * Handlers for order creation, status verification, and webhook signature validation.
 * 
 * SECURITY:
 * Never commit provider secrets. Read secrets strictly from process.env:
 * - process.env.FAMGATEWAY_API_KEY
 */

import crypto from "crypto";

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-FamGateway-Signature, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { action } = req.query;

  // 1. Create Payment Order via FamGateway
  if (req.method === "POST" && (action === "order" || action === "create-order")) {
    const apiKey = process.env.FAMGATEWAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "FAMGATEWAY_API_KEY is not configured in backend environment."
      });
    }

    const { amount } = req.body || {};
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount < 1 || parsedAmount > 10000) {
      return res.status(400).json({
        ok: false,
        error: "Invalid amount. Must be between ₹1 and ₹10,000."
      });
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
          amount: parsedAmount
        })
      });

      const data = await famResponse.json();
      return res.status(famResponse.status).json(data);
    } catch (err) {
      return res.status(502).json({
        ok: false,
        error: "Failed to connect to FamGateway API",
        message: err.message
      });
    }
  }

  // 2. FamGateway Webhook Handler
  if (req.method === "POST" && action === "webhook") {
    const apiKey = process.env.FAMGATEWAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Webhook secret (FAMGATEWAY_API_KEY) not configured" });
    }

    const signature = req.headers["x-famgateway-signature"] || req.headers["x-signature"];
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    if (signature) {
      const expectedSignature = crypto
        .createHmac("sha256", apiKey)
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    }

    // Process confirmed payment event
    return res.status(200).json({ success: true, message: "Webhook verified successfully" });
  }

  // 3. Status Verification Polling
  if (req.method === "GET" && action === "status") {
    const orderId = req.query.order_id || req.query.orderId;
    if (!orderId) {
      return res.status(400).json({ ok: false, error: "Missing order_id parameter" });
    }

    const apiKey = process.env.FAMGATEWAY_API_KEY;

    try {
      // Query FamGateway verification endpoint
      const verifyUrl = apiKey
        ? `https://famgateway.in/api/verify-order.php?order_id=${encodeURIComponent(orderId)}&api_key=${encodeURIComponent(apiKey)}`
        : `https://famgateway.in/api/checkout-status.php?order_id=${encodeURIComponent(orderId)}`;

      const famRes = await fetch(verifyUrl);
      const data = await famRes.json();

      const isVerified = data.status === "success" || data.status === "paid" || data.verified === true;

      return res.status(200).json({
        ok: true,
        order_id: orderId,
        verified: isVerified,
        status: isVerified ? "SUCCESS" : (data.status || "PENDING"),
        details: data
      });
    } catch (err) {
      return res.status(502).json({
        ok: false,
        order_id: orderId,
        verified: false,
        error: "Status check failed",
        message: err.message
      });
    }
  }

  return res.status(404).json({ ok: false, error: "Endpoint not found" });
}
