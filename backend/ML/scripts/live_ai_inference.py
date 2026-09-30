from pathlib import Path
from datetime import datetime, timedelta
import math
import json
import gc
import warnings

import numpy as np
import pandas as pd
import joblib
import xgboost as xgb

from pymongo import MongoClient, UpdateOne


warnings.filterwarnings("ignore")


# ============================================================
# VAYUNEX - LIVE AI INFERENCE ENGINE
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

MODEL_DIR = BASE_DIR / "ML" / "models"

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "vayunex_climateverse"

INPUT_COLLECTION = "live_forecast_inputs"
OUTPUT_COLLECTION = "live_ai_predictions"


# ------------------------------------------------------------
# Training feature order
# ------------------------------------------------------------

FEATURES = [
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
    "dv_850_500",
]


# ------------------------------------------------------------
# Model definitions
# ------------------------------------------------------------

MODEL_CONFIG = {
    "thunderstorm": {
        2: {
            "file": "xgboost_thunderstorm_2h_v2.json",
            "feature_file": "thunderstorm_2h_v2_features.pkl",
            "metadata_file": "thunderstorm_2h_metadata.json",
        },
        4: {
            "file": "xgboost_thunderstorm_4h_v1.json",
            "feature_file": "thunderstorm_4h_features.pkl",
            "metadata_file": "thunderstorm_4h_metadata.json",
        },
        6: {
            "file": "xgboost_thunderstorm_6h_v1.json",
            "feature_file": "thunderstorm_6h_features.pkl",
            "metadata_file": "thunderstorm_6h_metadata.json",
        },
    },

    "cloudburst": {
        2: {
            "file": "xgboost_cloudburst_2h.json",
            "feature_file": "cloudburst_2h_features.pkl",
            "metadata_file": "cloudburst_2h_metadata.json",
        },
        4: {
            "file": "xgboost_cloudburst_4h_v1.json",
            "feature_file": "cloudburst_4h_features.pkl",
            "metadata_file": "cloudburst_4h_metadata.json",
        },
        6: {
            "file": "xgboost_cloudburst_6h_v1.json",
            "feature_file": "cloudburst_6h_features.pkl",
            "metadata_file": "cloudburst_6h_metadata.json",
        },
    },

    "flashflood": {
        2: {
            "file": "xgboost_flashflood_2h.json",
            "feature_file": "flashflood_2h_features.pkl",
            "metadata_file": "flashflood_2h_metadata.json",
        },
        4: {
            "file": "xgboost_flashflood_4h_v1.json",
            "feature_file": "flashflood_4h_features.pkl",
            "metadata_file": "flashflood_4h_metadata.json",
        },
        6: {
            "file": "xgboost_flashflood_6h_v1.json",
            "feature_file": "flashflood_6h_features.pkl",
            "metadata_file": "flashflood_6h_metadata.json",
        },
    },
}


HORIZONS = [2, 4, 6]

# Operational labels used by Vayunex UI.
# These are deliberately simple and easy to understand.
RISK_LEVELS = [
    (0.80, "EXTREME"),
    (0.60, "HIGH"),
    (0.35, "MODERATE"),
    (0.15, "LOW"),
    (0.00, "VERY LOW"),
]


# ============================================================
# Utility functions
# ============================================================

def risk_level(probability: float) -> str:
    probability = float(probability)

    for threshold, label in RISK_LEVELS:
        if probability >= threshold:
            return label

    return "VERY LOW"


def safe_float(value):
    try:
        if value is None:
            return np.nan

        value = float(value)

        if not np.isfinite(value):
            return np.nan

        return value

    except Exception:
        return np.nan


def wind_components(speed_kmh, direction_deg):
    """
    Convert meteorological wind speed/direction to u/v.
    Training data uses approximately m/s components.
    """

    speed_kmh = safe_float(speed_kmh)
    direction_deg = safe_float(direction_deg)

    if np.isnan(speed_kmh) or np.isnan(direction_deg):
        return np.nan, np.nan

    speed_ms = speed_kmh / 3.6
    direction_rad = np.deg2rad(direction_deg)

    u = -speed_ms * np.sin(direction_rad)
    v = -speed_ms * np.cos(direction_rad)

    return float(u), float(v)


