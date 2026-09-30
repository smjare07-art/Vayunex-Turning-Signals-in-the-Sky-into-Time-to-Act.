const axios = require("axios");

let accessToken = null;
let tokenExpiry = 0;


// ==========================================
// 1. Generate JWT Token
// ==========================================
async function generateJWTToken() {
    try {

        console.log("Generating IMD JWT token...");

        const response = await axios.post(
            "https://api.imd.gov.in/api/oauth/token.php",
            {
                email: process.env.IMD_EMAIL,
                password: process.env.IMD_PASSWORD
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        );

        accessToken = response.data.access_token;

        if (!accessToken) {
            throw new Error("IMD JWT access_token not received");
        }

        // PDF says expires_in is returned.
        const expiresIn = response.data.expires_in || 3600;

        // Refresh 1 minute before expiry
        tokenExpiry = Date.now() + ((expiresIn - 60) * 1000);

        console.log("IMD JWT generated successfully");

        return accessToken;

    } catch (error) {

        console.error(
            "JWT STATUS:",
            error.response?.status
        );

        console.error(
            "JWT ERROR:",
            error.response?.data || error.message
        );

        throw error;
    }
}


// ==========================================
// 2. Get valid JWT token
// ==========================================
async function getAccessToken() {

    if (
        accessToken &&
        Date.now() < tokenExpiry
    ) {
        return accessToken;
    }

    return await generateJWTToken();
}


// ==========================================
// 3. District Nowcast
// ==========================================
async function getDistrictNowcast() {

    try {

        const token = await getAccessToken();

        console.log("Calling IMD District Nowcast API...");

        const response = await axios.get(
            "https://api.imd.gov.in/api/v1/districtnowcast",
            {
                headers: {

                    // IMPORTANT
                    "X-API-KEY": process.env.IMD_API_KEY,

                    // JWT
                    "Authorization": `Bearer ${token}`,

                    "Accept": "application/json"
                }
            }
        );

        console.log("IMD Nowcast API successful");

        return response.data;

    } catch (error) {

        console.error(
            "IMD STATUS:",
            error.response?.status
        );

        console.error(
            "IMD ERROR:",
            error.response?.data || error.message
        );

        throw error;
    }
};


module.exports = {
    generateJWTToken,
    getAccessToken,
    getDistrictNowcast
};