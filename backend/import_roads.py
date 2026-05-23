import json
import os
import random

from database import SessionLocal
from models import Road

def classify_road(highway):
    if highway in ["motorway", "trunk"]:
        return "NH"
    elif highway in ["primary", "secondary"]:
        return "SH"
    else:
        return "Local"

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

        if geometry.get("type") != "LineString":
            continue

        coords = geometry.get("coordinates", [])
        if len(coords) < 2:
            continue

        start = coords[0]
        end = coords[-1]

        highway = props.get("highway", "unknown")

        road = Road(
            name=props.get("name", "Unnamed Road"),
            type=classify_road(highway),

            start_lat=start[1],
            start_lng=start[0],
            end_lat=end[1],
            end_lng=end[0],

            # dummy realistic data
            contractor=random.choice(["ABC Infra", "XYZ Constructions", "Govt Works"]),
            lastRepaired=str(random.randint(2015, 2024)),

            budgetSanctioned=random.randint(1000000, 10000000),
            budgetSpent=random.randint(800000, 12000000)
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