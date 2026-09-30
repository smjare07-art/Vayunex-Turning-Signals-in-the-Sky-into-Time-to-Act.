const express =
    require("express");

const router =
    express.Router();

const {
    predictAllVillages
} = require(
    "../services/villagePredictionService"
);


// ============================================================
// CACHE
// ============================================================

const CACHE_TTL =
    5 * 60 * 1000;


let predictionCache =
    null;


let predictionTimestamp =
    0;


let refreshPromise =
    null;


// ============================================================
// REFRESH
// ============================================================

async function refreshVillagePredictions() {

    if (
        refreshPromise
    ) {

        return refreshPromise;

    }


    refreshPromise =
        (async () => {

            try {

                console.log(
                    "======================================"
                );

                console.log(
                    "Starting Maharashtra village prediction"
                );

                console.log(
                    "======================================"
                );


                const result =
                    await predictAllVillages();


                predictionCache =
                    result;


                predictionTimestamp =
                    Date.now();


                console.log(
                    "======================================"
                );

                console.log(
                    "Village prediction completed"
                );

                console.log(
                    "Locations:",
                    result.totalLocations
                );

                console.log(
                    "Successful:",
                    result.successfulLocations
                );

                console.log(
                    "Failed:",
                    result.failedLocations
                );

                console.log(
                    "Time:",
                    result.processingTimeMs,
                    "ms"
                );

                console.log(
                    "======================================"
                );


                return result;

            } finally {

                refreshPromise =
                    null;

            }

        })();


    return refreshPromise;

}


// ============================================================
// ALL VILLAGE PREDICTIONS
// ============================================================

router.get(
    "/maharashtra",
    async (req, res) => {

        try {

            const now =
                Date.now();


            if (

                predictionCache &&

                now -
                predictionTimestamp <
                CACHE_TTL

            ) {

                return res.json({

                    ...predictionCache,

                    cached: true,

                    cacheAgeMs:
                        now -
                        predictionTimestamp

                });

            }


            const result =
                await refreshVillagePredictions();


            return res.json({

                ...result,

                cached: false,

                cacheAgeMs: 0

            });


        } catch (error) {

            console.error(
                "Village prediction error:",
                error.message
            );


            if (
                predictionCache
            ) {

                return res.json({

                    ...predictionCache,

                    cached: true,

                    stale: true,

                    warning:
                        "Live prediction failed. Showing previous cache."

                });

            }


            return res.status(500).json({

                success: false,

                message:
                    "Village prediction failed",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// MANUAL REFRESH
// ============================================================

router.post(
    "/maharashtra/refresh",
    async (req, res) => {

        try {

            const result =
                await refreshVillagePredictions();


            return res.json({

                ...result,

                refreshed: true

            });

        } catch (error) {

            return res.status(500).json({

                success: false,

                message:
                    "Village prediction refresh failed",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// CACHE STATUS
// ============================================================

router.get(
    "/maharashtra/cache-status",
    (req, res) => {

        const now =
            Date.now();


        const age =
            predictionCache
                ? now -
                  predictionTimestamp
                : null;


        res.json({

            success: true,

            cacheExists:
                !!predictionCache,

            cacheValid:
                !!(
                    predictionCache &&
                    age <
                    CACHE_TTL
                ),

            cacheAgeMs:
                age,

            totalLocations:
                predictionCache
                    ?.totalLocations ||
                0,

            successfulLocations:
                predictionCache
                    ?.successfulLocations ||
                0,

            failedLocations:
                predictionCache
                    ?.failedLocations ||
                0,

            lastUpdated:
                predictionCache
                    ?.generatedAt ||
                null

        });

    }
);


module.exports = router;