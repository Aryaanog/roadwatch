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

  // 🔥 Fetch roads + complaints
  useEffect(() => {
    axios.get("http://127.0.0.1:8000/roads")
      .then(res => setRoadData(res.data));

    fetchComplaints();
  }, []);

  const fetchComplaints = () => {
    axios.get("http://127.0.0.1:8000/complaints")
      .then(res => setComplaints(res.data));
  };

  // 🔥 Submit complaint (manual type)
  const submitComplaint = async (type: string) => {
    await axios.post("http://127.0.0.1:8000/report", {
      type,
      location: clickedLocation
    });

    setClickedLocation(null);
    fetchComplaints();
  };

  // 🔥 Upload image + AI analysis
  const uploadImage = async () => {
    if (!selectedFile || !clickedLocation) return;

    const formData = new FormData();
    formData.append("file", selectedFile);

    const res = await axios.post(
      "http://127.0.0.1:8000/upload",
      formData
    );

    setAnalysis(res.data.analysis);

    // 🔥 Save AI result as complaint
    await axios.post("http://127.0.0.1:8000/report", {
      type: res.data.analysis.issue,
      severity: res.data.analysis.severity,
      location: clickedLocation
    });

    fetchComplaints();
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

          const feature = e.features && e.features[0];
          if (feature) {
            setInfo(feature.properties);
          }
        }}

        interactiveLayerIds={["roads-layer"]}
      >

        {/* Roads */}
        {roadData && (
          <Source id="roads" type="geojson" data={roadData}>
            <Layer
              id="roads-layer"
              type="line"
              paint={{
                "line-color": "#00ff00",
                "line-width": 5
              }}
            />
          </Source>
        )}

        {/* Complaint markers */}
        {complaints.map((c, i) => (
          <Marker key={i} longitude={c.location.lng} latitude={c.location.lat}>
            <div className="text-red-500 text-xl">📍</div>
          </Marker>
        ))}

      </Map>

      {/* Road Info */}
      {info && (
        <div className="absolute bottom-4 left-4 bg-black text-white p-4 rounded">
          <h2 className="font-bold">{info.name}</h2>
          <p>Type: {info.type}</p>
        </div>
      )}

      {/* Complaint + Upload UI */}
      {clickedLocation && (
        <div className="absolute top-4 left-4 bg-white p-4 rounded shadow w-64">
          <h2 className="font-bold">Report Issue</h2>

          {/* Manual buttons */}
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
            onChange={(e: any) => setSelectedFile(e.target.files[0])}
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