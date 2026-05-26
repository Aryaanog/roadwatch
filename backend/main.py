from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import shutil
from fastapi import Form
import os
import json

from database import SessionLocal, engine, Base
from models import Complaint, Road

from sqlalchemy.orm import Session
from math import sqrt

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CREATE TABLES
Base.metadata.create_all(bind=engine)

from ultralytics import YOLO
import cv2

model = YOLO("best.pt")  # lightweight model


import math

def distance_point_to_line(px, py, x1, y1, x2, y2):
    # Line segment length squared
    line_mag = (x2 - x1)**2 + (y2 - y1)**2

    if line_mag == 0:
        return math.sqrt((px - x1)**2 + (py - y1)**2)

    # Projection factor
    u = ((px - x1)*(x2 - x1) + (py - y1)*(y2 - y1)) / line_mag

    if u < 0:
        closest_x, closest_y = x1, y1
    elif u > 1:
        closest_x, closest_y = x2, y2
    else:
        closest_x = x1 + u * (x2 - x1)
        closest_y = y1 + u * (y2 - y1)

    return math.sqrt((px - closest_x)**2 + (py - closest_y)**2)


import math

def find_nearest_road(db, lat, lng):
    roads = db.query(Road).all()

    min_distance = float("inf")
    nearest_road_id = None

    for road in roads:
        coords = json.loads(road.geometry)

        for i in range(len(coords) - 1):
            x1, y1 = coords[i]
            x2, y2 = coords[i + 1]

            dist = distance_point_to_line(lng, lat, x1, y1, x2, y2)

            if dist < min_distance:
                min_distance = dist
                nearest_road_id = road.id

    # threshold (important)
    if min_distance > 0.0005:
        return None

    print("Assigned road_id:", nearest_road_id)
    return nearest_road_id

@app.get("/roads")
def get_roads():
    # update_road_conditions() 
    db = SessionLocal()

    roads = db.query(Road).all()
    complaints = db.query(Complaint).all()

    # count complaints per road
    count_map = {}
    for c in complaints:
        if c.road_id:
            count_map[c.road_id] = count_map.get(c.road_id, 0) + 1

    features = []

    for r in roads:
        count = count_map.get(r.id, 0)

        # 🔥 dynamic condition
        if count > 5:
            condition = "Poor"
        elif count > 2:
            condition = "Average"
        else:
            condition = "Good"

        features.append({
            "type": "Feature",
            "properties": {
                "name": r.name,
                "type": r.type,
                "condition": condition,
                "lastRepaired": r.lastRepaired,
                "contractor": r.contractor,
                "budgetSanctioned": r.budgetSanctioned,
                "budgetSpent": r.budgetSpent,
                "complaints": count,

            },
            "geometry": {
                "type": "LineString",
                "coordinates": json.loads(r.geometry)
            }
        })

        
        # print(len(json.loads(r.geometry)))

    

    db.close()

    return {
        "type": "FeatureCollection",
        "features": features
    }

@app.post("/report")
def report_issue(data: dict):
    db = SessionLocal()

    lat = data["location"]["lat"]
    lng = data["location"]["lng"]

    road_id = find_nearest_road(db, lat, lng)  # 🔥 NEW
    print("Assigned road_id:", road_id)

    new_complaint = Complaint(
        type=data.get("type"),
        severity=data.get("severity", "Unknown"),
        lat=lat,
        lng=lng,
        road_id=road_id   # 🔥 LINKED
    )

    db.add(new_complaint)
    db.commit()
    db.refresh(new_complaint)

    db.close()

    return {"message": "Complaint saved"}



# 🔥 GET COMPLAINTS
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


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...)
):
    file_location = f"uploads/{file.filename}"

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # YOLO inference
    results = model(file_location)
    detections = results[0].boxes

    if len(detections) == 0:
        issue = "No issue detected"
        severity = "Low"
    else:
        issue = "Pothole"
        if len(detections) > 3:
            severity = "High"
        elif len(detections) > 1:
            severity = "Medium"
        else:
            severity = "Low"

    # ✅ FIX: now lat/lng exist
    db = SessionLocal()
    road_id = find_nearest_road(db, lat, lng)

    # 🔥 AUTO SAVE COMPLAINT (preserved)
    if issue != "No issue detected":
        new_complaint = Complaint(
            type=issue,
            severity=severity,
            lat=lat,
            lng=lng,
            road_id=road_id
        )

        db.add(new_complaint)
        db.commit()

    db.close()

    return {
        "analysis": {
            "issue": issue,
            "severity": severity,
            "count": len(detections)
        },
        "road_id": road_id
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