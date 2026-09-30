function calculateRisk(item) {

    const color = Number(item.color);

    let risk = "LOW";
    let score = 20;

    if (color === 4) {
        risk = "EXTREME";
        score = 100;
    }
    else if (color === 3) {
        risk = "HIGH";
        score = 75;
    }
    else if (color === 2) {
        risk = "MEDIUM";
        score = 50;
    }
    else {
        risk = "LOW";
        score = 20;
    }

    // Severe thunderstorm
    if (Number(item.cat14) > 0) {
        risk = "HIGH";
        score = Math.max(score, 80);
    }

    // Very severe thunderstorm
    if (Number(item.cat15) > 0) {
        risk = "EXTREME";
        score = 100;
    }

    // Heavy rain
    if (Number(item.cat12) > 0) {
        risk = "HIGH";
        score = Math.max(score, 80);
    }

    // High lightning probability
    if (Number(item.cat19) > 0) {
        risk = "HIGH";
        score = Math.max(score, 80);
    }

    return {
        risk,
        score
    };
}


function processWeatherData(data) {

    return data.map(item => {

        const risk = calculateRisk(item);

        return {
            objId: item.Obj_id,
            district: item.State_District,
            date: item.Date,

            message: item.message || "",

            timeFrom: item.toi,
            validUpto: item.vupto,

            color: Number(item.color),

            risk: risk.risk,
            riskScore: risk.score,

            categories: {
                cat1: Number(item.cat1) || 0,
                cat2: Number(item.cat2) || 0,
                cat3: Number(item.cat3) || 0,
                cat4: Number(item.cat4) || 0,
                cat7: Number(item.cat7) || 0,
                cat11: Number(item.cat11) || 0,
                cat12: Number(item.cat12) || 0,
                cat14: Number(item.cat14) || 0,
                cat15: Number(item.cat15) || 0,
                cat19: Number(item.cat19) || 0
            }
        };

    });

}


module.exports = {
    calculateRisk,
    processWeatherData
};