import asyncio
import gc
import math
import os
from datetime import datetime
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne


# ============================================================
# VAYUNEX - LIVE GFS INGESTION V3
# ============================================================

ROOT = Path(r"C:\Vayunex")

GRID_FILE = (
    ROOT
    / "data"
    / "maharashtra_prediction_grid.csv"
)

load_dotenv(ROOT / ".env")
load_dotenv(
    ROOT / "backend" / "ml_api" / ".env"
)


MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://localhost:27017",
)

MONGODB_DB = os.getenv(
    "MONGODB_DB",
    "vayunex_climateverse",
)

COLLECTION_NAME = "live_gfs_inputs"

API_URL = "https://api.open-meteo.com/v1/gfs"

BATCH_SIZE = 8

# GFS request frequency protection.
REQUEST_DELAY = 4

# 24 hours historical + 9 hours forecast.
PAST_HOURS = 24
FORECAST_HOURS = 9

TIMEZONE = "Asia/Kolkata"

MAX_RETRIES = 6


# ============================================================
# GFS VARIABLES
# ============================================================

HOURLY_VARIABLES = [
    # Surface
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "precipitation",
    "rain",
    "surface_pressure",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "cloud_cover",

    # Convective / moisture
    "cape",
    "convective_inhibition",
    "boundary_layer_height",
    "total_column_integrated_water_vapour",

    # Pressure levels
    "temperature_850hPa",
    "temperature_700hPa",
    "temperature_500hPa",

    "relative_humidity_850hPa",
    "relative_humidity_700hPa",
    "relative_humidity_500hPa",

    "wind_speed_850hPa",
    "wind_speed_500hPa",

    "wind_direction_850hPa",
    "wind_direction_500hPa",

    "geopotential_height_850hPa",
    "geopotential_height_700hPa",
    "geopotential_height_500hPa",
]


# ============================================================
# HELPERS
# ============================================================

def safe_float(value):
    if value is None:
        return None

    try:
        value = float(value)

        if not np.isfinite(value):
            return None

        return value

    except (TypeError, ValueError):
        return None


def to_datetime(value):
    return pd.Timestamp(value).to_pydatetime()


def wind_components(speed_kmh, direction_deg):
    speed_kmh = safe_float(speed_kmh)
    direction_deg = safe_float(direction_deg)

    if speed_kmh is None or direction_deg is None:
        return None, None

    speed_ms = speed_kmh / 3.6

    direction_rad = math.radians(direction_deg)

    # Meteorological convention.
    u = -speed_ms * math.sin(direction_rad)
    v = -speed_ms * math.cos(direction_rad)

    return float(u), float(v)


# ============================================================
# FETCH
# ============================================================

async def fetch_batch(
    client,
    batch,
    batch_number,
    total_batches,
):
    requested_latitudes = ",".join(
        str(float(x))
        for x in batch["latitude"]
    )

    requested_longitudes = ",".join(
        str(float(x))
        for x in batch["longitude"]
    )

    params = {
        "latitude": requested_latitudes,
        "longitude": requested_longitudes,

        "hourly": ",".join(
            HOURLY_VARIABLES
        ),

        "past_hours": PAST_HOURS,
        "forecast_hours": FORECAST_HOURS,

        "timezone": TIMEZONE,

        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
    }

    for attempt in range(
        1,
        MAX_RETRIES + 1,
    ):
        try:

            response = await client.get(
                API_URL,
                params=params,
            )

            if response.status_code == 429:

                retry_after = (
                    response.headers.get(
                        "Retry-After"
                    )
                )

                if retry_after:
                    try:
                        wait_seconds = int(
                            retry_after
                        )
                    except ValueError:
                        wait_seconds = min(
                            20 * attempt,
                            180,
                        )
                else:
                    wait_seconds = min(
                        20 * attempt,
                        180,
                    )

                print(
                    f"  429 rate limit | "
                    f"batch {batch_number}/{total_batches} | "
                    f"attempt {attempt}/{MAX_RETRIES} | "
                    f"wait {wait_seconds}s"
                )

                await asyncio.sleep(
                    wait_seconds
                )

                continue

            response.raise_for_status()

            return response.json()

        except (
            httpx.ConnectError,
            httpx.ReadTimeout,
            httpx.RemoteProtocolError,
        ) as exc:

            wait_seconds = min(
                10 * attempt,
                120,
            )

            print(
                f"  Network error "
                f"{type(exc).__name__} | "
                f"retry {wait_seconds}s"
            )

            await asyncio.sleep(
                wait_seconds
            )

    raise RuntimeError(
        f"Maximum retries exceeded for "
        f"batch {batch_number}"
    )


