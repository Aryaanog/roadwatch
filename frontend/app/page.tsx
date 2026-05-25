"use client";

import Map, { Source, Layer, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect } from "react";
import axios from "axios";

export default function Home() {

  const [roadData, setRoadData] = useState<any>(null);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [clickedLocation, setClickedLocation] = useState<any>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // ✅ SAFE localStorage
  const getPending = () => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("pending") || "[]");
  };

  const updatePendingCount = () => {
    setPendingCount(getPending().length);
  };

  // 🔥 SYNC
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

    // ROADS
    axios.get("http://127.0.0.1:8000/roads")
      .then(res => {
        setRoadData(res.data);
        localStorage.setItem("roads", JSON.stringify(res.data));
      })
      .catch(() => {
        const cached = localStorage.getItem("roads");
        if (cached) setRoadData(JSON.parse(cached));
      });

    fetchComplaints();
    syncPending();

  }, []);

  const fetchComplaints = () => {
    axios.get("http://127.0.0.1:8000/complaints")
      .then(res => {
        setComplaints(res.data);
        localStorage.setItem("complaints", JSON.stringify(res.data));
      })
      .catch(() => {
        const cached = localStorage.getItem("complaints");
        if (cached) setComplaints(JSON.parse(cached));
      });
  };

  // 🔥 SUBMIT
  const submitComplaint = async (type: string) => {
    if (!clickedLocation) return;

    const payload = { type, location: clickedLocation };

    try {
      await axios.post("http://127.0.0.1:8000/report", payload);
      fetchComplaints();
    } catch {
      const pending = getPending();
      pending.push(payload);
      localStorage.setItem("pending", JSON.stringify(pending));
      updatePendingCount();
    }

    setClickedLocation(null);
  };

  return (
    <div className="w-screen h-screen">

      {/* 🌐 STATUS */}
      {!isOnline && (
        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded z-50">
          Offline Mode
        </div>
      )}

      {pendingCount > 0 && (
        <div className="absolute top-12 right-4 bg-yellow-400 text-black px-3 py-1 rounded z-50">
          {pendingCount} pending sync
        </div>
      )}

      <Map
        reuseMaps
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: 77.2090,
          latitude: 28.6139,
          zoom: 12
        }}

        // ✅ GOOGLE-LIKE STYLE
        mapStyle="mapbox://styles/mapbox/streets-v12"

        onClick={(e) => {
          const { lng, lat } = e.lngLat;
          setClickedLocation({ lng, lat });
        }}
      >

        {/* ✅ CLEAN ROADS (NO  FILTER BUG) */}
        {roadData && (
          <Source id="roads" type="geojson" data={roadData}>
            <Layer
              id="roads-layer"
              type="line"
              paint={{
                // ✅ subtle colors like Google Maps
                "line-color": [
                  "match",
                  ["get", "condition"],
                  "Good", "#4CAF50",
                  "Average", "#FFC107",
                  "Poor", "#F44336",
                  "#999999"
                ],

                // ✅ width based on road type
                "line-width": [
                  "match",
                  ["get", "type"],
                  "NH", 6,
                  "SH", 4,
                  "Local", 2,
                  2
                ],

                "line-opacity": 0.8,
              }}
            />
          </Source>
        )}

        {/* 📍 MARKERS */}
        {complaints.map((c, i) => {
          if (!c.location) return null;

          let color = "green";
          if (c.severity === "High") color = "red";
          else if (c.severity === "Medium") color = "orange";

          return (
            <Marker key={i} longitude={c.location.lng} latitude={c.location.lat}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  backgroundColor: color,
                  borderRadius: "50%",
                  border: "2px solid white"
                }}
              />
            </Marker>
          );
        })}

      </Map>

      {/* 📤 REPORT */}
      {clickedLocation && (
        <div className="absolute top-4 left-4 bg-white p-4 rounded shadow">
          <button
            className="bg-red-500 text-white px-3 py-1"
            onClick={() => submitComplaint("Pothole")}
          >
            Pothole
          </button>
        </div>
      )}

    </div>
  );
}