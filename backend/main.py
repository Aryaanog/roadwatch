from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import shutil
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


# def update_road_conditions():
#     db = SessionLocal()

#     roads = db.query(Road).all()
#     complaints = db.query(Complaint).all()

#     for road in roads:
#         score = 0

#         for c in complaints:
#             # distance from road start (simple approximation)
#             dist = sqrt(
#                 (road.start_lat - c.lat) ** 2 +
#                 (road.start_lng - c.lng) ** 2
#             )

#             if dist < 0.01:  # nearby
#                 if c.severity == "High":
#                     score += 3
#                 elif c.severity == "Medium":
#                     score += 2
#                 else:
#                     score += 1

#         # 🎯 classify
#         if score >= 10:
#             road.condition = "Poor"
#         elif score >= 5:
#             road.condition = "Average"
#         else:
#             road.condition = "Good"

#     db.commit()
#     db.close()

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
    roads = db.query(Road).all()  # ✅ must be iterable

    min_distance = float("inf")
    nearest_road_id = None

    if min_distance > 0.0005:
        return None  

    for road in roads:
        # simple distance using start point
        dist = math.sqrt(
            (road.start_lat - lat) ** 2 +
            (road.start_lng - lng) ** 2
        )

        if dist < min_distance:
            min_distance = dist
            nearest_road_id = road.id

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


# 🔥 FILE UPLOAD
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_location = f"uploads/{file.filename}"

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

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