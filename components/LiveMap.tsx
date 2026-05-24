"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, Tooltip, Polyline, useMapEvents } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Clock, Info, X, MapPin, Bus, SlidersHorizontal } from "lucide-react";

// Fix Leaflet's default icon paths in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export interface Vehicle {
  id: string;
  vehicle_id: string;
  route_id?: string;
  trip_id?: string;
  current_stop_sequence?: number;
  position: {
    lat: number;
    lon: number;
    bearing?: number;
    speed?: number;
  };
  delay?: number;
  stop_time_updates?: {
    stop_sequence: number;
    stop_id: string;
    arrival?: { delay?: number; time?: number };
    departure?: { delay?: number; time?: number };
  }[];
  trip_headsign?: string;
  current_status?: number;
}

interface LiveMapProps {
  vehicles: Vehicle[];
  lastUpdatedTimestamp?: number;
}

// Official Line Colors
export const LINE_COLORS: Record<string, string> = {
  "A": "#ef4444", // red-500
  "B": "#3b82f6", // blue-500
  "C1": "#a3e635", // lime-400 (clair)
  "C2": "#15803d", // green-700 (foncé)
  "D": "#eab308", // yellow-500
};
export const getLineColor = (routeId?: string) => LINE_COLORS[routeId || ""] || "#f59e0b"; // default amber-500

