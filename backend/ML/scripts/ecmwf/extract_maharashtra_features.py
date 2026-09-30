from pathlib import Path

import numpy as np
import xarray as xr
import cfgrib


# ============================================================
# CLIMATEVERSE AI
# ECMWF -> MAHARASHTRA FEATURE ENGINEERING
# ============================================================

BASE_DIR = Path(r"C:\ClimateVerse-AI")

DATA_DIR = (
    BASE_DIR
    / "data"
    / "ecmwf"
    / "maharashtra"
)

SURFACE_FILE = (
    DATA_DIR
    / "ecmwf_maharashtra_surface.grib2"
)

PRESSURE_FILE = (
    DATA_DIR
    / "ecmwf_maharashtra_pressure.grib2"
)

OUTPUT_FILE = (
    DATA_DIR
    / "maharashtra_ecmwf_features.nc"
)


# ============================================================
# REGION
# ============================================================

NORTH = 22.5
SOUTH = 15.0
WEST = 71.5
EAST = 81.5


print()
print("=" * 75)
print("     CLIMATEVERSE AI - ECMWF FEATURE ENGINEERING")
print("=" * 75)
print()


# ============================================================
# CHECK FILES
# ============================================================

if not SURFACE_FILE.exists():
    raise FileNotFoundError(
        f"Surface file not found:\n{SURFACE_FILE}"
    )

if not PRESSURE_FILE.exists():
    raise FileNotFoundError(
        f"Pressure file not found:\n{PRESSURE_FILE}"
    )


# ============================================================
# LOAD GRIB DATA
# ============================================================

print("Loading surface GRIB...")

surface_datasets = cfgrib.open_datasets(
    str(SURFACE_FILE)
)

print(
    f"Surface datasets found: "
    f"{len(surface_datasets)}"
)


print()
print("Loading pressure GRIB...")

pressure_datasets = cfgrib.open_datasets(
    str(PRESSURE_FILE)
)

print(
    f"Pressure datasets found: "
    f"{len(pressure_datasets)}"
)


# ============================================================
# FIND VARIABLE
# ============================================================

def find_variable(datasets, variable_name):

    for ds in datasets:

        if variable_name in ds.data_vars:
            return ds[variable_name]

    raise KeyError(
        f"Variable '{variable_name}' not found"
    )


# ============================================================
# SURFACE VARIABLES
# ============================================================

print()
print("Finding surface variables...")


u10 = find_variable(
    surface_datasets,
    "u10"
)

v10 = find_variable(
    surface_datasets,
    "v10"
)

t2m = find_variable(
    surface_datasets,
    "t2m"
)

d2m = find_variable(
    surface_datasets,
    "d2m"
)

sp = find_variable(
    surface_datasets,
    "sp"
)

tp = find_variable(
    surface_datasets,
    "tp"
)

mucape = find_variable(
    surface_datasets,
    "mucape"
)


# ============================================================
# PRESSURE DATASET
# ============================================================

print()
print("Finding pressure-level dataset...")


pressure_ds = None

for ds in pressure_datasets:

    if (
        "u" in ds.data_vars
        and "v" in ds.data_vars
        and "t" in ds.data_vars
        and "r" in ds.data_vars
    ):

        pressure_ds = ds
        break


if pressure_ds is None:

    raise RuntimeError(
        "850/500 hPa pressure dataset not found."
    )


# ============================================================
# CROP FUNCTION
# ============================================================

def crop_latlon(data):

    lat = data.latitude.values

    lon = data.longitude.values

    # Latitude in ECMWF is normally descending:
    # 90 -> -90

    if lat[0] > lat[-1]:

        data = data.sel(
            latitude=slice(
                NORTH,
                SOUTH
            )
        )

    else:

        data = data.sel(
            latitude=slice(
                SOUTH,
                NORTH
            )
        )

    data = data.sel(
        longitude=slice(
            WEST,
            EAST
        )
    )

    return data


# ============================================================
# CROP SURFACE
# ============================================================

print()
print("Cropping surface data...")


