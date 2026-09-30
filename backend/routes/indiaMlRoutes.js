const express = require("express");

const router = express.Router();


// ============================================================
// SERVICES
// ============================================================

const {
    getBatchAtmosphericData,
    getLiveAtmosphericData
} = require("../services/liveWeatherService");

const {
    buildMLFeatures
} = require("../services/mlFeatureBuilder");

const {
    predictWeather
} = require("../services/weatherPrediction");


// ============================================================
// INDIA GRID
// ============================================================

const indiaGrid =
    require("../data/indiaGrid");


// ============================================================
// SETTINGS
// ============================================================

// सुरुवातीला 20 locations test
const TEST_LIMIT =20000;


// ============================================================
// PROCESS ONE LOCATION
// ============================================================

async function processLocation(location, weather) {

    try {

        // ------------------------------------------------------
        // BUILD ML FEATURES
        // ------------------------------------------------------

        const features =
            buildMLFeatures(weather);


        // ------------------------------------------------------
        // FASTAPI + XGBOOST
        // ------------------------------------------------------

        const prediction =
            await predictWeather(features);


        return {

            id:
                location.id,

            name:
                location.name,

            country:
                "India",

            lat:
                location.lat,

            lon:
                location.lon,

            success:
                true,

            prediction

        };

    } catch (error) {

        console.error(
            `ML ERROR ${location.id}:`,
            error.message
        );


        return {

            id:
                location.id,

            name:
                location.name,

            country:
                "India",

            lat:
                location.lat,

            lon:
                location.lon,

            success:
                false,

            prediction:
                null,

            error:
                error.message

        };

    }

}


// ============================================================
// GET INDIA TEST SCAN
// ============================================================
//
// GET /api/ml/india
//
// ============================================================

