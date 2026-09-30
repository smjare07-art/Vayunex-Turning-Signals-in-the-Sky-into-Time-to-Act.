import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr
import xgboost as xgb

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    average_precision_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent.parent

DATA_FILE = (
    BASE_DIR
    / "data"
    / "processed"
    / "era5"
    / "maharashtra_era5_final_labels.nc"
)

MODEL_DIR = BASE_DIR / "models"

MODEL_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# FEATURES
# ============================================================

FEATURE_FILE = (
    MODEL_DIR
    / "thunderstorm_2h_v2_features.pkl"
)

with open(
    FEATURE_FILE,
    "rb"
) as f:
    FEATURES = pickle.load(f)


# ============================================================
# HAZARDS
# ============================================================

HAZARDS = {

    "cloudburst_2h":
        "cloudburst_proxy_2h",

    "flashflood_2h":
        "flashflood_2h"
}


# ============================================================
# LOAD DATA
# ============================================================

print("\n" + "=" * 70)
print("       CLIMATEVERSE AI - MULTI HAZARD TRAINING")
print("=" * 70)

print("\nLoading dataset...")

ds = xr.open_dataset(DATA_FILE)

print(
    "Dataset dimensions:",
    dict(ds.sizes)
)


# ============================================================
# VERIFY FEATURES
# ============================================================

missing_features = [
    f for f in FEATURES
    if f not in ds.data_vars
]

if missing_features:

    raise ValueError(
        "Missing features:\n"
        + "\n".join(missing_features)
    )


# ============================================================
# CONVERT TO DATAFRAME
# ============================================================

print("\nConverting ERA5 data...")

feature_data = ds[FEATURES]

df = feature_data.to_dataframe().reset_index()

print(
    "Total rows:",
    len(df)
)


# ============================================================
# CLEAN FEATURES
# ============================================================

X = df[FEATURES].copy()

X = X.apply(
    pd.to_numeric,
    errors="coerce"
)

X = X.replace(
    [np.inf, -np.inf],
    np.nan
)

print(
    "Missing feature values:",
    X.isna().sum().sum()
)


# ============================================================
# IMPUTATION
# ============================================================

for column in FEATURES:

    if X[column].isna().any():

        median = X[column].median()

        if pd.isna(median):
            median = 0.0

        X[column] = X[column].fillna(
            median
        )


# ============================================================
# TRAIN EACH HAZARD
# ============================================================