u10 = crop_latlon(u10)
v10 = crop_latlon(v10)

t2m = crop_latlon(t2m)
d2m = crop_latlon(d2m)

sp = crop_latlon(sp)
tp = crop_latlon(tp)

mucape = crop_latlon(mucape)


# ============================================================
# CROP PRESSURE
# ============================================================

print("Cropping pressure data...")


pressure_ds = pressure_ds.sel(
    latitude=slice(
        NORTH,
        SOUTH
    ),
    longitude=slice(
        WEST,
        EAST
    )
)


print()
print(
    "Cropped grid:",
    len(u10.latitude),
    "x",
    len(u10.longitude)
)


# ============================================================
# PRESSURE LEVELS
# ============================================================

print()
print("Selecting 850 hPa and 500 hPa...")


u850 = pressure_ds["u"].sel(
    isobaricInhPa=850
)

v850 = pressure_ds["v"].sel(
    isobaricInhPa=850
)

u500 = pressure_ds["u"].sel(
    isobaricInhPa=500
)

v500 = pressure_ds["v"].sel(
    isobaricInhPa=500
)

t850 = pressure_ds["t"].sel(
    isobaricInhPa=850
)

t500 = pressure_ds["t"].sel(
    isobaricInhPa=500
)

rh850 = pressure_ds["r"].sel(
    isobaricInhPa=850
)

rh500 = pressure_ds["r"].sel(
    isobaricInhPa=500
)


# ============================================================
# CROP PRESSURE VARIABLES INDIVIDUALLY
# ============================================================

u850 = crop_latlon(u850)
v850 = crop_latlon(v850)

u500 = crop_latlon(u500)
v500 = crop_latlon(v500)

t850 = crop_latlon(t850)
t500 = crop_latlon(t500)

rh850 = crop_latlon(rh850)
rh500 = crop_latlon(rh500)


# ============================================================
# WIND SPEED
# ============================================================

print()
print("Calculating wind speed...")


wind_speed_10m = np.sqrt(
    u10 ** 2
    +
    v10 ** 2
)

wind_speed_850 = np.sqrt(
    u850 ** 2
    +
    v850 ** 2
)

wind_speed_500 = np.sqrt(
    u500 ** 2
    +
    v500 ** 2
)


# ============================================================
# WIND DIRECTION
# ============================================================

print("Calculating wind direction...")


def meteorological_direction(u, v):

    direction = (
        np.degrees(
            np.arctan2(
                -u,
                -v
            )
        )
        + 360
    ) % 360

    return direction


wind_direction_10m = (
    meteorological_direction(
        u10,
        v10
    )
)

wind_direction_850 = (
    meteorological_direction(
        u850,
        v850
    )
)

wind_direction_500 = (
    meteorological_direction(
        u500,
        v500
    )
)


# ============================================================
# TEMPERATURE / DEWPOINT
# ============================================================

print("Calculating temperature features...")


temperature_c = (
    t2m - 273.15
)

dewpoint_c = (
    d2m - 273.15
)

dewpoint_depression = (
    temperature_c
    -
    dewpoint_c
)

temperature_dewpoint_diff = (
    temperature_c
    -
    dewpoint_c
)


# ============================================================
# PRESSURE
# ============================================================

surface_pressure_hpa = (
    sp / 100.0
)


# ============================================================
# VERTICAL WIND SHEAR
# ============================================================

print("Calculating vertical wind shear...")


du_850_500 = (
    u500 - u850
)

dv_850_500 = (
    v500 - v850
)

vertical_wind_shear_850_500 = np.sqrt(
    du_850_500 ** 2
    +
    dv_850_500 ** 2
)


# ============================================================
# SPATIAL DERIVATIVES
# ============================================================

