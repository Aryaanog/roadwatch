from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/roads")
def get_roads():
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Ring Road",
                    "type": "primary"
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [77.20, 28.60],
                        [77.22, 28.62],
                        [77.24, 28.61]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "name": "Outer Road",
                    "type": "secondary"
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [77.18, 28.59],
                        [77.19, 28.61],
                        [77.21, 28.63]
                    ]
                }
            }
        ]
    }

complaints = []

@app.post("/report")
def report_issue(data: dict):
    complaints.append(data)
    return {"message": "Complaint added"}

@app.get("/complaints")
def get_complaints():
    return complaints


from fastapi import File, UploadFile
import shutil

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    
    file_location = f"uploads/{file.filename}"
    
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 🚀 Dummy AI logic (we improve later)
    result = {
        "issue": "Pothole",
        "severity": "High"
    }

    return {
        "filename": file.filename,
        "analysis": result
    }