// Custom DivIcon logic for buses
const createBusIcon = (routeId: string = "B", bearing: number = 0, delaySeconds: number = 0) => {
  const lineColor = getLineColor(routeId);
  const isDelayed = delaySeconds > 60;
  const delayMin = Math.round(delaySeconds / 60);
  const shadowColor = isDelayed ? "rgba(239, 68, 68, 0.95)" : lineColor + "99"; // Red shadow if delayed
  const borderColor = isDelayed ? "#ef4444" : lineColor; // Red border if delayed

  const html = `
    <div style="position: relative; width: 36px; height: 36px;">
      
      <!-- Fixed Label Above Bus (Won't rotate with bearing) -->
      <div style="
        position: absolute; 
        top: -30px; 
        left: 50%; 
        transform: translateX(-50%); 
        background: ${isDelayed ? "rgba(15, 23, 42, 0.98)" : "rgba(15, 23, 42, 0.95)"}; 
        border: 1px solid ${isDelayed ? "rgba(239, 68, 68, 0.6)" : "rgba(255,255,255,0.1)"};
        color: ${isDelayed ? "#ef4444" : lineColor}; 
        padding: 3px 8px; 
        border-radius: 8px; 
        font-size: 11px; 
        font-weight: 800;
        white-space: nowrap; 
        box-shadow: 0 4px 10px rgba(0,0,0,0.8);
        z-index: 10;
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        gap: 4px;
      ">
        Ligne ${routeId}
        ${isDelayed ? `<span style="color: #ef4444; font-weight: 900; background: rgba(239, 68, 68, 0.15); padding: 1px 4px; border-radius: 4px; font-size: 9px; display: inline-flex; align-items: center; gap: 2px;">⚠️ +${delayMin}m</span>` : ""}
      </div>

      <!-- Bus Marker (Rotates based on bearing) -->
      <div style="
        position: absolute;
        top: 0; left: 0;
        width: 36px;
        height: 36px;
        background-color: #020617;
        border: 2px solid ${borderColor};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 15px ${shadowColor};
        color: ${lineColor};
        font-weight: bold;
        font-size: 12px;
        font-family: sans-serif;
        transform: rotate(${bearing}deg);
        transition: transform 0.3s ease;
      ">
        <!-- Counter-rotate text inside so it stays upright -->
        <div style="transform: rotate(${-bearing}deg);"> 
          ${routeId}
        </div>
        <!-- Directional pointer -->
        <div style="
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 8px solid ${borderColor};
        "></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-bus-marker",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

// Map Event Listener Component for Zoom
function MapZoomListener({ setZoom }: { setZoom: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    }
  });
  return null;
}

export default function LiveMap({ vehicles, lastUpdatedTimestamp }: LiveMapProps) {
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(13);

  const [showBuses, setShowBuses] = useState(true);
  const [showShapes, setShowShapes] = useState(true);
  const [showStops, setShowStops] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Derive exact generation time of the GTFS-RT feed from OiseMob server
  const lastUpdated = lastUpdatedTimestamp ? new Date(lastUpdatedTimestamp) : new Date();

  // Derive live data
  const selectedBus = vehicles.find(v => v.id === selectedBusId) || null;

  // Fetch all network stops for map visualization
  const { data: allStopsData } = useQuery({
    queryKey: ["allStops"],
    queryFn: async () => {
      const res = await fetch("/api/axo/all-stops");
      if (!res.ok) throw new Error("Failed to fetch all stops");
      return res.json();
    },
    staleTime: Infinity,
  });

  const selectedStop = allStopsData?.stops?.find((s: any) => s.stop_id === selectedStopId) || null;

  // Fetch static line data to get the precise stop timeline for the selected trip
  const { data: staticData } = useQuery({
    queryKey: ["staticLine", selectedBus?.trip_id],
    queryFn: async () => {
      const url = selectedBus?.trip_id
        ? `/api/axo/static-line?trip_id=${selectedBus.trip_id}`
        : `/api/axo/static-line?line=${selectedBus?.route_id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch static line data");
      return res.json();
    },
    enabled: !!(selectedBus?.trip_id || selectedBus?.route_id),
    staleTime: Infinity,
  });

  // Fetch all shapes (polylines) for network mapping
  const { data: shapesData } = useQuery({
    queryKey: ["networkShapes"],
    queryFn: async () => {
      const res = await fetch("/api/axo/shapes");
      if (!res.ok) throw new Error("Failed to fetch shapes");
      return res.json();
    },
    staleTime: Infinity,
  });

  // Calculate upcoming buses for the selected stop
  const upcomingBusesForStop = selectedStop ? vehicles.map(v => {
    const update = v.stop_time_updates?.find(u => u.stop_id === selectedStop.stop_id);
    // Only include if bus has an update for this stop and hasn't passed it
    if (update && v.current_stop_sequence !== undefined && update.stop_sequence >= v.current_stop_sequence) {
      const arrivalTime = update.arrival?.time;
      if (arrivalTime) {
        const etaSeconds = arrivalTime - Math.floor(Date.now() / 1000);
        return {
          vehicle: v,
          arrivalTime,
          etaMinutes: Math.floor(etaSeconds / 60)
        };
      }
    }
    return null;
  }).filter(Boolean).sort((a: any, b: any) => a.arrivalTime - b.arrivalTime) : [];

  // Bassin de Creil / Montataire
  const center: [number, number] = [49.2583, 2.4764];

  return (
    <div className="relative w-full h-[calc(100vh-80px)] overflow-hidden bg-slate-950">

      {/* Floating Real-time Update Indicator */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-md shadow-lg">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
          MAJ Bus • {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      {/* Floating Filter Controls Button & Menu */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-bold shadow-lg backdrop-blur-md transition-all duration-300 ${isFilterOpen
              ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
              : "bg-slate-900/90 border-white/10 text-slate-200 hover:bg-slate-850 hover:border-white/20"
            }`}
        >
          <SlidersHorizontal size={14} className={isFilterOpen ? "animate-pulse" : ""} />
          <span>Filtres</span>
        </button>

        {/* Dropdown Menu */}
        {isFilterOpen && (
          <div className="bg-slate-950/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl w-60 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-1">
              Affichage de la carte
            </h4>

            {/* Toggle Buses */}
            <label className="flex items-center justify-between cursor-pointer group py-1">
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Bus en circulation
              </span>
              <input
                type="checkbox"
                checked={showBuses}
                onChange={(e) => setShowBuses(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-950 cursor-pointer"
              />
            </label>

            {/* Toggle Shapes */}
            <label className="flex items-center justify-between cursor-pointer group py-1">
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Tracés des lignes
              </span>
              <input
                type="checkbox"
                checked={showShapes}
                onChange={(e) => setShowShapes(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-950 cursor-pointer"
              />
            </label>

            {/* Toggle Stops */}
            <label className="flex items-center justify-between cursor-pointer group py-1">
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Points d'arrêts
              </span>
              <input
                type="checkbox"
                checked={showStops}
                onChange={(e) => setShowStops(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-950 cursor-pointer"
              />
            </label>
          </div>
        )}
      </div>

      {/* Dynamic CSS override for Leaflet tooltips (Professional Map Labels with Halo) */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .stop-tooltip-clean {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #f8fafc !important;
          font-size: 11px !important;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-weight: 700 !important;
          letter-spacing: 0.01em !important;
          padding: 0 !important;
          margin-top: 4px !important;
          cursor: pointer !important;
          /* Professional map label halo effect */
          text-shadow: 
            -1.5px -1.5px 0 #020617,  
             1.5px -1.5px 0 #020617,
            -1.5px  1.5px 0 #020617,
             1.5px  1.5px 0 #020617,
             0px 4px 10px rgba(0,0,0,0.9) !important;
          transition: color 0.2s ease-in-out;
        }
        .stop-tooltip-clean::before {
          display: none !important;
        }
        .stop-tooltip-selected {
          color: #22d3ee !important; /* cyan-400 */
        }

        /* Force buses (markers) to render ABOVE stop names (tooltips) */
        .leaflet-marker-pane {
          z-index: 700 !important;
        }
        .leaflet-tooltip-pane {
          z-index: 600 !important;
        }
      `}} />

      {/* Map layer */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={center}
          zoom={13}
          className="w-full h-full"
          zoomControl={false}
          attributionControl={false}
        >
          <MapZoomListener setZoom={setZoomLevel} />

          {/* Dark Mode CartoDB layer */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* Network Polylines (Shapes) */}
          {showShapes && shapesData?.shapes?.map((shape: any) => {
            // Determine if this line should be highlighted
            const isLineSelected = selectedBus?.route_id === shape.route_id;
            const hasBusSelected = !!selectedBusId;

            // If a bus is selected, completely hide all other shapes
            if (hasBusSelected && !isLineSelected) return null;

            const opacity = hasBusSelected ? 1 : 0.6;
            const weight = hasBusSelected ? 6 : 4;

            return (
              <Polyline
                key={`shape-${shape.shape_id || Math.random()}`}
                positions={shape.coordinates}
                pathOptions={{
                  color: getLineColor(shape.route_id),
                  weight: weight,
                  opacity: opacity,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            );
          })}

          {/* Physical Network Stops */}
          {(showStops ? (selectedBusId && staticData?.stops ? staticData.stops : allStopsData?.stops) : (selectedStop ? [selectedStop] : []))?.map((stop: any) => {
            const isSelected = selectedStopId === stop.stop_id;
            return (
              <CircleMarker
                key={stop.stop_id}
                center={[stop.stop_lat, stop.stop_lon]}
                radius={isSelected ? 6 : 2.5}
                pathOptions={{
                  color: isSelected ? "#f59e0b" : "rgba(255,255,255,0.2)",
                  weight: isSelected ? 2 : 1,
                  fillColor: isSelected ? "#b45309" : "#ffffff",
                  fillOpacity: isSelected ? 1 : 0.5,
                }}
                interactive={true}
                eventHandlers={{
                  click: () => {
                    setSelectedStopId(stop.stop_id);
                    setSelectedBusId(null); // Deselect bus
                  }
                }}
              >
                {(zoomLevel >= 15 || isSelected) && (
                  <Tooltip
                    direction="top"
                    offset={[0, -4]}
                    opacity={1}
                    permanent
                    interactive={false}
                    className={`stop-tooltip-clean ${isSelected ? "stop-tooltip-selected" : ""}`}
                  >
                    {stop.stop_name}
                  </Tooltip>
                )}
              </CircleMarker>
            );
          })}

          {/* Real-time Buses */}
          {showBuses && vehicles.map((vehicle) => {
            if (!vehicle.position?.lat || !vehicle.position?.lon) return null;

            const isDelayed = (vehicle.delay || 0) > 60;
            return (
              <Marker
                key={vehicle.id}
                position={[vehicle.position.lat, vehicle.position.lon]}
                icon={createBusIcon(vehicle.route_id, vehicle.position.bearing || 0, vehicle.delay || 0)}
                eventHandlers={{
                  click: () => {
                    setSelectedBusId(vehicle.id);
                    setSelectedStopId(null); // Deselect stop
                  },
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Touch-friendly Bottom Sheet for selected BUS or STOP */}
      <div
        className={`absolute bottom-24 left-4 right-4 z-50 transition-transform duration-300 ease-out ${(selectedBus || selectedStop) ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
          }`}
      >
        <div className="bg-slate-900/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[50vh] overflow-hidden">

          {/* CONTENT FOR SELECTED BUS */}
          {selectedBus && (
            <>
              <div className="flex justify-between items-start shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl border"
                    style={{
                      backgroundColor: `${getLineColor(selectedBus.route_id)}33`,
                      color: getLineColor(selectedBus.route_id),
                      borderColor: `${getLineColor(selectedBus.route_id)}80`
                    }}
                  >
                    {selectedBus.route_id || "B"}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 tracking-wide">
                      Bus {selectedBus.vehicle_id || "Inconnu"}
                    </h3>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: getLineColor(selectedBus.route_id) }}>
                      Direction : {selectedBus.trip_headsign || "Inconnue"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBusId(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:text-white transition-colors border border-white/5"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex gap-2 shrink-0">
                <div className={`flex-1 flex items-center gap-2 p-3.5 rounded-2xl border ${(selectedBus.delay || 0) > 60
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  }`}>
                  <Clock size={20} />
                  <span className="font-semibold text-sm">
                    {(selectedBus.delay || 0) > 60
                      ? `Retard: +${Math.round((selectedBus.delay || 0) / 60)} min`
                      : "Bus à l'heure"}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar rounded-xl bg-slate-950/50 border border-white/5 p-4 mt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <MapPin size={14} />
                  Trajet de la course
                </h4>

                <div className="relative pl-3 border-l-2 border-slate-800 space-y-6">
                  {!staticData?.stops && (
                    <div className="text-slate-500 text-sm">Chargement du trajet...</div>
                  )}

                  {staticData?.stops?.map((stop: any) => {
                    const currentSeq = selectedBus.current_stop_sequence || 0;
                    const stopSeq = stop.stop_sequence;

                    const isPassed = stopSeq < currentSeq;
                    const isNext = stopSeq === currentSeq;

                    const update = selectedBus.stop_time_updates?.find((u) => u.stop_id === stop.stop_id);
                    const hasUpdate = !!update?.arrival?.time;

                    const timeStr = hasUpdate
                      ? new Date((update.arrival!.time as number) * 1000).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
                      : stop.arrival_time?.slice(0, 5) || "--:--"; const activeColor = getLineColor(selectedBus.route_id);

                    const dotClass = isPassed ? "bg-slate-700 border-slate-600" : isNext ? "animate-pulse" : "bg-slate-300 border-slate-400";
                    const dotStyle = isNext ? { backgroundColor: activeColor, borderColor: activeColor, boxShadow: `0 0 10px ${activeColor}cc` } : {};

                    const textColor = isPassed ? "text-slate-500 line-through" : isNext ? "" : "text-slate-200";
                    const textColorStyle = isNext ? { color: activeColor, fontWeight: "bold" } : {};

                    const timeColor = isPassed ? "text-slate-600" : isNext ? "" : "text-slate-400";
                    const timeColorStyle = isNext ? { color: activeColor, fontWeight: "bold" } : {};

                    // Calculate real-time bus position between stops
                    let busStyle = {};
                    const status = selectedBus.current_status ?? 0;

                    if (status === 1) {
                      // STOPPED_AT: On the dot
                      busStyle = { top: "50%", transform: "translateY(-50%)" };
                    } else if (status === 2) {
                      // INCOMING_AT: Slightly above the dot
                      busStyle = { top: "-12px", transform: "translateY(-50%)" };
                    } else {
                      // IN_TRANSIT_TO: Between this stop and the previous one
                      busStyle = { top: "-28px", transform: "translateY(-50%)" };
                    }

                    if (isPassed && stopSeq < currentSeq - 1) return null;

                    return (
                      <div key={stop.stop_id} className="relative flex items-center justify-between">
                        {/* Static stop dot */}
                        <div className={`absolute -left-[1.05rem] w-3 h-3 rounded-full border-2 ${dotClass}`} style={dotStyle} />

                        {/* Real-time animated bus on the timeline */}
                        {isNext && (
                          <div
                            className="absolute -left-[1.425rem] w-6 h-6 rounded-full flex items-center justify-center z-20 transition-all duration-1000 ease-in-out"
                            style={{
                              ...busStyle,
                              boxShadow: `0 0 12px ${activeColor}`
                            }}
                          >
                            <div
                              className="absolute inset-0 rounded-full animate-ping opacity-40"
                              style={{ backgroundColor: activeColor }}
                            />
                            <div
                              className="relative w-full h-full rounded-full flex items-center justify-center border-2"
                              style={{
                                borderColor: activeColor,
                                color: activeColor,
                                backgroundColor: "#020617"
                              }}
                            >
                              <Bus size={11} className="animate-pulse" />
                            </div>
                          </div>
                        )}

                        <div className={`text-sm truncate pr-4 ${textColor}`} style={textColorStyle}>
                          {stop.stop_name}
                        </div>
                        <div className={`text-xs ${timeColor}`} style={timeColorStyle}>
                          {timeStr}
                          {hasUpdate && !isPassed && <span className="text-[9px] ml-1 opacity-70">(TR)</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* CONTENT FOR SELECTED STOP */}
          {selectedStop && (
            <>
              <div className="flex justify-between items-start shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-800 text-slate-300 border border-slate-700">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 tracking-wide">
                      {selectedStop.stop_name}
                    </h3>
                    <p className="text-sm text-slate-400">
                      Arrêt de bus
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStopId(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:text-white transition-colors border border-white/5"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar rounded-xl bg-slate-950/50 border border-white/5 p-4 mt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Bus size={14} />
                  Prochains passages
                </h4>

                <div className="space-y-3">
                  {upcomingBusesForStop.length === 0 ? (
                    <div className="text-sm text-slate-500 text-center py-4">
                      Aucun passage prévu dans l'immédiat.
                    </div>
                  ) : (
                    upcomingBusesForStop.map((b: any, index: number) => {
                      const isImminent = b.etaMinutes <= 0;
                      const activeColor = getLineColor(b.vehicle.route_id);

                      return (
                        <div key={`${b.vehicle.id}-${index}`} className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-white/5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border shadow-inner"
                              style={{
                                backgroundColor: `${activeColor}33`,
                                color: activeColor,
                                borderColor: `${activeColor}80`
                              }}
                            >
                              {b.vehicle.route_id || "B"}
                            </div>
                            <span className="text-sm font-semibold text-slate-200">
                              Bus {b.vehicle.vehicle_id}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold" style={isImminent ? { color: activeColor, animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" } : { color: "#cbd5e1" }}>
                              {isImminent ? "À l'approche" : `${b.etaMinutes} min`}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(b.arrivalTime * 1000).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
