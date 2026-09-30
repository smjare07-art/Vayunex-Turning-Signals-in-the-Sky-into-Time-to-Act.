import os
import sys
import numpy as np
import xarray as xr
import requests
from pathlib import Path
from scipy.spatial import cKDTree
from dotenv import load_dotenv

# ============================================================
# PATHS
# ============================================================

BASE = Path(r"C:\ClimateVerse-AI")

FEATURE_FILE = (
    BASE
    / r"data\ecmwf\maharashtra\maharashtra_ecmwf_features_rain.nc"
)

OUTPUT_FILE = (
    BASE
    / r"data\ecmwf\maharashtra\maharashtra_ecmwf_features_rh.nc"
)

# ============================================================
# ENV
# ============================================================

load_dotenv(BASE / ".env")

IMD_EMAIL = os.getenv("IMD_EMAIL")
IMD_PASSWORD = os.getenv("IMD_PASSWORD")
IMD_API_KEY = os.getenv("IMD_API_KEY")

IMD_BASE_URL = "https://api.imd.gov.in"

if not IMD_EMAIL or not IMD_PASSWORD or not IMD_API_KEY:
    raise RuntimeError(
        "IMD_EMAIL / IMD_PASSWORD / IMD_API_KEY missing in .env"
    )

# ============================================================
# IMD AUTH
# ============================================================

print("=" * 70)
print("CLIMATEVERSE AI - IMD RH -> ECMWF GRID")
print("=" * 70)

print("\nAuthenticating with IMD...")

token_response = requests.post(
    f"{IMD_BASE_URL}/api/oauth/token.php",
    json={
        "email": IMD_EMAIL,
        "password": IMD_PASSWORD
    },
    headers={
        "Content-Type": "application/json"
    },
    timeout=20
)

token_response.raise_for_status()

token_data = token_response.json()

token = token_data.get("access_token")

if not token:
    raise RuntimeError(
        f"IMD token not received: {token_data}"
    )

print("IMD authentication: OK")

# ============================================================
# GET AWS DATA
# ============================================================

print("\nDownloading IMD AWS data...")

response = requests.get(
    f"{IMD_BASE_URL}/api/v1/aws_data",
    headers={
        "X-API-KEY": IMD_API_KEY,
        "Authorization": f"Bearer {token}"
    },
    timeout=30
)

if response.status_code != 200:
    print("Status:", response.status_code)
    print("Response:", response.text[:1000])
    response.raise_for_status()

raw = response.json()

# ============================================================
# NORMALIZE RESPONSE
# ============================================================

if isinstance(raw, list):
    stations = raw

elif isinstance(raw, dict):
    stations = (
        raw.get("data")
        or raw.get("aws_data")
        or raw.get("stations")
        or []
    )

else:
    stations = []

print("AWS records received:", len(stations))

if not stations:
    raise RuntimeError(
        "IMD AWS response contains no station records."
    )

# ============================================================
# EXTRACT RH
# ============================================================

station_points = []

for station in stations:

    state = str(
        station.get("STATE", "")
    ).strip().upper()

    if state and state != "MAHARASHTRA":
        continue

    try:
        lat = float(station.get("Latitude"))
        lon = float(station.get("Longitude"))
        rh = float(station.get("RH"))
    except (TypeError, ValueError):
        continue

    # Valid Maharashtra-ish region
    if not (
        15.0 <= lat <= 23.0
        and
        71.0 <= lon <= 82.0
    ):
        continue

    # RH physical range
    if not (
        np.isfinite(rh)
        and 0 <= rh <= 100
    ):
        continue

    station_points.append(
        (lat, lon, rh)
    )

print(
    "Valid Maharashtra RH stations:",
    len(station_points)
)

if len(station_points) < 3:
    raise RuntimeError(
        "Less than 3 valid RH stations available."
    )

# ============================================================
# REMOVE DUPLICATE COORDINATES
# ============================================================

unique = {}

for lat, lon, rh in station_points:

    key = (
        round(lat, 5),
        round(lon, 5)
    )

    unique[key] = rh

station_points = [
    (lat, lon, rh)
    for (lat, lon), rh in unique.items()
]

print(
    "Unique RH stations:",
    len(station_points)
)

# ============================================================
# LOAD ECMWF GRID
# ============================================================

print("\nLoading ECMWF feature grid...")

ds = xr.open_dataset(
    FEATURE_FILE
)

latitudes = ds.latitude.values
longitudes = ds.longitude.values

lon_grid, lat_grid = np.meshgrid(
    longitudes,
    latitudes
)

grid_points = np.column_stack(
    [
        lat_grid.ravel(),
        lon_grid.ravel()
    ]
)

stations_xy = np.array(
    [
        [lat, lon]
        for lat, lon, rh in station_points
    ]
)

stations_rh = np.array(
    [
        rh
        for lat, lon, rh in station_points
    ],
    dtype=np.float32
)

# ============================================================
# IDW INTERPOLATION
# ============================================================

print("\nInterpolating RH onto ECMWF grid...")

k = min(8, len(stations_xy))

tree = cKDTree(
    stations_xy
)

distances, indexes = tree.query(
    grid_points,
    k=k
)

if k == 1:
    distances = distances[:, None]
    indexes = indexes[:, None]

# Prevent division by zero
distances = np.maximum(
    distances,
    1e-6
)

weights = 1.0 / distances

rh_grid = (
    np.sum(
        weights * stations_rh[indexes],
        axis=1
    )
    /
    np.sum(
        weights,
        axis=1
    )
)

rh_grid = rh_grid.reshape(
    len(latitudes),
    len(longitudes)
)

# Physical limits
rh_grid = np.clip(
    rh_grid,
    0,
    100
).astype(np.float32)

# ============================================================
# ADD FEATURE
# ============================================================

ds["relative_humidity"] = (
    ("latitude", "longitude"),
    rh_grid
)

ds["relative_humidity"].attrs = {
    "units": "%",
    "source": "IMD AWS",
    "method": "Inverse Distance Weighting",
}

# ============================================================
# SAVE
# ============================================================

print("\nSaving output...")

ds.to_netcdf(
    OUTPUT_FILE
)

# ============================================================
# VERIFY
# ============================================================

rh = ds["relative_humidity"]

print("\n" + "=" * 70)
print("SUCCESS")
print("=" * 70)

print("\nOutput:")
print(OUTPUT_FILE)

print("\nGrid:")
print(
    len(latitudes),
    "x",
    len(longitudes)
)

print("\nRelative Humidity:")
print(
    f"MIN  : {float(rh.min()):.2f} %"
)

print(
    f"MAX  : {float(rh.max()):.2f} %"
)

print(
    f"MEAN : {float(rh.mean()):.2f} %"
)

print(
    "\nTotal features:",
    len(ds.data_vars)
)

print("\n37 -> 38 FEATURES COMPLETE")

ds.close()