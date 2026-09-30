const express = require("express");

const router = express.Router();

const {
    getMaharashtraLocations,
    getLocationStats
} = require("../services/villageLocationService");

// ============================================================
// GET ALL MAHARASHTRA LOCATIONS
// ============================================================

router.get("/maharashtra", async (req, res) => {

    try {

        const result =
            await getMaharashtraLocations({
                limit: req.query.limit,
                offset: req.query.offset,
                district: req.query.district
            });

        res.json(result);

    } catch (error) {

        console.error(
            "Maharashtra locations route error:",
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message ||
                "Unable to load Maharashtra locations"

        });
    }
});

// ============================================================
// LOCATION STATS
// ============================================================

router.get("/maharashtra/stats", async (req, res) => {

    try {

        const result =
            await getLocationStats();

        res.json(result);

    } catch (error) {

        console.error(
            "Location stats error:",
            error
        );

        res.status(500).json({

            success: false,

            error: error.message

        });
    }
});

module.exports = router;