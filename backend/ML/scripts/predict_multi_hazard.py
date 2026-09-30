import os
import json
import pickle
import warnings

import numpy as np
import pandas as pd
import xarray as xr
import xgboost as xgb

warnings.filterwarnings("ignore")


# ============================================================
# CONFIG
# ============================================================

BASE_DIR = r"C:\ClimateVerse-AI"

DATA_FILE = os.path.join(
    BASE_DIR,
    "data",
    "processed",
    "era5",
    "maharashtra_era5_engineered.nc"
)

MODEL_DIR = os.path.join(BASE_DIR, "models")
OUTPUT_DIR = os.path.join(BASE_DIR, "prediction")

THUNDER_MODEL = os.path.join(
    MODEL_DIR,
    "xgboost_thunderstorm_2h_v2.json"
)

THUNDER_FEATURES = os.path.join(
    MODEL_DIR,
    "thunderstorm_2h_v2_features.pkl"
)

CLOUDBURST_MODEL = os.path.join(
    MODEL_DIR,
    "xgboost_cloudburst_2h.json"
)

CLOUDBURST_FEATURES = os.path.join(
    MODEL_DIR,
    "cloudburst_2h_features.pkl"
)

FLASHFLOOD_MODEL = os.path.join(
    MODEL_DIR,
    "xgboost_flashflood_2h.json"
)

FLASHFLOOD_FEATURES = os.path.join(
    MODEL_DIR,
    "flashflood_2h_features.pkl"
)

JSON_OUTPUT = os.path.join(
    OUTPUT_DIR,
    "final_multi_hazard_predictions.json"
)

CSV_OUTPUT = os.path.join(
    OUTPUT_DIR,
    "final_multi_hazard_predictions.csv"
)

PARQUET_OUTPUT = os.path.join(
    OUTPUT_DIR,
    "final_multi_hazard_predictions.parquet"
)


# ============================================================
# RISK FUNCTION
# ============================================================

def get_risk(probability, threshold):
    """
    Convert ML probability into risk level.
    """

    if probability >= threshold:
        return "VERY HIGH"

    elif probability >= threshold * 0.75:
        return "HIGH"

    elif probability >= threshold * 0.50:
        return "MEDIUM"

    else:
        return "LOW"


# ============================================================
# LOAD MODEL + FEATURES
# ============================================================

def load_model(model_path, feature_path):

    print(f"\nLoading model:")
    print(model_path)

    model = xgb.XGBClassifier()
    model.load_model(model_path)

    with open(feature_path, "rb") as f:
        features = pickle.load(f)

    return model, features


# ============================================================
# MAIN
# ============================================================

print("=" * 75)
print("          CLIMATEVERSE AI - MULTI HAZARD PREDICTION")
print("=" * 75)


# ============================================================
# CHECK FILES
# ============================================================

required_files = [
    DATA_FILE,
    THUNDER_MODEL,
    THUNDER_FEATURES,
    CLOUDBURST_MODEL,
    CLOUDBURST_FEATURES,
    FLASHFLOOD_MODEL,
    FLASHFLOOD_FEATURES,
]

for file in required_files:

    if not os.path.exists(file):

        raise FileNotFoundError(
            f"\nRequired file not found:\n{file}"
        )


# ============================================================
# LOAD ERA5
# ============================================================

print("\nLoading ERA5 dataset...")

ds = xr.open_dataset(DATA_FILE)

print("\nDataset dimensions:")
print(ds.dims)


# ============================================================
# LOAD MODELS
# ============================================================

thunder_model, thunder_features = load_model(
    THUNDER_MODEL,
    THUNDER_FEATURES
)

cloudburst_model, cloudburst_features = load_model(
    CLOUDBURST_MODEL,
    CLOUDBURST_FEATURES
)

flashflood_model, flashflood_features = load_model(
    FLASHFLOOD_MODEL,
    FLASHFLOOD_FEATURES
)


# ============================================================
# FEATURE CONSISTENCY CHECK
# ============================================================

print("\n" + "=" * 75)
print("FEATURE VALIDATION")
print("=" * 75)

print(
    f"Thunderstorm features : {len(thunder_features)}"
)

