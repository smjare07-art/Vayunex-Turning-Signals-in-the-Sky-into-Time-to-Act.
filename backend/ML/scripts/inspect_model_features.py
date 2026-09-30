import pickle
import json
from pathlib import Path

MODEL_DIR = Path(r"C:\Vayunex\ML\models")

print("=" * 70)
print("VAYUNEX - MODEL FEATURE INSPECTOR")
print("=" * 70)

for pkl_file in sorted(MODEL_DIR.glob("*features.pkl")):

    print("\n" + "-" * 70)
    print("FILE:", pkl_file.name)

    try:

        with open(pkl_file, "rb") as f:
            obj = pickle.load(f)

        print("TYPE:", type(obj))

        if isinstance(obj, (list, tuple)):
            print("COUNT:", len(obj))
            print("FEATURES:")

            for i, feature in enumerate(obj):
                print(f"{i:03d}: {feature}")

        elif isinstance(obj, dict):

            print("DICT KEYS:")
            print(list(obj.keys()))

            for key, value in obj.items():

                print(
                    f"\n{key}: "
                    f"type={type(value)}, "
                    f"value={value}"
                )

        else:

            print("VALUE:")
            print(obj)

    except Exception as e:

        print("ERROR:", repr(e))


print("\n" + "=" * 70)
print("MODEL METADATA")
print("=" * 70)

for json_file in sorted(
    MODEL_DIR.glob("*metadata.json")
):

    print("\n" + "-" * 70)
    print("FILE:", json_file.name)

    try:

        with open(
            json_file,
            "r",
            encoding="utf-8"
        ) as f:

            obj = json.load(f)

        print(
            json.dumps(
                obj,
                indent=2
            )
        )

    except Exception as e:

        print("ERROR:", repr(e))
