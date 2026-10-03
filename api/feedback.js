/**
 * NIK MODS — Anonymous Feedback Serverless Function (Vercel / Node.js)
 * 
 * Securely forwards anonymous user feedback to Telegram Bot (@NIKMODSFeedbackBot)
 * Destination Chat ID: 1840373853
 * Bot Token: Read from process.env.TELEGRAM_BOT_TOKEN
 */

const DEFAULT_CHAT_ID = "1840373853";
const MIN_LENGTH = 2;
const MAX_LENGTH = 1000;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("Missing TELEGRAM_BOT_TOKEN environment variable.");
    return res.status(500).json({ error: "Feedback backend not configured. Please contact administrator." });
  }

  const chatId = process.env.TELEGRAM_CHAT_ID || DEFAULT_CHAT_ID;

  const payload = req.body || {};

  // Honeypot check
  if (payload._hp_site || payload.honeypot) {
    return res.status(200).json({ success: true, message: "Feedback sent" });
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message || message.length < MIN_LENGTH) {
    return res.status(400).json({ error: "Feedback message cannot be empty." });
  }

  if (message.length > MAX_LENGTH) {
    return res.status(400).json({ error: `Feedback message cannot exceed ${MAX_LENGTH} characters.` });
  }

  const telegramText = `NIK MODS — Anonymous Feedback\n\n${message}`;

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
      return res.status(502).json({ error: "Failed to deliver feedback to Telegram." });
    }

    return res.status(200).json({ success: true, message: "Thanks for your feedback." });
  } catch (err) {
    console.error("Error forwarding feedback to Telegram:", err);
    return res.status(500).json({ error: "Server error delivering feedback. Please try again." });
  }
}