# ============================================================
# BUILD DOCUMENTS
# ============================================================

def build_documents(
    response,
    requested_batch,
    retrieved_at,
):
    if isinstance(response, dict):
        response = [response]

    documents = []

    requested_coords = {
        (
            round(float(row.latitude), 4),
            round(float(row.longitude), 4),
        )
        for row in requested_batch.itertuples()
    }

    for weather in response:

        model_latitude = safe_float(
            weather.get("latitude")
        )

        model_longitude = safe_float(
            weather.get("longitude")
        )

        hourly = weather.get(
            "hourly",
            {},
        )

        times = hourly.get(
            "time",
            [],
        )

        if not times:
            continue

        # GFS usually snaps the requested point to
        # its own NWP grid. Find closest requested grid cell.
        nearest_requested = None

        if (
            model_latitude is not None
            and model_longitude is not None
        ):

            best_distance = float("inf")

            for req_lat, req_lon in requested_coords:

                distance = (
                    (req_lat - model_latitude) ** 2
                    +
                    (req_lon - model_longitude) ** 2
                )

                if distance < best_distance:
                    best_distance = distance
                    nearest_requested = (
                        req_lat,
                        req_lon,
                    )

        if nearest_requested is None:
            continue

        grid_latitude = nearest_requested[0]
        grid_longitude = nearest_requested[1]

        for hour_index, time_value in enumerate(
            times
        ):

            variables = {}

            for variable in HOURLY_VARIABLES:

                values = hourly.get(
                    variable,
                    [],
                )

                if (
                    hour_index
                    < len(values)
                ):
                    variables[variable] = (
                        safe_float(
                            values[hour_index]
                        )
                    )
                else:
                    variables[variable] = None

            documents.append({
                "time": to_datetime(
                    time_value
                ),

                "forecast_retrieved_at":
                    retrieved_at,

                # Requested Vayunex grid
                "latitude":
                    grid_latitude,

                "longitude":
                    grid_longitude,

                # Actual GFS grid coordinate
                "model_latitude":
                    model_latitude,

                "model_longitude":
                    model_longitude,

                "source":
                    "Open-Meteo GFS",

                "source_type":
                    "NWP_FORECAST",

                "model":
                    "GFS",

                "live":
                    True,

                "variables":
                    variables,
            })

    return documents


# ============================================================
# MONGO INDEXES
# ============================================================

def ensure_indexes(collection):

    index_name = (
        "latitude_1_longitude_1_time_1"
    )

    indexes = collection.index_information()

    if index_name in indexes:
        existing = indexes[index_name]

        if not existing.get(
            "unique",
            False,
        ):
            collection.drop_index(
                index_name
            )

    collection.create_index(
        [
            ("latitude", 1),
            ("longitude", 1),
            ("time", 1),
        ],
        unique=True,
        name=index_name,
    )

    collection.create_index(
        [("time", 1)],
        name="time_1",
    )

    collection.create_index(
        [("forecast_retrieved_at", -1)],
        name="forecast_retrieved_at_-1",
    )

    collection.create_index(
        [("live", 1)],
        name="live_1",
    )

    collection.create_index(
        [
            ("latitude", 1),
            ("longitude", 1),
        ],
        name="location_1",
    )


