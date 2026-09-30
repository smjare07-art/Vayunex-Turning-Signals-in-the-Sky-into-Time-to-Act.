
const axios = require("axios");

// ============================================================
// FASTAPI ML CONFIG
// ============================================================

const ML_API_URL =
    process.env.ML_API_URL ||
    "http://127.0.0.1:8000";

const ML_TIMEOUT = Number(
    process.env.ML_TIMEOUT || 8000
);

const DEFAULT_CONCURRENCY = Number(
    process.env.ML_CONCURRENCY || 6
);


// ============================================================
// AXIOS CLIENT
// ============================================================

const mlClient = axios.create({
    baseURL: ML_API_URL,
    timeout: ML_TIMEOUT,
    headers: {
        "Content-Type": "application/json"
    }
});


// ============================================================
// SINGLE LOCATION PREDICTION
// ============================================================

async function predictWeather(features) {

    const startTime = Date.now();

    if (!features || typeof features !== "object") {
        throw new Error("Invalid ML features");
    }

    try {

        const response = await mlClient.post(
            "/predict",
            features
        );

        const elapsed = Date.now() - startTime;

        if (elapsed > 1000) {
            console.warn(
                `⚠ Slow ML prediction: ${elapsed} ms`
            );
        }

        return response.data;

    } catch (error) {

        const elapsed = Date.now() - startTime;

        console.error(
            `FASTAPI ML ERROR after ${elapsed} ms:`,
            error.response?.data ||
            error.message
        );

        throw new Error(
            error.response?.data?.detail ||
            error.response?.data?.error ||
            error.message ||
            "VEEYOM ML service unavailable"
        );
    }
}


// ============================================================
// BATCH PREDICTION
// ============================================================
// Controlled concurrency prevents Node from sending too many
// simultaneous requests to FastAPI.
// ============================================================

async function predictWeatherBatch(
    locations = [],
    concurrency = DEFAULT_CONCURRENCY
) {

    if (!Array.isArray(locations) || locations.length === 0) {
        return [];
    }

    const startTime = Date.now();

    const safeConcurrency = Math.max(
        1,
        Math.min(
            Number(concurrency) || DEFAULT_CONCURRENCY,
            locations.length
        )
    );

    console.log(
        `ML batch started: ${locations.length} locations, concurrency ${safeConcurrency}`
    );

    const results = new Array(
        locations.length
    );

    let currentIndex = 0;

    // ========================================================
    // WORKER
    // ========================================================

    async function worker() {

        while (true) {

            const index = currentIndex++;

            if (index >= locations.length) {
                return;
            }

            const item = locations[index];

            try {

                const features =
                    item?.features || item;

                const prediction =
                    await predictWeather(features);

                results[index] = {
                    ...item,

                    prediction,

                    predictionSuccess: true
                };

            } catch (error) {

                console.error(
                    `ML failed for location ${index}:`,
                    error.message
                );

                results[index] = {
                    ...item,

                    prediction: {
                        success: false,

                        thunderstorm: {
                            probability: 0,
                            raw_probability: 0,
                            risk: "LOW"
                        },

                        cloudburst: {
                            probability: 0,
                            raw_probability: 0,
                            risk: "LOW"
                        },

                        flashFlood: {
                            probability: 0,
                            raw_probability: 0,
                            risk: "LOW"
                        },

                        overall: {
                            hazard: "NONE",
                            probability: 0,
                            raw_probability: 0,
                            risk: "LOW"
                        }
                    },

                    predictionSuccess: false,

                    predictionError:
                        error.message
                };
            }
        }
    }

    // ========================================================
    // CREATE WORKERS
    // ========================================================

    const workers = Array.from(
        { length: safeConcurrency },
        () => worker()
    );

    await Promise.all(workers);

    // ========================================================
    // FINAL TIMING
    // ========================================================

    const totalTime =
        Date.now() - startTime;

    const successful =
        results.filter(
            item =>
                item?.predictionSuccess === true
        ).length;

    const failed =
        results.length - successful;

    console.log(
        `ML batch completed: ${totalTime} ms | success: ${successful} | failed: ${failed}`
    );

    return results;
}


// ============================================================
// ML HEALTH CHECK
// ============================================================

async function checkMLService() {

    try {

        const response =
            await mlClient.get(
                "/health",
                {
                    timeout: 3000
                }
            );

        return {
            online: true,
            data: response.data
        };

    } catch (error) {

        return {
            online: false,
            error: error.message
        };
    }
}


// ============================================================
// TEST ML CONNECTION
// ============================================================

async function testMLConnection() {

    try {

        const response =
            await mlClient.get(
                "/",
                {
                    timeout: 3000
                }
            );

        console.log(
            "VEEYOM ML SERVICE ONLINE"
        );

        console.log(
            response.data
        );

        return true;

    } catch (error) {

        console.error(
            "VEEYOM ML SERVICE OFFLINE:",
            error.message
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