def utc_now_naive():
    return datetime.utcnow().replace(microsecond=0)


# ============================================================
# Model loading
# ============================================================

def load_models():
    print("\nLoading Vayunex AI models...")

    models = {}
    thresholds = {}

    for hazard, horizons in MODEL_CONFIG.items():

        models[hazard] = {}
        thresholds[hazard] = {}

        for horizon, config in horizons.items():

            model_path = MODEL_DIR / config["file"]
            feature_path = MODEL_DIR / config["feature_file"]
            metadata_path = MODEL_DIR / config["metadata_file"]

            if not model_path.exists():
                raise FileNotFoundError(
                    f"Model not found: {model_path}"
                )

            if not feature_path.exists():
                raise FileNotFoundError(
                    f"Feature file not found: {feature_path}"
                )

            model = xgb.XGBClassifier()
            model.load_model(model_path)

            trained_features = joblib.load(feature_path)

            if list(trained_features) != FEATURES:
                print(
                    f"WARNING: feature order differs for "
                    f"{hazard} {horizon}h"
                )

            threshold = 0.50

            if metadata_path.exists():
                try:
                    with open(
                        metadata_path,
                        "r",
                        encoding="utf-8",
                    ) as f:
                        metadata = json.load(f)

                    threshold = float(
                        metadata
                        .get("validation", {})
                        .get("threshold", 0.50)
                    )

                except Exception:
                    pass

            models[hazard][horizon] = model
            thresholds[hazard][horizon] = threshold

            print(
                f"  {hazard:12s} {horizon}h "
                f"loaded | threshold={threshold:.2f}"
            )

    return models, thresholds


# ============================================================
# MongoDB
# ============================================================

def get_mongo():
    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000,
    )

    client.admin.command("ping")

    db = client[DB_NAME]

    return client, db


# ============================================================
# Live forecast loading
# ============================================================

def load_latest_live_forecast(collection):
    latest_retrieval = collection.find_one(
        {"live": True},
        sort=[("forecast_retrieved_at", -1)],
        projection={
            "_id": 0,
            "forecast_retrieved_at": 1,
        },
    )

    if not latest_retrieval:
        raise RuntimeError(
            "No live forecast documents found."
        )

    retrieval_time = latest_retrieval[
        "forecast_retrieved_at"
    ]

    docs = list(
        collection.find(
            {
                "live": True,
                "forecast_retrieved_at": retrieval_time,
            }
        )
    )

    if not docs:
        raise RuntimeError(
            "Latest live forecast run contains no documents."
        )

    return retrieval_time, docs


# ============================================================
# Atmospheric feature construction
# ============================================================

