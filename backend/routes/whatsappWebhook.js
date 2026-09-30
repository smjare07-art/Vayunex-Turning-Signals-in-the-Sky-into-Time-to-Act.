const express = require("express");

const router = express.Router();

const VERIFY_TOKEN = "veeyom_webhook_123";

// META WEBHOOK VERIFICATION
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Webhook verification request");

  if (
    mode === "subscribe" &&
    token === VERIFY_TOKEN
  ) {
    console.log("✅ WEBHOOK VERIFIED");

    return res.status(200).send(challenge);
  }

  console.log("❌ WEBHOOK VERIFICATION FAILED");

  return res.sendStatus(403);
});

// WHATSAPP EVENTS
router.post("/", (req, res) => {
  console.log("================================");
  console.log("WHATSAPP WEBHOOK RECEIVED");
  console.log("================================");

  console.log(
    JSON.stringify(req.body, null, 2)
  );

  return res.sendStatus(200);
});

module.exports = router;