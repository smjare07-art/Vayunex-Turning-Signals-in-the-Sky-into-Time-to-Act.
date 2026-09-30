import json
import os
import shutil
from pathlib import Path

import pandas as pd


# ============================================================
# CLIMATEVERSE AI
# TIME-INDEXED PRODUCTION API DATA BUILDER
# ============================================================

BASE_DIR = Path(r"C:\ClimateVerse-AI")

SOURCE_FILE = (
    BASE_DIR
    / "ML"
    / "prediction"
    / "final_multi_hazard_predictions.parquet"
)

OUTPUT_DIR = (
    BASE_DIR
    / "ML"
    / "prediction"
    / "api"
)

HOURLY_DIR = OUTPUT_DIR / "hourly"

# Keep only fields required by backend/frontend
REQUIRED_COLUMNS = [
    "time",
    "latitude",
    "longitude",

    "thunderstorm_probability",
    "cloudburst_probability",
    "flashflood_probability",

    "thunderstorm_probability_percent",
    "cloudburst_probability_percent",
    "flashflood_probability_percent",

    "thunderstorm_prediction",
    "cloudburst_prediction",
    "flashflood_prediction",

    "thunderstorm_risk",
    "cloudburst_risk",
    "flashflood_risk",

    "overall_probability",
    "overall_hazard",
]


def json_safe(value):
    """
    Convert pandas/numpy values into JSON-safe values.
    """

    if pd.isna(value):
        return None

    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass

    if isinstance(value, pd.Timestamp):
        return value.isoformat()

    return value


def write_json_atomic(path, data):
    """
    Atomic JSON write:
    write temporary file first, then replace target.
    """

    path = Path(path)
    temp_path = path.with_suffix(path.suffix + ".tmp")

    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(
            data,
            f,
            ensure_ascii=False,
            separators=(",", ":"),
        )

    os.replace(temp_path, path)


def validate_source(df):
    print("\nValidating source data...")

    missing_columns = [
        c for c in REQUIRED_COLUMNS
        if c not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Missing required columns:\n"
            + "\n".join(missing_columns)
        )

    print("Required columns: OK")

    if df.empty:
        raise ValueError("Source dataset is empty.")

    # Probability validation
    probability_columns = [
        "thunderstorm_probability",
        "cloudburst_probability",
        "flashflood_probability",
    ]

    for column in probability_columns:
        values = pd.to_numeric(
            df[column],
            errors="coerce"
        )

        invalid = (
            values.isna()
            | (values < 0)
            | (values > 1)
        ).sum()

        if invalid:
            raise ValueError(
                f"Invalid probability values in {column}: {invalid}"
            )

    print("Probability ranges: OK")

    # Time validation
    if not pd.api.types.is_datetime64_any_dtype(df["time"]):
        df["time"] = pd.to_datetime(
            df["time"],
            errors="coerce"
        )

    invalid_time = df["time"].isna().sum()

    if invalid_time:
        raise ValueError(
            f"Invalid timestamps: {invalid_time}"
        )

    print("Timestamp values: OK")

    # Coordinates
    lat = pd.to_numeric(
        df["latitude"],
        errors="coerce"
    )

    lon = pd.to_numeric(
        df["longitude"],
        errors="coerce"
    )

    invalid_coordinates = (
        lat.isna()
        | lon.isna()
        | (lat < -90)
        | (lat > 90)
        | (lon < -180)
        | (lon > 180)
    ).sum()

    if invalid_coordinates:
        raise ValueError(
            f"Invalid coordinates: {invalid_coordinates}"
        )

    print("Coordinates: OK")


