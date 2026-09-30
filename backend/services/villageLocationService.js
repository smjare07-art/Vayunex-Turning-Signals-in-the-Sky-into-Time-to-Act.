const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIG
// ============================================================

const CACHE_DIR = path.join(__dirname, "..", "cache");

const CACHE_FILE =
    path.join(
        CACHE_DIR,
        "villageLocations.json"
    );

const CACHE_TTL =
    24 * 60 * 60 * 1000;

// DataMeet GeoJSON source.
// The Maharashtra dataset is split into mh1 and mh2.
const DATA_URLS = [
    process.env.MH_VILLAGE_GEOJSON_1 ||
        "https://projects.datameet.org/indian_village_boundaries/maps/mh1.geojson",

    process.env.MH_VILLAGE_GEOJSON_2 ||
        "https://projects.datameet.org/indian_village_boundaries/maps/mh2.geojson"
];

// ============================================================
// MEMORY CACHE
// ============================================================

let locationsCache = null;

let cacheTimestamp = 0;

let loadingPromise = null;


// ============================================================
// ENSURE CACHE DIRECTORY
// ============================================================

function ensureCacheDirectory() {

    if (!fs.existsSync(CACHE_DIR)) {

        fs.mkdirSync(
            CACHE_DIR,
            {
                recursive: true
            }
        );

    }

}


// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }

    return String(value)
        .trim()
        .toUpperCase();

}


// ============================================================
// CREATE ID
// ============================================================

