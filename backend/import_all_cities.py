# backend/import_all_cities.py
import json
import os
import random  # 👈 Added for generating realistic, dynamic mock finances
from sqlalchemy import text  # 👈 Crucial import for SQLAlchemy 2.0+
from database import SessionLocal, engine, Base
from models import Road

Base.metadata.create_all(bind=engine)

def import_geojson(db, file_path, city_tag):
    if not os.path.exists(file_path):
        print(f"⚠️ Skipping {city_tag}: File not found at {file_path}")
        return 0

    # 🗺️ Strict 4-Category Mapping Definition
    TIER_MAPPING = {
        "motorway": "Expressway",
        "motorway_link": "Expressway",
        "trunk": "Expressway",
        "trunk_link": "Expressway",
        
        "primary": "Primary",
        "primary_link": "Primary",
        
        "secondary": "Secondary",
        "secondary_link": "Secondary",
        
        "tertiary": "Tertiary",
        "tertiary_link": "Tertiary"
    }

    print(f"📖 Processing true geographical assets for: {city_tag}...")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    count = 0
    for feature in data.get("features", []):
        geom = feature.get("geometry")
        if not geom or geom.get("type") != "LineString":
            continue

        props = feature.get("properties", {})
        raw_road_type = (props.get("highway") or "").lower()

        # ⚡ Strict Filter: If it doesn't match our 4 specific groups, skip it completely
        if raw_road_type not in TIER_MAPPING:
            continue

        clean_road_type = TIER_MAPPING[raw_road_type]
        road_name = props.get("name") or props.get("ref") or f"{city_tag} Link Line"

        # Apply localized rules programmatically based on city origin
        if city_tag == "London":
            currency = "GBP"
            authority = "Transport for London (TfL)"
            email = "surface-complaints@tfl.gov.uk"
            source = f"OSM UK Core ID: {feature.get('id', 'Unknown')}"
            contractor = random.choice([
                "Balfour Beatty Infrastructure Plc", 
                "Eurovia UK Ltd", 
                "Tarmac Holdings Ltd"
            ])
            
            # Generate realistic localized mock numbers for London (£)
            if clean_road_type == "Expressway":
                base_budget = random.randint(800000, 1500000)
            elif clean_road_type == "Primary":
                base_budget = random.randint(400000, 750000)
            elif clean_road_type == "Secondary":
                base_budget = random.randint(150000, 350000)
            else:  # Tertiary
                base_budget = random.randint(50000, 120000)
                
        else:  # Delhi
            currency = "INR"
            authority = "Public Works Department (PWD) Delhi"
            email = "pwd-roads@delhi.gov.in"
            source = "Delhi State Asset Transparency Registry"
            contractor = random.choice([
                "Delhi Infrastructure Development Group",
                "L&T Infrastructure Engineering",
                "GMR Infrastructure Contractors"
            ])
            
            # Generate realistic localized mock numbers for Delhi (₹)
            if clean_road_type == "Expressway":
                base_budget = random.randint(7000000, 12000000)
            elif clean_road_type == "Primary":
                base_budget = random.randint(3500000, 6500000)
            elif clean_road_type == "Secondary":
                base_budget = random.randint(1500000, 3000000)
            else:  # Tertiary
                base_budget = random.randint(400000, 900000)

        # Calculate a realistic variant for Spent Budget (between 80% and 98% of Sanctioned)
        budget_sanctioned = float(base_budget)
        budget_spent = float(round(base_budget * random.uniform(0.80, 0.98), 2))

        new_road = Road(
            name=road_name,
            type=clean_road_type,
            condition="Good",
            lastRepaired=random.choice(["14-Jan-2025", "22-Nov-2024", "05-Mar-2025", "18-Aug-2024"]),
            contractor=contractor,
            budgetSanctioned=budget_sanctioned, 
            budgetSpent=budget_spent,  # 👈 Fixed: No longer Null, populated with realistic variance
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
    print(f"✅ Loaded {count} tracks with synchronized budget sheets for {city_tag}.")
    return count

def main():
    db = SessionLocal()
    
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