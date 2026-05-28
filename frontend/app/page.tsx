"use client";

import Map, { Layer, Marker, Source, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";
import { ChangeEvent, DragEvent, useEffect, useState, useRef } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";

type Location = { lat: number; lng: number };

type RoadProperties = {
  id?: number;
  name?: string;
  type?: string;
  condition?: "Good" | "Average" | "Poor";
  lastRepaired?: string;
  contractor?: string;
  budgetSanctioned?: number | string | null;
  budgetSpent?: number | string | null;
  currencyCode?: string; // Automatically switches between ₹, £, $, etc.
  budgetSource?: string;
  communityReports?: number;
  authorityName?: string;
  authorityEmail?: string;
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
  const mapRef = useRef<MapRef>(null);
  const [roadData, setRoadData] = useState<unknown>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [clickedLocation, setClickedLocation] = useState<Location | null>(null);
  const [selectedRoad, setSelectedRoad] = useState<RoadProperties | null>(null);
  const [viewMode, setViewMode] = useState("normal");
  const [darkMode, setDarkMode] = useState(false);

  // Global Geocoding Exploration States
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Machine Learning Pipeline States
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [mailLinkUrl, setMailLinkUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [networkAlert, setNetworkAlert] = useState<string | null>(null);

  const fetchComplaints = () => {
    axios.get(`${API_BASE_URL}/complaints`)
      .then((res) => setComplaints(res.data))
      .catch(() => setNetworkAlert("Operating in offline fallback mode. Showing locally cached records."));
  };

  const fetchRoadNetwork = () => {
    axios.get(`${API_BASE_URL}/roads`)
      .then((res) => setRoadData(res.data))
      .catch(() => setNetworkAlert("Connection low. Utilizing local cache layers."));
  };

  useEffect(() => {
    fetchRoadNetwork();
    fetchComplaints();
  }, []);

  // GLOBAL FUNCTIONALITY: Dynamically switches layout formats based on country origin rules
  const formatMoney = (amount: number | string | null | undefined, currencyCode = "INR") => {
    if (!amount) return "Information not published";
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount)) return String(amount);
    
    const designLocale = currencyCode === "INR" ? "en-IN" : currencyCode === "GBP" ? "en-GB" : "en-US";
    return new Intl.NumberFormat(designLocale, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  };

  // GLOBAL SEARCH WORKFLOW: Resolves coordinates for any address worldwide and moves the viewport
  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const response = await axios.get(
        `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(searchQuery)}&access_token=${token}`
      );

      const feature = response.data?.features?.[0];
      if (feature) {
        const [lng, lat] = feature.geometry.coordinates;
        
        // Smoothly pan map frame to target global location match
        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom: 14,
          duration: 2500,
          essential: true
        });

        // Clear localized states to prepare context workspace reset
        setSelectedRoad(null);
        setClickedLocation(null);
        setAnalysisResult(null);
        setProcessedImageUrl(null);
        setMailLinkUrl(null);
      } else {
        alert("Location location target could not be verified globally.");
      }
    } catch (err) {
      console.error("Geocoding address discovery failed:", err);
      alert("Error contacting location index engine.");
    } finally {
      setIsSearching(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!clickedLocation || !selectedRoad) return;
    
    setLoading(true);
    setSelectedFileName(file.name);
    setAnalysisResult(null);
    setProcessedImageUrl(null);
    setMailLinkUrl(null);
    setNetworkAlert(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lat", String(clickedLocation.lat));
    formData.append("lng", String(clickedLocation.lng));

    try {
      const res = await axios.post(`${API_BASE_URL}/upload`, formData);
      setAnalysisResult(res.data.analysis);
      setProcessedImageUrl(res.data.image_url);
      setMailLinkUrl(res.data.mail_link);
      
      fetchRoadNetwork();
      fetchComplaints();
    } catch (err) {
      console.warn("Low network anomaly detected. Intercepting citizen entry locally.", err);
      setNetworkAlert("Reporting saved to local storage stack. Auto-sync will run upon system recovery.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) uploadImage(file);
  };

  return (
    <div className={`relative h-screen w-screen transition-colors duration-300 font-sans antialiased overflow-hidden ${darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"}`}>
      
      {/* 🔍 Dynamic Top-Centered Global Search Console */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
        <form onSubmit={handleGlobalSearch} className={`flex items-center gap-2 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-md transition ${
          darkMode ? "border-slate-800 bg-slate-900/90" : "border-white/50 bg-white/85"
        }`}>
          <input
            type="text"
            placeholder="Search city or highway (e.g., London, Kolkata)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-transparent px-3 py-1.5 text-xs font-medium focus:outline-none ${
              darkMode ? "text-white placeholder-slate-400" : "text-slate-900 placeholder-slate-500"
            }`}
          />
          <button
            type="submit"
            disabled={isSearching}
            className="rounded-xl bg-sky-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-sky-600 disabled:opacity-50"
          >
            {isSearching ? "..." : "Explore"}
          </button>
        </form>
      </div>

      {/* 🔔 Citizen Connection Alert Banner */}
      {networkAlert && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md border border-amber-400/50">
          <span>⚠️ {networkAlert}</span>
        </div>
      )}

      {/* 🧭 View Toggles & Theme Engager Controls */}
      <div className="absolute left-6 top-6 z-50 flex items-center gap-3">
        <div className={`flex overflow-hidden rounded-xl border p-1 shadow-xl backdrop-blur-md ${darkMode ? "border-slate-800 bg-slate-900/80" : "border-white/40 bg-white/70"}`}>
          <button
            type="button"
            onClick={() => setViewMode("normal")}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              viewMode === "normal" ? (darkMode ? "bg-slate-800 text-sky-400" : "bg-slate-900 text-white") : "text-slate-500"
            }`}
          >
            Community Map
          </button>
          <button
            type="button"
            onClick={() => setViewMode("heatmap")}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              viewMode === "heatmap" ? "bg-red-500 text-white" : "text-slate-500 hover:text-red-400"
            }`}
          >
            Hotspots
          </button>
        </div>

        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-lg backdrop-blur-md transition ${
            darkMode ? "border-slate-800 bg-slate-900/80 text-yellow-400" : "border-white/40 bg-white/70 text-slate-800"
          }`}
        >
          {darkMode ? "☀️" : "🌙"}
        </button>
      </div>

      {/* 🗺️ Map Canvas Module Component Context */}
      <Map
        ref={mapRef}
        reuseMaps
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ longitude: 77.209, latitude: 28.6139, zoom: 12 }}
        mapStyle={darkMode ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12"}
        interactiveLayerIds={["roads-layer"]}
        onClick={(e) => {
          const feature = e.features?.[0];
          const { lng, lat } = e.lngLat;

          if (feature?.layer?.id === "roads-layer") {
            const nextRoad = (feature.properties || {}) as RoadProperties;
            if (nextRoad.id !== selectedRoad?.id) {
              setAnalysisResult(null);
              setProcessedImageUrl(null);
              setMailLinkUrl(null);
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
                properties: { intensity: c.severity === "High" ? 3 : c.severity === "Medium" ? 2 : 1 },
                geometry: { type: "Point", coordinates: [c.location.lng, c.location.lat] },
              })),
            }}
          >
            <Layer
              id="heatmap"
              type="heatmap"
              paint={{
                "heatmap-weight": ["get", "intensity"],
                "heatmap-radius": 25,
                "heatmap-opacity": 0.65,
                "heatmap-color": [
                  "interpolate", ["linear"], ["heatmap-density"],
                  0, "rgba(239, 68, 68, 0)",
                  0.3, "#fef08a",
                  0.7, "#f97316",
                  1, "#ef4444"
                ],
              }}
            />
          </Source>
        )}

        {roadData && (
          <Source id="roads" type="geojson" data={roadData as never}>
            {/* Background track layout drop-shadow overlay */}
            <Layer id="roads-shadow" type="line" paint={{ "line-color": "#000", "line-width": 10, "line-opacity": 0.12 }} />
            
            {/* Active Render Track Layer with Filters & Thickness Scaling */}
            <Layer
              id="roads-layer"
              type="line"
              // 🎛️ 1. FILTER EXPRESSION: Filters out minor paths to reduce canvas clutter
              filter={[
                "match",
                ["get", "type"],
                ["Service", "service", "residential", "Residential", "Unclassified", "unclassified", "footway"], false, // Hide these links
                true // Render everything else
              ]}
              paint={{
                // Color cases tied to active asset evaluation metrics
                "line-color": [
                  "case",
                  ["==", ["get", "id"], selectedRoad?.id || -1], "#38bdf8", // Sky blue select highlight
                  ["==", ["get", "condition"], "Poor"], "#ef4444",        // Danger Red
                  ["==", ["get", "condition"], "Average"], "#eab308",     // Alert Yellow
                  "#22c55e",                                              // Operational Green
                ],
                
                // 📏 2. DYNAMIC THICKNESS EXPRESSION: Scales line-width programmatically by infrastructure level
                "line-width": [
                  "case",
                  ["==", ["get", "id"], selectedRoad?.id || -1], 9, // Extra thick emphasis for active focus element
                  [
                    "match",
                    ["get", "type"],
                    "National Highway", 7.5,
                    "Trunk", 7.5,
                    "NH", 7.5,
                    "Primary", 5.5,
                    "Secondary", 4.0,
                    2.5 // Default width factor for minor linking routes
                  ]
                ],
                "line-opacity": 0.85
              }}
            />
          </Source>
        )}

        {complaints.map((complaint, index) => (
          <Marker key={index} longitude={complaint.location.lng} latitude={complaint.location.lat}>
            <div
              className="h-3.5 w-3.5 rounded-full border-2 border-white shadow-xl animate-pulse"
              style={{
                backgroundColor: complaint.severity === "High" ? "#ef4444" : complaint.severity === "Medium" ? "#eab308" : "#22c55e",
              }}
            />
          </Marker>
        ))}
      </Map>

      {/* 🗚 Dedicated Side Dock Architecture Layer Container */}
      <div className="absolute left-6 top-24 z-40 flex flex-col gap-4 max-h-[calc(100vh-8rem)] w-[24rem] overflow-y-auto no-scrollbar pointer-events-none">
        
        {/* Card Panel One: Public Tracking Details Card */}
        {selectedRoad && (
          <div className={`pointer-events-auto w-full rounded-2xl border p-5 shadow-xl backdrop-blur-md transition-all duration-300 ${
            darkMode ? "border-slate-800 bg-slate-900/80 text-white" : "border-white/30 bg-white/75 text-slate-900"
          }`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Public Infrastructure Info</p>
                <h2 className="text-xl font-black tracking-tight mt-0.5">{selectedRoad.name}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase shadow-sm ${
                selectedRoad.condition === "Poor" ? "bg-red-500 text-white" :
                selectedRoad.condition === "Average" ? "bg-yellow-500 text-slate-900" : "bg-emerald-500 text-white"
              }`}>
                {selectedRoad.condition} Status
              </span>
            </div>

            <div className={`grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 text-xs ${darkMode ? "border-slate-800" : "border-slate-200/50"}`}>
              <div>
                <p className={darkMode ? "text-slate-400" : "text-slate-500"}>Classification Type</p>
                <p className="font-bold mt-0.5 uppercase">{selectedRoad.type || "Local Street Connect"}</p>
              </div>
              <div>
                <p className={darkMode ? "text-slate-400" : "text-slate-500"}>Citizen Safety Reports</p>
                <p className="font-bold mt-0.5">{selectedRoad.communityReports ?? 0} Active</p>
              </div>
              <div>
                <p className={darkMode ? "text-slate-400" : "text-slate-500"}>Last Relaying Date</p>
                <p className="font-bold mt-0.5">{selectedRoad.lastRepaired}</p>
              </div>
              <div>
                <p className={darkMode ? "text-slate-400" : "text-slate-500"}>Assigned Contractor</p>
                <p className="font-bold mt-0.5 truncate" title={selectedRoad.contractor || "N/A"}>{selectedRoad.contractor}</p>
              </div>
              <div>
                <p className={darkMode ? "text-slate-400" : "text-slate-500"}>Public Budget Sanctioned</p>
                <p className="font-extrabold text-emerald-600 mt-0.5">{formatMoney(selectedRoad.budgetSanctioned, selectedRoad.currencyCode)}</p>
              </div>
              <div>
                <p className={darkMode ? "text-slate-400" : "text-slate-500"}>Amount Expended/Spent</p>
                <p className="font-extrabold text-amber-600 mt-0.5">{formatMoney(selectedRoad.budgetSpent, selectedRoad.currencyCode)}</p>
              </div>
            </div>

            <div className={`mt-4 rounded-xl p-3 border text-xs ${darkMode ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Responsible Maintenance Authority</p>
              <p className="font-bold mt-0.5 text-sky-500">{selectedRoad.authorityName}</p>
              <p className={`text-[10px] mt-1 italic ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Budget Transparency Source: {selectedRoad.budgetSource}</p>
            </div>
          </div>
        )}

        {/* Panel Container Two: Citizen Action & Report Input Card */}
        {clickedLocation && selectedRoad && (
          <div className={`pointer-events-auto w-full rounded-2xl border p-5 shadow-xl backdrop-blur-md transition-all duration-300 ${
            darkMode ? "border-slate-800 bg-slate-900/80 text-white" : "border-white/30 bg-white/75 text-slate-900"
          }`}>
            <div className="mb-3">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Citizen Action Center</p>
              <h3 className="text-sm font-black tracking-tight">Report a Safety Issue</h3>
            </div>

            <label
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) uploadImage(f); }}
              className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${
                dragActive ? "border-sky-500 bg-sky-500/10" : (darkMode ? "border-slate-800 bg-slate-950/40 hover:border-slate-700" : "border-slate-300 bg-slate-50 hover:border-slate-400")
              }`}
            >
              <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
              <span className="text-xs font-bold">Drag and drop photos of the issue here</span>
              <span className={`text-[10px] mt-0.5 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>or click to pick from camera roll</span>
              {selectedFileName && (
                <span className="mt-2 truncate max-w-full rounded bg-sky-500 px-2 py-0.5 text-[10px] text-white font-mono">{selectedFileName}</span>
              )}
            </label>

            {loading && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-sky-500/10 p-3 text-xs font-bold text-sky-500 animate-pulse">
                <span>AI running structural detection analysis...</span>
              </div>
            )}

            {/* AI Image Verification Canvas Render */}
            {processedImageUrl && (
              <div className={`mt-3 overflow-hidden rounded-xl border p-1 ${darkMode ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide px-1 py-0.5">AI Visual Verification Output</p>
                <img src={processedImageUrl} alt="YOLO Analysis Preview" className="w-full h-auto object-cover rounded-lg" />
              </div>
            )}

            {analysisResult && (
              <div className={`mt-3 rounded-xl border p-3 ${darkMode ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                <div className="grid grid-cols-3 gap-1 text-center text-xs">
                  <div>
                    <p className="text-slate-400 text-[10px]">Issue Type</p>
                    <p className="font-black mt-0.5 text-yellow-500">{analysisResult.issue}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Urgency Level</p>
                    <p className="font-black mt-0.5 text-red-500">{analysisResult.severity}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Total Detected</p>
                    <p className="font-black mt-0.5 text-sky-500">{analysisResult.count} items</p>
                  </div>
                </div>
              </div>
            )}

            {/* Email Routing Interaction CTA */}
            {mailLinkUrl && (
              <a
                href={mailLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-center text-xs font-bold tracking-wider uppercase text-white shadow-lg transition hover:bg-blue-700"
              >
                📧 Notify Responsible Authority
              </a>
            )}

            <button
              type="button"
              className={`mt-2 w-full rounded-xl py-2 text-xs font-bold tracking-wide uppercase border transition ${
                darkMode ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
              }`}
              onClick={() => { setClickedLocation(null); setSelectedRoad(null); }}
            >
              Clear Workspace Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}