print(
    f"Cloudburst features   : {len(cloudburst_features)}"
)

print(
    f"Flash Flood features  : {len(flashflood_features)}"
)


# ============================================================
# USE THUNDERSTORM FEATURE LIST AS MASTER
# ============================================================

FEATURES = list(thunder_features)


if list(cloudburst_features) != FEATURES:

    raise ValueError(
        "\nCloudburst feature order does not match Thunderstorm feature order."
    )


if list(flashflood_features) != FEATURES:

    raise ValueError(
        "\nFlash Flood feature order does not match Thunderstorm feature order."
    )


# ============================================================
# CHECK DATASET FEATURES
# ============================================================

missing_features = [
    feature
    for feature in FEATURES
    if feature not in ds.data_vars
]

if missing_features:

    print("\nMissing features:")

    for feature in missing_features:
        print(" -", feature)

    raise ValueError(
        "\nERA5 dataset does not contain all required features."
    )


print("\nAll 40 features are available.")


# ============================================================
# CONVERT TO DATAFRAME
# ============================================================

print("\nConverting ERA5 data...")

df = ds[FEATURES].to_dataframe().reset_index()

print(
    f"Total prediction rows: {len(df):,}"
)


# ============================================================
# NUMERIC CLEANUP
# ============================================================

print("\nCleaning feature data...")

X = df[FEATURES].copy()

X = X.replace(
    [np.inf, -np.inf],
    np.nan
)

missing_count = int(X.isna().sum().sum())

print(
    f"Missing feature values: {missing_count:,}"
)


# ============================================================
# MEDIAN IMPUTATION
# ============================================================

if missing_count > 0:

    medians = X.median()

    X = X.fillna(medians)


# ============================================================
# FINAL CHECK
# ============================================================

if X.isna().sum().sum() > 0:

    raise ValueError(
        "\nMissing values still exist after imputation."
    )


# ============================================================
# PREDICTION
# ============================================================

print("\n" + "=" * 75)
print("RUNNING MULTI-HAZARD PREDICTION")
print("=" * 75)


print("\n1/3 Predicting Thunderstorm...")

thunder_probability = (
    thunder_model.predict_proba(X)[:, 1]
)


print("2/3 Predicting Cloudburst...")

cloudburst_probability = (
    cloudburst_model.predict_proba(X)[:, 1]
)


print("3/3 Predicting Flash Flood...")

flashflood_probability = (
    flashflood_model.predict_proba(X)[:, 1]
)


# ============================================================
# THRESHOLDS
# ============================================================

THUNDER_THRESHOLD = 0.50
CLOUDBURST_THRESHOLD = 0.97
FLASHFLOOD_THRESHOLD = 0.98


# ============================================================
# OUTPUT DATAFRAME
# ============================================================
# ============================================================
# HANDLE TIME COLUMN
# ============================================================

if "valid_time" in df.columns:
    time_column = "valid_time"
elif "time" in df.columns:
    time_column = "time"
else:
    raise ValueError(
        "No time column found in ERA5 dataset."
    )


result = df[
    [
        time_column,
        "latitude",
        "longitude"
    ]
].copy()

# Keep a standard column name for output
result = result.rename(
    columns={time_column: "time"}
)


# ============================================================
# PROBABILITIES
# ============================================================

result["thunderstorm_probability"] = (
    thunder_probability
)

result["cloudburst_probability"] = (
    cloudburst_probability
)

result["flashflood_probability"] = (
    flashflood_probability
)


# ============================================================
# PERCENTAGES
# ============================================================

result["thunderstorm_probability_percent"] = (
    thunder_probability * 100
)

result["cloudburst_probability_percent"] = (
    cloudburst_probability * 100
)

result["flashflood_probability_percent"] = (
    flashflood_probability * 100
)


# ============================================================
# BINARY PREDICTIONS
# ============================================================

result["thunderstorm_prediction"] = (
    thunder_probability >= THUNDER_THRESHOLD
).astype(int)

result["cloudburst_prediction"] = (
    cloudburst_probability >= CLOUDBURST_THRESHOLD
).astype(int)

result["flashflood_prediction"] = (
    flashflood_probability >= FLASHFLOOD_THRESHOLD
).astype(int)


