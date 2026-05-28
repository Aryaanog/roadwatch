# backend/import_roads.py
import json
import os
from database import SessionLocal, engine, Base
from models import Road

# Reinitialize empty tables dynamically if you dropped them to start completely fresh
Base.metadata.create_all(bind=engine)

def import_delhi_network():
    db = SessionLocal()
    
    file_path = "data/roads.geojson"
    if not os.path.exists(file_path):
        print(f"❌ Error: Could not locate file at {file_path}. Please double-check your directory structure layout.")
        return

    print("📖 Opening roads.geojson data payload...")
    with open(file_path, "r", encoding="utf-8") as f:
        geojson_data = json.load(f)

    features = geojson_data.get("features", [])
    print(f"⚡ Discovered {len(features)} road tracks. Injecting clean parameters into PostgreSQL...")

    count = 0
    for feature in features:
        geom = feature.get("geometry")
        if not geom or geom.get("type") != "LineString":
            continue  # Skip points or invalid markers to keep line mapping safe

        props = feature.get("properties", {})

        # Dynamic parameter mapping - reads your previous keys or cleanly defaults them to Delhi metrics
        road_name = props.get("name") or props.get("road_name") or f"Delhi Street Line #{count+1}"
        road_type = props.get("type") or props.get("highway") or "Arterial Road"
        road_condition = props.get("condition") or "Good"
        
        # Budget numbers: reads previous metrics, defaults safely to double precision numbers
        budget_sanc = float(props.get("budgetSanctioned") or 5000000.0)
        budget_spent = float(props.get("budgetSpent") or 4200000.0)
        last_repaired = props.get("lastRepaired") or "10-Nov-2025"
        contractor = props.get("contractor") or "Delhi Infrastructure Development Group"

        # Construct the unified data record model
        new_road = Road(
            name=road_name,
            type=road_type,
            condition=road_condition,
            lastRepaired=last_repaired,
            contractor=contractor,
            budgetSanctioned=budget_sanc,
            budgetSpent=budget_spent,
            geometry=json.dumps(geom["coordinates"]), # Encodes string coordinate array natively for Text columns
            
            # 🌍 AI Global Enforcers: Fall back to localized India endpoints for these roads
            currency_code="INR",
            budget_source="Delhi State Asset Transparency Registry",
            authority_name="Public Works Department (PWD) Delhi",
            authority_email="pwd-roads@delhi.gov.in"
        )

        db.add(new_road)
        count += 1

        # Periodic batch commits to handle large geojson files quickly without freezing memory
        if count % 200 == 0:
            db.commit()
            print(f"  -> {count} features committed successfully...")

    db.commit()
    db.close()
    print(f"\n🎉 SUCCESS: {count} Delhi road strings successfully integrated into local PostgreSQL system!")

if __name__ == "__main__":
    import_delhi_network()