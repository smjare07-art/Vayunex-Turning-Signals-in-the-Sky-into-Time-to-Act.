import asyncio
import os
from datetime import datetime
from pathlib import Path

import httpx
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv


# =========================================================
# CONFIG
# =========================================================

ROOT = Path(r"C:\Vayunex")

GRID_FILE = (
    ROOT /
    "data" /
    "maharashtra_prediction_grid.csv"
)

load_dotenv(ROOT / ".env")

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://localhost:27017"
)

MONGODB_DB = os.getenv(
    "MONGODB_DB",
    "vayunex_climateverse"
)

COLLECTION_NAME = "live_forecast_inputs"

API_URL = (
    "https://api.open-meteo.com/v1/forecast"
)

BATCH_SIZE = 35

FORECAST_HOURS = 9

TIMEZONE = "Asia/Kolkata"


# =========================================================
# WEATHER VARIABLES
# =========================================================

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

    # Convective
    "cape",
    "convective_inhibition",
    "boundary_layer_height",
    "total_column_integrated_water_vapour",

    # Pressure level
    "temperature_850hPa",
    "temperature_700hPa",
    "temperature_500hPa",
    "temperature_300hPa",
    "temperature_200hPa",

    "relative_humidity_850hPa",
    "relative_humidity_700hPa",
    "relative_humidity_500hPa",
    "relative_humidity_300hPa",
    "relative_humidity_200hPa",

    "wind_speed_850hPa",
    "wind_speed_700hPa",
    "wind_speed_500hPa",
    "wind_speed_300hPa",
    "wind_speed_200hPa",

    "wind_direction_850hPa",
    "wind_direction_700hPa",
    "wind_direction_500hPa",
    "wind_direction_300hPa",
    "wind_direction_200hPa",

    "geopotential_height_850hPa",
    "geopotential_height_700hPa",
    "geopotential_height_500hPa",
    "geopotential_height_300hPa",
    "geopotential_height_200hPa",
]


# =========================================================
# HELPERS
# =========================================================

def safe_float(value):

    if value is None:
        return None

    try:

        return float(value)

    except (
        TypeError,
        ValueError
    ):

        return None


async def fetch_batch(
    client,
    batch
):

    latitudes = ",".join(
        str(x)
        for x in batch["latitude"]
    )

    longitudes = ",".join(
        str(x)
        for x in batch["longitude"]
    )


    params = {

        "latitude": latitudes,
        "longitude": longitudes,

        "hourly": ",".join(
            HOURLY_VARIABLES
        ),

        "forecast_hours":
            FORECAST_HOURS,

        "timezone":
            TIMEZONE,

        "temperature_unit":
            "celsius",

        "wind_speed_unit":
            "kmh",

        "precipitation_unit":
            "mm",

        # Pressure-level fields require
        # the open-data ECMWF model.
        "models":
            "ecmwf_ifs025",
    }


    response = await client.get(
        API_URL,
        params=params,
    )

    response.raise_for_status()

    return response.json()


def build_documents(
    batch,
    response
):

    # Multiple coordinates return
    # a list of weather objects.

    if isinstance(response, dict):
        response = [response]


    documents = []


    for index, weather in enumerate(response):

        latitude = safe_float(
            weather.get("latitude")
        )

        longitude = safe_float(
            weather.get("longitude")
        )


        hourly = weather.get(
            "hourly",
            {}
        )


        times = hourly.get(
            "time",
            []
        )


        for hour_index, time_value in enumerate(times):

            record = {

                "time":
                    pd.Timestamp(
                        time_value
                    ).to_pydatetime(),

                "forecast_retrieved_at":
                    datetime.now(),

                "latitude":
                    latitude,

                "longitude":
                    longitude,

                "source":
                    "Open-Meteo ECMWF IFS 0.25",

                "live":
                    True,

                "variables": {}

            }


            for variable in HOURLY_VARIABLES:

                values = hourly.get(
                    variable,
                    []
                )

                value = (
                    values[hour_index]
                    if hour_index < len(values)
                    else None
                )

                record[
                    "variables"
                ][variable] = safe_float(
                    value
                )


            documents.append(record)


    return documents


# =========================================================
# MAIN
# =========================================================

async def main():

    print("=" * 70)
    print("VAYUNEX - LIVE FORECAST INGESTION")
    print("=" * 70)


    # -----------------------------------------------------
    # Grid
    # -----------------------------------------------------

    print("\nLoading Maharashtra grid...")

    grid = pd.read_csv(
        GRID_FILE
    )

    print(
        "Grid cells:",
        len(grid)
    )


    # -----------------------------------------------------
    # MongoDB
    # -----------------------------------------------------

    print("\nConnecting MongoDB...")

    mongo = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=5000
    )

    mongo.admin.command("ping")

    db = mongo[MONGODB_DB]

    collection = db[
        COLLECTION_NAME
    ]

    print(
        "MongoDB:",
        MONGODB_DB
    )


    # -----------------------------------------------------
    # Remove old live forecast
    # -----------------------------------------------------

    print(
        "\nRemoving previous live forecast..."
    )

    collection.delete_many({
        "live": True
    })


    # -----------------------------------------------------
    # Fetch
    # -----------------------------------------------------

    all_documents = []

    async with httpx.AsyncClient(
        timeout=60
    ) as client:

        for start in range(
            0,
            len(grid),
            BATCH_SIZE
        ):

            batch = grid.iloc[
                start:
                start + BATCH_SIZE
            ]

            print(
                f"\nFetching "
                f"{start + 1}-"
                f"{min(start + BATCH_SIZE, len(grid))}"
            )


            try:

                response = await fetch_batch(
                    client,
                    batch
                )

                documents = build_documents(
                    batch,
                    response
                )

                print(
                    "Hours received:",
                    len(documents)
                )

                all_documents.extend(
                    documents
                )

            except Exception as e:

                print(
                    "BATCH ERROR:",
                    repr(e)
                )


    # -----------------------------------------------------
    # Insert
    # -----------------------------------------------------

    print(
        "\nTotal forecast documents:",
        len(all_documents)
    )


    if all_documents:

        result = collection.insert_many(
            all_documents,
            ordered=False
        )

        print(
            "Inserted:",
            len(result.inserted_ids)
        )


    # -----------------------------------------------------
    # Indexes
    # -----------------------------------------------------

    print(
        "\nCreating indexes..."
    )

    collection.create_index(
        [
            ("latitude", 1),
            ("longitude", 1),
            ("time", 1)
        ]
    )

    collection.create_index(
        [
            ("time", 1)
        ]
    )


    collection.create_index(
        [
            ("forecast_retrieved_at", -1)
        ]
    )


    # -----------------------------------------------------
    # Verify
    # -----------------------------------------------------

    count = collection.count_documents(
        {}
    )

    print(
        "\nMongoDB live forecast count:",
        count
    )


    sample = collection.find_one(
        {},
        {
            "_id": 0
        }
    )


    print(
        "\nSample:"
    )

    print(sample)


    print(
        "\nLIVE FORECAST INGESTION COMPLETE ✅"
    )


    mongo.close()


if __name__ == "__main__":
    asyncio.run(main())
