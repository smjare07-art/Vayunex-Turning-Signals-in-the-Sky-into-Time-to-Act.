const { GoogleGenAI } = require("@google/genai");

// ============================================================
// GEMINI AI
// ============================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});


// ============================================================
// WAIT FUNCTION
// ============================================================

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));


// ============================================================
// GENERATE WEATHER ALERT
// ============================================================

const generateAlertMessage = async ({
  username,
  district,
  hazard,
  riskLevel,
  probability,
  latitude,
  longitude
}) => {

  try {

    // ----------------------------------------------------------
    // Validate required data
    // ----------------------------------------------------------

    if (!district) {
      throw new Error("District is required");
    }

    if (!hazard) {
      throw new Error("Hazard is required");
    }

    if (!riskLevel) {
      throw new Error("Risk level is required");
    }


    // ----------------------------------------------------------
    // Normalize risk
    // ----------------------------------------------------------

    const risk = String(riskLevel).toUpperCase();

    const allowedRisks = [
      "LOW",
      "MEDIUM",
      "HIGH",
      "SEVERE"
    ];

    if (!allowedRisks.includes(risk)) {
      throw new Error(
        `Invalid risk level: ${risk}`
      );
    }


    // ----------------------------------------------------------
    // Probability
    // ----------------------------------------------------------

    let probabilityText = "Not available";

    if (
      probability !== undefined &&
      probability !== null &&
      !Number.isNaN(Number(probability))
    ) {

      let probabilityNumber =
        Number(probability);

      // 0.85 -> 85%
      if (probabilityNumber <= 1) {
        probabilityNumber =
          probabilityNumber * 100;
      }

      probabilityText =
        `${probabilityNumber.toFixed(1)}%`;
    }


    // ==========================================================
    // GEMINI PROMPT
    // ==========================================================

    const prompt = `
You are the official AI Alert Agent of VEEYOM,
an AI-powered hyper-local weather early warning system.

Your job is to convert the supplied ML prediction
into a clear WhatsApp weather alert.

IMPORTANT RULES:

1. NEVER change the ML risk level.
2. NEVER invent weather measurements.
3. NEVER invent rainfall, temperature, wind speed,
   flood level or other data.
4. Use ONLY the information provided below.
5. Keep the message short and easy to understand.
6. The message is for a normal citizen, not a scientist.
7. Give practical safety guidance appropriate to the risk.
8. Do not create panic for LOW or MEDIUM risk.
9. HIGH should sound urgent.
10. SEVERE should sound like an emergency warning.
11. Use suitable emojis.
12. Maximum 120 words.
13. Generate ONLY the WhatsApp message.
14. Do not explain how you generated the message.
15. Do not mention Gemini or AI.

RISK STYLE:

LOW:
- Informational
- Calm
- No immediate action required

MEDIUM:
- Advisory
- Ask user to stay alert
- Encourage monitoring updates

HIGH:
- Urgent
- Recommend precautions
- Avoid unnecessary travel if appropriate

SEVERE:
- Emergency tone
- Strong safety precautions
- Follow official/local authority instructions

USER INFORMATION:

Name: ${username || "User"}

LOCATION:

District: ${district}
Latitude: ${latitude ?? "Not available"}
Longitude: ${longitude ?? "Not available"}

WEATHER RISK:

Hazard: ${hazard}
ML Risk Level: ${risk}
ML Risk Probability: ${probabilityText}

Generate the final WhatsApp alert now.
`;


    // ==========================================================
    // GEMINI CALL WITH RETRY
    // ==========================================================

    let response = null;

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {

      try {

        console.log(
          `Gemini request attempt ${attempt}/${MAX_RETRIES}`
        );

        response = await ai.models.generateContent({

          model: "gemini-3.8-flash",

          contents: prompt

        });

        // Success
        break;

      } catch (error) {

        const errorMessage =
          error?.message || "";

        const isTemporaryError =
          errorMessage.includes("503") ||
          errorMessage.includes("UNAVAILABLE") ||
          errorMessage.includes("high demand") ||
          errorMessage.includes("overloaded");

        console.error(
          `Gemini attempt ${attempt} failed:`,
          errorMessage
        );

        // Permanent error
        if (!isTemporaryError) {
          throw error;
        }

        // Last attempt
        if (attempt === MAX_RETRIES) {
          throw new Error(
            "Gemini service temporarily unavailable after 3 attempts"
          );
        }

        // Exponential backoff
        const waitTime =
          2000 * Math.pow(2, attempt - 1);

        console.log(
          `Retrying Gemini after ${waitTime}ms...`
        );

        await sleep(waitTime);
      }
    }


    // ==========================================================
    // GET TEXT
    // ==========================================================

    const message =
      response?.text?.trim();


    if (!message) {

      throw new Error(
        "Gemini returned an empty message"
      );
    }


    // ==========================================================
    // LOG
    // ==========================================================

    console.log(
      "================================"
    );

    console.log(
      "AI ALERT GENERATED"
    );

    console.log(
      "District:",
      district
    );

    console.log(
      "Hazard:",
      hazard
    );

    console.log(
      "Risk:",
      risk
    );

    console.log(
      "Probability:",
      probabilityText
    );

    console.log(
      "================================"
    );


    return message;


  } catch (error) {

    console.error(
      "AI ALERT AGENT ERROR:",
      error.message
    );

    throw error;
  }
};


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  generateAlertMessage
};