router.get(
    "/india",
    async (req, res) => {

        const startTime =
            Date.now();


        try {

            console.log("");
            console.log(
                "=========================================="
            );

            console.log(
                "VEEYOM INDIA ML SCAN"
            );

            console.log(
                "=========================================="
            );


            // ==================================================
            // TEST LOCATIONS
            // ==================================================

            const locations =
                indiaGrid.slice(
                    0,
                    TEST_LIMIT
                );


            console.log(
                `Scanning ${locations.length} locations`
            );


            // ==================================================
            // WEATHER REQUEST
            // ==================================================

            const weatherLocations =
                locations.map(
                    location => ({

                        district:
                            location.id,

                        lat:
                            location.lat,

                        lon:
                            location.lon

                    })
                );


            const weatherData =
                await getBatchAtmosphericData(
                    weatherLocations
                );


            console.log(
                "Weather batch received"
            );


            // ==================================================
            // ML PROCESSING
            // ==================================================

            const results = [];


            for (
                const location
                of locations
            ) {

                try {

                    // ------------------------------------------
                    // IMPORTANT
                    // getBatchAtmosphericData may return Map
                    // ------------------------------------------

                    let weather = null;


                    if (
                        weatherData instanceof Map
                    ) {

                        weather =
                            weatherData.get(
                                location.id
                            );

                    } else {

                        weather =
                            weatherData?.[
                                location.id
                            ];

                    }


                    // ------------------------------------------
                    // WEATHER NOT AVAILABLE
                    // ------------------------------------------

                    if (!weather) {

                        results.push({

                            id:
                                location.id,

                            name:
                                location.name,

                            country:
                                "India",

                            lat:
                                location.lat,

                            lon:
                                location.lon,

                            success:
                                false,

                            prediction:
                                null,

                            error:
                                "Weather data unavailable"

                        });


                        continue;

                    }


                    // ------------------------------------------
                    // PROCESS ML
                    // ------------------------------------------

                    const result =
                        await processLocation(
                            location,
                            weather
                        );


                    results.push(
                        result
                    );


                    console.log(
                        `✓ ${location.id}`
                    );


                } catch (error) {

                    console.error(
                        `✗ ${location.id}:`,
                        error.message
                    );


                    results.push({

                        id:
                            location.id,

                        name:
                            location.name,

                        country:
                            "India",

                        lat:
                            location.lat,

                        lon:
                            location.lon,

                        success:
                            false,

                        prediction:
                            null,

                        error:
                            error.message

                    });

                }

            }


            // ==================================================
            // SUCCESSFUL
            // ==================================================

            const successful =
                results.filter(
                    item =>
                        item.success === true &&
                        item.prediction
                );


            // ==================================================
            // FAILED
            // ==================================================

            const failed =
                results.filter(
                    item =>
                        !item.success
                );


            // ==================================================
            // RISK SUMMARY
            // ==================================================

            const riskSummary = {

                veryHigh:
                    0,

                high:
                    0,

                medium:
                    0,

                low:
                    0

            };


            successful.forEach(
                item => {

                    const risk =
                        item
                            ?.prediction
                            ?.overall
                            ?.risk
                            ?.toUpperCase();


                    if (
                        risk === "VERY HIGH"
                    ) {

                        riskSummary.veryHigh++;

                    }

                    else if (
                        risk === "HIGH"
                    ) {

                        riskSummary.high++;

                    }

                    else if (
                        risk === "MEDIUM"
                    ) {

                        riskSummary.medium++;

                    }

                    else {

                        riskSummary.low++;

                    }

                }
            );


            // ==================================================
            // PROCESSING TIME
            // ==================================================

            const processingTimeMs =
                Date.now() -
                startTime;


            // ==================================================
            // RESPONSE
            // ==================================================

            const response = {

                success:
                    true,

                source:
                    "Open-Meteo GFS + XGBoost",

                country:
                    "India",

                testMode:
                    true,

                totalIndiaGrid:
                    indiaGrid.length,

                scannedLocations:
                    locations.length,

                successfulPredictions:
                    successful.length,

                failedPredictions:
                    failed.length,

                riskSummary,

                processingTimeMs,

                generatedAt:
                    new Date().toISOString(),

                results

            };


            console.log("");
            console.log(
                "=========================================="
            );

            console.log(
                "INDIA ML SCAN COMPLETED"
            );

            console.log(
                `Scanned: ${locations.length}`
            );

            console.log(
                `Successful: ${successful.length}`
            );

            console.log(
                `Failed: ${failed.length}`
            );

            console.log(
                `Time: ${processingTimeMs} ms`
            );

            console.log(
                "=========================================="
            );


            return res.json(
                response
            );


        } catch (error) {

            console.error(
                "INDIA ML ERROR:",
                error
            );


            return res.status(
                500
            ).json({

                success:
                    false,

                country:
                    "India",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// SINGLE INDIA LOCATION
// ============================================================
//
// GET /api/ml/india/location?lat=19.076&lon=72.8777
//
// ============================================================

router.get(
    "/india/location",
    async (req, res) => {

        try {

            const lat =
                Number(
                    req.query.lat
                );

            const lon =
                Number(
                    req.query.lon
                );


            // --------------------------------------------------
            // VALIDATION
            // --------------------------------------------------

            if (
                Number.isNaN(lat) ||
                Number.isNaN(lon)
            ) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    error:
                        "Valid lat and lon are required"

                });

            }


            console.log(
                `India location ML: ${lat}, ${lon}`
            );


            // --------------------------------------------------
            // WEATHER
            // --------------------------------------------------

            const weather =
                await getLiveAtmosphericData(
                    lat,
                    lon
                );


            // --------------------------------------------------
            // FEATURES
            // --------------------------------------------------

            const features =
                buildMLFeatures(
                    weather
                );


            // --------------------------------------------------
            // ML
            // --------------------------------------------------

            const prediction =
                await predictWeather(
                    features
                );


            // --------------------------------------------------
            // RESPONSE
            // --------------------------------------------------

            return res.json({

                success:
                    true,

                source:
                    "Open-Meteo GFS + XGBoost",

                country:
                    "India",

                location: {

                    lat,

                    lon

                },

                prediction,

                features

            });


        } catch (error) {

            console.error(
                "INDIA LOCATION ML ERROR:",
                error.message
            );


            return res.status(
                500
            ).json({

                success:
                    false,

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// INDIA GRID INFO
// ============================================================
//
// GET /api/ml/india/grid
//
// ============================================================

router.get(
    "/india/grid",
    (req, res) => {

        return res.json({

            success:
                true,

            country:
                "India",

            totalGridPoints:
                indiaGrid.length,

            gridPoints:
                indiaGrid

        });

    }
);


// ============================================================
// EXPORT
// ============================================================

module.exports =
    router;