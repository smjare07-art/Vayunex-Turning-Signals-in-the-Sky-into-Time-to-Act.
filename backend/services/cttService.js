// services/cttService.js

const axios = require("axios");

/**
 * NASA GIBS MODIS Terra Cloud Top Temperature
 *
 * Public GIBS WMS
 *
 * IMPORTANT:
 * This service retrieves the rendered CTT image around a location.
 * The returned pixel is NOT converted into a scientific Kelvin value.
 *
 * Layer:
 * MODIS_Terra_Cloud_Top_Temp_Day
 */

const GIBS_WMS =
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";

const CTT_LAYER =
    "MODIS_Terra_Cloud_Top_Temp_Day";


const getCTTImage = async (lat, lon, date = null) => {

    try {

        // -----------------------------
        // Validation
        // -----------------------------

        if (
            typeof lat !== "number" ||
            typeof lon !== "number"
        ) {
            throw new Error(
                "Latitude and longitude must be numbers"
            );
        }

        if (lat < -90 || lat > 90) {
            throw new Error(
                "Latitude must be between -90 and 90"
            );
        }

        if (lon < -180 || lon > 180) {
            throw new Error(
                "Longitude must be between -180 and 180"
            );
        }


        // -----------------------------
        // Small bounding box
        // -----------------------------
        //
        // Around requested point
        //
        // lon ± 0.05
        // lat ± 0.05
        //
        // Approximately small local area.
        //

        const delta = 0.05;

        const minLon = lon - delta;
        const maxLon = lon + delta;

        const minLat = lat - delta;
        const maxLat = lat + delta;


        // -----------------------------
        // Image size
        // -----------------------------

        const width = 101;
        const height = 101;


        // -----------------------------
        // WMS parameters
        // -----------------------------

        const params = {
            SERVICE: "WMS",
            VERSION: "1.1.1",
            REQUEST: "GetMap",

            LAYERS: CTT_LAYER,

            STYLES: "",

            SRS: "EPSG:4326",

            BBOX:
                `${minLon},${minLat},${maxLon},${maxLat}`,

            WIDTH: width,
            HEIGHT: height,

            FORMAT: "image/png",

            TRANSPARENT: "TRUE"
        };


        // Add date only when supplied
        if (date) {
            params.TIME = date;
        }


        // -----------------------------
        // Request GIBS
        // -----------------------------

        const response = await axios.get(
            GIBS_WMS,
            {
                params,

                responseType: "arraybuffer",

                timeout: 20000,

                headers: {
                    "User-Agent":
                        "Veeyom-Weather-Application"
                }
            }
        );


        // -----------------------------
        // Return image information
        // -----------------------------

        return {

            success: true,

            source: "NASA GIBS",

            satellite: "MODIS Terra",

            product:
                "MODIS Cloud Top Temperature Day",

            layer: CTT_LAYER,

            latitude: lat,

            longitude: lon,

            date: date,

            imageBuffer: response.data,

            imageSize: {
                width,
                height
            },

            bbox: {
                minLon,
                minLat,
                maxLon,
                maxLat
            }

        };

    } catch (error) {

        console.error(
            "CTT GIBS Error:",
            error.message
        );

        throw new Error(
            `Unable to retrieve NASA GIBS CTT: ${error.message}`
        );
    }
};


module.exports = {
    getCTTImage
};