def main():

    print("\n" + "=" * 70)
    print("   CLIMATEVERSE AI - TIME INDEXED API BUILDER")
    print("=" * 70)

    print(f"\nSource:")
    print(SOURCE_FILE)

    print(f"\nOutput:")
    print(OUTPUT_DIR)

    if not SOURCE_FILE.exists():
        raise FileNotFoundError(
            f"Source file not found:\n{SOURCE_FILE}"
        )

    # --------------------------------------------------------
    # Load source
    # --------------------------------------------------------

    print("\nLoading prediction dataset...")

    df = pd.read_parquet(
        SOURCE_FILE,
        columns=REQUIRED_COLUMNS
    )

    print(
        f"Total source rows: {len(df):,}"
    )

    # --------------------------------------------------------
    # Validate
    # --------------------------------------------------------

    validate_source(df)

    # --------------------------------------------------------
    # Normalize time
    # --------------------------------------------------------

    df["time"] = pd.to_datetime(
        df["time"]
    ).dt.floor("h")

    # --------------------------------------------------------
    # Check duplicate grid/time
    # --------------------------------------------------------

    duplicate_count = df.duplicated(
        subset=[
            "time",
            "latitude",
            "longitude"
        ]
    ).sum()

    print(
        f"Duplicate time/grid rows: {duplicate_count}"
    )

    if duplicate_count:
        raise ValueError(
            "Duplicate time/grid records detected."
        )

    # --------------------------------------------------------
    # Sort
    # --------------------------------------------------------

    df = df.sort_values(
        [
            "time",
            "latitude",
            "longitude"
        ]
    ).reset_index(drop=True)

    # --------------------------------------------------------
    # Timestamp statistics
    # --------------------------------------------------------

    unique_times = (
        df["time"]
        .drop_duplicates()
        .sort_values()
        .tolist()
    )

    print(
        f"Total timestamps: {len(unique_times):,}"
    )

    print(
        f"First timestamp: {unique_times[0]}"
    )

    print(
        f"Latest timestamp: {unique_times[-1]}"
    )

    # --------------------------------------------------------
    # Rebuild output directory safely
    # --------------------------------------------------------

    if OUTPUT_DIR.exists():

        print(
            "\nRemoving previous API directory..."
        )

        shutil.rmtree(OUTPUT_DIR)

    HOURLY_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------------
    # Build timestamp files
    # --------------------------------------------------------

    timestamp_records = []

    print(
        "\nBuilding timestamp files..."
    )

    total_timestamps = len(unique_times)

    for index, timestamp in enumerate(
        unique_times,
        start=1
    ):

        timestamp_string = (
            pd.Timestamp(timestamp)
            .strftime("%Y-%m-%dT%H:%M:%S")
        )

        timestamp_key = (
            pd.Timestamp(timestamp)
            .strftime("%Y-%m-%dT%H-%M-%S")
        )

        output_file = (
            HOURLY_DIR
            / f"{timestamp_key}.json"
        )

        # Select exactly one timestamp
        chunk = df[
            df["time"] == timestamp
        ].copy()

        # ----------------------------------------------------
        # Grid validation
        # ----------------------------------------------------

        if len(chunk) != 980:

            raise ValueError(
                f"Expected 980 grid points for "
                f"{timestamp_string}, "
                f"got {len(chunk)}"
            )

        # ----------------------------------------------------
        # Convert timestamp
        # ----------------------------------------------------

        chunk["time"] = chunk["time"].dt.strftime(
            "%Y-%m-%dT%H:%M:%S"
        )

        # ----------------------------------------------------
        # Convert to records
        # ----------------------------------------------------

        records = []

        for record in chunk.to_dict(
            orient="records"
        ):

            safe_record = {
                key: json_safe(value)
                for key, value in record.items()
            }

            records.append(safe_record)

        # ----------------------------------------------------
        # Write
        # ----------------------------------------------------

        write_json_atomic(
            output_file,
            records
        )

        # ----------------------------------------------------
        # Timestamp metadata
        # ----------------------------------------------------

        timestamp_records.append({
            "time": timestamp_string,
            "file": f"hourly/{output_file.name}",
            "rows": len(records),
        })

        # Progress
        if (
            index == 1
            or index % 100 == 0
            or index == total_timestamps
        ):

            print(
                f"[{index:>5}/{total_timestamps}] "
                f"{timestamp_string}"
            )

    # --------------------------------------------------------
    # Timestamp index
    # --------------------------------------------------------

    timestamp_index = {
        "count": len(timestamp_records),
        "first": timestamp_records[0]["time"],
        "latest": timestamp_records[-1]["time"],
        "timestamps": timestamp_records,
    }

    write_json_atomic(
        OUTPUT_DIR / "timestamps.json",
        timestamp_index
    )

    # --------------------------------------------------------
    # Metadata
    # --------------------------------------------------------

    metadata = {
        "project": "ClimateVerse AI",
        "dataset": "Multi-Hazard XGBoost Predictions",
        "source_file": str(SOURCE_FILE),

        "total_source_rows": int(len(df)),

        "total_timestamps": len(unique_times),

        "rows_per_timestamp": 980,

        "first_timestamp":
            timestamp_records[0]["time"],

        "latest_timestamp":
            timestamp_records[-1]["time"],

        "latitude_min":
            float(df["latitude"].min()),

        "latitude_max":
            float(df["latitude"].max()),

        "longitude_min":
            float(df["longitude"].min()),

        "longitude_max":
            float(df["longitude"].max()),

        "hazards": [
            "thunderstorm",
            "cloudburst",
            "flashflood"
        ],

        "forecast_horizons": [
            "2h",
            "4h",
            "6h"
        ],

        "format": "timestamp-partitioned-json",

        "api_design": {
            "one_timestamp_file": True,
            "grid_points_per_timestamp": 980,
            "master_dataset": "Parquet",
            "request_does_not_load_full_dataset": True
        },

        "columns": REQUIRED_COLUMNS,
    }

    write_json_atomic(
        OUTPUT_DIR / "metadata.json",
        metadata
    )

    # --------------------------------------------------------
    # Final verification
    # --------------------------------------------------------

    print("\n" + "=" * 70)
    print("FINAL VERIFICATION")
    print("=" * 70)

    sample_time = "2026-07-31T04:00:00"

    sample_file = (
        HOURLY_DIR
        / "2026-07-31T04-00-00.json"
    )

    if sample_file.exists():

        with open(
            sample_file,
            "r",
            encoding="utf-8"
        ) as f:

            sample = json.load(f)

        print(
            f"Sample timestamp: {sample_time}"
        )

        print(
            f"Sample rows: {len(sample)}"
        )

        thunderstorm_count = sum(
            int(x["thunderstorm_prediction"])
            for x in sample
        )

        cloudburst_count = sum(
            int(x["cloudburst_prediction"])
            for x in sample
        )

        flashflood_count = sum(
            int(x["flashflood_prediction"])
            for x in sample
        )

        print(
            f"Thunderstorm: {thunderstorm_count}"
        )

        print(
            f"Cloudburst: {cloudburst_count}"
        )

        print(
            f"Flash Flood: {flashflood_count}"
        )

        if len(sample) != 980:
            raise ValueError(
                "Sample timestamp does not contain 980 points."
            )

    else:

        raise FileNotFoundError(
            "Sample timestamp file was not generated."
        )

    # --------------------------------------------------------
    # Final result
    # --------------------------------------------------------

    print("\n" + "=" * 70)
    print("API DATA BUILD COMPLETED SUCCESSFULLY")
    print("=" * 70)

    print(
        f"\nSource rows : {len(df):,}"
    )

    print(
        f"Timestamps  : {len(unique_times):,}"
    )

    print(
        "Rows/time   : 980"
    )

    print(
        f"Latest      : {timestamp_records[-1]['time']}"
    )

    print(
        f"\nAPI folder:"
    )

    print(OUTPUT_DIR)

    print(
        "\nFiles:"
    )

    print("  metadata.json")
    print("  timestamps.json")
    print("  hourly/<timestamp>.json")


if __name__ == "__main__":
    main()