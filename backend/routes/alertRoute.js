const express = require("express");

const router = express.Router();

const {
  sendWeatherAlerts
} = require("../services/alertService");

// ==========================================
// SEND WEATHER ALERT
// POST /api/alerts/send
// ==========================================

router.post("/send", async (req, res) => {
  try {
    const {
      district,
      hazard,
      riskLevel,
      probability
    } = req.body;

    // ==========================================
    // VALIDATION
    // ==========================================

    if (!district || !hazard || !riskLevel) {
      return res.status(400).json({
        success: false,
        message: "district, hazard and riskLevel are required"
      });
    }

    // ==========================================
    // SEND ALERTS
    // ==========================================

    console.log("=================================");
    console.log("WEATHER ALERT API CALLED");
    console.log("District:", district);
    console.log("Hazard:", hazard);
    console.log("Risk Level:", riskLevel);
    console.log("Probability:", probability);
    console.log("=================================");

    const result = await sendWeatherAlerts({
      district,
      hazard,
      riskLevel,
      probability
    });

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,
      message: "Weather alerts processed successfully",
      result
    });

  } catch (error) {
    console.error("=================================");
    console.error("ALERT ROUTE ERROR");
    console.error(error);
    console.error("=================================");

    return res.status(500).json({
      success: false,
      message: "Failed to send weather alerts",
      error: error.message
    });
  }
});

module.exports = router;