def build_base_dataframe(docs):
    rows = []

    for doc in docs:

        v = doc.get("variables", {})

        lat = safe_float(doc.get("latitude"))
        lon = safe_float(doc.get("longitude"))
        time = doc.get("time")

        if time is None:
            continue

        temperature_c = safe_float(
            v.get("temperature_2m")
        )

        dewpoint_c = safe_float(
            v.get("dew_point_2m")
        )

        wind_speed_10m_kmh = safe_float(
            v.get("wind_speed_10m")
        )

        wind_direction_10m = safe_float(
            v.get("wind_direction_10m")
        )

        u10, v10 = wind_components(
            wind_speed_10m_kmh,
            wind_direction_10m,
        )

        wind850_speed_kmh = safe_float(
            v.get("wind_speed_850hPa")
        )

        wind850_direction = safe_float(
            v.get("wind_direction_850hPa")
        )

        u850, v850 = wind_components(
            wind850_speed_kmh,
            wind850_direction,
        )

        wind500_speed_kmh = safe_float(
            v.get("wind_speed_500hPa")
        )

        wind500_direction = safe_float(
            v.get("wind_direction_500hPa")
        )

        u500, v500 = wind_components(
            wind500_speed_kmh,
            wind500_direction,
        )

        precipitation_mm = safe_float(
            v.get("precipitation")
        )

        if np.isnan(precipitation_mm):
            precipitation_mm = safe_float(
                v.get("rain")
            )

        surface_pressure_hpa = safe_float(
            v.get("surface_pressure")
        )

        cape = safe_float(
            v.get("cape")
        )

        tcwv = safe_float(
            v.get(
                "total_column_integrated_water_vapour"
            )
        )

        relative_humidity = safe_float(
            v.get("relative_humidity_2m")
        )

        # ----------------------------------------------------
        # Training dataset uses Kelvin for t2m/d2m.
        # ----------------------------------------------------

        t2m = (
            temperature_c + 273.15
            if not np.isnan(temperature_c)
            else np.nan
        )

        d2m = (
            dewpoint_c + 273.15
            if not np.isnan(dewpoint_c)
            else np.nan
        )

        dewpoint_depression = (
            temperature_c - dewpoint_c
            if (
                not np.isnan(temperature_c)
                and not np.isnan(dewpoint_c)
            )
            else np.nan
        )

        # Open-Meteo precipitation is mm.
        # Training tp is approximately metres.
        tp = (
            precipitation_mm / 1000.0
            if not np.isnan(precipitation_mm)
            else np.nan
        )

        # ----------------------------------------------------
        # Derived shear.
        # ----------------------------------------------------

        if (
            not np.isnan(u850)
            and not np.isnan(v850)
            and not np.isnan(u500)
            and not np.isnan(v500)
        ):
            vertical_shear = math.sqrt(
                (u500 - u850) ** 2
                +
                (v500 - v850) ** 2
            )
        else:
            vertical_shear = np.nan

        row = {
            "time": pd.Timestamp(time),
            "latitude": lat,
            "longitude": lon,

            "u10": u10,
            "v10": v10,

            "wind_speed_10m": (
                wind_speed_10m_kmh / 3.6
                if not np.isnan(wind_speed_10m_kmh)
                else np.nan
            ),

            "t2m": t2m,
            "d2m": d2m,

            "temperature_c": temperature_c,
            "dewpoint_c": dewpoint_c,
            "dewpoint_depression": dewpoint_depression,

            "tp": tp,
            "precipitation_mm": precipitation_mm,

            "cape": cape,

            # Source currently does not provide these.
            # Leave them as NaN. XGBoost supports missing values.
            "cin": np.nan,

            "tcwv": tcwv,

            "sp": (
                surface_pressure_hpa * 100.0
                if not np.isnan(surface_pressure_hpa)
                else np.nan
            ),

            "surface_pressure_hpa": surface_pressure_hpa,

            "blh": np.nan,

            "u500": u500,
            "u850": u850,
            "v500": v500,
            "v850": v850,

            "vertical_wind_shear_850_500":
                vertical_shear,

            "relative_humidity":
                relative_humidity,

            "temperature_dewpoint_diff":
                dewpoint_depression,

            "wind_speed_850": (
                wind850_speed_kmh / 3.6
                if not np.isnan(wind850_speed_kmh)
                else np.nan
            ),

            "wind_speed_500": (
                wind500_speed_kmh / 3.6
                if not np.isnan(wind500_speed_kmh)
                else np.nan
            ),

            "wind_direction_10m":
                wind_direction_10m,

            "wind_direction_850":
                wind850_direction,

            "wind_direction_500":
                wind500_direction,

            "rain_1h": precipitation_mm,

            "rain_3h": np.nan,
            "rain_6h": np.nan,
            "rain_12h": np.nan,
            "rain_24h": np.nan,

            "low_level_convergence": np.nan,

            "vorticity_850": np.nan,
            "vorticity_500": np.nan,

            "rain_1h_change": np.nan,
            "rain_3h_change": np.nan,

            "du_850_500": (
                u850 - u500
                if (
                    not np.isnan(u850)
                    and not np.isnan(u500)
                )
                else np.nan
            ),

            "dv_850_500": (
                v850 - v500
                if (
                    not np.isnan(v850)
                    and not np.isnan(v500)
                )
                else np.nan
            ),
        }

        rows.append(row)

    if not rows:
        raise RuntimeError(
            "Could not construct live feature rows."
        )

    df = pd.DataFrame(rows)

    df = df.sort_values(
        ["latitude", "longitude", "time"]
    ).reset_index(drop=True)

    return df


