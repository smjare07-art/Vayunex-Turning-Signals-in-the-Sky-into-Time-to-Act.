const express = require("express");

const router = express.Router();

// ============================================================
// SERVICES
// ============================================================

const {
    getDistrictNowcast
} = require("../services/imdService");

const {
    processWeatherData
} = require("../services/riskService");

const {
    getWeatherData
} = require("../services/openMeteoService");


// ============================================================
// INDIA DISTRICTS
// ============================================================

const indiaDistricts =
    require("../data/indiaDistricts");


// ============================================================
// MAHARASHTRA DISTRICT NAMES
// ============================================================

const MAHARASHTRA_DISTRICTS = [

    "MUMBAI",
    "MUMBAI SUBURBAN",

    "PUNE",
    "BEED",

    "AMRAVATI",
    "NAGPUR",
    "NASHIK",
    "THANE",
    "RAIGAD",
    "RATNAGIRI",
    "SINDHUDURG",
    "KOLHAPUR",
    "SATARA",
    "SANGLI",
    "SOLAPUR",

    "DHULE",
    "NANDURBAR",
    "JALGAON",

    "AHMEDNAGAR",
    "CHHATRAPATI SAMBHAJINAGAR",

    "JALNA",
    "PARBHANI",
    "HINGOLI",
    "NANDED",
    "LATUR",
    "OSMANABAD",

    "WASHIM",
    "BULDHANA",
    "AKOLA",
    "WARDHA",
    "BHANDARA",
    "GONDIA",
    "CHANDRAPUR",
    "GADCHIROLI"

];


// ============================================================
// NORMALIZE INDIA DISTRICTS
// ============================================================

function getIndiaDistrictList() {

    if (Array.isArray(indiaDistricts)) {
        return indiaDistricts;
    }

    if (
        indiaDistricts &&
        typeof indiaDistricts === "object"
    ) {
        return Object.values(indiaDistricts);
    }

    return [];
}


// ============================================================
// GET MAHARASHTRA DISTRICTS WITH COORDINATES
// ============================================================

function getMaharashtraDistricts() {

    const districts =
        getIndiaDistrictList();

    const result = [];

    for (const district of districts) {

        if (!district || typeof district !== "object") {
            continue;
        }

        const name = String(
            district.district ||
            district.name ||
            district.District ||
            district.DISTRICT ||
            ""
        )
            .trim()
            .toUpperCase();


        if (!MAHARASHTRA_DISTRICTS.includes(name)) {
            continue;
        }


        const lat = Number(
            district.lat ??
            district.latitude ??
            district.Latitude
        );


        const lon = Number(
            district.lon ??
            district.longitude ??
            district.Longitude
        );


        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
        ) {
            continue;
        }


        result.push({

            district:
                district.district ||
                district.name ||
                district.District ||
                district.DISTRICT,

            lat,
            lon

        });

    }


    return result;
}


// ============================================================
// IMD NOWCAST
// ============================================================

router.get("/nowcast", async (req, res) => {

    try {

        const data =
            await getDistrictNowcast();


        res.json({

            success: true,

            source: "IMD",

            data

        });

    } catch (error) {

        console.error(
            "IMD Nowcast Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "IMD data fetch failed",

            error:
                error.response?.data ||
                error.message

        });

    }

});


// ============================================================
// MAHARASHTRA WEATHER - OPEN METEO
// ============================================================

router.get(
    "/maharashtra-weather",
    async (req, res) => {

        try {

            const districts =
                getMaharashtraDistricts();


            if (districts.length === 0) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Maharashtra districts with valid coordinates were not found in indiaDistricts.js",

                    availableDistricts:
                        getIndiaDistrictList().length

                });

            }


            const results = [];


            for (
                const district of districts
            ) {

                try {

                    const weather =
                        await getWeatherData(
                            district.lat,
                            district.lon
                        );


                    results.push({

                        district:
                            district.district,

                        latitude:
                            district.lat,

                        longitude:
                            district.lon,

                        current:
                            weather?.current ||
                            null

                    });

                } catch (districtError) {

                    console.error(
                        `Weather failed for ${district.district}:`,
                        districtError.message
                    );


                    results.push({

                        district:
                            district.district,

                        latitude:
                            district.lat,

                        longitude:
                            district.lon,

                        current: null,

                        error:
                            districtError.message

                    });

                }

            }


            res.json({

                success: true,

                state: "Maharashtra",

                totalDistricts:
                    results.length,

                data: results

            });


        } catch (error) {

            console.error(
                "Maharashtra Weather Error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Weather data fetch failed",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// MAHARASHTRA IMD WEATHER
// ============================================================

router.get(
    "/maharashtra",
    async (req, res) => {

        try {

            const response =
                await getDistrictNowcast();


            const allData =
                Array.isArray(response)
                    ? response
                    : response?.data || [];


            const maharashtraData =
                allData.filter(item => {

                    const district =
                        String(
                            item.State_District || ""
                        )
                            .trim()
                            .toUpperCase();


                    return MAHARASHTRA_DISTRICTS.includes(
                        district
                    );

                });


            const processedData =
                processWeatherData(
                    maharashtraData
                );


            res.json({

                success: true,

                state: "Maharashtra",

                totalDistricts:
                    processedData.length,

                data:
                    processedData

            });


        } catch (error) {

            console.error(
                "Maharashtra Weather Processing Error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Maharashtra weather processing failed",

                error:
                    error.response?.data ||
                    error.message

            });

        }

    }
);


// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;