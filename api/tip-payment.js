/**
 * NIK MODS — Tip Payment Serverless Handler (Vercel / Node.js)
 * 
 * Clean backend architecture for verified UPI payment integration.
 * Placeholders for createPaymentOrder, checkPaymentStatus, and handlePaymentWebhook.
 * 
 * SECURITY:
 * Never commit provider secrets. Read secrets strictly from process.env:
 * - process.env.UROPAY_API_KEY
 * - process.env.UROPAY_WEBHOOK_SECRET
 * - process.env.UROPAY_MERCHANT_ID
 */

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Signature, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { action } = req.query;

  // 1. Create Payment Order
  if (req.method === "POST" && action === "order") {
    const apiKey = process.env.UROPAY_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        status: "UNCONFIGURED",
        message: "Payment gateway credentials not configured in backend environment."
      });
    }

    const { amount, note } = req.body || {};
    if (!amount || Number(amount) < 1) {
      return res.status(400).json({ error: "Invalid amount (min ₹1)" });
    }

    // Call provider API here when ready
    return res.status(200).json({
      status: "UNCONFIGURED",
      message: "Payment provider integration ready for connection."
    });
  }

  // 2. Provider Webhook
  if (req.method === "POST" && action === "webhook") {
    const webhookSecret = process.env.UROPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    // Verify signature & update verified database/KV
    return res.status(200).json({ success: true, message: "Webhook received" });
  }

  // 3. Status Verification Polling
  if (req.method === "GET" && action === "status") {
    const { orderId } = req.query;
    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId" });
    }

    // Query status from database/KV
    return res.status(200).json({
      orderId,
      verified: false,
      status: "PENDING"
    });
  }

  return res.status(404).json({ error: "Endpoint not found" });
}
