from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pathlib import Path
import csv
import httpx
import math
import xgboost as xgb


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="VEEYOM ML API",
    version="2.0.0"
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[3]

GRID_FILE = BASE_DIR / "data" / "maharashtraGrid.csv"

MODEL_DIR = BASE_DIR / "ML" / "models"

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


# ============================================================
# MODEL FILES
# ============================================================

THUNDERSTORM_MODEL_FILE = (
    MODEL_DIR / "xgboost_thunderstorm_2h_v2.json"
)

CLOUDBURST_MODEL_FILE = (
    MODEL_DIR / "xgboost_cloudburst_2h.json"
)

FLASHFLOOD_MODEL_FILE = (
    MODEL_DIR / "xgboost_flashflood_2h.json"
)


# ============================================================
# MODEL CACHE
# ============================================================

thunderstorm_model = None
cloudburst_model = None
flashflood_model = None


# ============================================================
# EXACT MODEL FEATURES
# ============================================================

MODEL_FEATURES = [

    "u10",
    "v10",
    "wind_speed_10m",

    "t2m",
    "d2m",

    "temperature_c",
    "dewpoint_c",
    "dewpoint_depression",

    "tp",
    "precipitation_mm",

    "cape",
    "cin",
    "tcwv",

    "sp",
    "surface_pressure_hpa",

    "blh",

    "u500",
    "u850",

    "v500",
    "v850",

    "vertical_wind_shear_850_500",

    "low_level_convergence",

    "rain_1h",
    "rain_3h",
    "rain_6h",
    "rain_12h",
    "rain_24h",

    "relative_humidity",

    "temperature_dewpoint_diff",

    "wind_speed_850",
    "wind_speed_500",

    "wind_direction_10m",
    "wind_direction_850",
    "wind_direction_500",

    "vorticity_850",
    "vorticity_500",

    "rain_1h_change",
    "rain_3h_change",

    "du_850_500",
    "dv_850_500"
]


# ============================================================
# LOAD XGBOOST MODELS
# ============================================================

def load_models():

    global thunderstorm_model
    global cloudburst_model
    global flashflood_model

    print()
    print("=" * 60)
    print("VEEYOM XGBOOST MODEL LOADING")
    print("=" * 60)

    # --------------------------------------------------------
    # Thunderstorm
    # --------------------------------------------------------

    if not THUNDERSTORM_MODEL_FILE.exists():

        raise FileNotFoundError(
            f"Thunderstorm model not found: "
            f"{THUNDERSTORM_MODEL_FILE}"
        )

    thunderstorm_model = xgb.Booster()

    thunderstorm_model.load_model(
        str(THUNDERSTORM_MODEL_FILE)
    )

    print("✓ Thunderstorm model loaded")

    # --------------------------------------------------------
    # Cloudburst
    # --------------------------------------------------------

    if not CLOUDBURST_MODEL_FILE.exists():

        raise FileNotFoundError(
            f"Cloudburst model not found: "
            f"{CLOUDBURST_MODEL_FILE}"
        )

    cloudburst_model = xgb.Booster()

    cloudburst_model.load_model(
        str(CLOUDBURST_MODEL_FILE)
    )

    print("✓ Cloudburst model loaded")

    # --------------------------------------------------------
    # Flash Flood
    # --------------------------------------------------------

    if not FLASHFLOOD_MODEL_FILE.exists():

        raise FileNotFoundError(
            f"Flash flood model not found: "
            f"{FLASHFLOOD_MODEL_FILE}"
        )

    flashflood_model = xgb.Booster()

    flashflood_model.load_model(
        str(FLASHFLOOD_MODEL_FILE)
    )

    print("✓ Flash flood model loaded")

    print()
    print(
        f"Model features: {len(MODEL_FEATURES)}"
    )

    print(
        "✓ All VEEYOM models loaded successfully"
    )

    print("=" * 60)
    print()


