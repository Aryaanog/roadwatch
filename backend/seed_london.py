# seed_london.py
import json
from database import SessionLocal, engine, Base
from models import Road

# Ensure clean data tables are initialized
Base.metadata.create_all(bind=engine)

def seed_london_data():
    db = SessionLocal()
    
    # Inside backend/seed_london.py
    with open("data/london_roads.geojson", "r", encoding="utf-8") as f:
        geojson_data = json.load(f)

    features = geojson_data.get("features", [])
    print(f"Discovered {len(features)} real infrastructure segments. Injecting entries...")

    count = 0
    for feature in features:
        # Filter for valid line strings
        if feature["geometry"]["type"] != "LineString":
            continue

        props = feature.get("properties", {})
        
        # Pull the real street name if available, otherwise name by classification
        road_name = props.get("name", props.get("ref", "Unidentified London Link"))
        road_type = props.get("highway", "Primary Route")

        # Setup realistic community datasets tailored for the UK
        new_road = Road(
            name=road_name,
            type=road_type.capitalize(),
            geometry=json.dumps(feature["geometry"]["coordinates"]),
            lastRepaired="14-Oct-2024",
            contractor="Balfour Beatty Infrastructure Plc",
            budgetSanctioned=450000,
            budgetSpent=385000,
            currency_code="GBP", # Swaps frontend rendering instantly to £
            budget_source=f"TfL Asset ID: {feature.get('id', 'Unknown')}",
            authority_name="Transport for London (TfL) Highways Division",
            authority_email="surface-complaints@tfl.gov.uk"  # Direct dynamic reporting route
        )
        
        db.add(new_road)
        count += 1
        
        # Commit in reasonable chunks
        if count % 100 == 0:
            db.commit()

    db.commit()
    db.close()
    print(f"Successfully loaded {count} real London road segments into the database!")

if __name__ == "__main__":
    seed_london_data()