# ============================================================
# RISK LEVEL
# ============================================================

result["thunderstorm_risk"] = [
    get_risk(p, THUNDER_THRESHOLD)
    for p in thunder_probability
]

result["cloudburst_risk"] = [
    get_risk(p, CLOUDBURST_THRESHOLD)
    for p in cloudburst_probability
]

result["flashflood_risk"] = [
    get_risk(p, FLASHFLOOD_THRESHOLD)
    for p in flashflood_probability
]


# ============================================================
# OVERALL HAZARD
# ============================================================

result["overall_probability"] = np.maximum.reduce(
    [
        thunder_probability,
        cloudburst_probability,
        flashflood_probability
    ]
)


result["overall_hazard"] = np.select(
    [
        result["flashflood_probability"]
        >= result["overall_probability"],

        result["cloudburst_probability"]
        >= result["overall_probability"],

        result["thunderstorm_probability"]
        >= result["overall_probability"]
    ],
    [
        "FLASH FLOOD",
        "CLOUDBURST",
        "THUNDERSTORM"
    ],
    default="NONE"
)


# ============================================================
# SAVE CSV
# ============================================================

print("\nSaving CSV...")

result.to_csv(
    CSV_OUTPUT,
    index=False
)


# ============================================================
# SAVE PARQUET
# ============================================================

print("Saving Parquet...")

try:

    result.to_parquet(
        PARQUET_OUTPUT,
        index=False
    )

except Exception as e:

    print(
        "Parquet save skipped:",
        e
    )


# ============================================================
# TOP RISK POINT
# ============================================================

max_index = result[
    "overall_probability"
].idxmax()

top = result.loc[max_index]


# ============================================================
# SUMMARY
# ============================================================

summary = {

    "model": "ClimateVerse AI Multi-Hazard XGBoost",

    "hazards": [
        "Thunderstorm 2H",
        "Cloudburst 2H",
        "Flash Flood 2H"
    ],

    "total_predictions": int(len(result)),

    "positive_predictions": {

        "thunderstorm": int(
            result["thunderstorm_prediction"].sum()
        ),

        "cloudburst": int(
            result["cloudburst_prediction"].sum()
        ),

        "flashflood": int(
            result["flashflood_prediction"].sum()
        )
    },

    "thresholds": {

        "thunderstorm": THUNDER_THRESHOLD,

        "cloudburst": CLOUDBURST_THRESHOLD,

        "flashflood": FLASHFLOOD_THRESHOLD
    },

    "highest_risk_point": {

        "time": str(top["time"]),

        "latitude": float(top["latitude"]),

        "longitude": float(top["longitude"]),

        "overall_probability": float(
            top["overall_probability"] * 100
        ),

        "hazard": str(
            top["overall_hazard"]
        )
    },

    "output_files": {

        "csv": CSV_OUTPUT,

        "parquet": PARQUET_OUTPUT
    }
}


# ============================================================
# SAVE JSON
# ============================================================

with open(
    JSON_OUTPUT,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        summary,
        f,
        indent=4
    )


# ============================================================
# DISPLAY SUMMARY
# ============================================================

print("\n" + "=" * 75)
print("             MULTI-HAZARD PREDICTION COMPLETE")
print("=" * 75)

print(
    f"\nTotal predictions : {len(result):,}"
)

print(
    f"Thunderstorm     : "
    f"{result['thunderstorm_prediction'].sum():,}"
)

print(
    f"Cloudburst       : "
    f"{result['cloudburst_prediction'].sum():,}"
)

print(
    f"Flash Flood      : "
    f"{result['flashflood_prediction'].sum():,}"
)

print("\nHighest Risk Point")

print(
    f"Time        : {top['time']}"
)

print(
    f"Latitude    : {top['latitude']}"
)

print(
    f"Longitude   : {top['longitude']}"
)

print(
    f"Probability : "
    f"{top['overall_probability'] * 100:.2f}%"
)

print(
    f"Hazard      : {top['overall_hazard']}"
)

print("\nOutput files:")

print(
    JSON_OUTPUT
)

print(
    CSV_OUTPUT
)

print(
    PARQUET_OUTPUT
)

print("\n" + "=" * 75)