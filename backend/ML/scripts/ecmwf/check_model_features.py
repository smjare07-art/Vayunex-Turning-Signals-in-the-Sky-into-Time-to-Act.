from pathlib import Path
import pickle
import xarray as xr


# ============================================================
# CLIMATEVERSE AI
# ECMWF -> XGBOOST FEATURE COMPATIBILITY CHECK
# ============================================================

BASE_DIR = Path(r"C:\ClimateVerse-AI")

NC_FILE = (
    BASE_DIR
    / "data"
    / "ecmwf"
    / "maharashtra"
    / "maharashtra_ecmwf_features.nc"
)

MODEL_DIR = BASE_DIR / "ML" / "models"


MODEL_FEATURE_FILES = {
    "thunderstorm": (
        MODEL_DIR
        / "thunderstorm_2h_v2_features.pkl"
    ),

    "cloudburst": (
        MODEL_DIR
        / "cloudburst_2h_features.pkl"
    ),

    "flashflood": (
        MODEL_DIR
        / "flashflood_2h_features.pkl"
    ),
}


print()
print("=" * 75)
print("       CLIMATEVERSE AI - MODEL FEATURE CHECK")
print("=" * 75)
print()


# ============================================================
# LOAD ECMWF DATASET
# ============================================================

if not NC_FILE.exists():

    raise FileNotFoundError(
        f"ECMWF feature file not found:\n{NC_FILE}"
    )


ds = xr.open_dataset(NC_FILE)

available_features = set(ds.data_vars)


print("ECMWF feature dataset:")
print(NC_FILE)

print()
print("Available ECMWF features:")
print()


for feature in sorted(available_features):

    print("  ✓", feature)


print()
print(
    "Total ECMWF features:",
    len(available_features)
)


# ============================================================
# LOAD MODEL FEATURE LISTS
# ============================================================

for model_name, feature_file in MODEL_FEATURE_FILES.items():

    print()
    print("=" * 75)
    print(
        f"{model_name.upper()} MODEL"
    )
    print("=" * 75)

    if not feature_file.exists():

        print()
        print(
            "FEATURE FILE NOT FOUND:",
            feature_file
        )

        continue


    with open(
        feature_file,
        "rb"
    ) as f:

        model_features = pickle.load(f)


    # Handle different pickle formats
    if isinstance(model_features, dict):

        if "features" in model_features:
            model_features = model_features["features"]

        elif "feature_names" in model_features:
            model_features = model_features["feature_names"]


    model_features = list(
        model_features
    )


    print()
    print(
        "Model feature count:",
        len(model_features)
    )


    print()
    print("MODEL FEATURES:")
    print()


    for feature in model_features:

        if feature in available_features:

            print(
                "  ✓",
                feature
            )

        else:

            print(
                "  ✗ MISSING:",
                feature
            )


    available = [
        f
        for f in model_features
        if f in available_features
    ]


    missing = [
        f
        for f in model_features
        if f not in available_features
    ]


    print()
    print("-" * 75)

    print(
        "Compatible:",
        len(available),
        "/",
        len(model_features)
    )

    print(
        "Missing:",
        len(missing)
    )


    if missing:

        print()
        print("MISSING FEATURES:")

        for feature in missing:

            print(
                "  →",
                feature
            )


    print()
    print(
        "Compatibility:",
        round(
            len(available)
            /
            len(model_features)
            *
            100,
            2
        ),
        "%"
    )


# ============================================================
# CLOSE
# ============================================================

ds.close()


print()
print("=" * 75)
print("FEATURE COMPATIBILITY CHECK COMPLETED")
print("=" * 75)
print()