for hazard_name, label_name in HAZARDS.items():

    print("\n")
    print("=" * 70)
    print(
        "TRAINING:",
        hazard_name.upper()
    )
    print("=" * 70)

    y = (
        ds[label_name]
        .values
        .reshape(-1)
    )

    y = pd.Series(
        y,
        dtype="float32"
    )

    # --------------------------------------------------------
    # Remove invalid labels
    # --------------------------------------------------------

    valid = y.notna()

    X_h = X.loc[
        valid.values
    ].copy()

    y_h = y.loc[
        valid
    ].astype(int)

    # --------------------------------------------------------
    # Class distribution
    # --------------------------------------------------------

    positive = int(
        y_h.sum()
    )

    negative = int(
        len(y_h) - positive
    )

    print(
        f"Negative: {negative:,}"
    )

    print(
        f"Positive: {positive:,}"
    )

    if positive < 20:

        print(
            "Not enough positive samples."
        )

        continue

    # --------------------------------------------------------
    # Train / validation split
    # --------------------------------------------------------

    X_train, X_val, y_train, y_val = train_test_split(
        X_h,
        y_h,
        test_size=0.20,
        random_state=42,
        stratify=y_h
    )

    # --------------------------------------------------------
    # Class weight
    # --------------------------------------------------------

    scale_pos_weight = (
        (y_train == 0).sum()
        /
        max(
            1,
            (y_train == 1).sum()
        )
    )

    print(
        "scale_pos_weight:",
        round(
            float(scale_pos_weight),
            2
        )
    )

    # --------------------------------------------------------
    # Model
    # --------------------------------------------------------

    model = xgb.XGBClassifier(

        n_estimators=500,

        max_depth=6,

        learning_rate=0.05,

        subsample=0.8,

        colsample_bytree=0.8,

        min_child_weight=5,

        gamma=0.1,

        objective="binary:logistic",

        eval_metric="aucpr",

        scale_pos_weight=float(
            scale_pos_weight
        ),

        tree_method="hist",

        random_state=42,

        n_jobs=-1
    )

    # --------------------------------------------------------
    # Train
    # --------------------------------------------------------

    print("\nTraining XGBoost...")

    model.fit(
        X_train,
        y_train,
        eval_set=[
            (
                X_val,
                y_val
            )
        ],
        verbose=False
    )

    # --------------------------------------------------------
    # Validation probabilities
    # --------------------------------------------------------

    probabilities = model.predict_proba(
        X_val
    )[:, 1]

    # --------------------------------------------------------
    # Metrics
    # --------------------------------------------------------

    pr_auc = average_precision_score(
        y_val,
        probabilities
    )

    roc_auc = roc_auc_score(
        y_val,
        probabilities
    )

    # --------------------------------------------------------
    # Find best F1 threshold
    # --------------------------------------------------------

    thresholds = np.arange(
        0.01,
        1.00,
        0.01
    )

    best_threshold = 0.50
    best_f1 = 0.0

    best_precision = 0.0
    best_recall = 0.0

    for threshold in thresholds:

        pred = (
            probabilities >= threshold
        ).astype(int)

        precision = precision_score(
            y_val,
            pred,
            zero_division=0
        )

        recall = recall_score(
            y_val,
            pred,
            zero_division=0
        )

        f1 = f1_score(
            y_val,
            pred,
            zero_division=0
        )

        if f1 > best_f1:

            best_f1 = f1

            best_threshold = (
                float(threshold)
            )

            best_precision = (
                float(precision)
            )

            best_recall = (
                float(recall)
            )

    # --------------------------------------------------------
    # Print metrics
    # --------------------------------------------------------

    print("\nRESULTS")

    print(
        "PR-AUC:",
        round(
            float(pr_auc),
            5
        )
    )

    print(
        "ROC-AUC:",
        round(
            float(roc_auc),
            5
        )
    )

    print(
        "Best threshold:",
        round(
            best_threshold,
            2
        )
    )

    print(
        "Precision:",
        round(
            best_precision,
            5
        )
    )

    print(
        "Recall:",
        round(
            best_recall,
            5
        )
    )

    print(
        "F1:",
        round(
            best_f1,
            5
        )
    )

    # --------------------------------------------------------
    # Save model
    # --------------------------------------------------------

    model_file = (
        MODEL_DIR
        / f"xgboost_{hazard_name}.json"
    )

    model.save_model(
        str(model_file)
    )

    print(
        "\nModel saved:",
        model_file
    )

    # --------------------------------------------------------
    # Save features
    # --------------------------------------------------------

    feature_file = (
        MODEL_DIR
        / f"{hazard_name}_features.pkl"
    )

    with open(
        feature_file,
        "wb"
    ) as f:

        pickle.dump(
            FEATURES,
            f
        )

    # --------------------------------------------------------
    # Save metadata
    # --------------------------------------------------------

    metadata = {

        "hazard":
            hazard_name,

        "label":
            label_name,

        "features":
            FEATURES,

        "positive_samples":
            positive,

        "negative_samples":
            negative,

        "pr_auc":
            float(pr_auc),

        "roc_auc":
            float(roc_auc),

        "best_threshold":
            float(best_threshold),

        "precision":
            float(best_precision),

        "recall":
            float(best_recall),

        "f1":
            float(best_f1)
    }

    metadata_file = (
        MODEL_DIR
        / f"{hazard_name}_metadata.json"
    )

    with open(
        metadata_file,
        "w"
    ) as f:

        json.dump(
            metadata,
            f,
            indent=4
        )

    print(
        "Metadata saved:",
        metadata_file
    )


# ============================================================
# COMPLETE
# ============================================================

print("\n")
print("=" * 70)
print("             TRAINING COMPLETE")
print("=" * 70)

print("\nNew models should now be present in:")

print(
    MODEL_DIR
)