function createLocationId(
    village,
    district,
    index
) {

    const cleanVillage =
        normalizeText(village)
            .replace(/[^A-Z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

    const cleanDistrict =
        normalizeText(district)
            .replace(/[^A-Z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

    return (
        `village-${cleanDistrict}-${cleanVillage}-${index}`
    );

}


// ============================================================
// GEOMETRY CENTROID
// ============================================================

function calculateCentroid(
    geometry
) {

    if (!geometry) {

        return null;

    }

    let coordinates = [];

    // --------------------------------------------------------
    // Polygon
    // --------------------------------------------------------

    if (
        geometry.type === "Polygon"
    ) {

        coordinates =
            geometry.coordinates?.[0] || [];

    }

    // --------------------------------------------------------
    // MultiPolygon
    // --------------------------------------------------------

    else if (
        geometry.type === "MultiPolygon"
    ) {

        const polygons =
            geometry.coordinates || [];

        let largest = [];

        for (
            const polygon
            of polygons
        ) {

            const ring =
                polygon?.[0] || [];

            if (
                ring.length >
                largest.length
            ) {

                largest = ring;

            }

        }

        coordinates = largest;

    }

    // --------------------------------------------------------
    // Point
    // --------------------------------------------------------

    else if (
        geometry.type === "Point"
    ) {

        const [
            lon,
            lat
        ] = geometry.coordinates || [];

        if (
            Number.isFinite(lat) &&
            Number.isFinite(lon)
        ) {

            return {
                latitude: lat,
                longitude: lon
            };

        }

        return null;

    }

    if (
        !coordinates ||
        coordinates.length === 0
    ) {

        return null;

    }

    let sumLat = 0;

    let sumLon = 0;

    let count = 0;

    for (
        const point
        of coordinates
    ) {

        if (
            !Array.isArray(point) ||
            point.length < 2
        ) {

            continue;

        }

        const lon =
            Number(point[0]);

        const lat =
            Number(point[1]);

        if (
            Number.isFinite(lat) &&
            Number.isFinite(lon)
        ) {

            sumLat += lat;

            sumLon += lon;

            count++;

        }

    }

    if (count === 0) {

        return null;

    }

    return {

        latitude:
            sumLat / count,

        longitude:
            sumLon / count

    };

}


// ============================================================
// FIND PROPERTY
// ============================================================

function getProperty(
    properties,
    names
) {

    if (!properties) {

        return "";

    }

    for (
        const name
        of names
    ) {

        if (
            properties[name] !== undefined &&
            properties[name] !== null &&
            String(properties[name]).trim() !== ""
        ) {

            return properties[name];

        }

    }

    // Case-insensitive fallback

    const keys =
        Object.keys(properties);

    for (
        const key
        of keys
    ) {

        const normalizedKey =
            key.toLowerCase();

        for (
            const name
            of names
        ) {

            if (
                normalizedKey ===
                name.toLowerCase()
            ) {

                return properties[key];

            }

        }

    }

    return "";

}


// ============================================================
// CONVERT GEOJSON FEATURE
// ============================================================

function featureToLocation(
    feature,
    index
) {

    const properties =
        feature.properties || {};

    const village =
        getProperty(
            properties,
            [
                "NAME",
                "name",
                "VILLAGE",
                "Village",
                "village",
                "vill_name",
                "VILL_NAME"
            ]
        );

    const district =
        getProperty(
            properties,
            [
                "DISTRICT",
                "district",
                "District",
                "district_name",
                "DIST_NAME"
            ]
        );

    const taluka =
        getProperty(
            properties,
            [
                "SUBDISTRICT",
                "subdistrict",
                "Subdistrict",
                "TALUKA",
                "taluka",
                "tehsil",
                "TEHSIL"
            ]
        );

    const centroid =
        calculateCentroid(
            feature.geometry
        );

    if (!centroid) {

        return null;

    }

    if (
        !Number.isFinite(
            centroid.latitude
        ) ||
        !Number.isFinite(
            centroid.longitude
        )
    ) {

        return null;

    }

    // Maharashtra approximate bounds

    if (
        centroid.latitude < 15 ||
        centroid.latitude > 23
    ) {

        return null;

    }

    if (
        centroid.longitude < 70 ||
        centroid.longitude > 82
    ) {

        return null;

    }

    return {

        id:
            createLocationId(
                village ||
                    `VILLAGE-${index}`,

                district ||
                    "MAHARASHTRA",

                index
            ),

        locationName:
            String(
                village ||
                `Village ${index}`
            ).trim(),

        village:
            String(
                village ||
                `Village ${index}`
            ).trim(),

        taluka:
            String(
                taluka ||
                ""
            ).trim(),

        district:
            String(
                district ||
                ""
            ).trim(),

        state:
            "MAHARASHTRA",

        latitude:
            Number(
                centroid.latitude.toFixed(6)
            ),

        longitude:
            Number(
                centroid.longitude.toFixed(6)
            )

    };

}


// ============================================================
// DOWNLOAD GEOJSON
// ============================================================

async function downloadGeoJSON(
    url
) {

    console.log(
        `Downloading village dataset:\n${url}`
    );

    const response =
        await axios.get(
            url,
            {
                timeout: 60000,

                maxContentLength:
                    100 * 1024 * 1024,

                maxBodyLength:
                    100 * 1024 * 1024,

                headers: {
                    "User-Agent":
                        "VEEYOM/1.0"
                }
            }
        );

    if (
        !response.data
    ) {

        throw new Error(
            "Empty GeoJSON response"
        );

    }

    return response.data;

}


// ============================================================
// LOAD FROM EXTERNAL SOURCE
// ============================================================

async function loadVillageLocations() {

    if (loadingPromise) {

        return loadingPromise;

    }

    loadingPromise =
        (async () => {

            try {

                ensureCacheDirectory();

                // ==================================================
                // MEMORY CACHE
                // ==================================================

                if (
                    locationsCache &&
                    Date.now() -
                    cacheTimestamp <
                    CACHE_TTL
                ) {

                    console.log(
                        `✓ Village memory cache: ${locationsCache.length}`
                    );

                    return locationsCache;

                }


                // ==================================================
                // FILE CACHE
                // ==================================================

                if (
                    fs.existsSync(
                        CACHE_FILE
                    )
                ) {

                    try {

                        const stat =
                            fs.statSync(
                                CACHE_FILE
                            );

                        const age =
                            Date.now() -
                            stat.mtimeMs;

                        if (
                            age <
                            CACHE_TTL
                        ) {

                            const raw =
                                fs.readFileSync(
                                    CACHE_FILE,
                                    "utf8"
                                );

                            const parsed =
                                JSON.parse(raw);

                            if (
                                Array.isArray(
                                    parsed
                                ) &&
                                parsed.length > 0
                            ) {

                                locationsCache =
                                    parsed;

                                cacheTimestamp =
                                    Date.now();

                                console.log(
                                    `✓ Loaded ${parsed.length} villages from cache`
                                );

                                return parsed;

                            }

                        }

                    } catch (error) {

                        console.warn(
                            "Village cache read failed:",
                            error.message
                        );

                    }

                }


                // ==================================================
                // DOWNLOAD
                // ==================================================

                const allLocations = [];

                let globalIndex = 0;


                for (
                    const url
                    of DATA_URLS
                ) {

                    const geojson =
                        await downloadGeoJSON(
                            url
                        );

                    const features =
                        geojson.features ||
                        [];

                    console.log(
                        `Features received: ${features.length}`
                    );


                    for (
                        const feature
                        of features
                    ) {

                        const location =
                            featureToLocation(
                                feature,
                                globalIndex
                            );

                        globalIndex++;

                        if (
                            location
                        ) {

                            allLocations.push(
                                location
                            );

                        }

                    }

                }


                // ==================================================
                // REMOVE DUPLICATES
                // ==================================================

                const unique =
                    new Map();


                for (
                    const location
                    of allLocations
                ) {

                    const key =
                        [
                            location.locationName,
                            location.district,
                            location.taluka,
                            location.latitude,
                            location.longitude
                        ]
                            .map(normalizeText)
                            .join("|");


                    if (
                        !unique.has(key)
                    ) {

                        unique.set(
                            key,
                            location
                        );

                    }

                }


                const locations =
                    Array.from(
                        unique.values()
                    );


                // ==================================================
                // SAVE CACHE
                // ==================================================

                fs.writeFileSync(

                    CACHE_FILE,

                    JSON.stringify(
                        locations
                    ),

                    "utf8"

                );


                locationsCache =
                    locations;

                cacheTimestamp =
                    Date.now();


                console.log(
                    "======================================"
                );

                console.log(
                    `✓ Village locations loaded: ${locations.length}`
                );

                console.log(
                    `✓ Cache: ${CACHE_FILE}`
                );

                console.log(
                    "======================================"
                );


                return locations;

            } finally {

                loadingPromise = null;

            }

        })();


    return loadingPromise;

}


// ============================================================
// GET ALL
// ============================================================

async function getAllVillageLocations() {

    return loadVillageLocations();

}


// ============================================================
// GET PAGINATED
// ============================================================

async function getVillageLocations({
    page = 1,
    limit = 500,
    district = null,
    taluka = null
} = {}) {

    const locations =
        await loadVillageLocations();

    let filtered =
        locations;


    if (district) {

        const target =
            normalizeText(
                district
            );

        filtered =
            filtered.filter(
                item =>
                    normalizeText(
                        item.district
                    ) === target
            );

    }


    if (taluka) {

        const target =
            normalizeText(
                taluka
            );

        filtered =
            filtered.filter(
                item =>
                    normalizeText(
                        item.taluka
                    ) === target
            );

    }


    const safePage =
        Math.max(
            1,
            Number(page) || 1
        );

    const safeLimit =
        Math.min(
            2000,
            Math.max(
                1,
                Number(limit) || 500
            )
        );

    const start =
        (
            safePage - 1
        ) * safeLimit;

    const end =
        start + safeLimit;


    return {

        total:
            filtered.length,

        page:
            safePage,

        limit:
            safeLimit,

        totalPages:
            Math.ceil(
                filtered.length /
                safeLimit
            ),

        locations:
            filtered.slice(
                start,
                end
            )

    };

}


// ============================================================
// CLEAR CACHE
// ============================================================

function clearVillageCache() {

    locationsCache = null;

    cacheTimestamp = 0;


    if (
        fs.existsSync(
            CACHE_FILE
        )
    ) {

        fs.unlinkSync(
            CACHE_FILE
        );

    }

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    getAllVillageLocations,

    getVillageLocations,

    clearVillageCache

};