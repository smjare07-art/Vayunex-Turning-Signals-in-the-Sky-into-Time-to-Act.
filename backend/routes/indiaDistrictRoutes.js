const express = require("express");

const router = express.Router();

const indiaDistricts = require("../data/indiaDistricts");

// ============================================================
// GET ALL INDIA DISTRICTS
// GET /api/india-districts
// ============================================================

router.get("/", (req, res) => {
    try {
        return res.json({
            success: true,
            count: indiaDistricts.length,
            districts: indiaDistricts,
        });
    } catch (error) {
        console.error("India districts error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load India districts",
        });
    }
});

// ============================================================
// GET DISTRICTS BY STATE
// GET /api/india-districts/state/Maharashtra
// ============================================================

router.get("/state/:stateName", (req, res) => {
    try {
        const stateName =
            decodeURIComponent(req.params.stateName)
                .trim()
                .toUpperCase();

        const districts = indiaDistricts.filter(
            (item) =>
                String(item.state || "")
                    .trim()
                    .toUpperCase() === stateName
        );

        return res.json({
            success: true,
            state: req.params.stateName,
            count: districts.length,
            districts,
        });
    } catch (error) {
        console.error("State districts error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load state districts",
        });
    }
});

// ============================================================
// GET SINGLE DISTRICT
// GET /api/india-districts/:id
// ============================================================

router.get("/:id", (req, res) => {
    try {
        const id = decodeURIComponent(req.params.id);

        const district = indiaDistricts.find(
            (item) =>
                String(item.id).toUpperCase() ===
                String(id).toUpperCase()
        );

        if (!district) {
            return res.status(404).json({
                success: false,
                message: "District not found",
            });
        }

        return res.json({
            success: true,
            district,
        });
    } catch (error) {
        console.error("District lookup error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to find district",
        });
    }
});

module.exports = router;