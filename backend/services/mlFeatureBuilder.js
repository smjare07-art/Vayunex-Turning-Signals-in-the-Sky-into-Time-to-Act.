// ============================================================
// VEEYOM ML FEATURE BUILDER
// ============================================================

function degToRad(deg) {
    return (deg * Math.PI) / 180;
}


// ============================================================
// WIND COMPONENTS
// ============================================================

function windComponents(speed, direction) {

    const dir = degToRad(Number(direction));

    // Meteorological wind direction:
    // direction = where wind is coming FROM

    const u =
        -Number(speed) * Math.sin(dir);

    const v =
        -Number(speed) * Math.cos(dir);

    return {
        u,
        v
    };
}


// ============================================================
// WIND SPEED
// ============================================================

function calculateWindSpeed(u, v) {

    return Math.sqrt(
        (u * u) +
        (v * v)
    );
}


// ============================================================
// WIND DIRECTION
// ============================================================

function calculateWindDirection(u, v) {

    let direction =
        (Math.atan2(-u, -v) * 180) /
        Math.PI;

    if (direction < 0) {
        direction += 360;
    }

    return direction;
}


// ============================================================
// SAFE NUMBER
// ============================================================

function safe(value, fallback = 0) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


// ============================================================
// RAIN SUM
// ============================================================

function sumLastHours(values, index, hours) {

    let sum = 0;

    if (!Array.isArray(values)) {
        return 0;
    }

    const start =
        Math.max(
            0,
            index - hours + 1
        );

    for (
        let i = start;
        i <= index;
        i++
    ) {

        const value =
            Number(values[i] || 0);

        if (Number.isFinite(value)) {
            sum += value;
        }
    }

    return sum;
}


// ============================================================
// BUILD ML FEATURES
// ============================================================

