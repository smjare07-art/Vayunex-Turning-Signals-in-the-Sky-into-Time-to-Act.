const {
    getTomorrowWeather
} = require("../services/tomorrowService");

const {
    getOpenWeather
} = require("../services/openWeatherService");

const {
    getCTTImage
} = require("../services/cttService");


const getCombinedWeather = async (req, res) => {

    try {

        const { lat, lon } = req.query;

        if (!lat || !lon) {

            return res.status(400).json({
                success: false,
                message: "lat and lon are required"
            });

        }

        const latitude = Number(lat);
        const longitude = Number(lon);

        if (
            Number.isNaN(latitude) ||
            Number.isNaN(longitude)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid latitude or longitude"
            });

        }

        // ==============================
        // Tomorrow.io
        // ==============================

        const tomorrowData =
            await getTomorrowWeather(
                latitude,
                longitude
            );


        // ==============================
        // OpenWeather
        // ==============================

        const openWeatherData =
            await getOpenWeather(
                latitude,
                longitude
            );


        // ==============================
        // NASA GIBS CTT
        // ==============================

        const cttData =
            await getCTTImage(
                latitude,
                longitude
            );


        // ==============================
        // Calculate U/V Wind
        // ==============================

        let uWind = null;
        let vWind = null;

        if (
            tomorrowData.windSpeed !== null &&
            tomorrowData.windDirection !== null
        ) {

            const speed =
                tomorrowData.windSpeed;

            const direction =
                tomorrowData.windDirection *
                Math.PI / 180;

            uWind =
                -speed * Math.sin(direction);

            vWind =
                -speed * Math.cos(direction);
        }


        // ==============================
        // Final Response
        // ==============================

        return res.json({

            success: true,

            location: {
                latitude,
                longitude
            },


            // Tomorrow.io
            tomorrow: tomorrowData,


            // OpenWeather
            openWeather: openWeatherData,


            // Wind Vector
            wind: {

                speed:
                    tomorrowData.windSpeed,

                direction:
                    tomorrowData.windDirection,

                u_wind:
                    uWind,

                v_wind:
                    vWind
            },


            // CTT
            ctt: {

                source:
                    cttData.source,

                satellite:
                    cttData.satellite,

                product:
                    cttData.product,

                layer:
                    cttData.layer,

                bbox:
                    cttData.bbox

            }

        });

    } catch (error) {

        console.error(
            "Weather Controller Error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }
};


module.exports = {
    getCombinedWeather
};