# ============================================================
# LOAD MODELS AT STARTUP
# ============================================================

@app.on_event("startup")
def startup_event():

    try:

        load_models()

    except Exception as error:

        print()
        print("=" * 60)
        print("❌ MODEL LOADING FAILED")
        print("=" * 60)

        print(str(error))

        print("=" * 60)
        print()


# ============================================================
# PREDICTION REQUEST
# ============================================================

class PredictionRequest(BaseModel):

    # --------------------------------------------------------
    # Metadata
    # --------------------------------------------------------

    district: str = "UNKNOWN"

    latitude: float = 0.0

    longitude: float = 0.0

    # --------------------------------------------------------
    # 40 ML FEATURES
    # --------------------------------------------------------

    u10: float
    v10: float
    wind_speed_10m: float

    t2m: float
    d2m: float

    temperature_c: float
    dewpoint_c: float
    dewpoint_depression: float

    tp: float
    precipitation_mm: float

    cape: float
    cin: float
    tcwv: float

    sp: float
    surface_pressure_hpa: float

    blh: float

    u500: float
    u850: float

    v500: float
    v850: float

    vertical_wind_shear_850_500: float

    low_level_convergence: float

    rain_1h: float
    rain_3h: float
    rain_6h: float
    rain_12h: float
    rain_24h: float

    relative_humidity: float

    temperature_dewpoint_diff: float

    wind_speed_850: float
    wind_speed_500: float

    wind_direction_10m: float
    wind_direction_850: float
    wind_direction_500: float

    vorticity_850: float
    vorticity_500: float

    rain_1h_change: float
    rain_3h_change: float

    du_850_500: float
    dv_850_500: float


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "service": "VEEYOM ML API",
        "model": "XGBoost",
        "prediction": "Dynamic",
        "features": len(MODEL_FEATURES)
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    models_loaded = (
        thunderstorm_model is not None
        and cloudburst_model is not None
        and flashflood_model is not None
    )

    return {

        "status":
            "healthy"
            if models_loaded
            else "degraded",

        "models_loaded":
            models_loaded,

        "thunderstorm":
            thunderstorm_model is not None,

        "cloudburst":
            cloudburst_model is not None,

        "flashflood":
            flashflood_model is not None
    }


# ============================================================
# RISK CLASSIFICATION
# ============================================================

def probability_to_risk(probability):

    probability = float(probability)

    if probability >= 0.75:
        return "SEVERE"

    if probability >= 0.50:
        return "HIGH"

    if probability >= 0.25:
        return "MEDIUM"

    return "LOW"


# ============================================================
# SAFE PROBABILITY
# ============================================================

def clean_probability(value):

    try:

        value = float(value)

    except Exception:

        return 0.0

    if not math.isfinite(value):

        return 0.0

    return max(
        0.0,
        min(
            1.0,
            value
        )
    )


# ============================================================
# RUN XGBOOST MODEL
# ============================================================

def run_model(
    model,
    features
):

    if model is None:

        raise RuntimeError(
            "XGBoost model is not loaded"
        )

    # --------------------------------------------------------
    # EXACT FEATURE VECTOR
    # --------------------------------------------------------

    vector = [
        float(features[name])
        for name in MODEL_FEATURES
    ]

    # --------------------------------------------------------
    # XGBOOST D-MATRIX
    # --------------------------------------------------------

    matrix = xgb.DMatrix(
        [vector],
        feature_names=MODEL_FEATURES
    )

    # --------------------------------------------------------
    # PREDICTION
    # --------------------------------------------------------

    prediction = model.predict(matrix)

    if prediction is None:

        raise RuntimeError(
            "XGBoost returned no prediction"
        )

    if len(prediction) == 0:

        raise RuntimeError(
            "XGBoost returned empty prediction"
        )

    value = prediction[0]

    # --------------------------------------------------------
    # HANDLE POSSIBLE PREDICTION FORMAT
    # --------------------------------------------------------

    try:

        if hasattr(value, "__len__"):

            value = value[-1]

    except Exception:

        pass

    # --------------------------------------------------------
    # CLEAN PROBABILITY
    # --------------------------------------------------------

    probability = clean_probability(value)

    return probability