# ============================================================
# VALIDATE
# ============================================================

def validate_variables(
    documents,
):
    if not documents:
        return

    total = len(documents)

    counts = {}

    for variable in HOURLY_VARIABLES:

        count = sum(
            1
            for doc in documents
            if doc["variables"].get(variable)
            is not None
        )

        counts[variable] = count

    print("\nVariable availability:")

    for variable, count in counts.items():

        percent = (
            count
            / total
            * 100
        )

        status = (
            "OK"
            if percent >= 99
            else "PARTIAL"
        )

        print(
            f"  {variable:45s} "
            f"{percent:6.2f}% "
            f"{status}"
        )


# ============================================================
# MAIN
# ============================================================

async def main():

    print("\n")
    print("=" * 78)
    print("VAYUNEX - LIVE GFS FORECAST INGESTION V3")
    print("=" * 78)

    if not GRID_FILE.exists():
        raise FileNotFoundError(
            f"Grid file not found:\n{GRID_FILE}"
        )

    grid = pd.read_csv(
        GRID_FILE
    )

    grid["latitude"] = (
        pd.to_numeric(
            grid["latitude"],
            errors="coerce",
        )
        .round(4)
    )

    grid["longitude"] = (
        pd.to_numeric(
            grid["longitude"],
            errors="coerce",
        )
        .round(4)
    )

    grid = (
        grid[
            [
                "latitude",
                "longitude",
            ]
        ]
        .dropna()
        .drop_duplicates()
        .reset_index(drop=True)
    )

    total_cells = len(grid)

    print(
        f"\nMaharashtra grid cells: "
        f"{total_cells}"
    )

    expected_documents = (
        total_cells
        * (
            PAST_HOURS
            + FORECAST_HOURS
        )
    )

    print(
        f"Historical hours: "
        f"{PAST_HOURS}"
    )

    print(
        f"Forecast hours: "
        f"{FORECAST_HOURS}"
    )

    print(
        f"Expected documents: "
        f"{expected_documents}"
    )

    print(
        "\nConnecting to MongoDB..."
    )

    mongo = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=5000,
    )

    mongo.admin.command(
        "ping"
    )

    db = mongo[
        MONGODB_DB
    ]

    collection = db[
        COLLECTION_NAME
    ]

    print(
        f"MongoDB: {MONGODB_DB}"
    )

    print(
        f"Collection: {COLLECTION_NAME}"
    )

    retrieved_at = datetime.now()

    print(
        f"\nForecast run: "
        f"{retrieved_at}"
    )

    total_batches = math.ceil(
        total_cells
        / BATCH_SIZE
    )

    print(
        f"\nTotal API batches: "
        f"{total_batches}"
    )

    successful_documents = []

    failed_batches = []

    async with httpx.AsyncClient(
        timeout=120,
        headers={
            "User-Agent":
                "Vayunex-Weather-Nowcasting/2.0"
        },
    ) as client:

        for batch_index, start in enumerate(
            range(
                0,
                total_cells,
                BATCH_SIZE,
            ),
            start=1,
        ):

            end = min(
                start + BATCH_SIZE,
                total_cells,
            )

            batch = grid.iloc[
                start:end
            ]

            print(
                f"\n[{batch_index}/{total_batches}] "
                f"Fetching cells "
                f"{start + 1}-{end}"
            )

            try:

                response = await fetch_batch(
                    client,
                    batch,
                    batch_index,
                    total_batches,
                )

                documents = build_documents(
                    response,
                    batch,
                    retrieved_at,
                )

                print(
                    f"  Received: "
                    f"{len(documents)} documents"
                )

                successful_documents.extend(
                    documents
                )

            except Exception as exc:

                print(
                    f"  BATCH FAILED: "
                    f"{repr(exc)}"
                )

                failed_batches.append(
                    batch_index
                )

            await asyncio.sleep(
                REQUEST_DELAY
            )

    actual_documents = len(
        successful_documents
    )

    print("\n")
    print("=" * 78)
    print("INGESTION VALIDATION")
    print("=" * 78)

    print(
        f"Expected documents : "
        f"{expected_documents}"
    )

    print(
        f"Received documents : "
        f"{actual_documents}"
    )

    print(
        f"Failed batches     : "
        f"{len(failed_batches)}"
    )

    # Need all cells × all hours before
    # replacing current live run.
    if (
        failed_batches
        or actual_documents
        < expected_documents
    ):
        print(
            "\nWARNING: incomplete GFS run."
        )

        print(
            "Current live data will NOT "
            "be replaced."
        )

        mongo.close()
        return

    # --------------------------------------------------------
    # Verify uniqueness
    # --------------------------------------------------------

    unique_keys = {
        (
            doc["latitude"],
            doc["longitude"],
            doc["time"],
        )
        for doc in successful_documents
    }

    print(
        f"Unique location-time records: "
        f"{len(unique_keys)}"
    )

    if len(unique_keys) != actual_documents:

        raise RuntimeError(
            "Duplicate location-time records "
            "detected."
        )

    # --------------------------------------------------------
    # Variable availability
    # --------------------------------------------------------

    validate_variables(
        successful_documents
    )

    # --------------------------------------------------------
    # Mongo write
    # --------------------------------------------------------

    print(
        "\nWriting GFS forecast to MongoDB..."
    )

    operations = []

    for doc in successful_documents:

        operations.append(
            UpdateOne(
                {
                    "latitude":
                        doc["latitude"],

                    "longitude":
                        doc["longitude"],

                    "time":
                        doc["time"],
                },
                {
                    "$set": doc,
                },
                upsert=True,
            )
        )

    result = collection.bulk_write(
        operations,
        ordered=False,
    )

    print(
        "Matched :",
        result.matched_count,
    )

    print(
        "Modified:",
        result.modified_count,
    )

    print(
        "Inserted:",
        result.upserted_count,
    )

    # --------------------------------------------------------
    # Remove previous live run
    # --------------------------------------------------------

    cleanup = collection.delete_many(
        {
            "live": True,
            "forecast_retrieved_at": {
                "$ne":
                    retrieved_at
            },
        }
    )

    print(
        "Old live documents removed:",
        cleanup.deleted_count,
    )

    ensure_indexes(
        collection
    )

    # --------------------------------------------------------
    # Final verification
    # --------------------------------------------------------

    final_count = collection.count_documents(
        {
            "live": True,
            "forecast_retrieved_at":
                retrieved_at,
        }
    )

    distinct_times = sorted(
        collection.distinct(
            "time",
            {
                "live": True,
                "forecast_retrieved_at":
                    retrieved_at,
            },
        )
    )

    print("\n")
    print("=" * 78)
    print("VAYUNEX GFS LIVE VERIFICATION")
    print("=" * 78)

    print(
        f"Expected documents : "
        f"{expected_documents}"
    )

    print(
        f"Final live docs    : "
        f"{final_count}"
    )

    print(
        f"Forecast timestamps: "
        f"{len(distinct_times)}"
    )

    if distinct_times:

        print(
            f"First timestamp: "
            f"{distinct_times[0]}"
        )

        print(
            f"Last timestamp : "
            f"{distinct_times[-1]}"
        )

    sample = collection.find_one(
        {
            "live": True,
            "forecast_retrieved_at":
                retrieved_at,
        },
        {
            "_id": 0
        },
    )

    print(
        "\nSample document:"
    )

    print(
        sample
    )

    print("\n")

    if (
        final_count
        == expected_documents
    ):

        print(
            "LIVE GFS INGESTION COMPLETE ✅"
        )

    else:

        print(
            "WARNING: final count mismatch."
        )

    mongo.close()

    gc.collect()


if __name__ == "__main__":
    asyncio.run(
        main()
    )