# ============================================================
# Time-series derived rainfall features
# ============================================================

def add_rainfall_features(df):
    df = df.copy()

    grouped = df.groupby(
        ["latitude", "longitude"],
        group_keys=False,
    )

    # Forecast source provides hourly precipitation.
    # Build 3h and 6h rolling totals over available horizon.
    df["rain_3h"] = (
        grouped["rain_1h"]
        .rolling(3, min_periods=1)
        .sum()
        .reset_index(level=[0, 1], drop=True)
    )

    df["rain_6h"] = (
        grouped["rain_1h"]
        .rolling(6, min_periods=1)
        .sum()
        .reset_index(level=[0, 1], drop=True)
    )

    # 12h/24h are intentionally left unavailable because
    # this live run currently contains only 9 forecast hours.
    df["rain_12h"] = np.nan
    df["rain_24h"] = np.nan

    df["rain_1h_change"] = grouped[
        "rain_1h"
    ].diff()

    df["rain_3h_change"] = grouped[
        "rain_3h"
    ].diff()

    return df


# ============================================================
# Spatial derivatives
# ============================================================

def nearest_value(point_map, lat, lon, direction):
    """
    Find nearest valid neighbour along latitude or longitude.
    Used to estimate spatial derivatives without requiring a
    completely rectangular grid.
    """

    best = None
    best_distance = float("inf")

    if direction == "lat":

        for (p_lat, p_lon), value in point_map.items():

            if abs(p_lon - lon) > 1e-6:
                continue

            distance = abs(p_lat - lat)

            if distance < 1e-9:
                continue

            if np.isnan(value):
                continue

            if distance < best_distance:
                best_distance = distance
                best = (p_lat, value)

    else:

        for (p_lat, p_lon), value in point_map.items():

            if abs(p_lat - lat) > 1e-6:
                continue

            distance = abs(p_lon - lon)

            if distance < 1e-9:
                continue

            if np.isnan(value):
                continue

            if distance < best_distance:
                best_distance = distance
                best = (p_lon, value)

    return best