def calculate_horizontal_derivatives(
    u,
    v
):

    lat = u.latitude.values
    lon = u.longitude.values

    earth_radius = 6371000.0

    lat_rad = np.deg2rad(lat)
    lon_rad = np.deg2rad(lon)

    cos_lat = np.cos(lat_rad)

    dlon = np.gradient(
        lon_rad
    )

    dlat = np.gradient(
        lat_rad
    )

    dx = (
        earth_radius
        *
        cos_lat[:, None]
        *
        dlon[None, :]
    )

    dy = (
        earth_radius
        *
        dlat[:, None]
    )

    u_values = np.asarray(
        u.values,
        dtype=np.float64
    )

    v_values = np.asarray(
        v.values,
        dtype=np.float64
    )

    du_dy = (
        np.gradient(
            u_values,
            axis=0
        )
        /
        dy
    )

    dv_dx = (
        np.gradient(
            v_values,
            axis=1
        )
        /
        dx
    )

    du_dx = (
        np.gradient(
            u_values,
            axis=1
        )
        /
        dx
    )

    dv_dy = (
        np.gradient(
            v_values,
            axis=0
        )
        /
        dy
    )

    return (
        du_dx,
        du_dy,
        dv_dx,
        dv_dy
    )


# ============================================================
# 850 hPa VORTICITY / CONVERGENCE
# ============================================================

print()
print(
    "Calculating 850 hPa vorticity..."
)


(
    du_dx_850,
    du_dy_850,
    dv_dx_850,
    dv_dy_850
) = calculate_horizontal_derivatives(
    u850,
    v850
)


vorticity_850_values = (
    dv_dx_850
    -
    du_dy_850
)


divergence_850_values = (
    du_dx_850
    +
    dv_dy_850
)


low_level_convergence_values = (
    -divergence_850_values
)


vorticity_850 = xr.DataArray(
    vorticity_850_values,
    coords=u850.coords,
    dims=u850.dims,
    name="vorticity_850"
)


low_level_convergence = xr.DataArray(
    low_level_convergence_values,
    coords=u850.coords,
    dims=u850.dims,
    name="low_level_convergence"
)


# ============================================================
# 500 hPa VORTICITY
# ============================================================

print(
    "Calculating 500 hPa vorticity..."
)


(
    du_dx_500,
    du_dy_500,
    dv_dx_500,
    dv_dy_500
) = calculate_horizontal_derivatives(
    u500,
    v500
)


vorticity_500_values = (
    dv_dx_500
    -
    du_dy_500
)


vorticity_500 = xr.DataArray(
    vorticity_500_values,
    coords=u500.coords,
    dims=u500.dims,
    name="vorticity_500"
)
# ============================================================
# CLEAN GRIB METADATA COORDINATES
# ============================================================
#
# ECMWF surface parameters come from different heights:
#
# u10 / v10 -> 10 m
# t2m / d2m -> 2 m
#
# When combining them into one xarray Dataset,
# heightAboveGround causes coordinate conflicts.
#
# It is metadata, not one of our ML features,
# so remove it before merging.
# ============================================================

print()
print("Cleaning GRIB metadata coordinates...")


def clean_grib_coordinate(data):

    for coord_name in [
        "heightAboveGround",
        "surface",
        "mostUnstableParcel",
        "isobaricInhPa",
    ]:

        if coord_name in data.coords:

            data = data.drop_vars(
                coord_name
            )

    return data


# Surface
u10 = clean_grib_coordinate(u10)
v10 = clean_grib_coordinate(v10)

t2m = clean_grib_coordinate(t2m)
d2m = clean_grib_coordinate(d2m)

sp = clean_grib_coordinate(sp)
tp = clean_grib_coordinate(tp)

mucape = clean_grib_coordinate(mucape)


# Pressure-level derived variables
u850 = clean_grib_coordinate(u850)
v850 = clean_grib_coordinate(v850)

u500 = clean_grib_coordinate(u500)
v500 = clean_grib_coordinate(v500)

t850 = clean_grib_coordinate(t850)
t500 = clean_grib_coordinate(t500)

rh850 = clean_grib_coordinate(rh850)
rh500 = clean_grib_coordinate(rh500)


# Derived variables
wind_speed_10m = clean_grib_coordinate(
    wind_speed_10m
)

wind_speed_850 = clean_grib_coordinate(
    wind_speed_850
)