# ============================================================
# MAIN DYNAMIC ML PREDICTION
# ============================================================

@app.post("/predict")
def predict(
    data: PredictionRequest
):

    try:

        # ----------------------------------------------------
        # CHECK MODELS
        # ----------------------------------------------------

        if (
            thunderstorm_model is None
            or cloudburst_model is None
            or flashflood_model is None
        ):

            raise HTTPException(
                status_code=503,
                detail=(
                    "One or more XGBoost models "
                    "are not loaded"
                )
            )

        # ----------------------------------------------------
        # CONVERT REQUEST TO DICTIONARY
        # ----------------------------------------------------

        if hasattr(data, "model_dump"):

            payload = data.model_dump()

        else:

            payload = data.dict()

        # ----------------------------------------------------
        # VALIDATE ALL 40 FEATURES
        # ----------------------------------------------------

        missing_features = [

            feature

            for feature in MODEL_FEATURES

            if (
                feature not in payload
                or payload[feature] is None
            )

        ]

        if missing_features:

            raise HTTPException(

                status_code=400,

                detail={

                    "message":
                        "Missing ML features",

                    "missing_features":
                        missing_features
                }
            )

        # ----------------------------------------------------
        # EXTRACT ML FEATURES
        # ----------------------------------------------------

        features = {

            feature:
                float(payload[feature])

            for feature in MODEL_FEATURES

        }

        # ----------------------------------------------------
        # THUNDERSTORM
        # ----------------------------------------------------

        thunderstorm_probability = run_model(
            thunderstorm_model,
            features
        )

        thunderstorm_risk = probability_to_risk(
            thunderstorm_probability
        )

        # ----------------------------------------------------
        # CLOUDBURST
        # ----------------------------------------------------

        cloudburst_probability = run_model(
            cloudburst_model,
            features
        )

        cloudburst_risk = probability_to_risk(
            cloudburst_probability
        )

        # ----------------------------------------------------
        # FLASH FLOOD
        # ----------------------------------------------------

        flashflood_probability = run_model(
            flashflood_model,
            features
        )

        flashflood_risk = probability_to_risk(
            flashflood_probability
        )

        # ----------------------------------------------------
        # OVERALL RISK
        # ----------------------------------------------------

        probabilities = {

            "THUNDERSTORM":
                thunderstorm_probability,

            "CLOUDBURST":
                cloudburst_probability,

            "FLASH_FLOOD":
                flashflood_probability
        }

        overall_hazard = max(
            probabilities,
            key=probabilities.get
        )

        overall_probability = probabilities[
            overall_hazard
        ]

        overall_risk = probability_to_risk(
            overall_probability
        )

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        response = {

            "district":
                data.district,

            "latitude":
                data.latitude,

            "longitude":
                data.longitude,

            "risk":
                overall_risk,

            "probability":
                round(
                    overall_probability,
                    6
                ),

            "hazard":
                overall_hazard,

            "source":
                "VEEYOM XGBoost ML Model",

            "prediction": {

                "thunderstorm": {

                    "risk":
                        thunderstorm_risk,

                    "probability":
                        round(
                            thunderstorm_probability,
                            6
                        )
                },

                "cloudburst": {

                    "risk":
                        cloudburst_risk,

                    "probability":
                        round(
                            cloudburst_probability,
                            6
                        )
                },

                "flashFlood": {

                    "risk":
                        flashflood_risk,

                    "probability":
                        round(
                            flashflood_probability,
                            6
                        )
                }
            }
        }

        # ----------------------------------------------------
        # LOG
        # ----------------------------------------------------

        print()
        print(
            "------------------------------------------"
        )

        print(
            f"ML: {data.district}"
        )

        print(
            f"Thunderstorm: "
            f"{thunderstorm_risk} "
            f"({thunderstorm_probability:.4f})"
        )

        print(
            f"Cloudburst: "
            f"{cloudburst_risk} "
            f"({cloudburst_probability:.4f})"
        )

        print(
            f"Flash Flood: "
            f"{flashflood_risk} "
            f"({flashflood_probability:.4f})"
        )

        print(
            f"Overall: "
            f"{overall_risk} "
            f"({overall_probability:.4f})"
        )

        print(
            "------------------------------------------"
        )

        return response

    except HTTPException:

        raise

    except Exception as error:

        print()
        print(
            "❌ XGBOOST PREDICTION ERROR:"
        )

        print(str(error))

        raise HTTPException(

            status_code=500,

            detail=(
                f"XGBoost prediction failed: "
                f"{str(error)}"
            )
        )