def spatial_derivatives_at_time(group):
    group = group.copy()

    # Keyed lookups for 850/500 vector fields.
    u850_map = {
        (float(r.latitude), float(r.longitude)):
        safe_float(r.u850)
        for r in group.itertuples()
    }

    v850_map = {
        (float(r.latitude), float(r.longitude)):
        safe_float(r.v850)
        for r in group.itertuples()
    }

    u500_map = {
        (float(r.latitude), float(r.longitude)):
        safe_float(r.u500)
        for r in group.itertuples()
    }

    v500_map = {
        (float(r.latitude), float(r.longitude)):
        safe_float(r.v500)
        for r in group.itertuples()
    }

    earth_radius = 6_371_000.0

    low_conv = []
    vort850 = []
    vort500 = []

    for row in group.itertuples():

        lat = float(row.latitude)
        lon = float(row.longitude)

        key = (lat, lon)

        # -----------------------------------------------
        # dU/dx and dV/dy at 850 hPa
        # -----------------------------------------------

        east = nearest_value(
            u850_map,
            lat,
            lon,
            "lon",
        )

        west = east

        north = nearest_value(
            v850_map,
            lat,
            lon,
            "lat",
        )

        south = north

        if east is not None and west is not None:
            try:
                dx_deg = abs(
                    east[0] - lon
                )

                if dx_deg > 0:
                    dx = (
                        earth_radius
                        *
                        math.cos(
                            math.radians(lat)
                        )
                        *
                        math.radians(dx_deg)
                    )

                    du_dx = (
                        east[1]
                        - u850_map[key]
                    ) / dx

                else:
                    du_dx = np.nan

            except Exception:
                du_dx = np.nan

        else:
            du_dx = np.nan

        if north is not None and south is not None:
            try:
                dy_deg = abs(
                    north[0] - lat
                )

                if dy_deg > 0:
                    dy = (
                        earth_radius
                        * math.radians(dy_deg)
                    )

                    dv_dy = (
                        north[1]
                        - v850_map[key]
                    ) / dy

                else:
                    dv_dy = np.nan

            except Exception:
                dv_dy = np.nan

        else:
            dv_dy = np.nan

        if (
            not np.isnan(du_dx)
            and not np.isnan(dv_dy)
        ):
            convergence = (
                -(du_dx + dv_dy)
            )
        else:
            convergence = np.nan

        low_conv.append(convergence)

        # ------------------------------------------------
        # Vorticity approximation.
        # ------------------------------------------------

        u850_east = nearest_value(
            u850_map,
            lat,
            lon,
            "lon",
        )

        v850_north = nearest_value(
            v850_map,
            lat,
            lon,
            "lat",
        )

        u500_east = nearest_value(
            u500_map,
            lat,
            lon,
            "lon",
        )

        v500_north = nearest_value(
            v500_map,
            lat,
            lon,
            "lat",
        )

        if (
            u850_east is not None
            and v850_north is not None
        ):
            try:
                dx_deg = abs(
                    u850_east[0] - lon
                )
                dy_deg = abs(
                    v850_north[0] - lat
                )

                if dx_deg > 0:
                    dx = (
                        earth_radius
                        *
                        math.cos(
                            math.radians(lat)
                        )
                        *
                        math.radians(dx_deg)
                    )

                    dv_dx = (
                        v850_east[1]
                        if False else np.nan
                    )
                else:
                    dv_dx = np.nan

                # For stability, use available meridional
                # north-neighbour change where possible.
                if dy_deg > 0:
                    dy = (
                        earth_radius
                        * math.radians(dy_deg)
                    )

                    du_dy = (
                        u850_east[1]
                        - u850_map[key]
                    ) / (
                        earth_radius
                        * math.radians(dx_deg)
                    ) if dx_deg > 0 else np.nan

                    # We deliberately keep this conservative.
                    # If required neighbours are unavailable,
                    # model receives NaN.
                else:
                    du_dy = np.nan

                vort850_value = np.nan

            except Exception:
                vort850_value = np.nan

        else:
            vort850_value = np.nan

        # 500 hPa vorticity also kept NaN unless a complete
        # spatial stencil is available.
        vort500_value = np.nan

        vort850.append(vort850_value)
        vort500.append(vort500_value)

    group["low_level_convergence"] = low_conv
    group["vorticity_850"] = vort850
    group["vorticity_500"] = vort500

    return group


def add_spatial_features(df):
    pieces = []

    for time_value, group in df.groupby(
        "time",
        sort=True,
    ):
        pieces.append(
            spatial_derivatives_at_time(group)
        )

    result = pd.concat(
        pieces,
        ignore_index=True,
    )

    return result


# ============================================================
# Prediction
# ============================================================

def predict_for_horizon(
    feature_df,
    models,
    thresholds,
    horizon,
):
    print(
        f"\nRunning AI inference for +{horizon}h..."
    )

    results = []

    # Use the first available forecast timestamp as
    # the current forecast cycle baseline.
    base_time = feature_df["time"].min()

    source_time = base_time

    source_df = feature_df[
        feature_df["time"] == source_time
    ].copy()

    if source_df.empty:
        return results

    X = source_df[FEATURES].astype(
        np.float32
    )

    hazard_probabilities = {}

    for hazard in [
        "thunderstorm",
        "cloudburst",
        "flashflood",
    ]:

        model = models[hazard][horizon]

        probability = model.predict_proba(
            X
        )[:, 1]

        hazard_probabilities[
            hazard
        ] = probability

    target_time = (
        source_time
        + pd.Timedelta(hours=horizon)
    )

    for index, row in source_df.reset_index(
        drop=True
    ).iterrows():

        hazard_data = {}

        for hazard in hazard_probabilities:

            probability = float(
                hazard_probabilities[
                    hazard
                ][index]
            )

            threshold = float(
                thresholds[
                    hazard
                ][horizon]
            )

            hazard_data[hazard] = {
                "probability": probability,
                "probability_percent":
                    round(
                        probability * 100,
                        2,
                    ),
                "threshold": threshold,
                "triggered":
                    bool(
                        probability
                        >= threshold
                    ),
                "risk_level":
                    risk_level(
                        probability
                    ),
            }

        overall_hazard = max(
            hazard_data,
            key=lambda h:
                hazard_data[h]["probability"],
        )

        overall_probability = float(
            hazard_data[
                overall_hazard
            ]["probability"]
        )

        triggered_hazards = [
            hazard
            for hazard, data
            in hazard_data.items()
            if data["triggered"]
        ]

        results.append({
            "forecast_retrieved_at":
                feature_df.attrs.get(
                    "forecast_retrieved_at"
                ),

            "source_forecast_time":
                source_time.to_pydatetime(),

            "target_time":
                target_time.to_pydatetime(),

            "horizon_hours":
                int(horizon),

            "location": {
                "latitude":
                    float(row["latitude"]),
                "longitude":
                    float(row["longitude"]),
            },

            "hazards":
                hazard_data,

            "overall_probability":
                overall_probability,

            "overall_probability_percent":
                round(
                    overall_probability * 100,
                    2,
                ),

            "overall_hazard":
                overall_hazard,

            "overall_risk_level":
                risk_level(
                    overall_probability
                ),

            "triggered_hazards":
                triggered_hazards,

            "live": True,

            "source":
                "Vayunex live forecast + XGBoost",

            "model_type":
                "XGBoost",

            "feature_status": {
                "cin": "missing",
                "blh": "missing",
                "rain_12h":
                    "unavailable_from_9h_window",
                "rain_24h":
                    "unavailable_from_9h_window",
                "spatial_derivatives":
                    "estimated_when_available",
            },
        })

    return results


# ============================================================
# MongoDB writer
# ============================================================

def save_predictions(collection, predictions):
    if not predictions:
        print(
            "No predictions to write."
        )
        return

    operations = []

    for doc in predictions:

        query = {
            "target_time":
                doc["target_time"],

            "horizon_hours":
                doc["horizon_hours"],

            "location.latitude":
                doc["location"]["latitude"],

            "location.longitude":
                doc["location"]["longitude"],
        }

        operations.append(
            UpdateOne(
                query,
                {
                    "$set": doc,
                    "$setOnInsert": {
                        "created_at":
                            datetime.utcnow(),
                    },
                },
                upsert=True,
            )
        )

    result = collection.bulk_write(
        operations,
        ordered=False,
    )

    print("\nMongoDB write:")
    print(
        "  Matched :",
        result.matched_count,
    )
    print(
        "  Modified:",
        result.modified_count,
    )
    print(
        "  Inserted:",
        result.upserted_count,
    )


# ============================================================
# Indexes
# ============================================================

def ensure_indexes(collection):
    collection.create_index(
        [
            ("target_time", 1),
            ("horizon_hours", 1),
            ("location.latitude", 1),
            ("location.longitude", 1),
        ],
        unique=True,
        name="live_ai_unique",
    )

    collection.create_index(
        [("target_time", 1)],
        name="target_time_index",
    )

    collection.create_index(
        [("horizon_hours", 1)],
        name="horizon_index",
    )

    collection.create_index(
        [("overall_probability", -1)],
        name="risk_index",
    )

    collection.create_index(
        [("live", 1)],
        name="live_index",
    )


# ============================================================
# Summary
# ============================================================

def print_summary(
    collection,
    retrieval_time,
):
    print("\n")
    print("=" * 80)
    print("VAYUNEX LIVE AI INFERENCE SUMMARY")
    print("=" * 80)

    print(
        "Forecast retrieval:",
        retrieval_time,
    )

    total = collection.count_documents(
        {"live": True}
    )

    print(
        "Live AI documents:",
        total,
    )

    for horizon in HORIZONS:

        count = collection.count_documents({
            "live": True,
            "horizon_hours": horizon,
        })

        print(
            f"+{horizon}h predictions:",
            count,
        )

    latest = collection.find_one(
        {"live": True},
        sort=[
            ("overall_probability", -1)
        ],
        projection={
            "_id": 0,
            "target_time": 1,
            "horizon_hours": 1,
            "location": 1,
            "hazards": 1,
            "overall_hazard": 1,
            "overall_probability_percent": 1,
            "overall_risk_level": 1,
        },
    )

    if latest:
        print("\nHighest predicted risk:")
        print(
            json.dumps(
                latest,
                indent=2,
                default=str,
            )
        )


# ============================================================
# Main
# ============================================================

def main():

    print("\n")
    print("=" * 80)
    print("VAYUNEX - LIVE AI INFERENCE ENGINE")
    print("=" * 80)

    client = None

    try:

        # -----------------------------------------------
        # Mongo
        # -----------------------------------------------

        print("\nConnecting to MongoDB...")

        client, db = get_mongo()

        input_collection = db[
            INPUT_COLLECTION
        ]

        output_collection = db[
            OUTPUT_COLLECTION
        ]

        print(
            "MongoDB:",
            DB_NAME,
        )

        print(
            "Input collection:",
            INPUT_COLLECTION,
        )

        print(
            "Output collection:",
            OUTPUT_COLLECTION,
        )

        # -----------------------------------------------
        # Models
        # -----------------------------------------------

        models, thresholds = load_models()

        # -----------------------------------------------
        # Live forecast
        # -----------------------------------------------

        retrieval_time, docs = (
            load_latest_live_forecast(
                input_collection
            )
        )

        print(
            "\nLatest live forecast run:",
            retrieval_time,
        )

        print(
            "Documents loaded:",
            len(docs),
        )

        # -----------------------------------------------
        # Build features
        # -----------------------------------------------

        df = build_base_dataframe(
            docs
        )

        print(
            "Feature rows:",
            len(df),
        )

        print(
            "Forecast timestamps:",
            df["time"].nunique(),
        )

        df = add_rainfall_features(
            df
        )

        df = add_spatial_features(
            df
        )

        df.attrs[
            "forecast_retrieved_at"
        ] = retrieval_time

        # -----------------------------------------------
        # Inference
        # -----------------------------------------------

        all_predictions = []

        for horizon in HORIZONS:

            predictions = predict_for_horizon(
                feature_df=df,
                models=models,
                thresholds=thresholds,
                horizon=horizon,
            )

            all_predictions.extend(
                predictions
            )

            print(
                f"+{horizon}h predictions:",
                len(predictions),
            )

        # -----------------------------------------------
        # Write
        # -----------------------------------------------

        print(
            "\nSaving live AI predictions..."
        )

        save_predictions(
            output_collection,
            all_predictions,
        )

        ensure_indexes(
            output_collection
        )

        # -----------------------------------------------
        # Summary
        # -----------------------------------------------

        print_summary(
            output_collection,
            retrieval_time,
        )

        print("\n")
        print("=" * 80)
        print("LIVE AI INFERENCE COMPLETE")
        print("=" * 80)

    except Exception as exc:

        print("\n")
        print("!" * 80)
        print("LIVE AI INFERENCE FAILED")
        print("!" * 80)

        print(
            type(exc).__name__,
            ":",
            exc,
        )

        raise

    finally:

        if client is not None:
            client.close()

        gc.collect()


if __name__ == "__main__":
    main()