wind_speed_500 = clean_grib_coordinate(
    wind_speed_500
)

wind_direction_10m = clean_grib_coordinate(
    wind_direction_10m
)

wind_direction_850 = clean_grib_coordinate(
    wind_direction_850
)

wind_direction_500 = clean_grib_coordinate(
    wind_direction_500
)

temperature_c = clean_grib_coordinate(
    temperature_c
)

dewpoint_c = clean_grib_coordinate(
    dewpoint_c
)

dewpoint_depression = clean_grib_coordinate(
    dewpoint_depression
)

temperature_dewpoint_diff = clean_grib_coordinate(
    temperature_dewpoint_diff
)

surface_pressure_hpa = clean_grib_coordinate(
    surface_pressure_hpa
)

du_850_500 = clean_grib_coordinate(
    du_850_500
)

dv_850_500 = clean_grib_coordinate(
    dv_850_500
)

vertical_wind_shear_850_500 = clean_grib_coordinate(
    vertical_wind_shear_850_500
)

vorticity_850 = clean_grib_coordinate(
    vorticity_850
)

vorticity_500 = clean_grib_coordinate(
    vorticity_500
)

low_level_convergence = clean_grib_coordinate(
    low_level_convergence
)

# ============================================================
# BUILD DATASET
# ============================================================

print()
print("Building feature dataset...")


features = xr.Dataset({

    "u10": u10,

    "v10": v10,

    "wind_speed_10m":
        wind_speed_10m,

    "t2m": t2m,

    "d2m": d2m,

    "temperature_c":
        temperature_c,

    "dewpoint_c":
        dewpoint_c,

    "dewpoint_depression":
        dewpoint_depression,

    "sp": sp,

    "surface_pressure_hpa":
        surface_pressure_hpa,

    "tp": tp,

    "mucape": mucape,

    "u850": u850,

    "v850": v850,

    "u500": u500,

    "v500": v500,

    "t850": t850,

    "t500": t500,

    "rh850": rh850,

    "rh500": rh500,

    "wind_speed_850":
        wind_speed_850,

    "wind_speed_500":
        wind_speed_500,

    "wind_direction_10m":
        wind_direction_10m,

    "wind_direction_850":
        wind_direction_850,

    "wind_direction_500":
        wind_direction_500,

    "vertical_wind_shear_850_500":
        vertical_wind_shear_850_500,

    "du_850_500":
        du_850_500,

    "dv_850_500":
        dv_850_500,

    "vorticity_850":
        vorticity_850,

    "vorticity_500":
        vorticity_500,

    "low_level_convergence":
        low_level_convergence,

    "temperature_dewpoint_diff":
        temperature_dewpoint_diff,

})


# ============================================================
# ATTRIBUTES
# ============================================================

features.attrs["project"] = (
    "ClimateVerse AI"
)

features.attrs["source"] = (
    "ECMWF IFS Open Data"
)

features.attrs["resolution"] = (
    "0.25 degree"
)

features.attrs["region"] = (
    "Maharashtra + buffer"
)

features.attrs["forecast_step"] = (
    "0 hour"
)


# ============================================================
# SAVE
# ============================================================

print()
print("Saving feature dataset...")

print(
    OUTPUT_FILE
)


features.to_netcdf(
    OUTPUT_FILE
)


# ============================================================
# VALIDATION
# ============================================================

print()
print("=" * 75)
print("       FEATURE EXTRACTION SUCCESS")
print("=" * 75)

print()

print("Output:")
print(OUTPUT_FILE)

print()

print("Dimensions:")
print(features.dims)

print()

print(
    "Latitude range:",
    float(features.latitude.min()),
    "to",
    float(features.latitude.max())
)

print(
    "Longitude range:",
    float(features.longitude.min()),
    "to",
    float(features.longitude.max())
)

print()

print("Features:")

for name in features.data_vars:

    print(
        "  ✓",
        name
    )

print()

print(
    "Total features:",
    len(features.data_vars)
)

print()

print("SUCCESS!")