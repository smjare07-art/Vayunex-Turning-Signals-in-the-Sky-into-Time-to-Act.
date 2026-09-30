from pathlib import Path
import gc
import json
import warnings

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb

from sklearn.metrics import (
    average_precision_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split


warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data" / "processed" / "xgboost"
MODEL_DIR = BASE_DIR / "ML" / "models"

MODEL_DIR.mkdir(parents=True, exist_ok=True)


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


JOBS = [
    {
        "name": "thunderstorm",
        "datasets": {
            4: "thunderstorm_4h.parquet",
            6: "thunderstorm_6h.parquet",
        },
        "targets": {
            4: "thunderstorm_4h",
            6: "thunderstorm_6h",
        },
    },
    {
        "name": "cloudburst",
        "datasets": {
            4: "cloudburst_proxy_4h.parquet",
            6: "cloudburst_proxy_6h.parquet",
        },
        "targets": {
            4: "cloudburst_proxy_4h",
            6: "cloudburst_proxy_6h",
        },
    },
    {
        "name": "flashflood",
        "datasets": {
            4: "flashflood_4h.parquet",
            6: "flashflood_6h.parquet",
        },
        "targets": {
            4: "flashflood_4h",
            6: "flashflood_6h",
        },
    },
]


def find_best_threshold(y_true, probabilities):
    """
    Select threshold using F1 on validation data.
    Severe-weather datasets are highly imbalanced, so 0.5 is
    not automatically a good operational threshold.
    """

    thresholds = np.arange(0.05, 0.991, 0.01)

    best = {
        "threshold": 0.5,
        "precision": 0.0,
        "recall": 0.0,
        "f1": -1.0,
    }

    for threshold in thresholds:
        pred = (probabilities >= threshold).astype(np.int8)

        precision = precision_score(
            y_true,
            pred,
            zero_division=0,
        )

        recall = recall_score(
            y_true,
            pred,
            zero_division=0,
        )

        f1 = f1_score(
            y_true,
            pred,
            zero_division=0,
        )

        if f1 > best["f1"]:
            best = {
                "threshold": float(threshold),
                "precision": float(precision),
                "recall": float(recall),
                "f1": float(f1),
            }

    return best


def load_dataset(path):
    print(f"\nLoading: {path.name}")

    df = pd.read_parquet(
        path,
        columns=None,
    )

    print(f"Rows loaded : {len(df):,}")
    print(f"Columns     : {len(df.columns)}")

    missing_features = [
        feature
        for feature in FEATURES
        if feature not in df.columns
    ]

    if missing_features:
        raise RuntimeError(
            f"Missing features in {path.name}: {missing_features}"
        )

    return df


def train_one_model(hazard, horizon, dataset_name, target_name):
    dataset_path = DATA_DIR / dataset_name

    if not dataset_path.exists():
        raise FileNotFoundError(
            f"Dataset not found: {dataset_path}"
        )

    print("\n" + "=" * 80)
    print(f"TRAINING: {hazard.upper()} {horizon}H")
    print("=" * 80)

    df = load_dataset(dataset_path)

    if target_name not in df.columns:
        raise RuntimeError(
            f"Target column '{target_name}' not found in {dataset_name}"
        )

    # Keep only what is required for model training.
    X = df[FEATURES].astype(np.float32)
    y = df[target_name].astype(np.int8)

    print("\nTarget distribution:")
    print(y.value_counts().sort_index().to_string())

    positives = int(y.sum())
    negatives = int(len(y) - positives)

    if positives == 0:
        raise RuntimeError("Target contains no positive examples.")

    if negatives == 0:
        raise RuntimeError("Target contains no negative examples.")

    scale_pos_weight = negatives / positives

    print(f"\nPositive samples : {positives:,}")
    print(f"Negative samples : {negatives:,}")
    print(f"scale_pos_weight : {scale_pos_weight:.4f}")

    # 80/20 stratified split.
    X_train, X_valid, y_train, y_valid = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    print("\nTrain rows :", f"{len(X_train):,}")
    print("Valid rows :", f"{len(X_valid):,}")

    model = xgb.XGBClassifier(
        n_estimators=500,
        max_depth=8,
        learning_rate=0.05,
        min_child_weight=2,
        subsample=0.85,
        colsample_bytree=0.85,
        objective="binary:logistic",
        eval_metric="aucpr",
        scale_pos_weight=scale_pos_weight,
        tree_method="hist",
        n_jobs=6,
        random_state=42,
        reg_alpha=0.1,
        reg_lambda=1.0,
        gamma=0.0,
    )

    print("\nStarting XGBoost training...")
    print("This may take some time on the first model.")

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_valid, y_valid)],
        verbose=False,
    )

    print("Training complete.")

    print("\nValidation prediction...")
    probabilities = model.predict_proba(X_valid)[:, 1]

    roc_auc = roc_auc_score(
        y_valid,
        probabilities,
    )

    pr_auc = average_precision_score(
        y_valid,
        probabilities,
    )

    threshold_info = find_best_threshold(
        y_valid.to_numpy(),
        probabilities,
    )

    best_threshold = threshold_info["threshold"]

    print("\nValidation metrics:")
    print(f"ROC-AUC : {roc_auc:.6f}")
    print(f"PR-AUC  : {pr_auc:.6f}")
    print(f"Best threshold : {best_threshold:.2f}")
    print(f"Precision      : {threshold_info['precision']:.6f}")
    print(f"Recall         : {threshold_info['recall']:.6f}")
    print(f"F1             : {threshold_info['f1']:.6f}")

    model_filename = (
        f"xgboost_{hazard}_{horizon}h_v1.json"
    )

    feature_filename = (
        f"{hazard}_{horizon}h_features.pkl"
    )

    metadata_filename = (
        f"{hazard}_{horizon}h_metadata.json"
    )

    model_path = MODEL_DIR / model_filename
    feature_path = MODEL_DIR / feature_filename
    metadata_path = MODEL_DIR / metadata_filename

    print("\nSaving model...")

    model.save_model(model_path)

    joblib.dump(
        FEATURES,
        feature_path,
    )

    metadata = {
        "team": "Vayunex",
        "project": "Vayunex",
        "hazard": hazard,
        "horizon_hours": horizon,
        "model_type": "XGBoost",
        "model_version": "v1",
        "dataset": dataset_name,
        "target": target_name,
        "features": FEATURES,
        "feature_count": len(FEATURES),
        "training_rows": int(len(X_train)),
        "validation_rows": int(len(X_valid)),
        "positive_samples": positives,
        "negative_samples": negatives,
        "scale_pos_weight": float(scale_pos_weight),
        "validation": {
            "roc_auc": float(roc_auc),
            "pr_auc": float(pr_auc),
            "threshold": float(best_threshold),
            "precision": float(threshold_info["precision"]),
            "recall": float(threshold_info["recall"]),
            "f1": float(threshold_info["f1"]),
        },
        "training": {
            "n_estimators": 500,
            "max_depth": 8,
            "learning_rate": 0.05,
            "min_child_weight": 2,
            "subsample": 0.85,
            "colsample_bytree": 0.85,
            "tree_method": "hist",
            "n_jobs": 6,
            "random_state": 42,
        },
    }

    with open(
        metadata_path,
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            metadata,
            f,
            indent=2,
        )

    print("\nSaved:")
    print(f"  Model    : {model_path}")
    print(f"  Features : {feature_path}")
    print(f"  Metadata : {metadata_path}")

    # Free memory aggressively before next 360+ MB parquet.
    del df
    del X
    del y
    del X_train
    del X_valid
    del y_train
    del y_valid
    del probabilities
    del model

    gc.collect()

    print("\nMemory released.")

    return metadata


