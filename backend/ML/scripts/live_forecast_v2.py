import asyncio
import os
from datetime import datetime
from pathlib import Path

import httpx
import pandas as pd
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv


# =========================================================
# CONFIGURATION
# =========================================================

ROOT = Path(r"C:\Vayunex")

GRID_FILE = (
    ROOT
    / "data"
    / "maharashtra_prediction_grid.csv"
)

# Root .env first
load_dotenv(ROOT / ".env")

# Also check backend API .env if present
load_dotenv(
    ROOT
    / "backend"
    / "ml_api"
    / ".env"
)


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

# Smaller batch = less 429 risk
BATCH_SIZE = 10

# Delay between requests
REQUEST_DELAY = 12

# Current + next 8 hours
FORECAST_HOURS = 9

TIMEZONE = "Asia/Kolkata"

MAX_RETRIES = 6


# =========================================================
# WEATHER VARIABLES
# =========================================================

HOURLY_VARIABLES = [

    # -----------------------------------------------------
    # Surface
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # Convective / moisture
    # -----------------------------------------------------

    "cape",
    "convective_inhibition",
    "boundary_layer_height",
    "total_column_integrated_water_vapour",

    # -----------------------------------------------------
    # Pressure-level temperature
    # -----------------------------------------------------

    "temperature_850hPa",
    "temperature_700hPa",
    "temperature_500hPa",
    "temperature_300hPa",
    "temperature_200hPa",

    # -----------------------------------------------------
    # Pressure-level RH
    # -----------------------------------------------------

    "relative_humidity_850hPa",
    "relative_humidity_700hPa",
    "relative_humidity_500hPa",
    "relative_humidity_300hPa",
    "relative_humidity_200hPa",

    # -----------------------------------------------------
    # Pressure-level wind speed
    # -----------------------------------------------------

    "wind_speed_850hPa",
    "wind_speed_700hPa",
    "wind_speed_500hPa",
    "wind_speed_300hPa",
    "wind_speed_200hPa",

    # -----------------------------------------------------
    # Pressure-level wind direction
    # -----------------------------------------------------

    "wind_direction_850hPa",
    "wind_direction_700hPa",
    "wind_direction_500hPa",
    "wind_direction_300hPa",
    "wind_direction_200hPa",

    # -----------------------------------------------------
    # Geopotential height
    # -----------------------------------------------------

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


# =========================================================
# FETCH ONE BATCH
# =========================================================

async def fetch_batch(
    client,
    batch,
    batch_number,
    total_batches
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

        "models":
            "ecmwf_ifs025",
    }


    for attempt in range(
        1,
        MAX_RETRIES + 1
    ):

        try:

            response = await client.get(
                API_URL,
                params=params
            )


            # -------------------------------------------------
            # Rate limit
            # -------------------------------------------------

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
                            30 * attempt,
                            180
                        )

                else:

                    wait_seconds = min(
                        30 * attempt,
                        180
                    )


                print(
                    f"  429 rate limit | "
                    f"batch {batch_number}/{total_batches} | "
                    f"attempt {attempt}/{MAX_RETRIES} | "
                    f"waiting {wait_seconds}s"
                )


                await asyncio.sleep(
                    wait_seconds
                )

                continue


            response.raise_for_status()

            return response.json()


        except httpx.HTTPStatusError as exc:

            status = (
                exc.response.status_code
                if exc.response is not None
                else None
            )


            if status == 429:

                wait_seconds = min(
                    30 * attempt,
                    180
                )

                print(
                    f"  429 retry | "
                    f"waiting {wait_seconds}s"
                )


                await asyncio.sleep(
                    wait_seconds
                )

                continue


            raise


        except (
            httpx.ConnectError,
            httpx.ReadTimeout,
            httpx.RemoteProtocolError
        ) as exc:

            wait_seconds = min(
                15 * attempt,
                120
            )

            print(
                f"  Network error: "
                f"{type(exc).__name__} | "
                f"retry in {wait_seconds}s"
            )


            await asyncio.sleep(
                wait_seconds
            )


    raise RuntimeError(
        f"Maximum retries exceeded for "
        f"batch {batch_number}."
    )


# =========================================================
# BUILD MONGODB DOCUMENTS
# =========================================================

def build_documents(
    response,
    retrieved_at
):

    # Single response or multi-location response
    if isinstance(
        response,
        dict
    ):

        response = [response]


    documents = []


    for weather in response:

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


        for hour_index, time_value in enumerate(
            times
        ):

            variables = {}


            for variable in HOURLY_VARIABLES:

                values = hourly.get(
                    variable,
                    []
                )


                if (
                    hour_index
                    < len(values)
                ):

                    value = values[
                        hour_index
                    ]

                else:

                    value = None


                variables[
                    variable
                ] = safe_float(
                    value
                )


            documents.append({

                "time":
                    pd.Timestamp(
                        time_value
                    ).to_pydatetime(),

                "forecast_retrieved_at":
                    retrieved_at,

                "latitude":
                    latitude,

                "longitude":
                    longitude,

                "source":
                    "Open-Meteo ECMWF IFS 0.25",

                "live":
                    True,

                "variables":
                    variables

            })


    return documents


