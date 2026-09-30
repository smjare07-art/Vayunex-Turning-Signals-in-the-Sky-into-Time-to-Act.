import os
from pathlib import Path
from datetime import datetime

import pandas as pd
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv


# =========================================================
# CONFIG
# =========================================================

ROOT = Path(r"C:\Vayunex")

PREDICTION_FILE = (
    ROOT / "ML" / "prediction" /
    "final_multi_hazard_predictions.csv"
)

GRID_FILE = (
    ROOT / "data" /
    "maharashtra_prediction_grid.csv"
)

ENV_FILE = (
    ROOT / "backend" / "ml_api" / ".env"
)


# =========================================================
# LOAD ENV
# =========================================================

if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    load_dotenv(ROOT / ".env")

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://localhost:27017"
)

MONGODB_DB = os.getenv(
    "MONGODB_DB",
    "vayunex_climateverse"
)


# =========================================================
# CONNECT
# =========================================================

print("=" * 65)
print("VAYUNEX - MONGODB PREDICTION SEED")
print("=" * 65)

print("\nConnecting to MongoDB...")

client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000
)

client.admin.command("ping")

db = client[MONGODB_DB]

collection = db["predictions"]

print("MongoDB: CONNECTED")
print("Database:", MONGODB_DB)


# =========================================================
# LOAD MAHARASHTRA GRID
# =========================================================

print("\nLoading Maharashtra grid...")

grid = pd.read_csv(GRID_FILE)

grid["latitude"] = grid["latitude"].round(4)
grid["longitude"] = grid["longitude"].round(4)

print("Maharashtra cells:", len(grid))


grid_keys = set(
    zip(
        grid["latitude"],
        grid["longitude"]
    )
)


# =========================================================
# READ ONLY REQUIRED COLUMNS
# =========================================================

print("\nLoading prediction data...")

usecols = [
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
    "overall_hazard"
]


df = pd.read_csv(
    PREDICTION_FILE,
    usecols=usecols
)

print("Prediction rows loaded:", len(df))


# =========================================================
# NORMALIZE COORDINATES
# =========================================================

df["latitude"] = df["latitude"].round(4)
df["longitude"] = df["longitude"].round(4)


# =========================================================
# FILTER MAHARASHTRA GRID
# =========================================================

print("\nFiltering Maharashtra grid...")

maha = df[
    df.apply(
        lambda row: (
            row["latitude"],
            row["longitude"]
        ) in grid_keys,
        axis=1
    )
].copy()

print(
    "Maharashtra prediction rows:",
    len(maha)
)


if maha.empty:
    raise RuntimeError(
        "No Maharashtra predictions found."
    )


# =========================================================
# FIND LATEST TIMESTAMP
# =========================================================

maha["time"] = pd.to_datetime(
    maha["time"]
)

latest_time = maha["time"].max()

print("\nLatest timestamp:")
print(latest_time)


latest = maha[
    maha["time"] == latest_time
].copy()


print(
    "Latest Maharashtra grid rows:",
    len(latest)
)


# =========================================================
# BUILD MONGODB DOCUMENTS
# =========================================================

print("\nPreparing MongoDB documents...")

documents = []

for _, row in latest.iterrows():

    doc = {
        "time": row["time"].to_pydatetime(),

        "location": {
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"])
        },

        "hazards": {
            "thunderstorm": float(
                row["thunderstorm_probability"]
            ),

            "cloudburst": float(
                row["cloudburst_probability"]
            ),

            "flashflood": float(
                row["flashflood_probability"]
            )
        },

        "hazard_percent": {
            "thunderstorm": float(
                row["thunderstorm_probability_percent"]
            ),

            "cloudburst": float(
                row["cloudburst_probability_percent"]
            ),

            "flashflood": float(
                row["flashflood_probability_percent"]
            )
        },

        "predictions": {
            "thunderstorm": int(
                row["thunderstorm_prediction"]
            ),

            "cloudburst": int(
                row["cloudburst_prediction"]
            ),

            "flashflood": int(
                row["flashflood_prediction"]
            )
        },

        "risk": {
            "thunderstorm": str(
                row["thunderstorm_risk"]
            ),

            "cloudburst": str(
                row["cloudburst_risk"]
            ),

            "flashflood": str(
                row["flashflood_risk"]
            )
        },

        "overall_probability": float(
            row["overall_probability"]
        ),

        "overall_hazard": str(
            row["overall_hazard"]
        ),

        "region": "Maharashtra",

        "model": {
            "type": "XGBoost",
            "version": "multi_hazard_v1"
        },

        "source": "Vayunex prediction pipeline"
    }

    documents.append(doc)


# =========================================================
# UPSERT
# =========================================================

print("\nWriting to MongoDB...")

operations = []

for doc in documents:

    operations.append(
        UpdateOne(
            {
                "time": doc["time"],
                "location.latitude":
                    doc["location"]["latitude"],
                "location.longitude":
                    doc["location"]["longitude"]
            },
            {
                "$set": doc
            },
            upsert=True
        )
    )


if operations:

    result = collection.bulk_write(
        operations,
        ordered=False
    )

    print("\nMongoDB write complete.")

    print(
        "Matched:",
        result.matched_count
    )

    print(
        "Inserted:",
        result.upserted_count
    )

    print(
        "Modified:",
        result.modified_count
    )


# =========================================================
# INDEXES
# =========================================================

print("\nCreating indexes...")

collection.create_index(
    [
        ("time", -1),
        ("region", 1)
    ]
)

collection.create_index(
    [
        ("location.latitude", 1),
        ("location.longitude", 1),
        ("time", -1)
    ]
)

collection.create_index(
    [
        ("overall_hazard", 1),
        ("time", -1)
    ]
)


# =========================================================
# VERIFY
# =========================================================

count = collection.count_documents({})

print("\n" + "=" * 65)
print("MONGODB VERIFICATION")
print("=" * 65)

print("Total prediction documents:", count)

sample = collection.find_one(
    {},
    {"_id": 0}
)

print("\nSample document:")

print(sample)


print("\nDONE ✅")

client.close()
