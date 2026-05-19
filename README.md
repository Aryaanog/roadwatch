# 🚧 RoadWatch – AI Powered Road Monitoring System

RoadWatch is a web-based platform that enables citizens to:
- View road conditions on a map
- Report issues like potholes
- Upload images for AI-based analysis
- Improve transparency in road infrastructure

---

## 🚀 Features

### 🗺️ Interactive Map
- Built using Mapbox + Next.js
- Displays roads using GeoJSON
- Click anywhere to report an issue

### 🛠️ Manual Complaint System
- Report:
  - Potholes
  - Damaged Roads
- Location automatically captured

### 🤖 AI-Based Detection (Day 3)
- Upload road images
- Backend analyzes image
- Detects:
  - Issue type (e.g., pothole)
  - Severity (low/medium/high)

### 📍 Live Markers
- All complaints shown on map
- Persistent during session

---

## 🏗️ Tech Stack

### Frontend
- Next.js (React)
- TypeScript
- Mapbox (react-map-gl)
- Axios

### Backend
- FastAPI (Python)
- Uvicorn
- REST APIs

---

## 📂 Project Structure
