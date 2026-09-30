from pathlib import Path
from ecmwf.opendata import Client


BASE_DIR = Path(r"C:\ClimateVerse-AI")
OUTPUT_DIR = BASE_DIR / "data" / "ecmwf"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_FILE = OUTPUT_DIR / "pressure_test.grib2"


print()
print("=" * 70)
print("       CLIMATEVERSE AI - ECMWF PRESSURE LEVEL TEST")
print("=" * 70)
print()

client = Client(
    source="ecmwf",
    model="ifs",
    resol="0p25",
)

print("ECMWF client created")
print("Model      : IFS")
print("Resolution : 0.25 degree")
print()

levels = [850, 500]

params = [
    "u",
    "v",
    "t",
    "r",
]

print("Pressure levels:")
for level in levels:
    print(f"  - {level} hPa")

print()

print("Parameters:")
for param in params:
    print(f"  - {param}")

print()

try:

    result = client.retrieve(
        type="fc",
        stream="oper",
        step=0,
        levelist=levels,
        param=params,
        target=str(OUTPUT_FILE),
    )

    print()
    print("=" * 70)
    print("DOWNLOAD SUCCESS")
    print("=" * 70)

    print()
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

    print()
    print("SUCCESS!")

except Exception as error:

    print()
    print("=" * 70)
    print("ECMWF PRESSURE DOWNLOAD FAILED")
    print("=" * 70)

    print()
    print(type(error).__name__)
    print(error)

    raise