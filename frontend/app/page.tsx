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

  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const getPending = () => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("pending") || "[]");
  };

  const updatePendingCount = () => {
    setPendingCount(getPending().length);
  };

  const syncPending = async () => {
    const pending = getPending();
    if (!pending.length) return;

    const remaining = [];

    for (let p of pending) {
      try {
        await axios.post("http://127.0.0.1:8000/report", p);
      } catch {
        remaining.push(p);
      }
    }

    localStorage.setItem("pending", JSON.stringify(remaining));
    updatePendingCount();
    fetchComplaints();
  };

  useEffect(() => {

    setIsOnline(navigator.onLine);
    updatePendingCount();

    window.addEventListener("online", () => {
      setIsOnline(true);
      syncPending();
    });

    window.addEventListener("offline", () => {
      setIsOnline(false);
    });

    axios.get("http://127.0.0.1:8000/roads")
      .then(res => {
        setRoadData(res.data);
        localStorage.setItem("roads", JSON.stringify(res.data));
      });

    fetchComplaints();
    syncPending();

  }, []);

  const fetchComplaints = () => {
    axios.get("http://127.0.0.1:8000/complaints")
      .then(res => setComplaints(res.data));
  };

  const submitComplaint = async (type: string) => {
    if (!clickedLocation) return;

    const payload = { type, location: clickedLocation };

    await axios.post("http://127.0.0.1:8000/report", payload);
    fetchComplaints();

    setClickedLocation(null);
  };

  return (
    <div className="w-screen h-screen">

      {/* STATUS */}
      {!isOnline && (
        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 z-50">
          Offline
        </div>
      )}

      {/* MAP */}
      <Map
        reuseMaps
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: 77.2090,
          latitude: 28.6139,
          zoom: 12
        }}
        mapStyle="mapbox://styles/mapbox/streets-v12"

        interactiveLayerIds={["roads-layer"]} // ✅ IMPORTANT

        onClick={(e) => {
          const feature = e.features?.[0];

          if (feature) {
            // ✅ road clicked
            setSelectedRoad(feature.properties);
          }
 
          // ✅ map clicked
          const { lng, lat } = e.lngLat;
          setClickedLocation({ lng, lat });

        }}
      >

        {/* 🔥 HEATMAP LAYER - ADDED */}
        {complaints.length > 0 && (
          <Source
            id="complaints-heat"
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
                "heatmap-radius": 20,
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0, "blue",
                  0.3, "cyan",
                  0.5, "yellow",
                  0.7, "orange",
                  1, "red"
                ],
                "heatmap-opacity": 0.6
              }}
            />
          </Source>
        )}

        {/* ROADS */}
        {roadData && (
          <Source id="roads" type="geojson" data={roadData}>
            <Layer
              id="roads-layer"
              type="line"
              paint={{
                "line-color": [
                  "match",
                  ["get", "condition"],
                  "Good", "#4CAF50",
                  "Average", "#FFC107",
                  "Poor", "#F44336",
                  "#999"
                ],

                // ✅ FIXED TYPES (match backend)
                "line-width": [
                  "match",
                  ["get", "type"],
                  "primary", 6,
                  "secondary", 4,
                  "tertiary", 2,
                  2
                ],

                "line-opacity": 0.8
              }}
            />
          </Source>
        )}

        {/* MARKERS */}
        {complaints.map((c, i) => (
          <Marker key={i} longitude={c.location.lng} latitude={c.location.lat}>
            <div style={{
              width: "10px",
              height: "10px",
              backgroundColor:
                c.severity === "High" ? "red" :
                c.severity === "Medium" ? "orange" : "green",
              borderRadius: "50%"
            }} />
          </Marker>
        ))}

      </Map>

      {/* 📍 REPORT UI */}
      {clickedLocation && (
        <div className="absolute top-4 left-4 bg-white p-3 shadow z-50">
          <button
            className="bg-red-500 text-white px-3 py-1 rounded"
            onClick={() => submitComplaint("Pothole")}
          >
            Report Pothole
          </button>
          <button
            className="ml-2 bg-gray-500 text-white px-3 py-1 rounded"
            onClick={() => setClickedLocation(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* 🛣️ ROAD INFO PANEL (FIXED) */}
      {selectedRoad && (
        <div className="absolute bottom-4 left-4 bg-white p-4 shadow w-64 z-50">
          <h3 className="font-bold mb-2">{selectedRoad.name}</h3>
          <p className="text-sm mb-1"><span className="font-semibold">Type:</span> {selectedRoad.type}</p>
          <p className="text-sm mb-1"><span className="font-semibold">Condition:</span> {selectedRoad.condition}</p>
          <p className="text-sm mb-1"><span className="font-semibold">Complaints:</span> {selectedRoad.complaints}</p>
          <p className="text-sm mb-3"><span className="font-semibold">Contractor:</span> {selectedRoad.contractor}</p>
          <button
            className="mt-2 text-red-500 hover:text-red-700 text-sm font-semibold"
            onClick={() => setSelectedRoad(null)}
          >
            Close ✕
          </button>
        </div>
      )}

    </div>
  );
}