"use client";

import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, Tooltip, Polyline, useMapEvents } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Clock, Info, X, MapPin, Bus, SlidersHorizontal } from "lucide-react";
import { LINE_COLORS, getLineColor } from "./lineColors";

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

// LINE_COLORS and getLineColor are now imported from ./lineColors

// Custom DivIcon logic for buses
const createBusIcon = (routeId: string = "B", bearing: number = 0, delaySeconds: number = 0) => {
  const lineColor = getLineColor(routeId);
  const isDelayed = delaySeconds >= 300;
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

// Map Event Listener Component for Zoom and Background clicks
function MapEventsListener({
  setZoom,
  onMapClick
}: {
  setZoom: (z: number) => void;
  onMapClick: () => void;
}) {
  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
    click: () => {
      onMapClick();
    }
  });
  return null;
}

export default function LiveMap({ vehicles, lastUpdatedTimestamp }: LiveMapProps) {
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [isInitialModalOpen, setIsInitialModalOpen] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(13);

  const [showBuses, setShowBuses] = useState(true);
  const [showShapes, setShowShapes] = useState(true);
  const [showStops, setShowStops] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Derive exact generation time of the GTFS-RT feed from OiseMob server
  const lastUpdated = lastUpdatedTimestamp ? new Date(lastUpdatedTimestamp) : new Date();

  // Derive live data
  const selectedBus = vehicles.find(v => v.id === selectedBusId) || null;

  // Filter vehicles by the selected line
  const filteredVehicles = useMemo(() => {
    if (!selectedLineId) return vehicles;
    return vehicles.filter(v => v.route_id === selectedLineId);
  }, [vehicles, selectedLineId]);

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

  // Fetch static line data to get the precise stop timeline for the selected trip or filtered line
  const lineToFetch = selectedBus?.route_id || selectedLineId;
  const { data: staticData } = useQuery({
    queryKey: ["staticLine", selectedBus?.trip_id || selectedLineId],
    queryFn: async () => {
      const url = selectedBus?.trip_id
        ? `/api/axo/static-line?trip_id=${selectedBus.trip_id}`
        : `/api/axo/static-line?line=${lineToFetch}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch static line data");
      return res.json();
    },
    enabled: !!(selectedBus?.trip_id || lineToFetch),
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

  // Filter stops to show
  const stopsToShow = useMemo(() => {
    if (!showStops) return selectedStop ? [selectedStop] : [];
    if (selectedBusId && staticData?.stops) return staticData.stops;
    if (selectedLineId && allStopsData?.stops) {
      // Show ALL stops serving this line, not just one representative trip!
      return allStopsData.stops.filter((s: any) => s.lines?.includes(selectedLineId));
    }
    return allStopsData?.stops || [];
  }, [showStops, selectedStop, selectedBusId, selectedLineId, staticData, allStopsData]);

  // Calculate upcoming buses for the selected stop
  const upcomingBusesForStop = selectedStop ? filteredVehicles.map(v => {
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

  // Check if selected bus is waiting at the first stop and has not departed yet
  const departureStatus = useMemo(() => {
    if (!selectedBus || !staticData?.stops?.length) return null;
    const firstStop = staticData.stops[0];
    const currentSeq = selectedBus.current_stop_sequence || 0;

    // Check if the bus is at or before the first stop
    if (currentSeq <= firstStop.stop_sequence) {
      const update = selectedBus.stop_time_updates?.find((u) => u.stop_id === firstStop.stop_id);
      const departureTime = update?.departure?.time || update?.arrival?.time;
      
      if (departureTime) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const diffSeconds = departureTime - nowSeconds;
        
        if (diffSeconds > 0) {
          const diffMinutes = Math.max(1, Math.round(diffSeconds / 60));
          return {
            minutes: diffMinutes,
            isWaiting: true
          };
        }
      }
    }
    return null;
  }, [selectedBus, staticData]);

  // Find current stop name if stopped or approaching
  const currentStopInfo = useMemo(() => {
    if (!selectedBus || !staticData?.stops?.length) return null;
    const currentSeq = selectedBus.current_stop_sequence;
    const stop = staticData.stops.find((s: any) => s.stop_sequence === currentSeq);
    return {
      name: stop?.stop_name || null,
      status: selectedBus.current_status // 0: IN_TRANSIT_TO, 1: STOPPED_AT, 2: INCOMING_AT
    };
  }, [selectedBus, staticData]);

  // Bassin de Creil / Montataire
  const center: [number, number] = [49.2583, 2.4764];

  return (
    <div className="relative w-full h-[calc(100vh-80px)] overflow-hidden bg-slate-950">

      {/* Onboarding Modal asking which line to visualize */}
      {isInitialModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900/90 border border-white/10 rounded-[32px] p-8 max-w-sm w-full shadow-2xl flex flex-col gap-6 text-center relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-2">
                <Bus size={24} className="animate-pulse" />
              </div>
              <h3 className="text-xl font-black text-white tracking-wide">
                Réseau AXO Live
              </h3>
              <p className="text-xs font-medium text-slate-400 max-w-[260px] leading-relaxed">
                Quelle ligne de bus souhaitez-vous visualiser en temps réel sur la carte ?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Object.keys(LINE_COLORS).map((line) => {
                const lineColor = LINE_COLORS[line];
                return (
                  <button
                    key={line}
                    onClick={() => {
                      setSelectedLineId(line);
                      setIsInitialModalOpen(false);
                    }}
                    className="py-3.5 px-4 rounded-2xl border text-sm font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      backgroundColor: `${lineColor}15`,
                      borderColor: `${lineColor}30`,
                      color: lineColor,
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lineColor }} />
                    Ligne {line}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-white/5 pt-4">
              <button
                onClick={() => {
                  setSelectedLineId(null);
                  setIsInitialModalOpen(false);
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-white/5 hover:border-white/10 text-white font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-inner flex items-center justify-center gap-2"
              >
                Toutes les lignes
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Top Floating Line Filter Bar */}
      <div className="absolute top-16 left-4 right-4 z-[1000] flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl shadow-xl overflow-x-auto max-w-full no-scrollbar">
          <button
            onClick={() => {
              setSelectedLineId(null);
              setSelectedBusId(null);
              setSelectedStopId(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 border ${
              !selectedLineId
                ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                : "bg-slate-950/65 border-white/5 text-slate-400 hover:text-white"
            }`}
          >
            Toutes Lignes
          </button>
          
          {Object.keys(LINE_COLORS).map((line) => {
            const lineColor = LINE_COLORS[line];
            const isActive = selectedLineId === line;
            return (
              <button
                key={line}
                onClick={() => {
                  setSelectedLineId(line);
                  setSelectedBusId(null);
                  setSelectedStopId(null);
                }}
                className="px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 border flex items-center gap-1.5 shrink-0"
                style={{
                  backgroundColor: isActive ? `${lineColor}33` : "rgba(2, 6, 23, 0.65)",
                  borderColor: isActive ? lineColor : "rgba(255, 255, 255, 0.05)",
                  color: isActive ? "#ffffff" : lineColor,
                  boxShadow: isActive ? `0 0 10px ${lineColor}40` : "none",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lineColor }} />
                Ligne {line}
              </button>
            );
          })}
        </div>
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
          pointer-events: none !important;
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
          <MapEventsListener
            setZoom={setZoomLevel}
            onMapClick={() => {
              setSelectedBusId(null);
              setSelectedStopId(null);
            }}
          />

          {/* Dark Mode CartoDB layer */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* Network Polylines (Shapes) */}
          {showShapes && shapesData?.shapes?.map((shape: any) => {
            // Determine if this line should be highlighted
            const isLineSelected = selectedLineId ? selectedLineId === shape.route_id : selectedBus?.route_id === shape.route_id;
            const hasActiveFilter = !!selectedLineId || !!selectedBusId;

            // If a filter is set, completely hide other shapes
            if (hasActiveFilter && !isLineSelected) return null;

            const opacity = hasActiveFilter ? 1 : 0.6;
            const weight = hasActiveFilter ? 6 : 4;

            return (
              <Polyline
                key={`shape-${shape.shape_id || Math.random()}`}
                positions={shape.coordinates}
                interactive={true}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    setSelectedLineId(shape.route_id);
                    setSelectedBusId(null);
                    setSelectedStopId(null);
                  }
                }}
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
          {stopsToShow?.map((stop: any) => {
            const isSelected = selectedStopId === stop.stop_id;
            return (
              <CircleMarker
                key={stop.stop_id}
                center={[stop.stop_lat, stop.stop_lon]}
                radius={isSelected ? 10 : 6}
                pathOptions={{
                  color: isSelected ? "#f59e0b" : "#ffffff",
                  weight: isSelected ? 4 : 2,
                  fillColor: isSelected ? "#78350f" : "#0f172a",
                  fillOpacity: 1,
                }}
                interactive={true}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
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
          {showBuses && filteredVehicles.map((vehicle) => {
            if (!vehicle.position?.lat || !vehicle.position?.lon) return null;

            const isDelayed = (vehicle.delay || 0) > 60;
            return (
              <Marker
                key={vehicle.id}
                position={[vehicle.position.lat, vehicle.position.lon]}
                icon={createBusIcon(vehicle.route_id, vehicle.position.bearing || 0, vehicle.delay || 0)}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
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
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl border shadow-lg"
                    style={{
                      backgroundColor: `${getLineColor(selectedBus.route_id)}33`,
                      color: getLineColor(selectedBus.route_id),
                      borderColor: `${getLineColor(selectedBus.route_id)}80`
                    }}
                  >
                    {selectedBus.route_id || "B"}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white flex items-center gap-2 tracking-wide">
                      Bus {selectedBus.vehicle_id || "Inconnu"}
                    </h3>
                    <div className="mt-2.5 bg-black border border-slate-800 rounded-xl px-4 py-2.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] relative overflow-hidden flex items-center justify-between min-w-[200px]">
                      {/* Ambient grid texture overlay to simulate LED display */}
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none" />
                      
                      <div className="relative z-10 flex flex-col">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">
                          Direction
                        </span>
                        <span className="text-sm md:text-base font-black font-mono text-amber-500 uppercase tracking-wider leading-tight drop-shadow-[0_0_6px_rgba(245,158,11,0.85)]">
                          {selectedBus.trip_headsign || "SANS VOYAGEURS"}
                        </span>
                      </div>
                      
                      {/* Led indicators on the right of the sign */}
                      <div className="relative z-10 flex gap-1.5 pl-4 border-l border-slate-800/80 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/30 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 drop-shadow-[0_0_4px_rgba(245,158,11,0.85)]" />
                      </div>
                    </div>

                    {currentStopInfo?.name && currentStopInfo.status === 1 && (
                      <div className="mt-2 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider animate-pulse inline-flex">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        À l'arrêt : {currentStopInfo.name}
                      </div>
                    )}

                    {currentStopInfo?.name && currentStopInfo.status === 2 && (
                      <div className="mt-2 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-wider animate-pulse inline-flex">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                        En approche : {currentStopInfo.name}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBusId(null)}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:text-white transition-colors border border-white/5"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex gap-2 shrink-0">
                {departureStatus ? (
                  <div className="flex-1 flex items-center gap-3 p-4.5 rounded-2xl border bg-amber-500/10 border-amber-500/30 text-amber-400">
                    <Clock size={22} className="animate-pulse" />
                    <span className="font-extrabold text-base tracking-wide">
                      En attente au terminus • Départ dans {departureStatus.minutes} min
                    </span>
                  </div>
                ) : (
                  <div className={`flex-1 flex items-center gap-3 p-4.5 rounded-2xl border ${(selectedBus.delay || 0) > 60
                      ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    }`}>
                    <Clock size={22} />
                    <span className="font-extrabold text-base tracking-wide">
                      {(selectedBus.delay || 0) > 60
                        ? `Retard : +${Math.round((selectedBus.delay || 0) / 60)} min`
                        : "Bus à l'heure"}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar rounded-2xl bg-slate-950/50 border border-white/5 p-6 mt-3">
                <h4 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2.5">
                  <MapPin size={18} className="text-amber-500" />
                  Trajet de la course
                </h4>

                <div className="relative pl-6 border-l-[3px] border-slate-800 space-y-10">
                  {!staticData?.stops && (
                    <div className="text-slate-500 text-sm animate-pulse">Chargement du trajet...</div>
                  )}

                  {staticData?.stops?.map((stop: any) => {
                    const currentSeq = selectedBus.current_stop_sequence || 0;
                    const stopSeq = stop.stop_sequence;

                    const isPassed = stopSeq < currentSeq;
                    const isNext = stopSeq === currentSeq;

                    const isFirstStop = stop.stop_id === staticData?.stops?.[0]?.stop_id;
                    const isWaitingToDepart = isFirstStop && departureStatus?.isWaiting;

                    const update = selectedBus.stop_time_updates?.find((u) => u.stop_id === stop.stop_id);
                    const hasUpdate = !!update?.arrival?.time;

                    const scheduledTime = stop.arrival_time?.slice(0, 5) || "--:--";
                    const expectedTime = hasUpdate
                      ? new Date((update.arrival!.time as number) * 1000).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
                      : null;
                    const delayMin = hasUpdate ? Math.round((update.arrival?.delay || 0) / 60) : 0;
                    const activeColor = getLineColor(selectedBus.route_id);

                    const dotClass = isPassed ? "bg-slate-700 border-slate-600" : isNext ? "animate-pulse" : "bg-slate-300 border-slate-400";
                    const dotStyle = isNext ? { backgroundColor: activeColor, borderColor: activeColor, boxShadow: `0 0 12px ${activeColor}cc` } : {};

                    const textColor = isPassed ? "text-slate-500 line-through font-medium" : isNext ? "" : "text-slate-200";
                    const textColorStyle = isNext ? { color: activeColor, fontWeight: "900" } : {};

                    const timeColor = isPassed ? "text-slate-600" : isNext ? "" : "text-slate-400";
                    const timeColorStyle = isNext ? { color: activeColor, fontWeight: "900" } : {};

                    // Calculate real-time bus position between stops with our new taller spacing
                    let busStyle = {};
                    const status = selectedBus.current_status ?? 0;

                    if (status === 1) {
                      // STOPPED_AT: On the dot
                      busStyle = { top: "50%", transform: "translateY(-50%)" };
                    } else if (status === 2) {
                      // INCOMING_AT: Slightly above the dot
                      busStyle = { top: "-18px", transform: "translateY(-50%)" };
                    } else {
                      // IN_TRANSIT_TO: Between this stop and the previous one
                      busStyle = { top: "-42px", transform: "translateY(-50%)" };
                    }

                    if (isPassed && stopSeq < currentSeq - 1) return null;

                    return (
                      <div key={stop.stop_id} className="relative flex items-center justify-between min-h-[44px]">
                        {/* Static stop dot */}
                        <div className={`absolute -left-[32.5px] w-5 h-5 rounded-full border-[3px] z-10 ${dotClass}`} style={dotStyle} />

                        {/* Real-time animated bus on the timeline */}
                        {isNext && (
                          <div
                            className="absolute -left-[40.5px] w-9 h-9 rounded-full flex items-center justify-center z-20 transition-all duration-1000 ease-in-out"
                            style={{
                              ...busStyle,
                              boxShadow: `0 0 16px ${activeColor}`
                            }}
                          >
                            <div
                              className="absolute inset-0 rounded-full animate-ping opacity-45"
                              style={{ backgroundColor: activeColor }}
                            />
                            <div
                              className="relative w-full h-full rounded-full flex items-center justify-center border-[2.5px]"
                              style={{
                                borderColor: activeColor,
                                color: activeColor,
                                backgroundColor: "#020617"
                              }}
                            >
                              <Bus size={15} className="animate-pulse" />
                            </div>
                          </div>
                        )}

                        <div className={`text-base md:text-lg font-bold truncate pr-4 ${textColor}`} style={textColorStyle}>
                          {stop.stop_name}
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {hasUpdate && expectedTime ? (
                            <div className="flex flex-col items-end gap-1">
                              {/* Expected real-time arrival */}
                              <div className={`text-sm md:text-base font-extrabold bg-slate-900 border border-white/5 px-3 py-1.5 rounded-xl shadow-inner ${timeColor}`} style={timeColorStyle}>
                                {expectedTime}
                              </div>
                              
                              {/* Scheduled time and delay status indicator */}
                              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                                <span className="text-slate-500 line-through">
                                  {scheduledTime}
                                </span>
                                {isWaitingToDepart ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold animate-pulse">
                                    Départ dans {departureStatus.minutes} min
                                  </span>
                                ) : delayMin > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                                    +{delayMin} min
                                  </span>
                                ) : delayMin < 0 ? (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                    {delayMin} min
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                    À l'heure
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Fallback to theoretical only */
                            <div className={`text-xs md:text-sm font-extrabold bg-slate-900 border border-white/5 px-3.5 py-1.5 rounded-xl shadow-inner ${timeColor}`} style={timeColorStyle}>
                              {scheduledTime}
                            </div>
                          )}
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
                    <div className="bg-black border border-slate-800 rounded-xl px-4 py-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] relative overflow-hidden flex items-center justify-between min-w-[200px]">
                      {/* Ambient grid texture overlay to simulate LED display */}
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none" />
                      
                      <div className="relative z-10 flex flex-col">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">
                          Arrêt Physique
                        </span>
                        <span className="text-sm md:text-base font-black font-mono text-cyan-400 uppercase tracking-wider leading-tight drop-shadow-[0_0_6px_rgba(34,211,238,0.85)]">
                          {selectedStop.stop_name}
                        </span>
                      </div>
                      
                      {/* Led indicators on the right of the sign */}
                      <div className="relative z-10 flex gap-1.5 pl-4 border-l border-slate-800/80 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/30 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 drop-shadow-[0_0_4px_rgba(34,211,238,0.85)]" />
                      </div>
                    </div>
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
