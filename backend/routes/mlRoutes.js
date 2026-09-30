const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();


// ============================================================
// SERVICES
// ============================================================

const {
    getLiveAtmosphericData
} = require("../services/liveWeatherService");

const {
    buildMLFeatures
} = require("../services/mlFeatureBuilder");

const {
    predictWeather
} = require("../services/mlService");


// ============================================================
// CONFIG
// ============================================================

// IMPORTANT:
// Your actual CSV filename is:
// maharashtra_prediction_grid.csv

const GRID_CSV_PATH = path.join(
    __dirname,
    "../data/maharashtraGrid.csv"
);


// India district GeoJSON
const INDIA_GEOJSON_URL =
    "https://raw.githubusercontent.com/udit-001/india-maps-data/main/geojson/india.geojson";


// ============================================================
// CACHE
// ============================================================

let indiaDistrictCache = null;
let maharashtraGridCache = null;


// ============================================================
// NORMALIZE NAME
// ============================================================

function normalizeDistrictName(name) {

    return String(name || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");

}


// ============================================================
// RISK NORMALIZATION
// ============================================================

function getRiskFromPrediction(prediction) {

    let risk =
        prediction?.thunderstorm?.risk;

    if (!risk) {

        risk =
            prediction?.thunderstormRisk;

    }

    if (!risk) {

        risk =
            prediction?.risk;

    }

    risk =
        String(risk || "LOW")
            .trim()
            .toUpperCase();


    if (
        risk.includes("SEVERE") ||
        risk.includes("CRITICAL")
    ) {

        return "SEVERE";

    }


    if (
        risk.includes("HIGH")
    ) {

        return "HIGH";

    }


    if (
        risk.includes("MEDIUM") ||
        risk.includes("MODERATE")
    ) {

        return "MEDIUM";

    }


    return "LOW";

}


// ============================================================
// READ MAHARASHTRA GRID CSV
// ============================================================
//
// ACTUAL FILE:
//
// backend/data/maharashtra_prediction_grid.csv
//
// Supported headers:
//
// latitude,longitude
// lat,lon
// latitude,lon
// lat,lng
// Latitude,Longitude
//
// Every CSV row = ONE ML LOCATION
//
// ============================================================

function getMaharashtraGrid() {

    if (maharashtraGridCache) {

        return maharashtraGridCache;

    }


    // ----------------------------------------------------------
    // CHECK FILE
    // ----------------------------------------------------------

    if (!fs.existsSync(GRID_CSV_PATH)) {

        throw new Error(
            `Maharashtra prediction grid CSV not found at: ${GRID_CSV_PATH}`
        );

    }


    console.log(
        "=========================================="
    );

    console.log(
        "Loading Maharashtra prediction grid CSV..."
    );

    console.log(
        `CSV: ${GRID_CSV_PATH}`
    );


    // ----------------------------------------------------------
    // READ FILE
    // ----------------------------------------------------------

    const csv =
        fs.readFileSync(
            GRID_CSV_PATH,
            "utf8"
        );


    const lines =
        csv
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);


    if (lines.length < 2) {

        throw new Error(
            "Maharashtra prediction grid CSV is empty or invalid"
        );

    }


    // ----------------------------------------------------------
    // HEADER
    // ----------------------------------------------------------

    const headers =
        lines[0]
            .split(",")
            .map(header =>
                header
                    .trim()
                    .toLowerCase()
                    .replace(/["']/g, "")
            );


    console.log(
        "CSV headers:",
        headers
    );


    // ----------------------------------------------------------
    // FIND LATITUDE COLUMN
    // ----------------------------------------------------------

    const latitudeIndex =
        headers.findIndex(
            header =>
                [
                    "latitude",
                    "lat",
                    "y"
                ].includes(header)
        );


    // ----------------------------------------------------------
    // FIND LONGITUDE COLUMN
    // ----------------------------------------------------------

    const longitudeIndex =
        headers.findIndex(
            header =>
                [
                    "longitude",
                    "lon",
                    "lng",
                    "long",
                    "x"
                ].includes(header)
        );


    if (
        latitudeIndex === -1 ||
        longitudeIndex === -1
    ) {

        throw new Error(
            `CSV must contain latitude and longitude columns. Found: ${headers.join(", ")}`
        );

    }


    // ----------------------------------------------------------
    // PARSE LOCATIONS
    // ----------------------------------------------------------

    const grid = [];


    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        try {

            const values =
                lines[i]
                    .split(",")
                    .map(value =>
                        value
                            .trim()
                            .replace(/["']/g, "")
                    );


            const latitude =
                Number(
                    values[latitudeIndex]
                );


            const longitude =
                Number(
                    values[longitudeIndex]
                );


            // --------------------------------------------------
            // VALIDATE COORDINATES
            // --------------------------------------------------

            if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
            ) {

                console.warn(
                    `Skipping invalid CSV row ${i + 1}`
                );

                continue;

            }


            // --------------------------------------------------
            // MAHARASHTRA BOUNDING BOX
            // --------------------------------------------------

            if (
                latitude < 15.5 ||
                latitude > 22.2 ||
                longitude < 72.5 ||
                longitude > 81.0
            ) {

                console.warn(
                    `Skipping outside Maharashtra row ${i + 1}: ${latitude}, ${longitude}`
                );

                continue;

            }


            // --------------------------------------------------
            // UNIQUE GRID LOCATION
            // --------------------------------------------------

            grid.push({

                gridId:
                    grid.length + 1,

                latitude,

                longitude

            });


        } catch (error) {

            console.warn(
                `Unable to parse CSV row ${i + 1}:`,
                error.message
            );

        }

    }


    if (!grid.length) {

        throw new Error(
            "No valid latitude/longitude locations found in Maharashtra prediction grid CSV"
        );

    }


    // ----------------------------------------------------------
    // CACHE
    // ----------------------------------------------------------

    maharashtraGridCache =
        grid;


    console.log(
        `Maharashtra grid loaded: ${grid.length} locations`
    );

    console.log(
        "=========================================="
    );


    return grid;

}


// ============================================================
// GET INDIA DISTRICTS
// ============================================================
//
// District data is ONLY used as optional metadata.
// ML location itself always uses CSV latitude/longitude.
//
// ============================================================

async function getIndiaDistricts() {

    if (indiaDistrictCache) {

        return indiaDistrictCache;

    }


    console.log(
        "Loading India district GeoJSON..."
    );


    const response =
        await fetch(
            INDIA_GEOJSON_URL
        );


    if (!response.ok) {

        throw new Error(
            `India GeoJSON HTTP ${response.status}`
        );

    }


    const geojson =
        await response.json();


    if (
        !geojson ||
        !Array.isArray(
            geojson.features
        )
    ) {

        throw new Error(
            "Invalid India district GeoJSON"
        );

    }


    const districts = [];


    geojson.features.forEach(
        (feature, index) => {

            const properties =
                feature.properties || {};


            const district =
                properties.district ||
                properties.DISTRICT ||
                properties.District ||
                properties.NAME_2 ||
                properties.name ||
                `District ${index + 1}`;


            const state =
                properties.st_nm ||
                properties.state ||
                properties.STATE ||
                properties.ST_NM ||
                "Unknown";


            const coordinates =
                feature.geometry?.coordinates;


            if (!coordinates) {

                return;

            }


            const points = [];


            const collectPoints =
                (value) => {

                    if (
                        Array.isArray(value) &&
                        value.length >= 2 &&
                        typeof value[0] === "number" &&
                        typeof value[1] === "number"
                    ) {

                        points.push(value);

                        return;

                    }


                    if (
                        Array.isArray(value)
                    ) {

                        value.forEach(
                            collectPoints
                        );

                    }

                };


            collectPoints(
                coordinates
            );


            if (!points.length) {

                return;

            }


            let longitude = 0;
            let latitude = 0;


            points.forEach(
                ([lon, lat]) => {

                    longitude += lon;
                    latitude += lat;

                }
            );


            longitude /=
                points.length;


            latitude /=
                points.length;


            districts.push({

                district,

                state,

                latitude,

                longitude,

                districtCode:
                    properties.dt_code ||
                    properties.DT_CODE ||
                    null,

                stateCode:
                    properties.st_code ||
                    properties.ST_CODE ||
                    null

            });

        }
    );


    indiaDistrictCache =
        districts;


    console.log(
        `India districts loaded: ${districts.length}`
    );


    return districts;

}


// ============================================================
// FIND NEAREST DISTRICT
// ============================================================
//
// IMPORTANT:
// This does NOT decide prediction coordinates.
// It is ONLY metadata for the CSV point.
//
// ============================================================

function findNearestDistrict(
    districts,
    latitude,
    longitude
) {

    if (
        !Array.isArray(districts) ||
        districts.length === 0
    ) {

        return null;

    }


    let nearest = null;

    let minDistance =
        Infinity;


    for (
        const district
        of districts
    ) {

        const districtLat =
            Number(
                district.latitude
            );


        const districtLon =
            Number(
                district.longitude
            );


        if (
            !Number.isFinite(
                districtLat
            ) ||
            !Number.isFinite(
                districtLon
            )
        ) {

            continue;

        }


        const latDifference =
            districtLat -
            Number(latitude);


        const lonDifference =
            districtLon -
            Number(longitude);


        const distance =
            Math.sqrt(
                Math.pow(
                    latDifference,
                    2
                ) +
                Math.pow(
                    lonDifference,
                    2
                )
            );


        if (
            distance <
            minDistance
        ) {

            minDistance =
                distance;

            nearest =
                district;

        }

    }


    return nearest;

}


// ============================================================
// MAHARASHTRA DISTRICT LIST
// ============================================================
//
// Kept for backward compatibility.
// This endpoint returns districts only.
//
// ============================================================

router.get(
    "/maharashtra/districts",
    async (req, res) => {

        try {

            const districts =
                await getIndiaDistricts();


            const maharashtra =
                districts.filter(
                    district =>
                        normalizeDistrictName(
                            district.state
                        ) ===
                        "MAHARASHTRA"
                );


            res.json({

                success: true,

                state:
                    "Maharashtra",

                totalDistricts:
                    maharashtra.length,

                districts:
                    maharashtra.map(
                        district => ({

                            district:
                                district.district,

                            latitude:
                                district.latitude,

                            longitude:
                                district.longitude

                        })
                    )

            });


        } catch (error) {

            console.error(
                "District list error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to get Maharashtra districts",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// CURRENT USER LOCATION ML
// ============================================================
//
// GET:
//
// /api/ml/location?lat=18.5204&lon=73.8567
//
// ============================================================

router.get(
    "/location",
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


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lon)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid latitude and longitude are required"

                });

            }


            if (
                lat < -90 ||
                lat > 90 ||
                lon < -180 ||
                lon > 180
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid latitude or longitude"

                });

            }


            console.log(
                `Processing user location: ${lat}, ${lon}`
            );


            const indiaDistricts =
                await getIndiaDistricts();


            const nearestDistrict =
                findNearestDistrict(
                    indiaDistricts,
                    lat,
                    lon
                );


            const districtName =
                nearestDistrict?.district ||
                "UNKNOWN";


            const stateName =
                nearestDistrict?.state ||
                "Unknown";


            const weather =
                await getLiveAtmosphericData(
                    lat,
                    lon
                );


            const features =
                buildMLFeatures(
                    weather,
                    {

                        district:
                            districtName,

                        latitude:
                            lat,

                        longitude:
                            lon

                    }
                );


            const prediction =
                await predictWeather(
                    features
                );


            res.json({

                success: true,

                source:
                    "Open-Meteo GFS + XGBoost",

                district:
                    districtName,

                state:
                    stateName,

                latitude:
                    lat,

                longitude:
                    lon,

                prediction,

                risk:
                    getRiskFromPrediction(
                        prediction
                    ),

                features

            });


        } catch (error) {

            console.error(
                "User location ML error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Location ML prediction failed",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// SINGLE MAHARASHTRA DISTRICT ML
// ============================================================
//
// GET:
//
// /api/ml/district/PUNE
//
// This endpoint is kept for district details page.
//
// ============================================================

router.get(
    "/district/:district",
    async (req, res) => {

        try {

            const districts =
                await getIndiaDistricts();


            const districtName =
                normalizeDistrictName(
                    decodeURIComponent(
                        req.params.district
                    )
                );


            const district =
                districts.find(
                    item =>
                        normalizeDistrictName(
                            item.district
                        ) === districtName &&
                        normalizeDistrictName(
                            item.state
                        ) ===
                        "MAHARASHTRA"
                );


            if (!district) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Maharashtra district not found",

                    district:
                        req.params.district

                });

            }


            console.log(
                `Processing district: ${district.district}`
            );


            const weather =
                await getLiveAtmosphericData(
                    district.latitude,
                    district.longitude
                );


            const features =
                buildMLFeatures(
                    weather,
                    {

                        district:
                            district.district,

                        latitude:
                            district.latitude,

                        longitude:
                            district.longitude

                    }
                );


            const prediction =
                await predictWeather(
                    features
                );


            res.json({

                success: true,

                source:
                    "Open-Meteo GFS + XGBoost",

                state:
                    "Maharashtra",

                district:
                    district.district,

                latitude:
                    district.latitude,

                longitude:
                    district.longitude,

                prediction,

                risk:
                    getRiskFromPrediction(
                        prediction
                    ),

                features

            });


        } catch (error) {

            console.error(
                "District ML error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "District ML prediction failed",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// 🔥 MAIN MAHARASHTRA GRID ML
// ============================================================
//
// GET:
//
// /api/ml/maharashtra/grid
//
// IMPORTANT:
//
// CSV coordinate
//      ↓
// Open-Meteo
//      ↓
// buildMLFeatures
//      ↓
// XGBoost
//      ↓
// prediction
//      ↓
// exact CSV latitude/longitude
//
// ============================================================

router.get(
    "/maharashtra/grid",
    async (req, res) => {

        const startTime =
            Date.now();


        try {

            console.log(
                "=========================================="
            );

            console.log(
                "MAHARASHTRA GRID ML STARTED"
            );


            // ------------------------------------------------
            // LOAD CSV
            // ------------------------------------------------

            const grid =
                getMaharashtraGrid();


            console.log(
                `Total CSV locations: ${grid.length}`
            );


            const indiaDistricts =
                await getIndiaDistricts();


            const results = [];


            // ------------------------------------------------
            // BATCH SIZE
            // ------------------------------------------------

            const BATCH_SIZE = 5;


            // ------------------------------------------------
            // PROCESS EVERY CSV LOCATION
            // ------------------------------------------------

            for (
                let i = 0;
                i < grid.length;
                i += BATCH_SIZE
            ) {

                const batch =
                    grid.slice(
                        i,
                        i + BATCH_SIZE
                    );


                const batchResults =
                    await Promise.all(

                        batch.map(
                            async (location) => {

                                try {

                                    console.log(
                                        `Processing grid ${location.gridId}: ${location.latitude}, ${location.longitude}`
                                    );


                                    // --------------------------------
                                    // LIVE WEATHER
                                    // --------------------------------

                                    const weather =
                                        await getLiveAtmosphericData(
                                            location.latitude,
                                            location.longitude
                                        );


                                    // --------------------------------
                                    // OPTIONAL DISTRICT METADATA
                                    // --------------------------------
                                    //
                                    // Prediction coordinate remains:
                                    //
                                    // location.latitude
                                    // location.longitude
                                    //
                                    // --------------------------------

                                    const nearestDistrict =
                                        findNearestDistrict(
                                            indiaDistricts,
                                            location.latitude,
                                            location.longitude
                                        );


                                    const districtName =
                                        nearestDistrict?.district ||
                                        null;


                                    const stateName =
                                        nearestDistrict?.state ||
                                        "Maharashtra";


                                    // --------------------------------
                                    // ML FEATURES
                                    // --------------------------------

                                    const features =
                                        buildMLFeatures(
                                            weather,
                                            {

                                                district:
                                                    districtName ||
                                                    "GRID_LOCATION",

                                                latitude:
                                                    location.latitude,

                                                longitude:
                                                    location.longitude

                                            }
                                        );


                                    // --------------------------------
                                    // ML PREDICTION
                                    // --------------------------------

                                    const prediction =
                                        await predictWeather(
                                            features
                                        );


                                    // --------------------------------
                                    // RISK
                                    // --------------------------------

                                    const risk =
                                        getRiskFromPrediction(
                                            prediction
                                        );


                                    console.log(
                                        `✓ Grid ${location.gridId} → ${location.latitude}, ${location.longitude} → ${risk}`
                                    );


                                    // --------------------------------
                                    // RETURN EXACT CSV LOCATION
                                    // --------------------------------

                                    return {

                                        gridId:
                                            location.gridId,

                                        latitude:
                                            location.latitude,

                                        longitude:
                                            location.longitude,

                                        district:
                                            districtName,

                                        state:
                                            stateName,

                                        risk,

                                        prediction,

                                        features

                                    };


                                } catch (locationError) {

                                    console.error(
                                        `✗ Grid ${location.gridId}:`,
                                        locationError.message
                                    );


                                    return {

                                        gridId:
                                            location.gridId,

                                        latitude:
                                            location.latitude,

                                        longitude:
                                            location.longitude,

                                        district:
                                            null,

                                        state:
                                            "Maharashtra",

                                        risk:
                                            null,

                                        prediction:
                                            null,

                                        features:
                                            null,

                                        error:
                                            locationError.message

                                    };

                                }

                            }
                        )

                    );


                results.push(
                    ...batchResults
                );


                console.log(
                    `Grid progress: ${Math.min(
                        i + BATCH_SIZE,
                        grid.length
                    )}/${grid.length}`
                );

            }


            // =================================================
            // RISK COUNTS
            // =================================================

            const riskCounts = {

                severe: 0,

                high: 0,

                medium: 0,

                low: 0,

                failed: 0

            };


            results.forEach(
                item => {

                    if (
                        item.risk ===
                        "SEVERE"
                    ) {

                        riskCounts.severe++;

                    } else if (
                        item.risk ===
                        "HIGH"
                    ) {

                        riskCounts.high++;

                    } else if (
                        item.risk ===
                        "MEDIUM"
                    ) {

                        riskCounts.medium++;

                    } else if (
                        item.risk ===
                        "LOW"
                    ) {

                        riskCounts.low++;

                    } else {

                        riskCounts.failed++;

                    }

                }
            );


            const successfulLocations =
                results.filter(
                    item =>
                        item.prediction !== null
                ).length;


            const failedLocations =
                results.filter(
                    item =>
                        item.prediction === null
                ).length;


            const processingTimeMs =
                Date.now() -
                startTime;


            // =================================================
            // RESPONSE
            // =================================================

            res.json({

                success: true,

                country:
                    "India",

                state:
                    "Maharashtra",

                source:
                    "maharashtra_prediction_grid.csv + Open-Meteo GFS + XGBoost",

                totalGridLocations:
                    results.length,

                successfulLocations,

                failedLocations,

                processingTimeMs,

                riskCounts,

                locations:
                    results

            });


            console.log(
                "=========================================="
            );

            console.log(
                "MAHARASHTRA GRID ML COMPLETED"
            );

            console.log(
                `Total locations: ${results.length}`
            );

            console.log(
                `Success: ${successfulLocations}`
            );

            console.log(
                `Failed: ${failedLocations}`
            );

            console.log(
                `Severe: ${riskCounts.severe}`
            );

            console.log(
                `High: ${riskCounts.high}`
            );

            console.log(
                `Medium: ${riskCounts.medium}`
            );

            console.log(
                `Low: ${riskCounts.low}`
            );

            console.log(
                `Time: ${processingTimeMs} ms`
            );

            console.log(
                "=========================================="
            );


        } catch (error) {

            console.error(
                "=========================================="
            );

            console.error(
                "Maharashtra Grid ML Error:",
                error
            );

            console.error(
                "=========================================="
            );


            res.status(500).json({

                success: false,

                message:
                    "Maharashtra grid ML prediction failed",

                error:
                    error.message,

                csvPath:
                    GRID_CSV_PATH

            });

        }

    }
);


// ============================================================
// 🔥 IMPORTANT BACKWARD COMPATIBILITY
// ============================================================
//
// FRONTEND currently calls:
//
// /api/ml/maharashtra
//
// Earlier this endpoint returned district predictions.
//
// NOW it returns CSV GRID predictions.
//
// So frontend does NOT need to use district centers.
//
// ============================================================

router.get(
    "/maharashtra",
    async (req, res) => {

        try {

            console.log(
                "Redirecting /maharashtra → CSV GRID ML"
            );


            const grid =
                getMaharashtraGrid();


            const indiaDistricts =
                await getIndiaDistricts();


            const startTime =
                Date.now();


            const results = [];


            const BATCH_SIZE = 5;


            for (
                let i = 0;
                i < grid.length;
                i += BATCH_SIZE
            ) {

                const batch =
                    grid.slice(
                        i,
                        i + BATCH_SIZE
                    );


                const batchResults =
                    await Promise.all(

                        batch.map(
                            async (location) => {

                                try {

                                    const weather =
                                        await getLiveAtmosphericData(
                                            location.latitude,
                                            location.longitude
                                        );


                                    const nearestDistrict =
                                        findNearestDistrict(
                                            indiaDistricts,
                                            location.latitude,
                                            location.longitude
                                        );


                                    const districtName =
                                        nearestDistrict?.district ||
                                        null;


                                    const stateName =
                                        nearestDistrict?.state ||
                                        "Maharashtra";


                                    const features =
                                        buildMLFeatures(
                                            weather,
                                            {

                                                district:
                                                    districtName ||
                                                    "GRID_LOCATION",

                                                latitude:
                                                    location.latitude,

                                                longitude:
                                                    location.longitude

                                            }
                                        );


                                    const prediction =
                                        await predictWeather(
                                            features
                                        );


                                    const risk =
                                        getRiskFromPrediction(
                                            prediction
                                        );


                                    return {

                                        gridId:
                                            location.gridId,

                                        latitude:
                                            location.latitude,

                                        longitude:
                                            location.longitude,

                                        district:
                                            districtName,

                                        state:
                                            stateName,

                                        risk,

                                        prediction,

                                        features

                                    };


                                } catch (error) {

                                    console.error(
                                        `Grid ${location.gridId} failed:`,
                                        error.message
                                    );


                                    return {

                                        gridId:
                                            location.gridId,

                                        latitude:
                                            location.latitude,

                                        longitude:
                                            location.longitude,

                                        district:
                                            null,

                                        state:
                                            "Maharashtra",

                                        risk:
                                            null,

                                        prediction:
                                            null,

                                        features:
                                            null,

                                        error:
                                            error.message

                                    };

                                }

                            }
                        )

                    );


                results.push(
                    ...batchResults
                );


                console.log(
                    `Maharashtra grid progress: ${Math.min(
                        i + BATCH_SIZE,
                        grid.length
                    )}/${grid.length}`
                );

            }


            // ------------------------------------------------
            // RISK COUNTS
            // ------------------------------------------------

            const riskCounts = {

                severe:
                    results.filter(
                        x => x.risk === "SEVERE"
                    ).length,

                high:
                    results.filter(
                        x => x.risk === "HIGH"
                    ).length,

                medium:
                    results.filter(
                        x => x.risk === "MEDIUM"
                    ).length,

                low:
                    results.filter(
                        x => x.risk === "LOW"
                    ).length,

                failed:
                    results.filter(
                        x => x.risk === null
                    ).length

            };


            // ------------------------------------------------
            // RESPONSE
            // ------------------------------------------------

            res.json({

                success: true,

                country:
                    "India",

                state:
                    "Maharashtra",

                source:
                    "maharashtra_prediction_grid.csv + Open-Meteo GFS + XGBoost",

                totalLocations:
                    results.length,

                successfulLocations:
                    results.filter(
                        x =>
                            x.prediction !== null
                    ).length,

                failedLocations:
                    results.filter(
                        x =>
                            x.prediction === null
                    ).length,

                processingTimeMs:
                    Date.now() -
                    startTime,

                riskCounts,

                // IMPORTANT:
                // Frontend can extract this directly.
                locations:
                    results,

                // Backward compatibility
                districts:
                    results

            });


        } catch (error) {

            console.error(
                "Maharashtra grid endpoint error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Maharashtra grid ML prediction failed",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// GET CSV GRID LOCATIONS ONLY
// ============================================================
//
// GET:
//
// /api/ml/maharashtra/grid/locations
//
// Useful for testing CSV.
//
// ============================================================

router.get(
    "/maharashtra/grid/locations",
    (req, res) => {

        try {

            const grid =
                getMaharashtraGrid();


            res.json({

                success: true,

                state:
                    "Maharashtra",

                source:
                    "maharashtra_prediction_grid.csv",

                totalLocations:
                    grid.length,

                locations:
                    grid

            });


        } catch (error) {

            console.error(
                "Grid location error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Unable to load Maharashtra prediction grid",

                error:
                    error.message,

                csvPath:
                    GRID_CSV_PATH

            });

        }

    }
);


// ============================================================
// INDIA SINGLE DISTRICT ML
// ============================================================

router.get(
    "/india/district/:district",
    async (req, res) => {

        try {

            const districtName =
                normalizeDistrictName(
                    decodeURIComponent(
                        req.params.district
                    )
                );


            const districts =
                await getIndiaDistricts();


            const district =
                districts.find(
                    item =>
                        normalizeDistrictName(
                            item.district
                        ) === districtName
                );


            if (!district) {

                return res.status(404).json({

                    success: false,

                    message:
                        "India district not found",

                    district:
                        req.params.district

                });

            }


            console.log(
                `Processing ${district.state} / ${district.district}`
            );


            const weather =
                await getLiveAtmosphericData(
                    district.latitude,
                    district.longitude
                );


            const features =
                buildMLFeatures(
                    weather,
                    {

                        district:
                            district.district,

                        latitude:
                            district.latitude,

                        longitude:
                            district.longitude

                    }
                );


            const prediction =
                await predictWeather(
                    features
                );


            res.json({

                success: true,

                source:
                    "Open-Meteo GFS + XGBoost",

                country:
                    "India",

                state:
                    district.state,

                district:
                    district.district,

                latitude:
                    district.latitude,

                longitude:
                    district.longitude,

                prediction,

                risk:
                    getRiskFromPrediction(
                        prediction
                    ),

                features

            });


        } catch (error) {

            console.error(
                "India district ML error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "India district ML prediction failed",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// ALL INDIA DISTRICT ML
// ============================================================
//
// This remains district-based.
// It is separate from Maharashtra CSV grid.
//
// ============================================================

router.get(
    "/india/districts",
    async (req, res) => {

        const startTime =
            Date.now();


        try {

            const districts =
                await getIndiaDistricts();


            const results = [];


            const BATCH_SIZE = 5;


            for (
                let i = 0;
                i < districts.length;
                i += BATCH_SIZE
            ) {

                const batch =
                    districts.slice(
                        i,
                        i + BATCH_SIZE
                    );


                const batchResults =
                    await Promise.all(

                        batch.map(
                            async (district) => {

                                try {

                                    console.log(
                                        `India: ${district.state} / ${district.district}`
                                    );


                                    const weather =
                                        await getLiveAtmosphericData(
                                            district.latitude,
                                            district.longitude
                                        );


                                    const features =
                                        buildMLFeatures(
                                            weather,
                                            {

                                                district:
                                                    district.district,

                                                latitude:
                                                    district.latitude,

                                                longitude:
                                                    district.longitude

                                            }
                                        );


                                    const prediction =
                                        await predictWeather(
                                            features
                                        );


                                    return {

                                        district:
                                            district.district,

                                        state:
                                            district.state,

                                        districtCode:
                                            district.districtCode,

                                        stateCode:
                                            district.stateCode,

                                        latitude:
                                            district.latitude,

                                        longitude:
                                            district.longitude,

                                        prediction,

                                        risk:
                                            getRiskFromPrediction(
                                                prediction
                                            ),

                                        features

                                    };


                                } catch (error) {

                                    console.error(
                                        `India ${district.district} failed:`,
                                        error.message
                                    );


                                    return {

                                        district:
                                            district.district,

                                        state:
                                            district.state,

                                        districtCode:
                                            district.districtCode,

                                        stateCode:
                                            district.stateCode,

                                        latitude:
                                            district.latitude,

                                        longitude:
                                            district.longitude,

                                        prediction:
                                            null,

                                        risk:
                                            null,

                                        features:
                                            null,

                                        error:
                                            error.message

                                    };

                                }

                            }
                        )

                    );


                results.push(
                    ...batchResults
                );


                console.log(
                    `India progress: ${Math.min(
                        i + BATCH_SIZE,
                        districts.length
                    )}/${districts.length}`
                );

            }


            const successfulDistricts =
                results.filter(
                    item =>
                        item.prediction !== null
                ).length;


            const failedDistricts =
                results.filter(
                    item =>
                        item.prediction === null
                ).length;


            res.json({

                success: true,

                country:
                    "India",

                source:
                    "Open-Meteo GFS + XGBoost",

                totalDistricts:
                    results.length,

                successfulDistricts,

                failedDistricts,

                processingTimeMs:
                    Date.now() -
                    startTime,

                districts:
                    results

            });


        } catch (error) {

            console.error(
                "India ML Error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "India ML prediction failed",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;