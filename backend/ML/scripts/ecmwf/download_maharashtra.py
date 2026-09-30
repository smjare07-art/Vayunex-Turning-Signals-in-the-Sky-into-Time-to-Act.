from pathlib import Path
from ecmwf.opendata import Client


# ============================================================
# CLIMATEVERSE AI
# ECMWF IFS - MAHARASHTRA DATA DOWNLOADER
# ============================================================

BASE_DIR = Path(r"C:\ClimateVerse-AI")

OUTPUT_DIR = BASE_DIR / "data" / "ecmwf" / "maharashtra"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ------------------------------------------------------------
# Maharashtra + BUFFER
# ------------------------------------------------------------
#
# North = 22.5
# South = 15.0
# West  = 71.5
# East  = 81.5
#
# ECMWF area format:
# [North, West, South, East]
#

AREA = [
    22.5,
    71.5,
    15.0,
    81.5,
]


print()
print("=" * 75)
print("       CLIMATEVERSE AI - ECMWF MAHARASHTRA DOWNLOAD")
print("=" * 75)
print()

print("Area:")
print(f"  North : {AREA[0]}")
print(f"  West  : {AREA[1]}")
print(f"  South : {AREA[2]}")
print(f"  East  : {AREA[3]}")
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
print("Model      : IFS")
print("Resolution : 0.25 degree")
print()


# ------------------------------------------------------------
# SURFACE PARAMETERS
# ------------------------------------------------------------

surface_params = [
    "2t",
    "2d",
    "10u",
    "10v",
    "sp",
    "tp",
    "mucape",
]


print("Surface parameters:")
for p in surface_params:
    print("  -", p)

print()


# ------------------------------------------------------------
# DOWNLOAD SURFACE DATA
# ------------------------------------------------------------

surface_file = OUTPUT_DIR / "ecmwf_maharashtra_surface.grib2"

print("Downloading surface data...")
print()

try:

    result = client.retrieve(
        type="fc",
        stream="oper",
        step=0,
        param=surface_params,
        area=AREA,
        target=str(surface_file),
    )

    print()
    print("SURFACE DOWNLOAD SUCCESS")
    print("-" * 75)

    print("File:")
    print(surface_file)

    print()
    print("Forecast datetime:")
    print(result.datetime)

    print()
    print("File size:")
    print(
        round(
            surface_file.stat().st_size / (1024 * 1024),
            2
        ),
        "MB"
    )

except Exception as error:

    print()
    print("=" * 75)
    print("SURFACE DOWNLOAD FAILED")
    print("=" * 75)

    print(type(error).__name__)
    print(error)

    raise


# ------------------------------------------------------------
# PRESSURE LEVEL PARAMETERS
# ------------------------------------------------------------

pressure_params = [
    "u",
    "v",
    "t",
    "r",
]


pressure_levels = [
    850,
    500,
]


print()
print("=" * 75)
print("Pressure-level parameters")
print("=" * 75)

print()

print("Levels:")
for level in pressure_levels:
    print("  -", level, "hPa")

print()

print("Parameters:")
for p in pressure_params:
    print("  -", p)

print()


# ------------------------------------------------------------
# DOWNLOAD PRESSURE DATA
# ------------------------------------------------------------

pressure_file = OUTPUT_DIR / "ecmwf_maharashtra_pressure.grib2"

print("Downloading pressure-level data...")
print()

try:

    result = client.retrieve(
        type="fc",
        stream="oper",
        step=0,
        levelist=pressure_levels,
        param=pressure_params,
        area=AREA,
        target=str(pressure_file),
    )

    print()
    print("PRESSURE DOWNLOAD SUCCESS")
    print("-" * 75)

    print("File:")
    print(pressure_file)

    print()
    print("Forecast datetime:")
    print(result.datetime)

    print()
    print("File size:")
    print(
        round(
            pressure_file.stat().st_size / (1024 * 1024),
            2
        ),
        "MB"
    )

except Exception as error:

    print()
    print("=" * 75)
    print("PRESSURE DOWNLOAD FAILED")
    print("=" * 75)

    print(type(error).__name__)
    print(error)

    raise


# ------------------------------------------------------------
# FINAL
# ------------------------------------------------------------

print()
print("=" * 75)
print("       ECMWF MAHARASHTRA DOWNLOAD COMPLETED")
print("=" * 75)
print()

print("Output directory:")
print(OUTPUT_DIR)

print()
print("Files:")

for file in OUTPUT_DIR.glob("*.grib2"):
    print(
        f"  {file.name} "
        f"({file.stat().st_size / (1024 * 1024):.2f} MB)"
    )

print()
print("NEXT STEP:")
print("Run the inspection command and send the output.")
print()