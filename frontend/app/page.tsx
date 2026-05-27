"use client";

import Map, { Layer, Marker, Source } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";
import { ChangeEvent, DragEvent, useEffect, useState } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";
const POTHOLE_RED = "#f87171";
const POTHOLE_RED_DARK = "#ef4444";

export default function Home() {
  const [roadData, setRoadData] = useState<any>(null);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [clickedLocation, setClickedLocation] = useState<any>(null);
  const [selectedRoad, setSelectedRoad] = useState<any>(null);
  const [viewMode, setViewMode] = useState("normal");

  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/roads`).then((res) => setRoadData(res.data));
    fetchComplaints();
  }, []);

  const fetchComplaints = () => {
    axios.get(`${API_BASE_URL}/complaints`).then((res) => setComplaints(res.data));
  };

  // ✅ use unique id if available
  const getRoadKey = (road: any) =>
    road?.["@id"] || road?.id || road?.name || "";

  const formatMoney = (amount: number | string | undefined) => {
    if (!amount) return "Not published";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(amount));
  };

  const getAuthority = (road: any) => {
    const t = String(road?.type || "").toLowerCase();
    if (t.includes("nh")) return "National Highway Authority";
    if (t.includes("sh")) return "State PWD";
    return "Local Authority";
  };

  const uploadImage = async (file: File) => {
    if (!clickedLocation || !selectedRoad) return;

    try {
      setLoading(true);
      setSelectedFileName(file.name);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("lat", clickedLocation.lat);
      formData.append("lng", clickedLocation.lng);

      const res = await axios.post(`${API_BASE_URL}/upload`, formData);

      setAnalysisResult(res.data.analysis);
      setPreviewImage(res.data.image_url);
      fetchComplaints();
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
  };

  const handleDrag = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadImage(file);
  };

  return (
    <div className="h-screen w-screen bg-slate-950">

      {/* 🔘 TOGGLE */}
      <div className="absolute top-4 left-4 z-50 flex rounded bg-white shadow">
        <button onClick={() => setViewMode("normal")} className="px-4 py-2">
          Road
        </button>
        <button onClick={() => setViewMode("heatmap")} className="px-4 py-2 text-red-500">
          Heatmap
        </button>
      </div>

      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ longitude: 77.209, latitude: 28.6139, zoom: 12 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        interactiveLayerIds={["roads-layer"]}
        onClick={(e) => {
          const feature = e.features?.[0];
          const { lng, lat } = e.lngLat;

          if (feature?.layer?.id === "roads-layer") {
            const next = feature.properties;

            if (getRoadKey(next) !== getRoadKey(selectedRoad)) {
              setAnalysisResult(null);
              setSelectedFileName("");
            }

            setSelectedRoad(next);
            setClickedLocation({ lng, lat });
          } else {
            setSelectedRoad(null);
            setClickedLocation(null);
          }
        }}
      >

        {/* 🌡️ HEATMAP */}
        {viewMode === "heatmap" && (
          <Source
            id="heat"
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: complaints.map((c) => ({
                type: "Feature",
                properties: { intensity: c.severity === "High" ? 3 : 1 },
                geometry: {
                  type: "Point",
                  coordinates: [c.location.lng, c.location.lat],
                },
              })),
            }}
          >
            <Layer
              id="heatmap"
              type="heatmap"
              paint={{
                "heatmap-weight": ["get", "intensity"],
                "heatmap-radius": 25,
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0,
                  "transparent",
                  1,
                  POTHOLE_RED_DARK,
                ],
              }}
            />
          </Source>
        )}

        {/* 🛣️ ROADS */}
        {roadData && (
          <Source id="roads" type="geojson" data={roadData}>
            <Layer
              id="roads-layer"
              type="line"
              paint={{
                "line-color": [
                  "case",
                  ["==", ["get", "name"], selectedRoad?.name || ""],
                  "#22c55e", // highlight
                  "#166534", // normal
                ],
                "line-width": [
                  "case",
                  ["==", ["get", "name"], selectedRoad?.name || ""],
                  8,
                  4,
                ],
              }}
            />
          </Source>
        )}

        {/* 📍 MARKERS */}
        {complaints.map((c, i) => (
          <Marker key={i} longitude={c.location.lng} latitude={c.location.lat}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background:
                  c.severity === "High"
                    ? POTHOLE_RED
                    : c.severity === "Medium"
                    ? "#fb923c"
                    : "#86efac",
                border: "2px solid white",
              }}
            />
          </Marker>
        ))}
      </Map>

      {/* 🛣️ ROAD INFO (BOTTOM LEFT) */}
      {selectedRoad && (
        <div className="absolute bottom-4 left-4 z-50 w-80 bg-white p-4 rounded shadow">
          <h2 className="font-bold text-lg">{selectedRoad.name}</h2>

          <p>Condition: {selectedRoad.condition}</p>
          <p>Contractor: {selectedRoad.contractor}</p>
          <p>Complaints: {selectedRoad.complaints ?? 0}</p>
          <p>Budget: {formatMoney(selectedRoad.budgetSanctioned)}</p>

          {/* 📧 EMAIL */}
          <p className="mt-2 text-sm">
            Engineer:{" "}
            <a
              href={`mailto:engineer@pwd.gov.in?subject=Road Issue ${selectedRoad.name}`}
              className="text-blue-600 underline"
            >
              engineer@pwd.gov.in
            </a>
          </p>

          <p className="text-xs mt-2">{getAuthority(selectedRoad)}</p>
        </div>
      )}

      {/* 📤 UPLOAD PANEL (TOP RIGHT) */}
      {clickedLocation && selectedRoad && (
        <div className="absolute top-4 right-4 z-50 w-72 bg-white p-4 rounded shadow">
          <label
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className="border-2 border-dashed p-4 block text-center cursor-pointer"
          >
            <input type="file" className="hidden" onChange={handleFileChange} />
            Upload Image
          </label>

          {loading && <p>Analyzing...</p>}

          {analysisResult && (
            <div className="mt-2 text-sm">
              <p>Issue: {analysisResult.issue}</p>
              <p>Severity: {analysisResult.severity}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}