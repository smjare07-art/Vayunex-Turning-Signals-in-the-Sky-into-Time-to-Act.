const axios = require("axios");

// ============================================================
// OPEN-METEO GFS
// ============================================================

const BASE_URL = "https://api.open-meteo.com/v1/gfs";

// ============================================================
// AXIOS CLIENT
// ============================================================

const gfsClient = axios.create({

    baseURL: BASE_URL,

    timeout: 15000,

    headers: {
        "Accept": "application/json"
    }

});


// ============================================================
// WEATHER VARIABLES
// ============================================================

const HOURLY_VARIABLES = [

    // Surface
    "temperature_2m",
    "dew_point_2m",
    "relative_humidity_2m",
    "surface_pressure",

    // 10m wind
    "wind_speed_10m",
    "wind_direction_10m",

    // Rain
    "precipitation",
    "rain",

    // Convective
    "cape",
    "convective_inhibition",
    "boundary_layer_height",
    "total_column_integrated_water_vapour",

    // 850 hPa
    "temperature_850hPa",
    "dew_point_850hPa",
    "relative_humidity_850hPa",
    "wind_speed_850hPa",
    "wind_direction_850hPa",

    // 500 hPa
    "temperature_500hPa",
    "dew_point_500hPa",
    "relative_humidity_500hPa",
    "wind_speed_500hPa",
    "wind_direction_500hPa"

].join(",");


// ============================================================
// SIMPLE CACHE
// ============================================================
// Avoids requesting the same district repeatedly within 5 min.
// ============================================================

const weatherCache = new Map();

const CACHE_TIME = 5 * 60 * 1000;


// ============================================================
// SINGLE LOCATION
// ============================================================

async function getLiveAtmosphericData(lat, lon) {

    const cacheKey =
        `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;


    // --------------------------------------------------------
    // CACHE CHECK
    // --------------------------------------------------------

    const cached =
        weatherCache.get(cacheKey);


    if (
        cached &&
        Date.now() - cached.timestamp < CACHE_TIME
    ) {

        console.log(
            `✓ GFS cache hit: ${cacheKey}`
        );

        return cached.data;

    }


    // --------------------------------------------------------
    // GFS REQUEST
    // --------------------------------------------------------

    const startTime = Date.now();

    try {

        console.log(
            `GFS request: ${lat}, ${lon}`
        );


        const response =
            await gfsClient.get("", {

                params: {

                    latitude: lat,

                    longitude: lon,

                    hourly:
                        HOURLY_VARIABLES,

                    forecast_hours: 25,

                    timezone: "Asia/Kolkata",

                    wind_speed_unit: "ms",

                    precipitation_unit: "mm"

                }

            });


        const data =
            response.data;


        // ----------------------------------------------------
        // BASIC VALIDATION
        // ----------------------------------------------------

        if (
            !data ||
            !data.hourly
        ) {

            throw new Error(
                "Invalid GFS response"
            );

        }


        // ----------------------------------------------------
        // CACHE
        // ----------------------------------------------------

        weatherCache.set(
            cacheKey,
            {

                timestamp:
                    Date.now(),

                data

            }
        );


        const time =
            Date.now() - startTime;


        console.log(
            `✓ GFS completed in ${time} ms`
        );


        return data;


    } catch (error) {

        console.error(
            "GFS API ERROR:",
            error.response?.data ||
            error.message
        );


        throw new Error(
            error.response?.data?.reason ||
            error.message ||
            "GFS API request failed"
        );

    }

}


// ============================================================
// BATCH GFS
// ============================================================
// This is the important optimization.
//
// Instead of:
//
// PUNE     -> GFS
// SATARA   -> GFS
// SANGLI   -> GFS
// KOLHAPUR -> GFS
//
// We can request multiple coordinates together.
// ============================================================

async function getLiveAtmosphericDataBatch(
    locations = []
) {

    if (
        !Array.isArray(locations) ||
        locations.length === 0
    ) {

        return [];

    }


    const startTime =
        Date.now();


    console.log(
        `Starting batch GFS request for ${locations.length} locations`
    );


    try {

        const latitude =
            locations
                .map(item => item.lat)
                .join(",");


        const longitude =
            locations
                .map(item => item.lon)
                .join(",");


        const response =
            await gfsClient.get("", {

                params: {

                    latitude,

                    longitude,

                    hourly:
                        HOURLY_VARIABLES,

                    forecast_hours: 25,

                    timezone: "Asia/Kolkata",

                    wind_speed_unit: "ms",

                    precipitation_unit: "mm"

                }

            });


        const data =
            response.data;


        // ----------------------------------------------------
        // Open-Meteo returns:
        //
        // Array when multiple locations are requested.
        // ----------------------------------------------------

        const results =
            Array.isArray(data)
                ? data
                : [data];


        const elapsed =
            Date.now() - startTime;


        console.log(
            `✓ Batch GFS completed in ${elapsed} ms`
        );


        console.log(
            `✓ Locations received: ${results.length}`
        );


        return results;


    } catch (error) {

        console.error(
            "BATCH GFS API ERROR:",
            error.response?.data ||
            error.message
        );


        throw new Error(
            error.response?.data?.reason ||
            error.message ||
            "Batch GFS request failed"
        );

    }

}


// ============================================================
// CACHE CLEAR
// ============================================================

function clearWeatherCache() {

    weatherCache.clear();

    console.log(
        "✓ GFS weather cache cleared"
    );

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    getLiveAtmosphericData,

    getLiveAtmosphericDataBatch,

    clearWeatherCache

};