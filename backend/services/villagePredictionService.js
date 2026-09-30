const {
    getAllVillageLocations
} = require("./villageLocationService");

const {
    getBatchVillageWeather
} = require("./liveWeatherService");

const {
    buildMLFeatures
} = require("./mlFeatureBuilder");

const {
    predictWeatherBatch
} = require("./weatherPrediction");


// ============================================================
// CONFIG
// ============================================================

const LOCATION_BATCH_SIZE =
    Number(
        process.env.VILLAGE_BATCH_SIZE || 500
    );

const ML_CONCURRENCY =
    Number(
        process.env.ML_CONCURRENCY || 8
    );


// ============================================================
// RISK NORMALIZATION
// ============================================================

function normalizeRisk(
    prediction
) {

    const risk =
        prediction
            ?.overall
            ?.risk ||
        prediction
            ?.risk ||
        "LOW";


    return String(
        risk
    ).toUpperCase();

}


// ============================================================
// PROCESS BATCH
// ============================================================

async function processVillageBatch(
    locations
) {

    // --------------------------------------------------------
    // WEATHER
    // --------------------------------------------------------

    const weatherMap =
        await getBatchVillageWeather(
            locations
        );


    // --------------------------------------------------------
    // BUILD FEATURES
    // --------------------------------------------------------

    const mlItems = [];


    for (
        const location
        of locations
    ) {

        const weather =
            weatherMap.get(
                location.id
            );


        if (!weather) {

            continue;

        }


        try {

            const features =
                buildMLFeatures(
                    weather
                );


            mlItems.push({

                location,

                features

            });

        } catch (error) {

            console.error(

                `Feature error ${location.locationName}:`,

                error.message

            );

        }

    }


    // --------------------------------------------------------
    // ML
    // --------------------------------------------------------

    const predictions =
        await predictWeatherBatch(

            mlItems,

            {
                concurrency:
                    ML_CONCURRENCY
            }

        );


    // --------------------------------------------------------
    // FINAL RESULTS
    // --------------------------------------------------------

    return predictions.map(
        item => {

            const prediction =
                item.prediction;


            const riskLevel =
                item.success
                    ? normalizeRisk(
                        prediction
                    )
                    : "UNKNOWN";


            return {

                id:
                    item.location.id,

                locationName:
                    item.location.locationName,

                village:
                    item.location.village,

                taluka:
                    item.location.taluka,

                district:
                    item.location.district,

                latitude:
                    item.location.latitude,

                longitude:
                    item.location.longitude,

                prediction,

                riskLevel,

                error:
                    item.error || null

            };

        }
    );

}


// ============================================================
// ALL MAHARASHTRA
// ============================================================

async function predictAllVillages() {

    const startTime =
        Date.now();


    const locations =
        await getAllVillageLocations();


    const allResults = [];


    for (
        let i = 0;
        i < locations.length;
        i += LOCATION_BATCH_SIZE
    ) {

        const batch =
            locations.slice(
                i,
                i +
                LOCATION_BATCH_SIZE
            );


        console.log(

            `Village prediction batch ${
                Math.floor(
                    i /
                    LOCATION_BATCH_SIZE
                ) + 1
            } / ${
                Math.ceil(
                    locations.length /
                    LOCATION_BATCH_SIZE
                )
            }`

        );


        const results =
            await processVillageBatch(
                batch
            );


        allResults.push(
            ...results
        );

    }


    // --------------------------------------------------------
    // RISK SUMMARY
    // --------------------------------------------------------

    const riskSummary = {

        severe: 0,

        high: 0,

        medium: 0,

        low: 0,

        unknown: 0

    };


    for (
        const result
        of allResults
    ) {

        const risk =
            result.riskLevel
                .toLowerCase();


        if (
            riskSummary[risk] !== undefined
        ) {

            riskSummary[risk]++;

        } else {

            riskSummary.unknown++;

        }

    }


    return {

        success: true,

        source:
            "Open-Meteo GFS + XGBoost",

        state:
            "Maharashtra",

        coverage:
            "Village",

        totalLocations:
            locations.length,

        successfulLocations:
            allResults.filter(
                item =>
                    item.prediction !== null
            ).length,

        failedLocations:
            allResults.filter(
                item =>
                    item.prediction === null
            ).length,

        generatedAt:
            new Date().toISOString(),

        processingTimeMs:
            Date.now() -
            startTime,

        riskSummary,

        locations:
            allResults

    };

}


module.exports = {

    predictAllVillages,

    processVillageBatch

};