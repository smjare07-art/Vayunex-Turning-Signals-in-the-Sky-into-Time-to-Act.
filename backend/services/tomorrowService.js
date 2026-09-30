const axios = require("axios");

const getTomorrowWeather = async (lat, lon) => {
    try {
        const url = "https://api.tomorrow.io/v4/weather/forecast";

        const response = await axios.get(url, {
            params: {
                location: `${lat},${lon}`,
                apikey: process.env.TOMORROW_API_KEY,
                timesteps: "1h",
                units: "metric"
            }
        });

        const hourly = response.data.timelines?.hourly;

        if (!hourly || hourly.length === 0) {
            throw new Error("No Tomorrow.io weather data found");
        }

        const values = hourly[0].values;

        return {
            temperature: values.temperature ?? null,
            humidity: values.humidity ?? null,
            windSpeed: values.windSpeed ?? null,
            windDirection: values.windDirection ?? null,
            cloudCover: values.cloudCover ?? null
        };

    } catch (error) {
        console.error(
            "Tomorrow.io Error:",
            error.response?.data || error.message
        );

        throw new Error("Failed to fetch Tomorrow.io data");
    }
};

module.exports = {
    getTomorrowWeather
};