const axios = require("axios");

// ======================================================
// FORMAT INDIAN WHATSAPP NUMBER
// ======================================================

const formatWhatsAppPhone = (phone) => {

  if (!phone) {
    throw new Error("Phone number is required");
  }

  // Remove +, spaces, -, brackets etc.
  let cleanPhone = String(phone).replace(/\D/g, "");

  // Example:
  // 9876543210
  // becomes
  // 919876543210

  if (cleanPhone.length === 10) {
    cleanPhone = "91" + cleanPhone;
  }

  // Already formatted Indian number
  if (
    cleanPhone.length === 12 &&
    cleanPhone.startsWith("91")
  ) {
    return cleanPhone;
  }

  throw new Error(
    `Invalid Indian WhatsApp phone number: ${phone}`
  );
};


// ======================================================
// SEND WHATSAPP TEXT MESSAGE
// ======================================================

const sendWhatsAppText = async (phone, message) => {

  const apiVersion =
    process.env.WHATSAPP_API_VERSION;

  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID;

  const token =
    process.env.WHATSAPP_ACCESS_TOKEN;


  // ====================================================
  // ENV VALIDATION
  // ====================================================

  if (!apiVersion) {
    throw new Error(
      "WHATSAPP_API_VERSION is not defined in .env"
    );
  }

  if (!phoneNumberId) {
    throw new Error(
      "WHATSAPP_PHONE_NUMBER_ID is not defined in .env"
    );
  }

  if (!token) {
    throw new Error(
      "WHATSAPP_ACCESS_TOKEN is not defined in .env"
    );
  }

  if (!message) {
    throw new Error(
      "WhatsApp message is required"
    );
  }


  // ====================================================
  // FORMAT PHONE
  // ====================================================

  const whatsappPhone =
    formatWhatsAppPhone(phone);


  // ====================================================
  // META GRAPH API URL
  // ====================================================

  const url =
    `https://graph.facebook.com/${apiVersion}` +
    `/${phoneNumberId}/messages`;


  // ====================================================
  // DEBUG LOG
  // ====================================================

  console.log("");
  console.log("==========================================");
  console.log("        VEEYOM WHATSAPP ALERT");
  console.log("==========================================");

  console.log("API Version:", apiVersion);
  console.log("Phone Number ID:", phoneNumberId);
  console.log("Token Available:", !!token);
  console.log("Sending To:", whatsappPhone);

  console.log("==========================================");


  try {

    // ==================================================
    // SEND MESSAGE TO META
    // ==================================================

    const response = await axios.post(

      url,

      {
        messaging_product: "whatsapp",

        recipient_type: "individual",

        to: whatsappPhone,

        type: "text",

        text: {
          preview_url: false,
          body: message
        }
      },

      {
        headers: {

          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json"

        },

        timeout: 15000
      }
    );


    // ==================================================
    // SUCCESS
    // ==================================================

    console.log("");
    console.log("✅ WHATSAPP MESSAGE SENT");
    console.log("To:", whatsappPhone);

    console.log(
      "Meta Response:",
      JSON.stringify(
        response.data,
        null,
        2
      )
    );

    console.log("==========================================");
    console.log("");


    return {

      success: true,

      phone: whatsappPhone,

      data: response.data

    };

  }


  catch (error) {

    // ==================================================
    // ERROR
    // ==================================================

    console.log("");
    console.log("❌ WHATSAPP MESSAGE FAILED");
    console.log("To:", whatsappPhone);

    console.log(
      "Status:",
      error.response?.status
    );

    console.log(
      "Meta Error:",
      JSON.stringify(
        error.response?.data ||
        {
          message: error.message
        },
        null,
        2
      )
    );

    console.log("==========================================");
    console.log("");


    return {

      success: false,

      phone: whatsappPhone,

      error:
        error.response?.data ||
        {
          message: error.message
        }

    };

  }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {
  sendWhatsAppText,
  formatWhatsAppPhone
};