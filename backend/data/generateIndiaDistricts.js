const fs = require("fs");
const path = require("path");
const axios = require("axios");

// ============================================================
// CONFIG
// ============================================================

const GEOJSON_URL =
    "https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson";

const OUTPUT_DIR = path.join(
    __dirname,
    "../data"
);

const OUTPUT_FILE = path.join(
    OUTPUT_DIR,
    "indiaDistricts.js"
);

// ============================================================
// GET ALL COORDINATES FROM GEOMETRY
// ============================================================

function extractCoordinates(geometry) {

    const coordinates = [];

    function walk(value) {

        if (!Array.isArray(value)) {
            return;
        }

        if (
            value.length >= 2 &&
            typeof value[0] === "number" &&
            typeof value[1] === "number"
        ) {
            coordinates.push([
                value[0],
                value[1]
            ]);

            return;
        }

        value.forEach(walk);
    }

    walk(geometry.coordinates);

    return coordinates;
}

// ============================================================
// CENTROID
// ============================================================

function calculateCentroid(feature) {

    const coordinates =
        extractCoordinates(
            feature.geometry
        );

    if (!coordinates.length) {
        return {
            lat: null,
            lon: null
        };
    }

    let totalLon = 0;
    let totalLat = 0;

    coordinates.forEach(
        ([lon, lat]) => {
            totalLon += lon;
            totalLat += lat;
        }
    );

    return {
        lat:
            totalLat /
            coordinates.length,

        lon:
            totalLon /
            coordinates.length
    };
}

// ============================================================
// NORMALIZE NAME
// ============================================================

function normalizeName(name) {

    if (!name) {
        return "";
    }

    return String(name)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");
}

// ============================================================
// DOWNLOAD GEOJSON
// ============================================================

async function downloadGeoJSON() {

    console.log(
        "Downloading India district GeoJSON..."
    );

    const response =
        await axios.get(
            GEOJSON_URL,
            {
                timeout: 60000
            }
        );

    return response.data;
}

// ============================================================
// GET ELEVATION
// ============================================================

async function getElevations(
    districts
) {

    console.log(
        `Getting elevation for ${districts.length} districts...`
    );

    const batchSize = 100;

    for (
        let i = 0;
        i < districts.length;
        i += batchSize
    ) {

        const batch =
            districts.slice(
                i,
                i + batchSize
            );

        const latitudes =
            batch
                .map(
                    item =>
                        item.lat
                )
                .join(",");

        const longitudes =
            batch
                .map(
                    item =>
                        item.lon
                )
                .join(",");

        try {

            const url =
                `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`;

            const response =
                await axios.get(
                    url,
                    {
                        timeout: 60000
                    }
                );

            const elevations =
                response.data.elevation ||
                [];

            batch.forEach(
                (district, index) => {

                    district.altitude =
                        Number(
                            elevations[index]
                        ) || 0;

                }
            );

            console.log(
                `Elevation: ${Math.min(
                    i + batchSize,
                    districts.length
                )}/${districts.length}`
            );

        } catch (error) {

            console.error(
                "Elevation API error:",
                error.message
            );

            batch.forEach(
                district => {
                    district.altitude = 0;
                }
            );
        }

        // Small delay
        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    300
                )
        );
    }

    return districts;
}

// ============================================================
// MAIN
// ============================================================

async function main() {

    try {

        const geojson =
            await downloadGeoJSON();

        const features =
            geojson.features || [];

        console.log(
            `District polygons found: ${features.length}`
        );

        const districts = [];

        features.forEach(
            (feature, index) => {

                const properties =
                    feature.properties || {};

                const district =
                    normalizeName(
                        properties.NAME_2 ||
                        properties.district ||
                        properties.DISTRICT ||
                        properties.dtname
                    );

                const state =
                    normalizeName(
                        properties.NAME_1 ||
                        properties.state ||
                        properties.STATE
                    );

                if (!district) {
                    return;
                }

                const {
                    lat,
                    lon
                } =
                    calculateCentroid(
                        feature
                    );

                if (
                    lat === null ||
                    lon === null
                ) {
                    return;
                }

                districts.push({

                    id:
                        `${state}_${district}`
                            .replace(
                                /[^A-Z0-9_]/g,
                                "_"
                            ),

                    district,

                    state,

                    lat:
                        Number(
                            lat.toFixed(6)
                        ),

                    lon:
                        Number(
                            lon.toFixed(6)
                        ),

                    altitude: 0
                });
            }
        );

        console.log(
            `Valid districts: ${districts.length}`
        );

        // Remove duplicate district/state
        const uniqueMap =
            new Map();

        districts.forEach(
            district => {

                const key =
                    `${district.state}_${district.district}`;

                if (
                    !uniqueMap.has(key)
                ) {
                    uniqueMap.set(
                        key,
                        district
                    );
                }
            }
        );

        let uniqueDistricts =
            Array.from(
                uniqueMap.values()
            );

        console.log(
            `Unique districts: ${uniqueDistricts.length}`
        );

        // ====================================================
        // ELEVATION
        // ====================================================

        uniqueDistricts =
            await getElevations(
                uniqueDistricts
            );

        // ====================================================
        // SORT
        // ====================================================

        uniqueDistricts.sort(
            (a, b) => {

                if (
                    a.state ===
                    b.state
                ) {
                    return a.district.localeCompare(
                        b.district
                    );
                }

                return a.state.localeCompare(
                    b.state
                );
            }
        );

        // ====================================================
        // SAVE JS
        // ====================================================

        fs.mkdirSync(
            OUTPUT_DIR,
            {
                recursive: true
            }
        );

        const output =
`// ============================================================
// AUTO GENERATED INDIA DISTRICTS
// Generated from India district GeoJSON + Open-Meteo elevation
// ============================================================

const indiaDistricts = ${JSON.stringify(
    uniqueDistricts,
    null,
    4
)};

module.exports = indiaDistricts;
`;

        fs.writeFileSync(
            OUTPUT_FILE,
            output,
            "utf8"
        );

        console.log(
            "=========================================="
        );

        console.log(
            "India district data generated successfully"
        );

        console.log(
            `File: ${OUTPUT_FILE}`
        );

        console.log(
            `Districts: ${uniqueDistricts.length}`
        );

        console.log(
            "=========================================="
        );

    } catch (error) {

        console.error(
            "Generation failed:",
            error
        );

        process.exit(1);
    }
}

main();