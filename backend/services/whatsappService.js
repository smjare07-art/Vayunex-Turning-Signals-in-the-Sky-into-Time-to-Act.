const axios = require("axios");

const sendWhatsAppText = async (phone, message) => {

  const apiVersion = process.env.WHATSAPP_API_VERSION;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  console.log("WhatsApp API Version:", apiVersion);
  console.log("WhatsApp Phone ID:", phoneNumberId);
  console.log("Token exists:", !!token);

  if (!apiVersion) {
    throw new Error("WHATSAPP_API_VERSION is not defined");
  }

  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is not defined");
  }

  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is not defined");
  }

  const url =
    `https://graph.facebook.com/${apiVersion}` +
    `/${phoneNumberId}/messages`;

  const response = await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: {
        body: message
      }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
};

module.exports = {
  sendWhatsAppText
};