from pathlib import Path
from ecmwf.opendata import Client


# ============================================================
# CLIMATEVERSE AI
# ECMWF MISSING FEATURE AVAILABILITY TEST
# ============================================================

BASE_DIR = Path(r"C:\ClimateVerse-AI")

OUTPUT_DIR = (
    BASE_DIR
    / "data"
    / "ecmwf"
    / "maharashtra"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


OUTPUT_FILE = (
    OUTPUT_DIR
    / "missing_features_test.grib2"
)


print()
print("=" * 75)
print("     CLIMATEVERSE AI - ECMWF MISSING FEATURES TEST")
print("=" * 75)
print()


client = Client(
    source="ecmwf",
    model="ifs",
    resol="0p25",
)


# ============================================================
# PARAMETERS
# ============================================================

params = [
    "tcwv",
    "blh",
    "mucape",
]


print("Testing parameters:")

for param in params:
    print(
        "  -",
        param
    )

print()


# ============================================================
# AREA
# ============================================================

# NOTE:
# ECMWF open-data currently ignores `area`
# for this request.
#
# Therefore we download and crop locally,
# exactly like previous steps.

print("Requesting ECMWF data...")
print()


# ============================================================
# DOWNLOAD
# ============================================================

try:

    result = client.retrieve(

        type="fc",

        stream="oper",

        step=0,

        param=params,

        target=str(
            OUTPUT_FILE
        ),
    )


    print()
    print("=" * 75)
    print("DOWNLOAD SUCCESS")
    print("=" * 75)

    print()

    print("File:")
    print(
        OUTPUT_FILE
    )

    print()

    print("Forecast datetime:")

    print(
        result.datetime
    )

    print()

    print("File size:")

    print(
        round(
            OUTPUT_FILE.stat().st_size
            /
            (1024 * 1024),
            2
        ),
        "MB"
    )


except Exception as error:

    print()
    print("=" * 75)
    print("DOWNLOAD FAILED")
    print("=" * 75)

    print()

    print(
        type(error).__name__
    )

    print(
        error
    )

    raise


print()
print("=" * 75)
print("TEST COMPLETED")
print("=" * 75)
print()