# ============================================================
# LOAD MAHARASHTRA GRID
# ============================================================

def load_maharashtra_grid():

    if not GRID_FILE.exists():

        raise FileNotFoundError(
            f"Maharashtra grid file not found: "
            f"{GRID_FILE}"
        )

    locations = []

    with open(
        GRID_FILE,
        "r",
        encoding="utf-8-sig"
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:

            latitude = row.get("latitude")

            longitude = row.get("longitude")

            if (
                latitude is None
                or longitude is None
            ):

                continue

            try:

                locations.append({

                    "latitude":
                        float(latitude),

                    "longitude":
                        float(longitude)

                })

            except (ValueError, TypeError):

                continue

    return locations


# ============================================================
# OPEN-METEO LIVE WEATHER
# ============================================================

async def fetch_grid_weather(
    locations
):

    if not locations:

        return []

    results = []

    batch_size = 50

    async with httpx.AsyncClient(
        timeout=30
    ) as client:

        for start in range(
            0,
            len(locations),
            batch_size
        ):

            batch = locations[
                start:start + batch_size
            ]

            latitudes = ",".join(
                str(location["latitude"])
                for location in batch
            )

            longitudes = ",".join(
                str(location["longitude"])
                for location in batch
            )

            params = {

                "latitude":
                    latitudes,

                "longitude":
                    longitudes,

                "current": (
                    "temperature_2m,"
                    "relative_humidity_2m,"
                    "apparent_temperature,"
                    "precipitation,"
                    "rain,"
                    "weather_code,"
                    "cloud_cover,"
                    "surface_pressure,"
                    "wind_speed_10m,"
                    "wind_direction_10m,"
                    "wind_gusts_10m"
                ),

                "timezone":
                    "Asia/Kolkata",

                "temperature_unit":
                    "celsius",

                "wind_speed_unit":
                    "kmh",

                "precipitation_unit":
                    "mm"
            }

            response = await client.get(
                OPEN_METEO_URL,
                params=params
            )

            response.raise_for_status()

            weather_response = response.json()

            if isinstance(
                weather_response,
                list
            ):

                weather_data = weather_response

            else:

                weather_data = [
                    weather_response
                ]

            for index, weather in enumerate(
                weather_data
            ):

                if index >= len(batch):

                    continue

                location = batch[index]

                current = weather.get(
                    "current",
                    {}
                )

                results.append({

                    "latitude":
                        location["latitude"],

                    "longitude":
                        location["longitude"],

                    "time":
                        current.get("time"),

                    "weather": {

                        "temperature_c":
                            current.get(
                                "temperature_2m"
                            ),

                        "humidity_percent":
                            current.get(
                                "relative_humidity_2m"
                            ),

                        "apparent_temperature_c":
                            current.get(
                                "apparent_temperature"
                            ),

                        "precipitation_mm":
                            current.get(
                                "precipitation"
                            ),

                        "rain_mm":
                            current.get(
                                "rain"
                            ),

                        "cloud_cover_percent":
                            current.get(
                                "cloud_cover"
                            ),

                        "surface_pressure_hpa":
                            current.get(
                                "surface_pressure"
                            ),

                        "wind_speed_kmh":
                            current.get(
                                "wind_speed_10m"
                            ),

                        "wind_direction_deg":
                            current.get(
                                "wind_direction_10m"
                            ),

                        "wind_gusts_kmh":
                            current.get(
                                "wind_gusts_10m"
                            ),

                        "weather_code":
                            current.get(
                                "weather_code"
                            )
                    },

                    "source":
                        "Open-Meteo",

                    "live":
                        True
                })

    return results


# ============================================================
# GRID WEATHER API
# ============================================================

@app.get("/api/live/grid-weather")
async def grid_weather():

    try:

        locations = load_maharashtra_grid()

        weather = await fetch_grid_weather(
            locations
        )

        return {

            "status":
                "success",

            "source":
                "Open-Meteo",

            "live":
                True,

            "total_grid_points":
                len(weather),

            "grid_file":
                "maharashtraGrid.csv",

            "data":
                weather
        }

    except FileNotFoundError as error:

        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except httpx.HTTPError as error:

        raise HTTPException(

            status_code=502,

            detail=(
                f"Open-Meteo request failed: "
                f"{str(error)}"
            )
        )

    except Exception as error:

        raise HTTPException(

            status_code=500,

            detail=(
                f"Grid weather error: "
                f"{str(error)}"
            )
        )


# ============================================================
# SINGLE LOCATION LIVE WEATHER
# ============================================================

@app.get("/api/live/weather")
async def live_weather(
    latitude: float,
    longitude: float
):

    params = {

        "latitude":
            latitude,

        "longitude":
            longitude,

        "current": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "apparent_temperature,"
            "precipitation,"
            "rain,"
            "weather_code,"
            "cloud_cover,"
            "surface_pressure,"
            "wind_speed_10m,"
            "wind_direction_10m,"
            "wind_gusts_10m"
        ),

        "timezone":
            "Asia/Kolkata",

        "temperature_unit":
            "celsius",

        "wind_speed_unit":
            "kmh",

        "precipitation_unit":
            "mm"
    }

    try:

        async with httpx.AsyncClient(
            timeout=15
        ) as client:

            response = await client.get(
                OPEN_METEO_URL,
                params=params
            )

            response.raise_for_status()

            data = response.json()

        current = data.get(
            "current",
            {}
        )

        return {

            "source":
                "Open-Meteo",

            "live":
                True,

            "latitude":
                latitude,

            "longitude":
                longitude,

            "time":
                current.get("time"),

            "weather": {

                "temperature_c":
                    current.get(
                        "temperature_2m"
                    ),

                "humidity_percent":
                    current.get(
                        "relative_humidity_2m"
                    ),

                "apparent_temperature_c":
                    current.get(
                        "apparent_temperature"
                    ),

                "precipitation_mm":
                    current.get(
                        "precipitation"
                    ),

                "rain_mm":
                    current.get(
                        "rain"
                    ),

                "cloud_cover_percent":
                    current.get(
                        "cloud_cover"
                    ),

                "surface_pressure_hpa":
                    current.get(
                        "surface_pressure"
                    ),

                "wind_speed_kmh":
                    current.get(
                        "wind_speed_10m"
                    ),

                "wind_direction_deg":
                    current.get(
                        "wind_direction_10m"
                    ),

                "wind_gusts_kmh":
                    current.get(
                        "wind_gusts_10m"
                    ),

                "weather_code":
                    current.get(
                        "weather_code"
                    )
            }
        }

    except httpx.HTTPError as error:

        raise HTTPException(

            status_code=502,

            detail=(
                f"Open-Meteo request failed: "
                f"{str(error)}"
            )
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )