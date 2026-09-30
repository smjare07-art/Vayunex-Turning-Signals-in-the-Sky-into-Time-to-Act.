"""
VAYUNEX - LIVE AI INFERENCE V2
GFS -> 40 ML Features -> XGBoost -> 2H/4H/6H -> Risk + Precaution

Source:
    Open-Meteo GFS / NOAA-NCEP NWP forecast

Input MongoDB:
    live_gfs_inputs

Output MongoDB:
    live_ai_predictions

IMPORTANT:
    GFS is NWP forecast data, NOT IMD observation data.
"""

from __future__ import annotations

import json
import math
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING
import xgboost as xgb


# ============================================================
# CONFIG
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH)

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://localhost:27017"
)

DB_NAME = os.getenv(
    "MONGO_DB",
    "vayunex_climateverse"
)

INPUT_COLLECTION = "live_gfs_inputs"
OUTPUT_COLLECTION = "live_ai_predictions"

MODEL_DIR = BASE_DIR / "ML" / "models"

HORIZONS = [2, 4, 6]

HAZARDS = [
    "thunderstorm",
    "cloudburst",
    "flashflood",
]

# Known / calibrated thresholds.
# Metadata values are used first when available.
FALLBACK_THRESHOLDS = {
    "thunderstorm": {
        2: 0.90,
        4: 0.90,
        6: 0.88,
    },
    "cloudburst": {
        2: 0.97,
        4: 0.91,
        6: 0.91,
    },
    "flashflood": {
        2: 0.98,
        4: 0.80,
        6: 0.78,
    },
}

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


# ============================================================
# LOGGING
# ============================================================

def banner(text: str):
    print()
    print("=" * 78)
    print(text)
    print("=" * 78)


# ============================================================
# HELPERS
# ============================================================

def safe_float(value, default=np.nan):
    try:
        if value is None:
            return default

        value = float(value)

        if math.isnan(value) or math.isinf(value):
            return default

        return value

    except Exception:
        return default


def wind_to_uv(speed_kmh, direction_deg) -> Tuple[float, float]:
    """
    Meteorological wind direction:
    direction is the direction FROM which wind blows.

    Convert km/h -> m/s.
    """
    speed_kmh = safe_float(speed_kmh)
    direction_deg = safe_float(direction_deg)

    if np.isnan(speed_kmh) or np.isnan(direction_deg):
        return np.nan, np.nan

    speed_ms = speed_kmh / 3.6
    rad = np.deg2rad(direction_deg)

    u = -speed_ms * np.sin(rad)
    v = -speed_ms * np.cos(rad)

    return u, v


def load_metadata_threshold(
    hazard: str,
    horizon: int
) -> float:

    possible_files = [
        MODEL_DIR / f"{hazard}_{horizon}h_metadata.json",
        MODEL_DIR / f"xgboost_{hazard}_{horizon}h_metadata.json",
        MODEL_DIR / f"{hazard}_{horizon}h_v1_metadata.json",
        MODEL_DIR / f"xgboost_{hazard}_{horizon}h_v1_metadata.json",
    ]

    for path in possible_files:

        try:
            if not path.exists():
                continue

            with open(path, "r", encoding="utf-8") as f:
                meta = json.load(f)

            candidates = [
                meta.get("validation", {}).get("threshold"),
                meta.get("threshold"),
                meta.get("best_threshold"),
            ]

            for value in candidates:
                if value is not None:
                    return float(value)

        except Exception as exc:
            print(
                f"  Metadata warning "
                f"{path.name}: {exc}"
            )

    return FALLBACK_THRESHOLDS[hazard][horizon]

def find_model_file(hazard: str, horizon: int) -> Path | None:
    candidates = [
        MODEL_DIR / f"xgboost_{hazard}_{horizon}h.json",
        MODEL_DIR / f"xgboost_{hazard}_{horizon}h_v1.json",
        MODEL_DIR / f"xgboost_{hazard}_{horizon}h_v2.json",
        MODEL_DIR / f"xgboost_{hazard}_{horizon}h_v3.json",
    ]

    for path in candidates:
        if path.exists():
            return path

    return None


def find_feature_file(hazard: str, horizon: int) -> Path | None:

    candidates = [
        MODEL_DIR / f"xgboost_{hazard}_{horizon}h_features.pkl",
        MODEL_DIR / f"xgboost_{hazard}_{horizon}h_features.pickle",
        MODEL_DIR / f"{hazard}_{horizon}h_features.pkl",
    ]

    for path in candidates:
        if path.exists():
            return path

    return None


# ============================================================
# MODEL LOADING
# ============================================================

def load_models():

    models = {}
    thresholds = {}
    feature_lists = {}

    banner("LOADING VAYUNEX XGBOOST MODELS")

    for hazard in HAZARDS:

        for horizon in HORIZONS:

            model_path = find_model_file(hazard, horizon)

            if model_path is None:
                print(
                    f"[WARNING] Missing model: "
                    f"{hazard} {horizon}H"
                )
                continue

            model = xgb.XGBClassifier()
            model.load_model(str(model_path))

            feature_path = find_feature_file(
                hazard,
                horizon
            )

            if feature_path and feature_path.exists():

                try:
                    features = joblib.load(feature_path)

                    if isinstance(features, dict):
                        features = (
                            features.get("features")
                            or features.get("feature_names")
                        )

                    if features:
                        feature_lists[
                            (hazard, horizon)
                        ] = list(features)

                except Exception as exc:
                    print(
                        f"  Feature file warning: {exc}"
                    )

            if (hazard, horizon) not in feature_lists:
                feature_lists[
                    (hazard, horizon)
                ] = FEATURES.copy()

            threshold = load_metadata_threshold(
                hazard,
                horizon
            )

            models[(hazard, horizon)] = model
            thresholds[(hazard, horizon)] = threshold

            print(
                f"  {hazard:<14} "
                f"{horizon}H   "
                f"threshold={threshold:.3f}"
            )

    print(
        f"\nLoaded models: {len(models)}/18"
    )

    return models, thresholds, feature_lists


# ============================================================
# LOAD GFS DATA
# ============================================================

def load_gfs_dataframe(collection):

    docs = list(
        collection.find(
            {
                "live": True,
                "model": "GFS",
            },
            {
                "_id": 0,
                "time": 1,
                "latitude": 1,
                "longitude": 1,
                "variables": 1,
                "forecast_retrieved_at": 1,
            }
        ).sort("time", ASCENDING)
    )

    if not docs:
        raise RuntimeError(
            "No live GFS documents found."
        )

    rows = []

    for doc in docs:

        variables = doc.get("variables", {})

        row = {
            "time": pd.to_datetime(
                doc.get("time")
            ),

            "latitude": safe_float(
                doc.get("latitude")
            ),

            "longitude": safe_float(
                doc.get("longitude")
            ),

            "forecast_retrieved_at":
                doc.get("forecast_retrieved_at"),
        }

        for key, value in variables.items():
            row[key] = safe_float(value)

        rows.append(row)

    df = pd.DataFrame(rows)

    df = df.sort_values(
        ["latitude", "longitude", "time"]
    ).reset_index(drop=True)

    return df


# ============================================================
# SELECT CURRENT / BASE TIME
# ============================================================

def choose_base_time(df: pd.DataFrame) -> pd.Timestamp:
    """
    GFS timestamps are stored as naive India-local timestamps
    from the ingestion pipeline.

    Choose the latest GFS timestamp that is not in the future
    relative to current India time.
    """

    now_local = pd.Timestamp.now(
        tz="Asia/Kolkata"
    ).tz_localize(None)

    available = (
        df["time"]
        .dropna()
        .drop_duplicates()
        .sort_values()
    )

    past = available[
        available <= now_local
    ]

    if not past.empty:
        return past.iloc[-1]

    return available.iloc[-1]


# ============================================================
# FEATURE ENGINEERING
# ============================================================

def add_basic_features(df):

    # --------------------------------------------------------
    # Near surface wind
    # --------------------------------------------------------

    uv = df.apply(
        lambda r: wind_to_uv(
            r.get("wind_speed_10m"),
            r.get("wind_direction_10m"),
        ),
        axis=1,
        result_type="expand"
    )

    df["u10"] = uv[0]
    df["v10"] = uv[1]

    df["wind_speed_10m"] = (
        df["wind_speed_10m"] / 3.6
    )

    # --------------------------------------------------------
    # Temperature
    # --------------------------------------------------------

    df["temperature_c"] = df[
        "temperature_2m"
    ]

    df["dewpoint_c"] = df[
        "dew_point_2m"
    ]

    df["t2m"] = (
        df["temperature_2m"] + 273.15
    )

    df["d2m"] = (
        df["dew_point_2m"] + 273.15
    )

    df["dewpoint_depression"] = (
        df["temperature_c"]
        - df["dewpoint_c"]
    )

    df["temperature_dewpoint_diff"] = (
        df["temperature_c"]
        - df["dewpoint_c"]
    )

    # --------------------------------------------------------
    # Precipitation
    # --------------------------------------------------------

    df["precipitation_mm"] = (
        df["precipitation"].clip(lower=0)
    )

    df["tp"] = (
        df["precipitation_mm"] / 1000.0
    )

    # --------------------------------------------------------
    # Pressure
    # --------------------------------------------------------

    df["surface_pressure_hpa"] = (
        df["surface_pressure"]
    )

    df["sp"] = (
        df["surface_pressure_hpa"] * 100.0
    )

    # --------------------------------------------------------
    # Atmospheric variables
    # --------------------------------------------------------

    df["cape"] = df["cape"]
    df["cin"] = df["convective_inhibition"]
    df["tcwv"] = df[
        "total_column_integrated_water_vapour"
    ]
    df["blh"] = df[
        "boundary_layer_height"
    ]

    df["relative_humidity"] = df[
        "relative_humidity_2m"
    ]

    # --------------------------------------------------------
    # 850 / 500 wind
    # --------------------------------------------------------

    uv850 = df.apply(
        lambda r: wind_to_uv(
            r.get("wind_speed_850hPa"),
            r.get("wind_direction_850hPa"),
        ),
        axis=1,
        result_type="expand"
    )

    df["u850"] = uv850[0]
    df["v850"] = uv850[1]

    uv500 = df.apply(
        lambda r: wind_to_uv(
            r.get("wind_speed_500hPa"),
            r.get("wind_direction_500hPa"),
        ),
        axis=1,
        result_type="expand"
    )

    df["u500"] = uv500[0]
    df["v500"] = uv500[1]

    df["wind_speed_850"] = (
        df["wind_speed_850hPa"] / 3.6
    )

    df["wind_speed_500"] = (
        df["wind_speed_500hPa"] / 3.6
    )

    df["wind_direction_850"] = (
        df["wind_direction_850hPa"]
    )

    df["wind_direction_500"] = (
        df["wind_direction_500hPa"]
    )

    # --------------------------------------------------------
    # Vertical wind shear
    # --------------------------------------------------------

    du = df["u500"] - df["u850"]
    dv = df["v500"] - df["v850"]

    df["du_850_500"] = du
    df["dv_850_500"] = dv

    df["vertical_wind_shear_850_500"] = (
        np.sqrt(
            du ** 2 +
            dv ** 2
        )
    )

    return df


# ============================================================
# RAINFALL FEATURES
# ============================================================

def add_rainfall_features(df):

    df = df.sort_values(
        ["latitude", "longitude", "time"]
    )

    grouped = df.groupby(
        ["latitude", "longitude"],
        group_keys=False
    )

    # Current rainfall
    current_rain = (
        df["precipitation_mm"]
        .fillna(0)
        .clip(lower=0)
    )

    df["rain_1h"] = current_rain

    # Rolling rainfall
    for hours in [3, 6, 12, 24]:

        name = f"rain_{hours}h"

        df[name] = (
            grouped["precipitation_mm"]
            .transform(
                lambda s:
                s.fillna(0)
                .rolling(
                    hours,
                    min_periods=1
                )
                .sum()
            )
        )

    # Changes
    grouped_rain = grouped[
        "precipitation_mm"
    ]

    df["rain_1h_change"] = (
        grouped_rain
        .diff(1)
        .fillna(0)
    )

    df["rain_3h_change"] = (
        df["rain_3h"]
        -
        grouped["rain_3h"]
        .shift(1)
        .fillna(df["rain_3h"])
    )

    # Replace negative accumulation changes
    df["rain_1h_change"] = (
        df["rain_1h_change"]
        .clip(lower=-100, upper=100)
    )

    df["rain_3h_change"] = (
        df["rain_3h_change"]
        .clip(lower=-100, upper=100)
    )

    return df


# ============================================================
# SPATIAL DERIVATIVES
# ============================================================

def estimate_spatial_derivatives(
    df: pd.DataFrame
) -> pd.DataFrame:

    df = df.copy()

    df["low_level_convergence"] = np.nan
    df["vorticity_850"] = np.nan
    df["vorticity_500"] = np.nan

    # Convert approximate degree spacing -> metres
    lat_rad = np.deg2rad(
        df["latitude"].to_numpy()
    )

    lon_scale = (
        111_320.0
        * np.cos(lat_rad)
    )

    lat_scale = np.full(
        len(df),
        111_320.0
    )

    # Work timestamp by timestamp
    for timestamp, idx in df.groupby(
        "time"
    ).groups.items():

        block = df.loc[idx].copy()

        if len(block) < 3:
            continue

        coords = np.column_stack(
            [
                block["latitude"].to_numpy()
                * 111_320.0,
                block["longitude"].to_numpy()
                * (
                    111_320.0
                    * np.cos(
                        np.deg2rad(
                            block["latitude"]
                        )
                    )
                ),
            ]
        )

        values = {
            "u850": block["u850"].to_numpy(),
            "v850": block["v850"].to_numpy(),
            "u500": block["u500"].to_numpy(),
            "v500": block["v500"].to_numpy(),
        }

        n = len(block)

        convergence = np.full(
            n,
            np.nan
        )

        vort850 = np.full(
            n,
            np.nan
        )

        vort500 = np.full(
            n,
            np.nan
        )

        for i in range(n):

            diff = (
                coords -
                coords[i]
            )

            distances = np.sqrt(
                np.sum(
                    diff ** 2,
                    axis=1
                )
            )

            distances[i] = np.inf

            neighbour_ids = np.argsort(
                distances
            )[:8]

            neighbour_ids = [
                j for j in neighbour_ids
                if np.isfinite(
                    distances[j]
                )
            ]

            if len(neighbour_ids) < 2:
                continue

            du_dx = []
            dv_dy = []
            dv_dx = []
            du_dy = []

            for j in neighbour_ids:

                dx = diff[j, 0]
                dy = diff[j, 1]

                if (
                    abs(dx) < 1.0
                    or abs(dy) < 1.0
                ):
                    continue

                du850 = (
                    values["u850"][j]
                    -
                    values["u850"][i]
                )

                dv850 = (
                    values["v850"][j]
                    -
                    values["v850"][i]
                )

                du500 = (
                    values["u500"][j]
                    -
                    values["u500"][i]
                )

                dv500 = (
                    values["v500"][j]
                    -
                    values["v500"][i]
                )

                du_dx.append(
                    du850 / dx
                )

                dv_dy.append(
                    dv850 / dy
                )

                dv_dx.append(
                    dv850 / dx
                )

                du_dy.append(
                    du850 / dy
                )

                # 500 hPa vorticity
                # stored separately
                # using same neighbour geometry
                # below
                # ---------------------------------

                # 500 derivatives handled from
                # separate arrays
                # ---------------------------------

            if du_dx and dv_dy:

                div850 = (
                    np.nanmean(du_dx)
                    +
                    np.nanmean(dv_dy)
                )

                convergence[i] = -div850

                vort850[i] = (
                    np.nanmean(dv_dx)
                    -
                    np.nanmean(du_dy)
                )

            # 500 hPa vorticity
            dv_dx_500 = []
            du_dy_500 = []

            for j in neighbour_ids:

                dx = diff[j, 0]
                dy = diff[j, 1]

                if (
                    abs(dx) < 1.0
                    or abs(dy) < 1.0
                ):
                    continue

                dv500 = (
                    values["v500"][j]
                    -
                    values["v500"][i]
                )

                du500 = (
                    values["u500"][j]
                    -
                    values["u500"][i]
                )

                dv_dx_500.append(
                    dv500 / dx
                )

                du_dy_500.append(
                    du500 / dy
                )

            if (
                dv_dx_500
                and du_dy_500
            ):

                vort500[i] = (
                    np.nanmean(
                        dv_dx_500
                    )
                    -
                    np.nanmean(
                        du_dy_500
                    )
                )

        df.loc[
            block.index,
            "low_level_convergence"
        ] = convergence

        df.loc[
            block.index,
            "vorticity_850"
        ] = vort850

        df.loc[
            block.index,
            "vorticity_500"
        ] = vort500

    # Spatial derivative estimates can be noisy.
    # Missing values are safely zero-filled because
    # models were trained with finite numeric inputs.
    for col in [
        "low_level_convergence",
        "vorticity_850",
        "vorticity_500",
    ]:
        df[col] = (
            df[col]
            .replace(
                [np.inf, -np.inf],
                np.nan
            )
            .fillna(0.0)
        )

    return df


# ============================================================
# FINAL FEATURE MATRIX
# ============================================================

def finalize_features(df):

    # Required output columns
    for col in FEATURES:
        if col not in df.columns:
            df[col] = 0.0

    # Ensure numeric
    for col in FEATURES:
        df[col] = pd.to_numeric(
            df[col],
            errors="coerce"
        )

    # Replace infinities
    df[FEATURES] = (
        df[FEATURES]
        .replace(
            [np.inf, -np.inf],
            np.nan
        )
    )

    # Temporal/spatial derivatives may have unavoidable
    # missing values at boundaries.
    df[FEATURES] = (
        df[FEATURES]
        .fillna(0.0)
    )

    return df


# ============================================================
# RISK ENGINE
# ============================================================

def risk_level(probability: float, threshold: float):

    probability = float(
        max(0.0, min(1.0, probability))
    )

    threshold = float(
        max(0.0001, threshold)
    )

    ratio = probability / threshold

    if ratio < 0.25:
        return "LOW"

    if ratio < 0.50:
        return "MODERATE"

    if ratio < 1.00:
        return "HIGH"

    return "EXTREME"


def hazard_precaution(
    hazard: str,
    risk: str
) -> str:

    if risk == "LOW":
        return (
            "No immediate precaution required. "
            "Continue monitoring updated Vayunex predictions."
        )

    if hazard == "thunderstorm":

        if risk == "MODERATE":
            return (
                "Stay alert to changing weather. "
                "Avoid exposed open areas during thunder activity "
                "and secure loose outdoor objects."
            )

        if risk == "HIGH":
            return (
                "Move indoors when thunder activity approaches. "
                "Avoid open fields, hilltops and isolated trees. "
                "Secure loose objects and electrical equipment."
            )

        return (
            "Severe thunderstorm risk is elevated. "
            "Stay indoors, avoid open areas and isolated trees, "
            "and follow official local weather alerts."
        )

    if hazard == "cloudburst":

        if risk == "MODERATE":
            return (
                "Avoid unnecessary travel near drainage channels "
                "and low-lying areas. Monitor rainfall changes."
            )

        if risk == "HIGH":
            return (
                "Avoid low-lying locations and storm-water drains. "
                "Do not drive through rapidly accumulating water."
            )

        return (
            "High cloudburst risk. Move away from low-lying and "
            "poor-drainage areas, avoid flooded roads, and follow "
            "official local authority instructions."
        )

    if hazard == "flashflood":

        if risk == "MODERATE":
            return (
                "Avoid streams, drainage channels and underpasses. "
                "Be prepared to move to safer elevated ground."
            )

        if risk == "HIGH":
            return (
                "Avoid flooded roads, bridges and flowing water. "
                "Move toward safer elevated locations if water rises."
            )

        return (
            "High flash-flood risk. Move to higher ground, "
            "never cross flowing water, avoid bridges and "
            "low-lying roads, and follow official authority alerts."
        )

    return (
        "Monitor weather conditions and follow official alerts."
    )


# ============================================================
# OVERALL RISK
# ============================================================

def overall_risk(results: Dict) -> str:

    levels = {
        "LOW": 0,
        "MODERATE": 1,
        "HIGH": 2,
        "EXTREME": 3,
    }

    max_level = 0

    for hazard in HAZARDS:

        risk = results.get(
            hazard,
            {}
        ).get(
            "risk",
            "LOW"
        )

        max_level = max(
            max_level,
            levels.get(risk, 0)
        )

    reverse = {
        0: "LOW",
        1: "MODERATE",
        2: "HIGH",
        3: "EXTREME",
    }

    return reverse[max_level]


# ============================================================
# MAIN
# ============================================================

def main():

    banner(
        "VAYUNEX - LIVE AI INFERENCE V2"
    )

    print(
        f"Base directory : {BASE_DIR}"
    )

    print(
        f"MongoDB        : {DB_NAME}"
    )

    print(
        f"Model directory: {MODEL_DIR}"
    )

    # --------------------------------------------------------
    # Mongo
    # --------------------------------------------------------

    banner("CONNECTING TO MONGODB")

    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=10000
    )

    db = client[DB_NAME]

    input_collection = db[
        INPUT_COLLECTION
    ]

    output_collection = db[
        OUTPUT_COLLECTION
    ]

    client.admin.command(
        "ping"
    )

    print(
        "MongoDB connection: OK"
    )

    print(
        f"Input collection : "
        f"{INPUT_COLLECTION}"
    )

    print(
        f"Output collection: "
        f"{OUTPUT_COLLECTION}"
    )

    # --------------------------------------------------------
    # Load models
    # --------------------------------------------------------

    models, thresholds, feature_lists = (
        load_models()
    )

    if not models:
        raise RuntimeError(
            "No XGBoost models found."
        )

    # --------------------------------------------------------
    # Load GFS
    # --------------------------------------------------------

    banner(
        "LOADING LIVE GFS INPUTS"
    )

    df = load_gfs_dataframe(
        input_collection
    )

    print(
        f"GFS documents : {len(df):,}"
    )

    print(
        f"Grid cells     : "
        f"{df[['latitude','longitude']].drop_duplicates().shape[0]}"
    )

    print(
        f"Timestamps     : "
        f"{df['time'].nunique()}"
    )

    print(
        f"First time     : "
        f"{df['time'].min()}"
    )

    print(
        f"Last time      : "
        f"{df['time'].max()}"
    )

    # --------------------------------------------------------
    # Base/current time
    # --------------------------------------------------------

    base_time = choose_base_time(df)

    print(
        f"\nCurrent/base GFS time: "
        f"{base_time}"
    )

    max_target_time = (
        base_time
        + pd.Timedelta(hours=max(HORIZONS))
    )

    available_targets = [
        base_time + pd.Timedelta(
            hours=h
        )
        for h in HORIZONS
        if (
            base_time
            + pd.Timedelta(hours=h)
        ) <= df["time"].max()
    ]

    print(
        "Target times:"
    )

    for target in available_targets:
        print(
            f"  {target}"
        )

    # --------------------------------------------------------
    # Feature engineering
    # --------------------------------------------------------

    banner(
        "BUILDING 40 ML FEATURES"
    )

    df = add_basic_features(
        df
    )

    df = add_rainfall_features(
        df
    )

    df = estimate_spatial_derivatives(
        df
    )

    df = finalize_features(
        df
    )

    print(
        f"Feature columns available: "
        f"{len([c for c in FEATURES if c in df.columns])}/40"
    )

    missing_features = [
        c for c in FEATURES
        if c not in df.columns
    ]

    if missing_features:
        print(
            "Missing features:"
        )

        for feature in missing_features:
            print(
                f"  - {feature}"
            )

    # --------------------------------------------------------
    # Current predictor frame
    # --------------------------------------------------------

    current = df[
        df["time"] == base_time
    ].copy()

    if current.empty:
        raise RuntimeError(
            f"No predictor rows at base time "
            f"{base_time}"
        )

    print(
        f"\nCurrent predictor cells: "
        f"{len(current)}"
    )

    # --------------------------------------------------------
    # Run all horizons
    # --------------------------------------------------------

    banner(
        "RUNNING LIVE AI PREDICTIONS"
    )

    prediction_docs = []

    for horizon in HORIZONS:

        target_time = (
            base_time
            + pd.Timedelta(hours=horizon)
        )

        print()
        print(
            f"----- +{horizon}H -----"
        )

        for hazard in HAZARDS:

            key = (
                hazard,
                horizon
            )

            model = models.get(key)

            if model is None:
                print(
                    f"  {hazard:<14} "
                    f"MODEL MISSING"
                )
                continue

            threshold = thresholds[key]

            model_features = (
                feature_lists.get(
                    key,
                    FEATURES
                )
            )

            X = (
                current
                .reindex(
                    columns=model_features
                )
                .fillna(0.0)
            )

            probabilities = model.predict_proba(
                X
            )[:, 1]

            probability_count = len(
                probabilities
            )

            print(
                f"  {hazard:<14} "
                f"cells={probability_count:<4} "
                f"threshold={threshold:.3f} "
                f"max={np.max(probabilities):.4f} "
                f"mean={np.mean(probabilities):.4f}"
            )

            for idx, probability in zip(
                current.index,
                probabilities
            ):

                row = current.loc[idx]

                probability = float(
                    max(
                        0.0,
                        min(
                            1.0,
                            probability
                        )
                    )
                )

                risk = risk_level(
                    probability,
                    threshold
                )

                # Store one document per
                # location + horizon
                prediction_docs.append(
                    {
                        "time": pd.Timestamp(
                            base_time
                        ).to_pydatetime(),

                        "target_time":
                            pd.Timestamp(
                                target_time
                            ).to_pydatetime(),

                        "latitude":
                            float(
                                row["latitude"]
                            ),

                        "longitude":
                            float(
                                row["longitude"]
                            ),

                        "horizon_hours":
                            horizon,

                        "hazard":
                            hazard,

                        "probability":
                            probability,

                        "threshold":
                            float(threshold),

                        "risk":
                            risk,

                        "precaution":
                            hazard_precaution(
                                hazard,
                                risk
                            ),

                        "source":
                            "Open-Meteo GFS",

                        "source_type":
                            "NWP_FORECAST",

                        "model":
                            "GFS",

                        "ai_model":
                            f"xgboost_{hazard}_{horizon}h",

                        "live":
                            True,

                        "generated_at":
                            datetime.utcnow(),

                        "forecast_retrieved_at":
                            row.get(
                                "forecast_retrieved_at"
                            ),

                        "feature_version":
                            "gfs_v2_40features",
                    }
                )

    # --------------------------------------------------------
    # Save predictions
    # --------------------------------------------------------

    banner(
        "WRITING LIVE AI PREDICTIONS"
    )

    if not prediction_docs:
        raise RuntimeError(
            "No prediction documents generated."
        )

    # Replace same base-time/horizon/hazard
    # to keep current live state clean.
    base_dt = pd.Timestamp(
        base_time
    ).to_pydatetime()

    output_collection.delete_many(
        {
            "live": True,
            "time": base_dt,
        }
    )

    result = output_collection.insert_many(
        prediction_docs,
        ordered=False
    )

    print(
        f"Inserted: {len(result.inserted_ids):,}"
    )

    # --------------------------------------------------------
    # Indexes
    # --------------------------------------------------------

    output_collection.create_index(
        [
            ("live", ASCENDING),
            ("horizon_hours", ASCENDING),
            ("hazard", ASCENDING),
            ("time", DESCENDING),
        ]
    )

    output_collection.create_index(
        [
            ("latitude", ASCENDING),
            ("longitude", ASCENDING),
            ("horizon_hours", ASCENDING),
            ("hazard", ASCENDING),
        ]
    )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    banner(
        "VAYUNEX LIVE AI VERIFICATION"
    )

    total = output_collection.count_documents(
        {
            "live": True,
            "time": base_dt,
        }
    )

    print(
        f"Prediction documents : {total:,}"
    )

    print(
        f"Expected              : "
        f"{len(current) * len(HORIZONS) * len(HAZARDS):,}"
    )

    for horizon in HORIZONS:

        print()
        print(
            f"+{horizon}H SUMMARY"
        )

        horizon_docs = list(
            output_collection.find(
                {
                    "live": True,
                    "time": base_dt,
                    "horizon_hours": horizon,
                },
                {
                    "_id": 0,
                    "hazard": 1,
                    "probability": 1,
                    "risk": 1,
                }
            )
        )

        for hazard in HAZARDS:

            subset = [
                d for d in horizon_docs
                if d["hazard"] == hazard
            ]

            if not subset:
                continue

            probs = [
                d["probability"]
                for d in subset
            ]

            counts = {}

            for d in subset:
                counts[d["risk"]] = (
                    counts.get(
                        d["risk"],
                        0
                    ) + 1
                )

            print(
                f"  {hazard:<14} "
                f"max={max(probs):.4f} "
                f"mean={np.mean(probs):.4f} "
                f"risk_cells={counts}"
            )

    # --------------------------------------------------------
    # Sample
    # --------------------------------------------------------

    sample = output_collection.find_one(
        {
            "live": True,
            "time": base_dt,
        },
        {
            "_id": 0
        }
    )

    print()
    print(
        "Sample prediction:"
    )

    print(
        json.dumps(
            sample,
            default=str,
            indent=2
        )
    )

    client.close()

    banner(
        "LIVE AI INFERENCE V2 COMPLETE ✅"
    )


if __name__ == "__main__":
    main()