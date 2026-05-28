# backend/import_all_cities.py
import json
import os
from sqlalchemy import text  # 👈 Crucial import for SQLAlchemy 2.0+
from database import SessionLocal, engine, Base
from models import Road

Base.metadata.create_all(bind=engine)

def import_geojson(db, file_path, city_tag):
    if not os.path.exists(file_path):
        print(f"⚠️ Skipping {city_tag}: File not found at {file_path}")
        return 0

    print(f"📖 Processing true geographical assets for: {city_tag}...")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    count = 0
    for feature in data.get("features", []):
        geom = feature.get("geometry")
        if not geom or geom.get("type") != "LineString":
            continue

        props = feature.get("properties", {})
        road_name = props.get("name") or props.get("ref") or f"{city_tag} Link Line"
        road_type = props.get("highway") or "Primary"

        # Apply localized rules programmatically based on city origin
        if city_tag == "London":
            currency = "GBP"
            authority = "Transport for London (TfL)"
            email = "surface-complaints@tfl.gov.uk"
            source = f"OSM UK Core ID: {feature.get('id', 'Unknown')}"
            contractor = "Balfour Beatty Infrastructure Plc"
        else:  # Delhi
            currency = "INR"
            authority = "Public Works Department (PWD) Delhi"
            email = "pwd-roads@delhi.gov.in"
            source = "Delhi State Asset Transparency Registry"
            contractor = "Delhi Infrastructure Development Group"

        new_road = Road(
            name=road_name,
            type=road_type.capitalize(),
            condition="Good",
            lastRepaired="14-Jan-2025",
            contractor=contractor,
            budgetSanctioned=5000000.0 if currency == "INR" else 450000.0,
            budgetSpent=4200000.0 if currency == "INR" else 385000.0,
            geometry=json.dumps(geom["coordinates"]),
            currency_code=currency,
            budget_source=source,
            authority_name=authority,
            authority_email=email
        )
        db.add(new_road)
        count += 1
        if count % 200 == 0:
            db.commit()
            
    db.commit()
    print(f"✅ Loaded {count} tracks for {city_tag}.")
    return count

def main():
    db = SessionLocal()
    
    # 🌟 FIXED: Explicitly wrapped strings inside text() constructors
    try:
        print("🧹 Clearing old database entries safely...")
        db.execute(text("TRUNCATE TABLE complaints CASCADE;"))
        db.execute(text("TRUNCATE TABLE roads CASCADE;"))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"⚠️ Warning during truncate: {e}")

    import_geojson(db, "data/roads.geojson", "Delhi")
    import_geojson(db, "data/london_roads.geojson", "London")
    db.close()

if __name__ == "__main__":
    main()