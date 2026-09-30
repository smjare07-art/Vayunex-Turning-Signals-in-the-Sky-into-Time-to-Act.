from pathlib import Path

from ecmwf.opendata import Client


# ============================================================
# CLIMATEVERSE AI
# ECMWF PRECIPITATION STEP TEST
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
    / "rainfall_steps_test.grib2"
)


print()
print("=" * 75)
print("     CLIMATEVERSE AI - ECMWF RAINFALL STEP TEST")
print("=" * 75)
print()


client = Client(
    source="ecmwf",
    model="ifs",
    resol="0p25",
)


# ------------------------------------------------------------
# Forecast steps
# ------------------------------------------------------------

steps = [
    0,
    3,
    6,
    9,
    12,
    15,
    18,
    21,
    24,
]


print("Forecast steps:")

for step in steps:
    print(
        f"  - +{step} hour"
    )

print()


# ------------------------------------------------------------
# Request
# ------------------------------------------------------------

print(
    "Requesting ECMWF total precipitation..."
)

print()


try:

    result = client.retrieve(

        type="fc",

        stream="oper",

        step=steps,

        param=["tp"],

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