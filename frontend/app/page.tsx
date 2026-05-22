"use client";

import Map, { Source, Layer, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect } from "react";
import axios from "axios";

export default function Home() {

  const [info, setInfo] = useState<any>(null);
  const [roadData, setRoadData] = useState<any>(null);

  const [clickedLocation, setClickedLocation] = useState<any>(null);
  const [complaints, setComplaints] = useState<any[]>([]);

  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  // 🔥 Fetch data
  useEffect(() => {
    axios.get("http://127.0.0.1:8000/roads")
      .then(res => setRoadData(res.data))
      .catch(err => console.error("Roads error:", err));

    fetchComplaints();
  }, []);

  const fetchComplaints = () => {
    axios.get("http://127.0.0.1:8000/complaints")
      .then(res => setComplaints(res.data))
      .catch(err => console.error("Complaints error:", err));
  };

  // 🔥 Manual complaint
  const submitComplaint = async (type: string) => {
    if (!clickedLocation) return;

    try {
      await axios.post("http://127.0.0.1:8000/report", {
        type,
        location: clickedLocation
      });

      setClickedLocation(null);
      fetchComplaints();

    } catch (err) {
      console.error("Submit error:", err);
    }
  };

  // 🔥 AI upload
  const uploadImage = async () => {
    if (!selectedFile || !clickedLocation) return;

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await axios.post(
        "http://127.0.0.1:8000/upload",
        formData
      );

      setAnalysis(res.data.analysis);

      await axios.post("http://127.0.0.1:8000/report", {
        type: res.data.analysis.issue,
        severity: res.data.analysis.severity,
        location: clickedLocation
      });

      fetchComplaints();
      setClickedLocation(null);

    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  return (
    <div className="w-screen h-screen">

      <Map
        reuseMaps
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: 77.2090,
          latitude: 28.6139,
          zoom: 12
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"

        onClick={(e) => {
          const { lng, lat } = e.lngLat;
          setClickedLocation({ lng, lat });

          const feature = e.features?.[0];
          if (feature) {
            setInfo(feature.properties);
          }
        }}

        interactiveLayerIds={["roads-layer"]}
      >

        {/* ✅ Roads with condition color */}
        {roadData && (
          <Source id="roads" type="geojson" data={roadData}>
            <Layer
              id="roads-layer"
              type="line"
              paint={{
                "line-color": [
                  "case",
                  ["==", ["get", "condition"], "Good"], "#00ff00",
                  ["==", ["get", "condition"], "Poor"], "#ff0000",
                  "#ffff00"
                ],
                "line-width": 5
              }}
            />
          </Source>
        )}

        {/* 📍 Complaint markers */}
        {complaints.map((c, i) => {
          if (!c.location) return null;

          return (
            <Marker
              key={i}
              longitude={c.location.lng}
              latitude={c.location.lat}
            >
              <div
                className="text-red-500 text-xl cursor-pointer"
                onClick={() => setInfo(c)}
              >
                📍
              </div>
            </Marker>
          );
        })}

      </Map>

      {/* 🧠 INFO PANEL */}
      {info && (
        <div className="absolute bottom-4 left-4 bg-black text-white p-4 rounded w-72">
          <h2 className="font-bold text-lg">{info.name || "Road Issue"}</h2>

          {/* Road Info */}
          {info.type && <p>Type: {info.type}</p>}
          {info.condition && <p>Condition: {info.condition}</p>}
          {info.lastRepaired && <p>Last Repair: {info.lastRepaired}</p>}

          {/* Budget + Contractor */}
          {info.contractor && (
            <>
              <p className="mt-2">Contractor: {info.contractor}</p>
              <p>Sanctioned: ₹{info.budgetSanctioned}</p>
              <p>Spent: ₹{info.budgetSpent}</p>

              {info.budgetSpent > info.budgetSanctioned && (
                <p className="text-red-400 font-bold">
                  ⚠️ Overspending Detected
                </p>
              )}
            </>
          )}

          {/* Complaint Info */}
          {info.type && <p className="mt-2">Issue: {info.type}</p>}
          {info.severity && <p>Severity: {info.severity}</p>}
        </div>
      )}

      {/* 📤 REPORT UI */}
      {clickedLocation && (
        <div className="absolute top-4 left-4 bg-white p-4 rounded shadow w-64">
          <h2 className="font-bold">Report Issue</h2>

          {/* Manual */}
          <button
            className="bg-red-500 text-white px-3 py-1 mt-2"
            onClick={() => submitComplaint("Pothole")}
          >
            Pothole
          </button>

          <button
            className="bg-yellow-500 text-white px-3 py-1 mt-2 ml-2"
            onClick={() => submitComplaint("Damaged Road")}
          >
            Damaged Road
          </button>

          {/* Upload */}
          <input
            type="file"
            onChange={(e: any) => setSelectedFile(e.target.files?.[0])}
            className="mt-3"
          />

          <button
            className="bg-blue-500 text-white px-3 py-1 mt-2 w-full"
            onClick={uploadImage}
          >
            Upload & Analyze
          </button>

          {/* AI Result */}
          {analysis && (
            <div className="mt-3 text-sm">
              <p><b>Issue:</b> {analysis.issue}</p>
              <p><b>Severity:</b> {analysis.severity}</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

