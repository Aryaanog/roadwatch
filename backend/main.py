from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import json

from database import SessionLocal, engine, Base
from models import Complaint, Road

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ CREATE TABLES
Base.metadata.create_all(bind=engine)


@app.get("/roads")
def get_roads():
    base_dir = os.path.dirname(__file__)
    file_path = os.path.join(base_dir, "data", "roads.geojson")

    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)

    return data

# 🔥 REPORT COMPLAINT (SAVE TO DB)
@app.post("/report")
def report_issue(data: dict):
    db = SessionLocal()

    lat = data["location"]["lat"]
    lng = data["location"]["lng"]

    routing = route_complaint(lat, lng)

    new_complaint = Complaint(
        type=data.get("type"),
        severity=data.get("severity", "Unknown"),
        lat=lat,
        lng=lng
    )

    db.add(new_complaint)
    db.commit()
    db.refresh(new_complaint)

    db.close()

    return {
        "type": new_complaint.type,
        "severity": new_complaint.severity,
        "location": {"lat": lat, "lng": lng},
        "authority": routing["authority"],
        "officer": routing["officer"],
        "contact": routing["contact"]
    }


# 🔥 GET COMPLAINTS FROM DB
@app.get("/complaints")
def get_complaints():
    db = SessionLocal()

    data = db.query(Complaint).all()

    result = []
    for c in data:
        result.append({
            "type": c.type,
            "severity": c.severity,
            "location": {
                "lat": c.lat,
                "lng": c.lng
            }
        })

    db.close()

    return result


# 🔥 FILE UPLOAD (AI later)
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    
    file_location = f"uploads/{file.filename}"
    
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Dummy AI
    result = {
        "issue": "Pothole",
        "severity": "High"
    }

    return {
        "filename": file.filename,
        "analysis": result
    }


# 🔥 ROUTING LOGIC
def route_complaint(lat, lng):
    if lat > 28.6:
        return {
            "authority": "NHAI",
            "officer": "Rajesh Kumar",
            "contact": "nhai@example.com"
        }
    else:
        return {
            "authority": "Municipal Corporation",
            "officer": "Amit Sharma",
            "contact": "municipal@example.com"
        }