from pathlib import Path
from ecmwf.opendata import Client


# ============================================================
# CLIMATEVERSE AI
# ECMWF OPEN DATA TEST
# ============================================================

BASE_DIR = Path(r"C:\ClimateVerse-AI")

OUTPUT_DIR = BASE_DIR / "data" / "ecmwf"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_FILE = OUTPUT_DIR / "ecmwf_test.grib2"


print()
print("=" * 70)
print("        CLIMATEVERSE AI - ECMWF OPEN DATA TEST")
print("=" * 70)
print()


# ------------------------------------------------------------
# ECMWF CLIENT
# ------------------------------------------------------------

client = Client(
    source="ecmwf",
    model="ifs",
    resol="0p25",
)


print("ECMWF client created")
print("Source : ECMWF")
print("Model  : IFS")
print("Resolution : 0.25 degree")
print()


# ------------------------------------------------------------
# TEST REQUEST
# ------------------------------------------------------------

params = [
    "2t",
    "2d",
    "10u",
    "10v",
    "sp",
    "tp",
    "blh",
    "mucape",
    "mucin",
]


print("Requesting parameters:")
print()

for param in params:
    print("  -", param)

print()


# ------------------------------------------------------------
# DOWNLOAD
# ------------------------------------------------------------

try:

    result = client.retrieve(
        type="fc",
        stream="oper",

        # latest available forecast
        step=0,

        param=params,

        target=str(OUTPUT_FILE),
    )

    print()
    print("DOWNLOAD SUCCESS")
    print("-" * 70)

    print("File:")
    print(OUTPUT_FILE)

    print()

    print("Forecast datetime:")
    print(result.datetime)

    print()

    print("File size:")
    print(
        round(
            OUTPUT_FILE.stat().st_size / (1024 * 1024),
            2
        ),
        "MB"
    )


except Exception as error:

    print()
    print("=" * 70)
    print("ECMWF DOWNLOAD FAILED")
    print("=" * 70)

    print()
    print(type(error).__name__)
    print(error)

    raise