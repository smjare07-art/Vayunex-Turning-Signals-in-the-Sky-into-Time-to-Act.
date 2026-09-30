const db = require("../config/db");

const {
  generateAlertMessage
} = require("./aiAlertAgent");

const {
  sendWhatsAppText
} = require("./whatsappService");


// ============================================================
// SEND WEATHER ALERTS
// ============================================================

const sendWeatherAlerts = async ({
  district,
  hazard,
  riskLevel,
  probability
}) => {

  try {

    // ========================================================
    // GET ELIGIBLE USERS
    // ========================================================

    const result = await db.query(`
      SELECT
        id,
        username,
        phone,
        whatsapp_opt_in,
        latitude,
        longitude
      FROM users
      WHERE whatsapp_opt_in = TRUE
        AND phone IS NOT NULL
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
    `);

    const users = result.rows;


    console.log("=================================");
    console.log("WHATSAPP ALERT SYSTEM");
    console.log("Total users:", users.length);
    console.log("District:", district);
    console.log("Hazard:", hazard);
    console.log("Risk:", riskLevel);
    console.log("Probability:", probability);
    console.log("=================================");


    // ========================================================
    // RESULT TRACKING
    // ========================================================

    const sent = [];
    const failed = [];


    // ========================================================
    // SEND ALERT TO EVERY USER
    // ========================================================

    for (const user of users) {

      try {

        console.log("");
        console.log("---------------------------------");
        console.log(`Processing user: ${user.username}`);
        console.log(`Phone: ${user.phone}`);
        console.log("---------------------------------");


        // ====================================================
        // GENERATE AI ALERT MESSAGE
        // ====================================================

        console.log(
          `Generating alert for: ${user.username}`
        );

        const message = await generateAlertMessage({

          username: user.username,

          district: district,

          hazard: hazard,

          riskLevel: riskLevel,

          probability: probability,

          latitude: user.latitude,

          longitude: user.longitude

        });


        console.log("---------------------------------");
        console.log("Generated message:");
        console.log(message);
        console.log("---------------------------------");


        // ====================================================
        // SEND WHATSAPP MESSAGE
        // ====================================================

        console.log(
          `Sending WhatsApp alert to ${user.phone}...`
        );

        const whatsappResult = await sendWhatsAppText(
          user.phone,
          message
        );


        // ====================================================
        // CHECK WHATSAPP API RESULT
        // ====================================================

        if (
          !whatsappResult ||
          whatsappResult.success !== true
        ) {

          const errorMessage =
            whatsappResult?.error ||
            "WhatsApp message failed";

          console.error(
            `❌ WhatsApp failed for ${user.username}`
          );

          console.error(
            "Reason:",
            errorMessage
          );


          failed.push({

            id: user.id,

            username: user.username,

            phone: user.phone,

            error: errorMessage,

            errorCode:
              whatsappResult?.errorCode || null,

            errorType:
              whatsappResult?.errorType || null,

            data:
              whatsappResult?.data || null

          });


          continue;
        }


        // ====================================================
        // GET WHATSAPP MESSAGE ID
        // ====================================================

        const messageId =
          whatsappResult?.data?.messages?.[0]?.id ||
          null;


        // ====================================================
        // SUCCESS
        // ====================================================

        sent.push({

          id: user.id,

          username: user.username,

          phone: user.phone,

          whatsappMessageId: messageId

        });


        console.log(
          `✅ WhatsApp alert sent successfully to ${user.username}`
        );

        console.log(
          "WhatsApp Message ID:",
          messageId
        );


      } catch (userError) {

        // ====================================================
        // USER-SPECIFIC ERROR
        // ====================================================

        console.error(
          `❌ Failed for ${user.username}:`,
          userError.message
        );


        failed.push({

          id: user.id,

          username: user.username,

          phone: user.phone,

          error: userError.message

        });

      }

    }


    // ========================================================
    // FINAL SUMMARY
    // ========================================================

    console.log("");
    console.log("=================================");
    console.log("WHATSAPP ALERT SUMMARY");
    console.log("=================================");

    console.log(
      "Total users:",
      users.length
    );

    console.log(
      "Sent:",
      sent.length
    );

    console.log(
      "Failed:",
      failed.length
    );

    console.log("=================================");


    // ========================================================
    // FINAL RESPONSE
    // ========================================================

    return {

      success: true,

      totalUsers: users.length,

      sentCount: sent.length,

      failedCount: failed.length,

      sent: sent,

      failed: failed,

      message: "Alerts processed successfully"

    };

  } catch (error) {

    console.error(
      "================================="
    );

    console.error(
      "ALERT SERVICE ERROR:"
    );

    console.error(
      error
    );

    console.error(
      "================================="
    );

    throw error;

  }

};


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  sendWeatherAlerts
};