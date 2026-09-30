const express = require("express");

const router = express.Router();

const {
    getMaharashtraLocations,
    getLocationStats
} = require("../services/villageLocationService");

// ============================================================
// GET ALL MAHARASHTRA LOCATIONS
// GET /api/ml/maharashtra/all-locations
// ============================================================

router.get("/maharashtra/all-locations", async (req, res) => {
    try {
        console.log("📍 Fetching Maharashtra all locations...");

        const result = await getMaharashtraLocations({
            limit: req.query.limit,
            offset: req.query.offset,
            district: req.query.district
        });

        if (!result) {
            return res.status(200).json({
                success: true,
                message: "No location data available",
                data: []
            });
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error(
            "❌ Maharashtra all-locations route error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to load Maharashtra locations",
            data: []
        });
    }
});

// ============================================================
// GET MAHARASHTRA LOCATIONS
// GET /api/ml/maharashtra
// ============================================================

router.get("/maharashtra", async (req, res) => {
    try {
        console.log("📍 Fetching Maharashtra locations...");

        const result = await getMaharashtraLocations({
            limit: req.query.limit,
            offset: req.query.offset,
            district: req.query.district
        });

        return res.status(200).json(result);

    } catch (error) {
        console.error(
            "❌ Maharashtra locations route error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to load Maharashtra locations",
            data: []
        });
    }
});

// ============================================================
// LOCATION STATS
// GET /api/ml/maharashtra/stats
// ============================================================

router.get("/maharashtra/stats", async (req, res) => {
    try {
        console.log("📊 Fetching Maharashtra location stats...");

        const result = await getLocationStats();

        return res.status(200).json(result);

    } catch (error) {
        console.error(
            "❌ Location stats error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to load location stats",
            data: []
        });
    }
});

module.exports = router;