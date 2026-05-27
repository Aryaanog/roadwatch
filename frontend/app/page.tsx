"use client";

import Map, { Layer, Marker, Source } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";
import { ChangeEvent, DragEvent, useEffect, useState } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";
const POTHOLE_RED = "#f87171";
const POTHOLE_RED_DARK = "#ef4444";

type Location = {
  lat: number;
  lng: number;
};

type Road = {
  [key: string]: string | number | null | undefined;
  name?: string;
  type?: string;
  highway?: string;
  condition?: string;
  lastRepaired?: string;
  contractor?: string;
  budgetSanctioned?: number | string | null;
  budgetSpent?: number | string | null;
  complaints?: number;
};

type Complaint = {
  type?: string;
  severity: string;
  location: Location;
};

type AnalysisResult = {
  issue: string;
  severity: string;
  count: number;
};

export default function Home() {
  const [roadData, setRoadData] = useState<unknown>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [clickedLocation, setClickedLocation] = useState<Location | null>(null);
  const [selectedRoad, setSelectedRoad] = useState<Road | null>(null);
  const [viewMode, setViewMode] = useState("normal");

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");

  const fetchComplaints = () => {
    axios.get(`${API_BASE_URL}/complaints`).then((res) => setComplaints(res.data));
  };

  useEffect(() => {
    axios.get(`${API_BASE_URL}/roads`).then((res) => setRoadData(res.data));
    fetchComplaints();
  }, []);

  const getRoadKey = (road: Road | null) => road?.name || road?.["@id"] || "";

  const formatMoney = (amount: number | string | null | undefined) => {
    if (amount === undefined || amount === null || amount === "") return "Not published";

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount)) return String(amount);

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numericAmount);
  };

  const getAuthority = (road: Road | null) => {
    const roadType = String(road?.type || "").toLowerCase();

    if (roadType.includes("nh") || roadType.includes("national")) {
      return "National highways authority / Executive Engineer";
    }

    if (roadType.includes("sh") || roadType.includes("state")) {
      return "State PWD Executive Engineer";
    }

    if (roadType.includes("mdr") || roadType.includes("major")) {
      return "District Roads Division";
    }

    return "Local road authority";
  };

  const uploadImage = async (file: File) => {
    if (!clickedLocation || !selectedRoad) return;

    try {
      setLoading(true);
      setSelectedFileName(file.name);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("lat", String(clickedLocation.lat));
      formData.append("lng", String(clickedLocation.lng));

      const res = await axios.post(`${API_BASE_URL}/upload`, formData);
      setAnalysisResult(res.data.analysis);
      fetchComplaints();
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) uploadImage(file);
  };

  const handleDrag = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === "dragenter" || event.type === "dragover");
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (file) uploadImage(file);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-900">
      <div className="absolute left-4 top-4 z-50 flex overflow-hidden rounded-lg border border-white/70 bg-white shadow-lg">
        <button
          onClick={() => setViewMode("normal")}
          className={`px-4 py-2 text-sm font-semibold transition ${
            viewMode === "normal" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          }`}
        >
          Road
        </button>
        <button
          onClick={() => setViewMode("heatmap")}
          className={`px-4 py-2 text-sm font-semibold transition ${
            viewMode === "heatmap" ? "bg-red-400 text-white" : "bg-white text-slate-700 hover:bg-red-50"
          }`}
        >
          Heatmap
        </button>
      </div>

      <Map
        reuseMaps
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ longitude: 77.209, latitude: 28.6139, zoom: 12 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        interactiveLayerIds={["roads-layer"]}
        onClick={(e) => {
          const feature = e.features?.[0];
          const { lng, lat } = e.lngLat;

          if (feature?.layer?.id === "roads-layer") {
            const nextRoad = (feature.properties || {}) as Road;
            const isNextRoad = getRoadKey(nextRoad) !== getRoadKey(selectedRoad);

            if (isNextRoad) {
              setAnalysisResult(null);
              setSelectedFileName("");
            }

            setSelectedRoad(nextRoad);
            setClickedLocation({ lng, lat });
          } else {
            setSelectedRoad(null);
            setClickedLocation({ lng, lat });
          }
        }}
      >
        {viewMode === "heatmap" && (
          <Source
            id="heat"
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: complaints.map((c) => ({
                type: "Feature",
                properties: {
                  intensity: c.severity === "High" ? 3 : c.severity === "Medium" ? 2 : 1,
                },
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
                "heatmap-opacity": 0.55,
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0,
                  "rgba(255, 241, 242, 0)",
                  0.35,
                  "#fecdd3",
                  0.7,
                  POTHOLE_RED,
                  1,
                  POTHOLE_RED_DARK,
                ],
              }}
            />
          </Source>
        )}

        {roadData && (
          <Source id="roads" type="geojson" data={roadData as never}>
            <Layer
              id="roads-shadow"
              type="line"
              paint={{
                "line-color": "#000",
                "line-width": 10,
                "line-opacity": 0.15,
              }}
            />

            <Layer
              id="roads-layer"
              type="line"
              paint={{
                "line-color": [
                  "case",
                  ["==", ["get", "name"], selectedRoad?.name || ""],
                  "#166534",
                  "#86efac",
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

        {complaints.map((complaint, index) => (
          <Marker key={index} longitude={complaint.location.lng} latitude={complaint.location.lat}>
            <div
              aria-label={`${complaint.severity} severity pothole report`}
              title={`${complaint.severity} severity pothole report`}
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                backgroundColor:
                  complaint.severity === "High"
                    ? POTHOLE_RED
                    : complaint.severity === "Medium"
                      ? "#fb923c"
                      : "#86efac",
                border: "2px solid white",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.28)",
              }}
            />
          </Marker>
        ))}
      </Map>

      {selectedRoad && (
        <div className="absolute bottom-4 left-4 z-50 w-[min(25rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Selected road</p>
              <h2 className="text-lg font-bold leading-tight text-slate-950">{selectedRoad.name || "Unnamed road"}</h2>
            </div>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              {selectedRoad.condition || "Unknown"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Road type</p>
              <p className="font-semibold">{selectedRoad.type || selectedRoad.highway || "Not classified"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Last relaid</p>
              <p className="font-semibold">{selectedRoad.lastRepaired || "Not published"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Contractor</p>
              <p className="font-semibold">{selectedRoad.contractor || "Not published"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Complaints</p>
              <p className="font-semibold">{selectedRoad.complaints ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Sanctioned</p>
              <p className="font-semibold">{formatMoney(selectedRoad.budgetSanctioned)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Spent</p>
              <p className="font-semibold">{formatMoney(selectedRoad.budgetSpent)}</p>
            </div>
          </div>

          <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
            <p className="text-xs text-slate-500">Complaint routing</p>
            <p className="font-semibold">{getAuthority(selectedRoad)}</p>
            <p className="mt-1 text-xs text-slate-500">Budget source: local road registry, with OSM geometry support</p>
          </div>
        </div>
      )}

      {clickedLocation && selectedRoad && (
        <div className="absolute left-4 top-20 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Road image upload</p>
            <h3 className="font-bold leading-tight text-slate-950">{selectedRoad.name || "Selected road"}</h3>
          </div>

          <label
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition ${
              dragActive ? "border-red-300 bg-red-50" : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white"
            }`}
          >
            <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
            <span className="text-sm font-semibold text-slate-900">Drag and drop a road photo</span>
            <span className="mt-1 text-sm text-slate-600">or click to upload from your device</span>
            {selectedFileName && (
              <span className="mt-3 max-w-full truncate rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600">
                {selectedFileName}
              </span>
            )}
          </label>

          {loading && <p className="mt-3 text-sm font-semibold text-blue-600">Analyzing image...</p>}

          {analysisResult && !loading && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="mb-2 font-bold text-slate-950">AI result</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-slate-500">Issue</p>
                  <p className="font-semibold">{analysisResult.issue}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Severity</p>
                  <p className="font-semibold">{analysisResult.severity}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Count</p>
                  <p className="font-semibold">{analysisResult.count}</p>
                </div>
              </div>
            </div>
          )}

          <button
            className="mt-3 w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
            onClick={() => {
              setClickedLocation(null);
              setSelectedRoad(null);
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
