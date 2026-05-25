import json
import os
import random

from database import SessionLocal
from models import Road


# ✅ Better classification (UI-friendly)
def classify_road(highway):
    if highway in ["motorway", "trunk"]:
        return "primary"
    elif highway in ["primary"]:
        return "primary"
    elif highway in ["secondary"]:
        return "secondary"
    else:
        return "tertiary"


# ✅ Ignore useless small roads
def is_valid_road(highway):
    return highway in [
        "motorway", "trunk",
        "primary", "secondary",
        "tertiary"
    ]


def import_roads():
    db = SessionLocal()

    base_dir = os.path.dirname(__file__)
    file_path = os.path.join(base_dir, "data", "roads.geojson")

    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)

    count = 0

    for feature in data["features"]:
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {})

        highway = props.get("highway")

        # ❌ skip garbage roads
        if not is_valid_road(highway):
            continue

        coords_list = []

        # ✅ handle BOTH types
        if geometry.get("type") == "LineString":
            coords_list = [geometry.get("coordinates", [])]

        elif geometry.get("type") == "MultiLineString":
            coords_list = geometry.get("coordinates", [])

        else:
            continue

        for coords in coords_list:

            if len(coords) < 2:
                continue

            geometry_json = json.dumps(coords)

            road = Road(
                name=props.get("name", "Unnamed Road"),

                # ✅ consistent with frontend
                type=classify_road(highway),

                condition="Good",  # ✅ IMPORTANT FIX

                geometry=geometry_json,

                contractor=random.choice([
                    "ABC Infra",
                    "XYZ Constructions",
                    "Govt Works"
                ]),

                lastRepaired=str(random.randint(2015, 2024)),

                budgetSanctioned=random.randint(1_000_000, 10_000_000),
                budgetSpent=random.randint(800_000, 12_000_000)
            )

            db.add(road)
            count += 1

            if count % 500 == 0:
                db.commit()
                print(f"{count} roads inserted...")

    db.commit()
    db.close()

    print(f"✅ Done. Total roads inserted: {count}")


if __name__ == "__main__":
    import_roads()