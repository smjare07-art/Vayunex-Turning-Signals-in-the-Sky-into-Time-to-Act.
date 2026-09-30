const { sendWhatsAppText } = require("../services/whatsappService");

const sendWhatsAppMessage = async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        message: "Phone and message are required"
      });
    }

    const result = await sendWhatsAppText(phone, message);

    res.json({
      success: true,
      message: "WhatsApp message sent",
      data: result
    });

  } catch (error) {
    console.error(error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: "WhatsApp message failed",
      error: error.response?.data || error.message
    });
  }
};

module.exports = {
  sendWhatsAppMessage
};