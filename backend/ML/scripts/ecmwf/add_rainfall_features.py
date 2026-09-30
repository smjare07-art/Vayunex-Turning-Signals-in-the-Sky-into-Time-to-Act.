import xarray as xr
import numpy as np
from pathlib import Path

BASE = Path(r"C:\ClimateVerse-AI")

RAIN_FILE = BASE / r"data\ecmwf\maharashtra\rainfall_steps_test.grib2"
FEATURE_FILE = BASE / r"data\ecmwf\maharashtra\maharashtra_ecmwf_features.nc"
OUTPUT_FILE = BASE / r"data\ecmwf\maharashtra\maharashtra_ecmwf_features_rain.nc"

print("=" * 70)
print("CLIMATEVERSE AI - ADD ECMWF RAINFALL FEATURES")
print("=" * 70)

# ---------------------------------------------------------
# Load rainfall
# ---------------------------------------------------------
print("\nLoading rainfall GRIB...")

rain = xr.open_dataset(
    RAIN_FILE,
    engine="cfgrib"
)

tp = rain["tp"]

print("Rainfall shape:", tp.shape)
print("Steps:", rain.step.values)

# ---------------------------------------------------------
# Convert metre -> mm
# ---------------------------------------------------------
tp_mm = tp * 1000.0

# ---------------------------------------------------------
# Accumulated rainfall differences
# ---------------------------------------------------------
rain_3h = tp_mm.sel(step=np.timedelta64(3, "h")) \
             - tp_mm.sel(step=np.timedelta64(0, "h"))

rain_6h = tp_mm.sel(step=np.timedelta64(6, "h")) \
             - tp_mm.sel(step=np.timedelta64(0, "h"))

rain_12h = tp_mm.sel(step=np.timedelta64(12, "h")) \
              - tp_mm.sel(step=np.timedelta64(0, "h"))

rain_24h = tp_mm.sel(step=np.timedelta64(24, "h")) \
              - tp_mm.sel(step=np.timedelta64(0, "h"))

# Prevent tiny numerical negatives
rain_3h = xr.where(rain_3h < 0, 0, rain_3h)
rain_6h = xr.where(rain_6h < 0, 0, rain_6h)
rain_12h = xr.where(rain_12h < 0, 0, rain_12h)
rain_24h = xr.where(rain_24h < 0, 0, rain_24h)

# ---------------------------------------------------------
# precipitation_mm
# ---------------------------------------------------------
# Current forecast accumulation at +24h
precipitation_mm = tp_mm.sel(
    step=np.timedelta64(24, "h")
)

# ---------------------------------------------------------
# Load existing ECMWF features
# ---------------------------------------------------------
print("\nLoading existing feature file...")

features = xr.open_dataset(FEATURE_FILE)

print("Existing features:", len(features.data_vars))

# ---------------------------------------------------------
# Add rainfall variables
# ---------------------------------------------------------
features["precipitation_mm"] = precipitation_mm
features["rain_3h"] = rain_3h
features["rain_6h"] = rain_6h
features["rain_12h"] = rain_12h
features["rain_24h"] = rain_24h

# ---------------------------------------------------------
# Save
# ---------------------------------------------------------
print("\nSaving...")

features.to_netcdf(OUTPUT_FILE)

print("\n" + "=" * 70)
print("SUCCESS")
print("=" * 70)

print("\nOutput:")
print(OUTPUT_FILE)

print("\nAdded:")
print("  precipitation_mm")
print("  rain_3h")
print("  rain_6h")
print("  rain_12h")
print("  rain_24h")

print("\nTotal features:", len(features.data_vars))

# ---------------------------------------------------------
# Quick verification
# ---------------------------------------------------------
print("\nVerification:")

for name in [
    "precipitation_mm",
    "rain_3h",
    "rain_6h",
    "rain_12h",
    "rain_24h"
]:
    da = features[name]

    print(
        f"{name:20s} "
        f"min={float(da.min()):.4f} mm "
        f"max={float(da.max()):.4f} mm"
    )

features.close()
rain.close()