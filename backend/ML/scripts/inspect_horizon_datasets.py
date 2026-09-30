from pathlib import Path
import pandas as pd

BASE = Path("data/processed/xgboost")

FILES = [
    "thunderstorm_2h.parquet",
    "thunderstorm_4h.parquet",
    "thunderstorm_6h.parquet",
    "cloudburst_proxy_2h.parquet",
    "cloudburst_proxy_4h.parquet",
    "cloudburst_proxy_6h.parquet",
    "flashflood_2h.parquet",
    "flashflood_4h.parquet",
    "flashflood_6h.parquet",
]


def inspect_file(path: Path):
    print("\n" + "=" * 90)
    print(f"FILE: {path.name}")
    print("=" * 90)

    df = pd.read_parquet(path)

    print(f"Rows      : {len(df):,}")
    print(f"Columns   : {len(df.columns)}")

    print("\nColumns:")
    for i, col in enumerate(df.columns, start=1):
        print(f"{i:03d}. {col}")

    print("\nData types:")
    print(df.dtypes.to_string())

    print("\nMissing values:")
    missing = df.isna().sum()
    missing_pct = (missing / len(df) * 100).round(2)

    miss_df = pd.DataFrame({
        "missing": missing,
        "missing_pct": missing_pct
    })

    miss_df = miss_df[miss_df["missing"] > 0]

    if miss_df.empty:
        print("No missing values.")
    else:
        print(miss_df.sort_values("missing", ascending=False).to_string())

    print("\nPotential target columns:")

    target_candidates = [
        c for c in df.columns
        if any(
            word in c.lower()
            for word in [
                "target",
                "label",
                "hazard",
                "thunder",
                "storm",
                "cloudburst",
                "flashflood",
                "flood",
            ]
        )
    ]

    if target_candidates:
        for col in target_candidates:
            print(f"\n[{col}]")
            print(df[col].value_counts(dropna=False).head(20).to_string())
    else:
        print("No obvious target column detected.")

    print("\nFirst 3 rows:")
    print(df.head(3).to_string())


def main():
    print("\n")
    print("=" * 90)
    print("VAYUNEX - XGBOOST HORIZON DATASET INSPECTION")
    print("=" * 90)

    for filename in FILES:
        path = BASE / filename

        if not path.exists():
            print(f"\nMISSING FILE: {path}")
            continue

        try:
            inspect_file(path)
        except Exception as e:
            print(f"\nERROR reading {filename}")
            print(type(e).__name__, ":", e)

    print("\n" + "=" * 90)
    print("INSPECTION COMPLETE")
    print("=" * 90)


if __name__ == "__main__":
    main()