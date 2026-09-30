const axios = require("axios");

async function getWeatherData(lat, lon) {
    try {
        const url = "https://api.open-meteo.com/v1/forecast";

        const response = await axios.get(url, {
            params: {
                latitude: lat,
                longitude: lon,

                current:
                    "temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,rain",

                hourly:
                    "temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,rain,precipitation",

                forecast_days: 2,

                timezone: "Asia/Kolkata"
            }
        });

        return response.data;

    } catch (error) {
        console.error(
            "Open-Meteo Error:",
            error.response?.data || error.message
        );

        throw error;
    }
}

module.exports = {
    getWeatherData
};