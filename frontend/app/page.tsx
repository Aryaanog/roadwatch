"use client";

import Map, { Source, Layer, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect } from "react";
import axios from "axios";

export default function Home() {
  const [roadData, setRoadData] = useState<any>(null);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [clickedLocation, setClickedLocation] = useState<any>(null);
  const [selectedRoad, setSelectedRoad] = useState<any>(null);
  const [viewMode, setViewMode] = useState("normal"); // 🔥 NEW
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));

    axios.get("http://127.0.0.1:8000/roads")
      .then(res => setRoadData(res.data));

    fetchComplaints();
  }, []);

  const fetchComplaints = () => {
    axios.get("http://127.0.0.1:8000/complaints")
      .then(res => setComplaints(res.data));
  };

  return (
    <div className="w-screen h-screen">

      {/* 🌐 STATUS */}
      {!isOnline && (
        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 z-50">
          Offline
        </div>
      )}

      {/* 🔥 TOGGLE BUTTON */}
      <div className="absolute top-4 left-4 z-50">
        <button
          className="bg-blue-500 text-white px-3 py-1 mr-2 rounded"
          onClick={() => setViewMode("normal")}
        >
          Road View
        </button>
        <button
          className="bg-red-500 text-white px-3 py-1 rounded"
          onClick={() => setViewMode("heatmap")}
        >
          Heatmap
        </button>
      </div>

      <Map
        reuseMaps
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: 77.2090,
          latitude: 28.6139,
          zoom: 12
        }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        interactiveLayerIds={["roads-layer"]}

        onClick={(e) => {
          const feature = e.features?.[0];
          const { lng, lat } = e.lngLat;

          if (feature && feature.layer.id === "roads-layer") {
            // ✅ ONLY react to road layer
            setSelectedRoad(feature.properties);
            setClickedLocation({ lng, lat });
          } else {
            // ✅ map click
            setClickedLocation({ lng, lat });
            setSelectedRoad(null);
          }
        }}

      >

        {/* 🔥 HEATMAP (OVERLAY, DOES NOT REMOVE ROADS) */}
        {viewMode === "heatmap" && complaints.length > 0 && (
          <Source
            id="heat"
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: complaints.map(c => ({
                type: "Feature",
                properties: {
                  intensity:
                    c.severity === "High" ? 3 :
                    c.severity === "Medium" ? 2 : 1
                },
                geometry: {
                  type: "Point",
                  coordinates: [c.location.lng, c.location.lat]
                }
              }))
            }}
          >
            <Layer
              id="heatmap"
              type="heatmap"
              paint={{
                "heatmap-weight": ["get", "intensity"],
                "heatmap-intensity": 1.5,
                "heatmap-radius": 25,
                "heatmap-opacity": 0.6,
                "heatmap-color": [
                  "interpolate", ["linear"], ["heatmap-density"],
                  0, "blue",
                  0.3, "cyan",
                  0.5, "yellow",
                  0.7, "orange",
                  1, "red"
                ]
              }}
            />
          </Source>
        )}

        {/* 🛣️ ROADS (ALWAYS VISIBLE) */}
        {roadData && (
          <Source id="roads" type="geojson" data={roadData}>
            {/* ✨ SHADOW LAYER */}
            <Layer
              id="roads-shadow"
              type="line"
              paint={{
                "line-color": "#000",
                "line-width": 10,
                "line-opacity": 0.2
              }}
            />
            <Layer
              id="roads-layer"
              type="line"
              layout={{
                "line-cap": "round",
                "line-join": "round"
              }}
              paint={{
                "line-color": [
                  "case",
                  ["==", ["get", "name"], selectedRoad?.name || ""],
                  "#00FFFF", // 🔥 highlight color (cyan)
                  [
                    "match",
                    ["get", "condition"],
                    "Good", "#4CAF50",
                    "Average", "#FFC107",
                    "Poor", "#F44336",
                    "#999"
                  ]
                ],
                "line-width": [
                  "case",
                  ["==", ["get", "name"], selectedRoad?.name || ""],
                  8, // ✅ highlighted
                  [
                    "match",
                    ["get", "type"],
                    "primary", 6,
                    "secondary", 4,
                    "tertiary", 2,
                    3
                  ]
                ]
              }}
            />
          </Source>
        )}

        {/* 📍 MARKERS */}
        {complaints.map((c, i) => (
          <Marker key={i} longitude={c.location.lng} latitude={c.location.lat}>
            <div
              style={{
                width: "10px",
                height: "10px",
                backgroundColor:
                  c.severity === "High" ? "red" :
                  c.severity === "Medium" ? "orange" : "green",
                borderRadius: "50%"
              }}
            />
          </Marker>
        ))}

      </Map>

      {/* 🛣️ ROAD INFO PANEL (separate) */}
      {selectedRoad && (
        <div className="absolute bottom-4 left-4 bg-white p-4 shadow w-64 z-50">
          <h3 className="font-bold">{selectedRoad.name}</h3>
          <p>Condition: {selectedRoad.condition}</p>
        </div>
      )}

      {/* 📤 UPLOAD PANEL (only when clicking location on a road) */}
      {clickedLocation && selectedRoad && (
        <div className="absolute top-16 left-4 bg-white p-4 shadow z-50 w-72">
          <h3 className="font-bold mb-2">{selectedRoad.name}</h3>
          <p className="text-sm mb-2">
            Condition: {selectedRoad.condition}
          </p>

          {/* 📤 UPLOAD */}
          <input
            type="file"
            className="mb-3"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;

                console.log("Uploading file...");

                const formData = new FormData();
                formData.append("file", file);
                formData.append("lat", clickedLocation.lat);
                formData.append("lng", clickedLocation.lng);

                const res = await axios.post(
                  "http://127.0.0.1:8000/upload",
                  formData,
                  {
                    headers: { "Content-Type": "multipart/form-data" }
                  }
                );

                console.log("Upload response:", res.data);

                const analysis = res.data.analysis;

                await axios.post("http://127.0.0.1:8000/report", {
                  type: analysis.issue,
                  severity: analysis.severity,
                  location: clickedLocation
                });

                console.log("Report submitted");

                setAnalysisResult(analysis);

                fetchComplaints();

              } catch (err) {
                console.error("UPLOAD ERROR:", err);
                alert("Upload failed. Check console.");
              }
            }}
          />

          {/* 🔥 SHOW ANALYSIS RESULT */}
          {analysisResult && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-sm">
              <p><b>Issue:</b> {analysisResult.issue}</p>
              <p><b>Severity:</b> {analysisResult.severity}</p>
              <p><b>Count:</b> {analysisResult.count}</p>
            </div>
          )}

          <button
            className="bg-gray-500 text-white px-3 py-1 rounded mt-2"
            onClick={() => {
              setClickedLocation(null);
              setSelectedRoad(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}

    </div>
  );
}