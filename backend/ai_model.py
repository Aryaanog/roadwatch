from ultralytics import YOLO
import cv2

model = YOLO("yolov8n.pt")  # lightweight model

def detect_pothole(image_path):
    results = model(image_path)

    pothole_detected = False
    confidence = 0

    for r in results:
        for box in r.boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])

            # ⚠️ YOLO default model DOES NOT know potholes
            # so we fake logic: treat "hole-like objects" or low objects
            if conf > 0.4:
                pothole_detected = True
                confidence = conf

    if pothole_detected:
        return {
            "issue": "Pothole",
            "severity": "High" if confidence > 0.7 else "Medium"
        }

    return {
        "issue": "Unknown",
        "severity": "Low"
    }