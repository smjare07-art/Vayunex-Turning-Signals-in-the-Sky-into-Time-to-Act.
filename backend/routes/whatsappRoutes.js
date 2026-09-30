const express = require("express");

const router = express.Router();

const {
  sendWhatsAppMessage
} = require("../controllers/whatsappController");

router.post("/send", sendWhatsAppMessage);

module.exports = router;