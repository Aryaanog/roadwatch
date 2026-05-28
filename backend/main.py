from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil, os, json, math, cv2, urllib.parse
from datetime import datetime

from database import SessionLocal, engine, Base
from models import Complaint, Road

from ultralytics import YOLO

app = FastAPI()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Load YOLO model for community hazard processing
model = YOLO("best.pt")
model.to('cpu')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# ------------------ GEOSPATIAL SNAP LOGIC ------------------

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

    # Define a bounding box delta (~500 meters rough box) to ignore far-away roads instantly
    bbox_delta = 0.005 

    for road in roads:
        try:
            coords = json.loads(road.geometry)
            
            # ⚡ SPEED BOOST: Quick bounding box check
            lons = [c[0] for c in coords]
            lats = [c[1] for c in coords]
            
            if not (min(lons) - bbox_delta <= lng <= max(lons) + bbox_delta and
                    min(lats) - bbox_delta <= lat <= max(lats) + bbox_delta):
                continue  # Skip this road entirely, it's nowhere near the click!

            # Only run the heavy math for roads in the immediate vicinity
            for i in range(len(coords) - 1):
                x1, y1 = coords[i]
                x2, y2 = coords[i + 1]
                dist = distance_point_to_line(lng, lat, x1, y1, x2, y2)
                if dist < min_distance:
                    min_distance = dist
                    nearest = road
        except Exception:
            continue
            
    return nearest if min_distance < 0.005 else None

# ------------------ DYNAMIC API ENDPOINTS ------------------

@app.get("/roads")
def get_roads():
    db = SessionLocal()
    try:
        roads = db.query(Road).all()
        complaints = db.query(Complaint).all()

        # Count up active citizen updates per road segment
        count_map = {}
        for c in complaints:
            if c.road_id:
                count_map[c.road_id] = count_map.get(c.road_id, 0) + 1

        features = []
        for r in roads:
            count = count_map.get(r.id, 0)

            # Strict Hackathon Rules: Warning Yellow (3+ Reports), Danger Red (5+ Reports)
            if count >= 5:
                condition = "Poor"
            elif count >= 3:
                condition = "Average"
            else:
                condition = "Good"

            # GLOBAL IMPLEMENTATION: Everything is extracted dynamically from columns in the DB row
            features.append({
                "type": "Feature",
                "properties": {
                    "id": r.id,
                    "name": r.name or "Unnamed Local Street",
                    "type": getattr(r, 'type', 'Local Road'), 
                    "condition": condition,
                    "lastRepaired": getattr(r, 'lastRepaired', 'No data available'),
                    "contractor": getattr(r, 'contractor', 'Not disclosed'),
                    "budgetSanctioned": getattr(r, 'budgetSanctioned', 0),
                    "budgetSpent": getattr(r, 'budgetSpent', 0),
                    # Fetches regional data from your DB columns to support cross-country logic
                    "currencyCode": getattr(r, 'currency_code', 'INR'), 
                    "budgetSource": getattr(r, 'budget_source', 'Public Record Registry'),
                    "communityReports": count,
                    "authorityName": getattr(r, 'authority_name', 'Local Neighborhood Council'),
                    "authorityEmail": getattr(r, 'authority_email', 'community-support@city.gov')
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": json.loads(r.geometry)
                }
            })
        return {"type": "FeatureCollection", "features": features}
    finally:
        db.close()

@app.get("/complaints")
def get_complaints():
    db = SessionLocal()
    try:
        data = db.query(Complaint).all()
        return [{
            "type": c.type,
            "severity": c.severity,
            "location": {"lat": c.lat, "lng": c.lng}
        } for c in data]
    finally:
        db.close()

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), lat: float = Form(...), lng: float = Form(...)):
    timestamp = datetime.now().strftime("%Y%m%dd_%H%M%S")
    filename_clean = f"{timestamp}_{file.filename}"
    file_path = f"{UPLOAD_DIR}/{filename_clean}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Core AI Analysis
    results = model(file_path)
    detections = results[0].boxes

    plotted = results[0].plot()
    output_name = f"output_{filename_clean}"
    output_path = f"{UPLOAD_DIR}/{output_name}"
    cv2.imwrite(output_path, plotted)

    if len(detections) == 0:
        issue = "No issue detected"
        severity = "Low"
    else:
        issue = "Pothole"
        severity = "High" if len(detections) > 3 else "Medium" if len(detections) > 1 else "Low"

    db = SessionLocal()
    try:
        road = find_nearest_road(db, lat, lng)

        if issue != "No issue detected" and road:
            new_complaint = Complaint(type=issue, severity=severity, lat=lat, lng=lng, road_id=road.id)
            db.add(new_complaint)
            db.commit()

        # Build dynamic details out of the linked database row attributes
        dest_email = getattr(road, 'authority_email', 'community-support@city.gov') if road else 'community-support@city.gov'
        dest_name = getattr(road, 'authority_name', 'Local Road Authority') if road else 'Local Road Authority'
        road_title = road.name if road else "Public Safety Coordinate Spot"

        email_body = (
            f"Dear Team at {dest_name},\n\n"
            f"This is an official community report filed via our neighborhood citizen portal.\n"
            f"A road safety hazard has been reported by a community member:\n\n"
            f"- Street Location: {road_title}\n"
            f"- Coordinates: ({lat}, {lng})\n"
            f"- Issue Detected: {issue}\n"
            f"- Urgency Rating: {severity} ({len(detections)} spot instances counted)\n\n"
            f"Please coordinate neighborhood repair efforts to clear this hazard for public safety."
        )

        encoded_body = urllib.parse.quote(email_body)
        encoded_subject = urllib.parse.quote(f"COMMUNITY SAFETY REPORT: Road Issue Spotted at [{road_title}]")
        mail_link = f"https://mail.google.com/mail/?view=cm&fs=1&to={dest_email}&su={encoded_subject}&body={encoded_body}"

        return {
            "analysis": {"issue": issue, "severity": severity, "count": len(detections)},
            "image_url": f"http://127.0.0.1:8000/uploads/{output_name}",
            "mail_link": mail_link
        }
    finally:
        db.close()

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")