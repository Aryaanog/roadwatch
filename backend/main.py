from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil, os, json, math, cv2

from database import SessionLocal, engine, Base
from models import Complaint, Road
from sqlalchemy.orm import Session

from ultralytics import YOLO

app = FastAPI()

# ------------------ CONFIG ------------------
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

model = YOLO("best.pt")

# ------------------ CORS ------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# ------------------ UTILS ------------------

def distance_point_to_line(px, py, x1, y1, x2, y2):
    line_mag = (x2 - x1)**2 + (y2 - y1)**2
    if line_mag == 0:
        return math.sqrt((px - x1)**2 + (py - y1)**2)

    u = ((px - x1)*(x2 - x1) + (py - y1)*(y2 - y1)) / line_mag

    if u < 0:
        cx, cy = x1, y1
    elif u > 1:
        cx, cy = x2, y2
    else:
        cx = x1 + u * (x2 - x1)
        cy = y1 + u * (y2 - y1)

    return math.sqrt((px - cx)**2 + (py - cy)**2)


def find_nearest_road(db, lat, lng):
    roads = db.query(Road).all()
    min_distance = float("inf")
    nearest = None

    for road in roads:
        coords = json.loads(road.geometry)

        for i in range(len(coords) - 1):
            x1, y1 = coords[i]
            x2, y2 = coords[i + 1]

            dist = distance_point_to_line(lng, lat, x1, y1, x2, y2)

            if dist < min_distance:
                min_distance = dist
                nearest = road

    return nearest if min_distance < 0.0005 else None


# ------------------ ROUTING LOGIC ------------------

def get_authority(road: Road):
    road_type = (road.type or "").lower()

    if "nh" in road_type or "national" in road_type:
        return {
            "authority": "NHAI",
            "engineer": "Executive Engineer - NHAI",
            "email": "nhai.engineer@gov.in"
        }

    if "sh" in road_type or "state" in road_type:
        return {
            "authority": "State PWD",
            "engineer": "Executive Engineer - PWD",
            "email": "pwd.engineer@gov.in"
        }

    return {
        "authority": "Municipal Corporation",
        "engineer": "City Engineer",
        "email": "city.engineer@gov.in"
    }


# ------------------ ROADS API ------------------

@app.get("/roads")
def get_roads():
    db = SessionLocal()

    roads = db.query(Road).all()
    complaints = db.query(Complaint).all()

    # complaint count per road
    count_map = {}
    for c in complaints:
        if c.road_id:
            count_map[c.road_id] = count_map.get(c.road_id, 0) + 1

    features = []

    for r in roads:
        count = count_map.get(r.id, 0)

        # dynamic condition
        if count > 5:
            condition = "Poor"
        elif count > 2:
            condition = "Average"
        else:
            condition = "Good"

        authority = get_authority(r)

        features.append({
            "type": "Feature",
            "properties": {
                "name": r.name,
                "type": r.type,
                "condition": condition,
                "lastRepaired": r.lastRepaired,
                "contractor": r.contractor,

                # 💰 Budget transparency
                "budgetSanctioned": r.budgetSanctioned,
                "budgetSpent": r.budgetSpent,
                "budgetSource": "PWD / Government Tender Database",

                # 📊 Complaints
                "complaints": count,

                # 📍 Routing info
                "authority": authority["authority"],
                "engineer": authority["engineer"],
                "engineerEmail": authority["email"],
            },
            "geometry": {
                "type": "LineString",
                "coordinates": json.loads(r.geometry)
            }
        })

    db.close()

    return {
        "type": "FeatureCollection",
        "features": features
    }


# ------------------ COMPLAINTS ------------------

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


# ------------------ IMAGE UPLOAD + YOLO ------------------

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...)
):
    file_path = f"{UPLOAD_DIR}/{file.filename}"

    # save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # YOLO detection
    results = model(file_path)
    detections = results[0].boxes

    plotted = results[0].plot()
    output_filename = f"output_{file.filename}"
    output_path = f"{UPLOAD_DIR}/{output_filename}"
    cv2.imwrite(output_path, plotted)

    # detection logic
    if len(detections) == 0:
        issue = "No issue detected"
        severity = "Low"
    else:
        issue = "Pothole"
        severity = "High" if len(detections) > 3 else "Medium" if len(detections) > 1 else "Low"

    db = SessionLocal()
    road = find_nearest_road(db, lat, lng)

    # save complaint
    if issue != "No issue detected" and road:
        new_complaint = Complaint(
            type=issue,
            severity=severity,
            lat=lat,
            lng=lng,
            road_id=road.id
        )
        db.add(new_complaint)
        db.commit()

    # routing info
    authority = get_authority(road) if road else None

    db.close()

    return {
        "analysis": {
            "issue": issue,
            "severity": severity,
            "count": len(detections)
        },

        # 🖼️ bounding box image
        "image_url": f"http://127.0.0.1:8000/uploads/{output_filename}",

        # 📧 engineer contact
        "engineerEmail": authority["email"] if authority else None,
        "mail_link": f"https://mail.google.com/mail/?view=cm&fs=1&to={authority['email']}&su=Road Issue&body=Pothole detected at location ({lat},{lng})" if authority else None,

        "road_id": road.id if road else None
    }


# ------------------ STATIC ------------------
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")