function buildMLFeatures(weather, location = {}) {

    if (
        !weather ||
        !weather.hourly
    ) {

        throw new Error(
            "Invalid Open-Meteo weather response"
        );
    }


    const hourly =
        weather.hourly;

    const time =
        hourly.time;


    if (
        !Array.isArray(time) ||
        time.length === 0
    ) {

        throw new Error(
            "No hourly weather data available"
        );
    }


    // ========================================================
    // LATEST AVAILABLE HOUR
    // ========================================================

    const index =
        time.length - 1;


    // ========================================================
    // SURFACE WEATHER
    // ========================================================

    const t2m =
        safe(
            hourly.temperature_2m?.[index]
        );

    const d2m =
        safe(
            hourly.dew_point_2m?.[index]
        );

    const relativeHumidity =
        safe(
            hourly.relative_humidity_2m?.[index]
        );

    const surfacePressure =
        safe(
            hourly.surface_pressure?.[index]
        );

    const precipitation =
        safe(
            hourly.precipitation?.[index]
        );

    const rain =
        safe(
            hourly.rain?.[index]
        );


    // ========================================================
    // CONVECTIVE PARAMETERS
    // ========================================================

    const cape =
        safe(
            hourly.cape?.[index]
        );

    const cin =
        safe(
            hourly.convective_inhibition?.[index]
        );

    const tcwv =
        safe(
            hourly.total_column_integrated_water_vapour?.[index]
        );

    const blh =
        safe(
            hourly.boundary_layer_height?.[index]
        );


    // ========================================================
    // 10M WIND
    // ========================================================

    const windSpeed10Raw =
        safe(
            hourly.wind_speed_10m?.[index]
        );

    const windDirection10Raw =
        safe(
            hourly.wind_direction_10m?.[index]
        );

    const wind10 =
        windComponents(
            windSpeed10Raw,
            windDirection10Raw
        );

    const u10 =
        wind10.u;

    const v10 =
        wind10.v;

    const windSpeed10 =
        calculateWindSpeed(
            u10,
            v10
        );

    const windDirection10 =
        calculateWindDirection(
            u10,
            v10
        );


    // ========================================================
    // 850 hPa WIND
    // ========================================================

    const windSpeed850Raw =
        safe(
            hourly.wind_speed_850hPa?.[index]
        );

    const windDirection850Raw =
        safe(
            hourly.wind_direction_850hPa?.[index]
        );

    const wind850 =
        windComponents(
            windSpeed850Raw,
            windDirection850Raw
        );

    const windSpeed850 =
        calculateWindSpeed(
            wind850.u,
            wind850.v
        );

    const windDirection850 =
        calculateWindDirection(
            wind850.u,
            wind850.v
        );


    // ========================================================
    // 500 hPa WIND
    // ========================================================

    const windSpeed500Raw =
        safe(
            hourly.wind_speed_500hPa?.[index]
        );

    const windDirection500Raw =
        safe(
            hourly.wind_direction_500hPa?.[index]
        );

    const wind500 =
        windComponents(
            windSpeed500Raw,
            windDirection500Raw
        );

    const windSpeed500 =
        calculateWindSpeed(
            wind500.u,
            wind500.v
        );

    const windDirection500 =
        calculateWindDirection(
            wind500.u,
            wind500.v
        );


    // ========================================================
    // RAIN FEATURES
    // ========================================================

    const rain1h =
        sumLastHours(
            hourly.rain,
            index,
            1
        );

    const rain3h =
        sumLastHours(
            hourly.rain,
            index,
            3
        );

    const rain6h =
        sumLastHours(
            hourly.rain,
            index,
            6
        );

    const rain12h =
        sumLastHours(
            hourly.rain,
            index,
            12
        );

    const rain24h =
        sumLastHours(
            hourly.rain,
            index,
            24
        );


    // ========================================================
    // RAIN CHANGE
    // ========================================================

    const previousIndex =
        Math.max(
            0,
            index - 1
        );

    const previousRain =
        safe(
            hourly.rain?.[previousIndex]
        );

    const rain1hChange =
        rain1h -
        previousRain;

    const previous3h =
        sumLastHours(
            hourly.rain,
            previousIndex,
            3
        );

    const rain3hChange =
        rain3h -
        previous3h;


    // ========================================================
    // TEMPERATURE / DEWPOINT
    // ========================================================

    const temperatureC =
        t2m;

    const dewpointC =
        d2m;

    const dewpointDepression =
        temperatureC -
        dewpointC;

    const temperatureDewpointDiff =
        temperatureC -
        dewpointC;


    // ========================================================
    // VERTICAL WIND SHEAR
    // ========================================================

    const du850500 =
        wind850.u -
        wind500.u;

    const dv850500 =
        wind850.v -
        wind500.v;

    const verticalWindShear =
        Math.sqrt(
            Math.pow(
                du850500,
                2
            ) +
            Math.pow(
                dv850500,
                2
            )
        );


    // ========================================================
    // SPATIAL FEATURES
    // ========================================================

    // These cannot be calculated correctly from a single
    // latitude/longitude point.

    // They can be calculated using neighbouring GFS grid
    // points in a future version.

    const lowLevelConvergence =
        0;

    const vorticity850 =
        0;

    const vorticity500 =
        0;


    // ========================================================
    // FINAL FEATURES
    // ========================================================

    return {

        // ====================================================
        // LOCATION METADATA
        // ====================================================

        district:
            String(
                location.district ||
                "UNKNOWN"
            ),

        latitude:
            safe(
                location.latitude,
                0
            ),

        longitude:
            safe(
                location.longitude,
                0
            ),


        // ====================================================
        // 40 ML FEATURES
        // ====================================================

        // 1
        u10:
            u10,

        // 2
        v10:
            v10,

        // 3
        wind_speed_10m:
            windSpeed10,

        // 4
        t2m:
            t2m,

        // 5
        d2m:
            d2m,

        // 6
        temperature_c:
            temperatureC,

        // 7
        dewpoint_c:
            dewpointC,

        // 8
        dewpoint_depression:
            dewpointDepression,

        // 9
        tp:
            precipitation,

        // 10
        precipitation_mm:
            precipitation,

        // 11
        cape:
            cape,

        // 12
        cin:
            cin,

        // 13
        tcwv:
            tcwv,

        // 14
        sp:
            surfacePressure,

        // 15
        surface_pressure_hpa:
            surfacePressure,

        // 16
        blh:
            blh,

        // 17
        u500:
            wind500.u,

        // 18
        u850:
            wind850.u,

        // 19
        v500:
            wind500.v,

        // 20
        v850:
            wind850.v,

        // 21
        vertical_wind_shear_850_500:
            verticalWindShear,

        // 22
        low_level_convergence:
            lowLevelConvergence,

        // 23
        rain_1h:
            rain1h,

        // 24
        rain_3h:
            rain3h,

        // 25
        rain_6h:
            rain6h,

        // 26
        rain_12h:
            rain12h,

        // 27
        rain_24h:
            rain24h,

        // 28
        relative_humidity:
            relativeHumidity,

        // 29
        temperature_dewpoint_diff:
            temperatureDewpointDiff,

        // 30
        wind_speed_850:
            windSpeed850,

        // 31
        wind_speed_500:
            windSpeed500,

        // 32
        wind_direction_10m:
            windDirection10,

        // 33
        wind_direction_850:
            windDirection850,

        // 34
        wind_direction_500:
            windDirection500,

        // 35
        vorticity_850:
            vorticity850,

        // 36
        vorticity_500:
            vorticity500,

        // 37
        rain_1h_change:
            rain1hChange,

        // 38
        rain_3h_change:
            rain3hChange,

        // 39
        du_850_500:
            du850500,

        // 40
        dv_850_500:
            dv850500
    };
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    buildMLFeatures
};