def main():
    print("\n")
    print("=" * 80)
    print("VAYUNEX - 4H / 6H HAZARD MODEL TRAINING")
    print("=" * 80)
    print(f"Base directory : {BASE_DIR}")
    print(f"Data directory : {DATA_DIR}")
    print(f"Model directory: {MODEL_DIR}")
    print(f"Feature count  : {len(FEATURES)}")

    results = []

    for job in JOBS:
        hazard = job["name"]

        for horizon in [4, 6]:
            try:
                result = train_one_model(
                    hazard=hazard,
                    horizon=horizon,
                    dataset_name=job["datasets"][horizon],
                    target_name=job["targets"][horizon],
                )

                results.append(result)

            except Exception as exc:
                print("\n" + "!" * 80)
                print(
                    f"FAILED: {hazard.upper()} {horizon}H"
                )
                print(
                    f"{type(exc).__name__}: {exc}"
                )
                print("!" * 80)

    print("\n")
    print("=" * 80)
    print("TRAINING SUMMARY")
    print("=" * 80)

    if not results:
        print("No models were trained successfully.")
        return

    for result in results:
        validation = result["validation"]

        print(
            f"{result['hazard']:15s} "
            f"{result['horizon_hours']}h | "
            f"PR-AUC={validation['pr_auc']:.5f} | "
            f"ROC-AUC={validation['roc_auc']:.5f} | "
            f"F1={validation['f1']:.5f} | "
            f"Threshold={validation['threshold']:.2f}"
        )

    print("\nAll completed models are in:")
    print(MODEL_DIR)


if __name__ == "__main__":
    main()