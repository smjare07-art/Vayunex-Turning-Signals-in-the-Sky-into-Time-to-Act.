import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from pathlib import Path

CSV = Path(r"C:\Vayunex\ML\prediction\final_multi_hazard_predictions.csv")
BOUNDARY_DIR = Path(r"C:\Vayunex\data\boundaries")

print("=" * 60)
print("VAYUNEX - MAHARASHTRA GRID FILTER")
print("=" * 60)

print("\nLoading prediction coordinates...")

df = pd.read_csv(
    CSV,
    usecols=["latitude", "longitude"]
).drop_duplicates()

print(f"Prediction grid points : {len(df)}")

# ---------------------------------------------------------
# Find Maharashtra boundary shapefile
# ---------------------------------------------------------

shp_files = list(BOUNDARY_DIR.glob("*.shp"))

print("\nAvailable shapefiles:")
for shp in shp_files:
    print(" -", shp.name)

if not shp_files:
    raise FileNotFoundError("No shapefile found in data/boundaries")

# Prefer ADM1 file
maha_candidates = [
    p for p in shp_files
    if "IND_1" in p.name
]

if maha_candidates:
    shp = maha_candidates[0]
else:
    shp = shp_files[0]

print("\nUsing boundary:")
print(shp)

gdf = gpd.read_file(shp)

print("\nBoundary columns:")
print(gdf.columns.tolist())

print("\nNumber of boundary records:", len(gdf))

# ---------------------------------------------------------
# Identify Maharashtra
# ---------------------------------------------------------

name_columns = [
    "NAME_1",
    "NAME1",
    "name_1",
    "NAME",
    "name"
]

state_col = None

for col in name_columns:
    if col in gdf.columns:
        state_col = col
        break

if state_col is None:
    raise ValueError(
        "Could not identify state-name column."
    )

print("State column:", state_col)

print("\nAvailable state names:")
print(gdf[state_col].dropna().unique())

maha = gdf[
    gdf[state_col].astype(str).str.lower().str.strip()
    == "maharashtra"
].copy()

if maha.empty:
    raise ValueError(
        "Maharashtra boundary not found."
    )

# ---------------------------------------------------------
# Ensure CRS
# ---------------------------------------------------------

if gdf.crs is None:
    raise ValueError("Boundary CRS is missing.")

points = gpd.GeoDataFrame(
    df,
    geometry=[
        Point(lon, lat)
        for lat, lon in zip(df.latitude, df.longitude)
    ],
    crs="EPSG:4326"
)

maha = maha.to_crs("EPSG:4326")

# ---------------------------------------------------------
# Spatial filter
# ---------------------------------------------------------

inside = gpd.sjoin(
    points,
    maha[["geometry"]],
    how="inner",
    predicate="within"
)

inside = inside[
    ["latitude", "longitude"]
].drop_duplicates()

print("\n" + "=" * 60)
print("RESULT")
print("=" * 60)

print("Maharashtra grid cells:", len(inside))

print("\nLatitude range:")
print(inside.latitude.min(), "->", inside.latitude.max())

print("\nLongitude range:")
print(inside.longitude.min(), "->", inside.longitude.max())

# ---------------------------------------------------------
# Save grid
# ---------------------------------------------------------

output = Path(
    r"C:\Vayunex\data\maharashtra_prediction_grid.csv"
)

inside.to_csv(output, index=False)

print("\nSaved:")
print(output)

print("\nFirst 20 cells:")
print(inside.head(20).to_string(index=False))
