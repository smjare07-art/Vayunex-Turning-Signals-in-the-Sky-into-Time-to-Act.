const axios = require("axios");

// ============================================================
// FASTAPI ML CONFIG
// ============================================================

const ML_API_URL =
    process.env.ML_API_URL ||
    "http://127.0.0.1:8000";


// ============================================================
// AXIOS CLIENT
// ============================================================

const mlClient = axios.create({

    baseURL: ML_API_URL,

    timeout: 10000,

    headers: {
        "Content-Type": "application/json"
    }

});


// ============================================================
// SINGLE WEATHER PREDICTION
// ============================================================

async function predictWeather(features) {

    const startTime = Date.now();

    try {

        const response =
            await mlClient.post(
                "/predict",
                features
            );


        const elapsed =
            Date.now() - startTime;


        console.log(
            `✓ FastAPI prediction completed in ${elapsed} ms`
        );


        return response.data;


    } catch (error) {

        console.error(
            "FASTAPI ML ERROR:",
            error.response?.data ||
            error.message
        );


        throw new Error(

            error.response?.data?.detail ||

            error.response?.data?.error ||

            error.message ||

            "FastAPI ML service unavailable"

        );

    }

}


// ============================================================
// BATCH PREDICTION
// ============================================================
// This function is ready for future /predict-batch support.
// It does NOT call it unless your FastAPI endpoint exists.
// ============================================================

async function predictWeatherBatch(
    locations = [],
    concurrency = 5
) {

    if (
        !Array.isArray(locations) ||
        locations.length === 0
    ) {

        return [];

    }


    console.log(
        `Starting FastAPI batch prediction for ${locations.length} locations`
    );


    const startTime =
        Date.now();


    const results =
        new Array(locations.length);


    let currentIndex = 0;


    // --------------------------------------------------------
    // WORKER
    // --------------------------------------------------------

    async function worker(workerId) {

        while (true) {

            const index =
                currentIndex++;


            if (
                index >= locations.length
            ) {

                break;

            }


            const item =
                locations[index];


            try {

                const prediction =
                    await predictWeather(
                        item.features || item
                    );


                results[index] = {

                    ...item,

                    prediction,

                    predictionSuccess: true

                };


            } catch (error) {

                console.error(

                    `FastAPI prediction failed at index ${index}:`,

                    error.message

                );


                results[index] = {

                    ...item,

                    prediction: {

                        thunderstormRisk:
                            "LOW",

                        thunderstormProbability:
                            0,

                        cloudburstRisk:
                            "LOW",

                        cloudburstProbability:
                            0,

                        flashFloodRisk:
                            "LOW",

                        flashFloodProbability:
                            0

                    },

                    predictionSuccess:
                        false,

                    predictionError:
                        error.message

                };

            }

        }


        console.log(
            `FastAPI worker ${workerId} completed`
        );

    }


    // --------------------------------------------------------
    // CONTROLLED CONCURRENCY
    // --------------------------------------------------------

    const workerCount =
        Math.min(
            concurrency,
            locations.length
        );


    const workers = [];


    for (
        let i = 0;
        i < workerCount;
        i++
    ) {

        workers.push(
            worker(i + 1)
        );

    }


    await Promise.all(
        workers
    );


    const elapsed =
        Date.now() - startTime;


    console.log(
        `✓ FastAPI batch completed in ${elapsed} ms`
    );


    return results;

}


// ============================================================
// FASTAPI HEALTH CHECK
// ============================================================

async function checkMLService() {

    try {

        const response =
            await mlClient.get(
                "/health"
            );


        return {

            online:
                true,

            data:
                response.data

        };


    } catch (error) {

        return {

            online:
                false,

            error:
                error.message

        };

    }

}


// ============================================================
// FASTAPI CONNECTION TEST
// ============================================================

async function testMLConnection() {

    try {

        const response =
            await mlClient.get(
                "/"
            );


        console.log(
            "=========================================="
        );

        console.log(
            "VEEYOM FASTAPI ML SERVICE ONLINE"
        );

        console.log(
            `URL: ${ML_API_URL}`
        );

        console.log(
            response.data
        );

        console.log(
            "=========================================="
        );


        return true;


    } catch (error) {

        console.error(
            "=========================================="
        );

        console.error(
            "VEEYOM FASTAPI ML SERVICE OFFLINE"
        );

        console.error(
            `URL: ${ML_API_URL}`
        );

        console.error(
            error.message
        );

        console.error(
            "=========================================="
        );


        return false;

    }

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    predictWeather,

    predictWeatherBatch,

    checkMLService,

    testMLConnection

};