# =========================================================
# MAIN
# =========================================================

async def main():

    print("=" * 70)
    print("VAYUNEX - LIVE FORECAST INGESTION V2")
    print("=" * 70)


    # =====================================================
    # GRID
    # =====================================================

    if not GRID_FILE.exists():

        raise FileNotFoundError(
            f"Maharashtra grid not found:\n"
            f"{GRID_FILE}"
        )


    grid = pd.read_csv(
        GRID_FILE
    )


    # Normalize coordinates
    grid["latitude"] = (
        pd.to_numeric(
            grid["latitude"],
            errors="coerce"
        )
        .round(4)
    )


    grid["longitude"] = (
        pd.to_numeric(
            grid["longitude"],
            errors="coerce"
        )
        .round(4)
    )


    grid = (
        grid[
            [
                "latitude",
                "longitude"
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
        * FORECAST_HOURS
    )


    print(
        f"Forecast hours per cell: "
        f"{FORECAST_HOURS}"
    )


    print(
        f"Expected documents: "
        f"{expected_documents}"
    )


    # =====================================================
    # MONGODB
    # =====================================================

    print(
        "\nConnecting to MongoDB..."
    )


    mongo = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=5000
    )


    # Test connection
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


    # =====================================================
    # RUN ID
    # =====================================================

    retrieved_at = datetime.now()


    print(
        f"\nForecast run: "
        f"{retrieved_at}"
    )


    # =====================================================
    # FETCH ALL BATCHES
    # =====================================================

    successful_documents = []

    failed_batches = []


    total_batches = (
        (
            total_cells
            + BATCH_SIZE
            - 1
        )
        // BATCH_SIZE
    )


    print(
        f"\nTotal API batches: "
        f"{total_batches}"
    )


    async with httpx.AsyncClient(
        timeout=90,
        headers={
            "User-Agent":
                "Vayunex-Weather-Nowcasting/1.0"
        }
    ) as client:


        for batch_index, start in enumerate(
            range(
                0,
                total_cells,
                BATCH_SIZE
            ),
            start=1
        ):

            end = min(
                start + BATCH_SIZE,
                total_cells
            )


            batch = grid.iloc[
                start:end
            ]


            print(
                f"\n"
                f"[{batch_index}/{total_batches}] "
                f"Fetching cells "
                f"{start + 1}-{end}"
            )


            try:

                response = await fetch_batch(

                    client,

                    batch,

                    batch_index,

                    total_batches

                )


                documents = build_documents(

                    response,

                    retrieved_at

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


            # Always pause
            await asyncio.sleep(
                REQUEST_DELAY
            )


    # =====================================================
    # VALIDATION
    # =====================================================

    actual_documents = len(
        successful_documents
    )


    print("\n")
    print("=" * 70)

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

    print("=" * 70)


    # =====================================================
    # IMPORTANT:
    # NEVER DELETE CURRENT DATA ON INCOMPLETE RUN
    # =====================================================

    if (
        actual_documents
        != expected_documents
        or failed_batches
    ):

        print(
            "\nWARNING: "
            "Live forecast ingestion is incomplete."
        )


        if failed_batches:

            print(
                "Failed batches:"
            )

            print(
                failed_batches
            )


        print(
            "\nExisting live forecast data "
            "has NOT been deleted."
        )


        print(
            "No incomplete forecast has been "
            "written as a new live run."
        )


        mongo.close()

        return


    # =====================================================
    # ENSURE COMPLETE RUN
    # =====================================================

    print(
        "\nFull forecast successfully received."
    )


    # =====================================================
    # UPSERT DOCUMENTS
    # =====================================================

    print(
        "\nWriting forecast to MongoDB..."
    )


    operations = []


    for doc in successful_documents:

        operations.append(

            UpdateOne(

                {
                    "latitude":
                        doc[
                            "latitude"
                        ],

                    "longitude":
                        doc[
                            "longitude"
                        ],

                    "time":
                        doc[
                            "time"
                        ]

                },

                {
                    "$set":
                        doc
                },

                upsert=True

            )

        )


    result = collection.bulk_write(
        operations,
        ordered=False
    )


    print(
        f"Matched  : "
        f"{result.matched_count}"
    )

    print(
        f"Modified : "
        f"{result.modified_count}"
    )

    print(
        f"Inserted : "
        f"{result.upserted_count}"
    )


    # =====================================================
    # DELETE OLD LIVE RUNS
    # =====================================================

    cleanup_result = (
        collection.delete_many(
            {
                "live": True,

                "forecast_retrieved_at": {
                    "$ne":
                        retrieved_at
                }
            }
        )
    )


    print(
        f"Old live documents removed: "
        f"{cleanup_result.deleted_count}"
    )


    # =====================================================
    # INDEXES
    # =====================================================

    print(
        "\nChecking MongoDB indexes..."
    )


    # -----------------------------------------------------
    # Unique location + time index
    # -----------------------------------------------------

    index_name = (
        "latitude_1_longitude_1_time_1"
    )


    existing_indexes = (
        collection.index_information()
    )


    if (
        index_name
        in existing_indexes
    ):

        existing_index = (
            existing_indexes[
                index_name
            ]
        )


        if existing_index.get(
            "unique",
            False
        ):

            print(
                "✓ Unique location-time "
                "index already exists."
            )

        else:

            print(
                "Existing index is "
                "not unique."
            )

            print(
                "Dropping old index..."
            )


            collection.drop_index(
                index_name
            )


            collection.create_index(

                [
                    (
                        "latitude",
                        1
                    ),

                    (
                        "longitude",
                        1
                    ),

                    (
                        "time",
                        1
                    )
                ],

                unique=True,

                name=index_name

            )


            print(
                "✓ Unique index recreated."
            )


    else:

        collection.create_index(

            [
                (
                    "latitude",
                    1
                ),

                (
                    "longitude",
                    1
                ),

                (
                    "time",
                    1
                )
            ],

            unique=True,

            name=index_name

        )


        print(
            "✓ Unique location-time "
            "index created."
        )


    # -----------------------------------------------------
    # Time index
    # -----------------------------------------------------

    existing_indexes = (
        collection.index_information()
    )


    if "time_1" not in existing_indexes:

        collection.create_index(

            [
                (
                    "time",
                    1
                )
            ],

            name="time_1"

        )

        print(
            "✓ Time index created."
        )

    else:

        print(
            "✓ Time index exists."
        )


    # -----------------------------------------------------
    # Retrieval-time index
    # -----------------------------------------------------

    existing_indexes = (
        collection.index_information()
    )


    retrieval_index = (
        "forecast_retrieved_at_-1"
    )


    if (
        retrieval_index
        not in existing_indexes
    ):

        collection.create_index(

            [
                (
                    "forecast_retrieved_at",
                    -1
                )
            ],

            name=retrieval_index

        )

        print(
            "✓ Retrieval-time "
            "index created."
        )

    else:

        print(
            "✓ Retrieval-time "
            "index exists."
        )


    # -----------------------------------------------------
    # Live flag index
    # -----------------------------------------------------

    existing_indexes = (
        collection.index_information()
    )


    if "live_1" not in existing_indexes:

        collection.create_index(

            [
                (
                    "live",
                    1
                )
            ],

            name="live_1"

        )

        print(
            "✓ Live index created."
        )


    # =====================================================
    # FINAL VERIFICATION
    # =====================================================

    final_count = (
        collection.count_documents(
            {
                "live": True
            }
        )
    )


    print("\n")
    print("=" * 70)
    print("VAYUNEX LIVE FORECAST VERIFICATION")
    print("=" * 70)


    print(
        f"Expected live docs : "
        f"{expected_documents}"
    )


    print(
        f"Final live docs    : "
        f"{final_count}"
    )


    # Distinct times
    distinct_times = (
        collection.distinct(
            "time",
            {
                "live": True
            }
        )
    )


    distinct_times = sorted(
        distinct_times
    )


    print(
        f"Forecast timestamps: "
        f"{len(distinct_times)}"
    )


    if distinct_times:

        print(
            f"First forecast time: "
            f"{distinct_times[0]}"
        )

        print(
            f"Last forecast time : "
            f"{distinct_times[-1]}"
        )


    # -----------------------------------------------------
    # Sample
    # -----------------------------------------------------

    sample = collection.find_one(

        {
            "live": True
        },

        {
            "_id": 0
        }

    )


    print(
        "\nSample document:"
    )


    print(
        sample
    )


    # =====================================================
    # FINAL STATUS
    # =====================================================

    if (
        final_count
        == expected_documents
    ):

        print(
            "\nLIVE FORECAST INGESTION "
            "COMPLETE ✅"
        )

    else:

        print(
            "\nWARNING: "
            "Final MongoDB count does not "
            "match expected count."
        )


    print(
        "\nMongoDB indexes:"
    )


    print(
        collection.index_information()
    )


    mongo.close()


# =========================================================
# ENTRY POINT
# =========================================================

if __name__ == "__main__":

    asyncio.run(
        main()
    )
