"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMapEvents, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Clock, Info, X, MapPin, Bus, SlidersHorizontal, ChevronDown, Search } from "lucide-react";
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

// Clean and format bus names (remove RCR prefix)
const formatBusName = (vehicleId: string) => {
  return vehicleId ? vehicleId.replace("RCR", "") : "";
};

// Identify bus type (Standard or Articulated for: 53, 57, 58, 65, 66, 67, 68)
const getVehicleType = (vehicleId: string) => {
  const cleanId = formatBusName(vehicleId);
  const articulatedIds = ["53", "57", "58", "65", "66", "67", "68"];
  return articulatedIds.includes(cleanId) ? "Articulé" : "Standard";
};

// LINE_COLORS and getLineColor are now imported from ./lineColors

// Custom DivIcon logic for buses (sleek, compact & modern)
// Enhanced with rotating neon conic-gradient glow wrapper when selected/focused
const createBusIcon = (
  routeId: string = "B",
  bearing: number = 0,
  delaySeconds: number = 0,
  isSelected: boolean = false
) => {
  const lineColor = getLineColor(routeId);
  const isDelayed = delaySeconds >= 300;
  const glowColor = `${lineColor}50`;
  const borderColor = lineColor;

  const neonPulseStyle = isSelected ? 'animation: pulse-neon 1.5s ease-in-out infinite alternate;' : '';

  const html = `
    <div style="position: relative; width: 30px; height: 30px; overflow: visible; ${neonPulseStyle}">
      
      <!-- Neon vibrant gradient halo outer glow when focused -->
      ${isSelected ? `
      <div style="
        position: absolute;
        top: -6px;
        left: -6px;
        width: 42px;
        height: 42px;
        background: conic-gradient(from 0deg, #ff007f, #00f0ff, #00ff66, #ff007f);
        border-radius: 50%;
        animation: rotate-neon 1.5s linear infinite;
        z-index: -1;
        opacity: 0.95;
      "></div>
      ` : ""}

      <!-- Tiny Line Badge Above (Stays upright, unrotated) -->
      <div style="
        position: absolute;
        top: -11px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #0b0f19;
        border: 1.5px solid ${borderColor};
        color: ${lineColor};
        border-radius: 6px;
        padding: 1px 4.5px;
        font-size: 8px;
        font-weight: 900;
        font-family: system-ui, -apple-system, sans-serif;
        white-space: nowrap;
        line-height: 1;
        z-index: 10;
        box-shadow: 0 2px 5px rgba(0,0,0,0.5);
      ">
        ${routeId}
      </div>

      <!-- Bus Marker Circle (Rotates with travel bearing) -->
      <div style="
        position: absolute;
        top: 0; left: 0;
        width: 30px;
        height: 30px;
        background-color: #0b0f19;
        border: 2px solid ${borderColor};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 10px ${glowColor};
        color: ${lineColor};
        transform: rotate(${bearing}deg);
        transition: transform 0.3s ease;
      ">
        <!-- Universal Front-Facing Bus SVG Icon (Instantly recognizable at small sizes) -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px;">
          <rect x="4" y="3" width="16" height="16" rx="2" />
          <path d="M4 10h16" />
          <line x1="8" y1="15" x2="8.01" y2="15" style="stroke-width: 3.5;" />
          <line x1="16" y1="15" x2="16.01" y2="15" style="stroke-width: 3.5;" />
          <path d="M6 19v2" />
          <path d="M18 19v2" />
        </svg>
        
        <!-- Sleek Directional pointer -->
        <div style="
          position: absolute;
          top: -5px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 6px solid ${borderColor};
        "></div>
      </div>

      <!-- Small Delay Indicator Badge -->
      ${isDelayed ? `
        <div style="
          position: absolute;
          top: -1px;
          right: -1px;
          width: 7px;
          height: 7px;
          background-color: #ef4444;
          border: 1.5px solid #0b0f19;
          border-radius: 50%;
          box-shadow: 0 0 5px #ef4444;
          z-index: 20;
        "></div>
      ` : ""}
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-bus-marker",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

// Custom DivIcon for bus STOPS — Rounded SQUARE shape with multi-color border
// Distinct from circular bus markers: square shape + white dot center
const createStopIcon = (isSelected: boolean = false, lines: string[] = []) => {
  const size = isSelected ? 24 : 18;
  const borderWidth = isSelected ? 3.5 : 3;
  const innerSize = size - borderWidth * 2;
  const radius = isSelected ? 7 : 5; // rounded-square corners

  // Build conic-gradient from each line's color
  const colors = lines.length > 0
    ? lines.map(l => getLineColor(l))
    : ['#6b7280']; // neutral gray fallback if no line data

  let ringGradient: string;
  if (colors.length === 1) {
    ringGradient = colors[0];
  } else {
    const segDeg = 360 / colors.length;
    const stops = colors.map((c, i) =>
      `${c} ${i * segDeg}deg ${(i + 1) * segDeg}deg`
    ).join(', ');
    ringGradient = `conic-gradient(from 90deg, ${stops})`;
  }

  // Selected state: golden outline glow
  const selectedOutline = isSelected ? 'outline: 2px solid #f59e0b; outline-offset: 2px;' : '';
  const shadow = isSelected
    ? '0 0 14px rgba(245,158,11,0.5), 0 2px 8px rgba(0,0,0,0.5)'
    : '0 1px 5px rgba(0,0,0,0.45)';

  const dotColor = isSelected ? '#f59e0b' : '#ffffff';
  const dotSize = isSelected ? 6 : 4;

  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background: ${ringGradient};
      border-radius: ${radius}px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: ${shadow};
      ${selectedOutline}
      cursor: pointer;
      transition: all 0.2s ease;
    ">
      <div style="
        width: ${innerSize}px;
        height: ${innerSize}px;
        background: #0f172a;
        border-radius: ${Math.max(1, radius - 2)}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: ${dotSize}px;
          height: ${dotSize}px;
          background: ${dotColor};
          border-radius: 50%;
        "></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-stop-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// --- HIGHLY INTELLIGENT FUZZY SEARCH HELPERS (Accent Insensitive & Typo Tolerant) ---

// Calculates the basic editing distance between two strings
const getLevenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// Computes a fuzzy matching strength (0-100) between the stop name and query string
const getFuzzyMatchScore = (stopName: string, query: string): number => {
  // Convert to lowercase and strip all French accents/diacritics
  const cleanStop = stopName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Perfect substring match (highest priority score)
  if (cleanStop.includes(cleanQuery)) {
    return 100 - (cleanStop.indexOf(cleanQuery) * 2) - (cleanStop.length - cleanQuery.length);
  }

  // 2. Word-by-word comparison for spelling mistake tolerance
  const stopWords = cleanStop.split(/[\s-]+/);
  const queryWords = cleanQuery.split(/[\s-]+/);

  let totalScore = 0;

  for (const qWord of queryWords) {
    if (!qWord) continue;
    let bestWordScore = 0;

    for (const sWord of stopWords) {
      if (!sWord) continue;

      // Prefix match (e.g. "berth" matches "berthe")
      if (sWord.startsWith(qWord)) {
        bestWordScore = Math.max(bestWordScore, 85 - (sWord.length - qWord.length));
        continue;
      }

      // Inter-word substring
      if (sWord.includes(qWord)) {
        bestWordScore = Math.max(bestWordScore, 70 - (sWord.length - qWord.length));
        continue;
      }

      // Levenshtein typo distance tolerance
      const dist = getLevenshteinDistance(sWord, qWord);
      const maxLength = Math.max(sWord.length, qWord.length);

      // Max allowed errors: 2 for long words (>4), 1 for medium (>2), 0 for short
      const maxAllowedDist = qWord.length > 4 ? 2 : qWord.length > 2 ? 1 : 0;

      if (dist <= maxAllowedDist) {
        const similarity = 1 - dist / maxLength;
        bestWordScore = Math.max(bestWordScore, Math.round(similarity * 60));
      }
    }
    totalScore += bestWordScore;
  }

  return totalScore / queryWords.length;
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

// Component to automatically recenter/fly the map to the active selection
function MapFocusController({
  selectedBus,
  selectedStop,
  highlightedBus
}: {
  selectedBus: Vehicle | null;
  selectedStop: any | null;
  highlightedBus: Vehicle | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (highlightedBus?.position?.lat && highlightedBus?.position?.lon) {
      map.flyTo(
        [highlightedBus.position.lat, highlightedBus.position.lon],
        16,
        { animate: true, duration: 1.2 }
      );
    } else if (selectedBus?.position?.lat && selectedBus?.position?.lon) {
      map.flyTo(
        [selectedBus.position.lat, selectedBus.position.lon],
        16,
        { animate: true, duration: 1.2 }
      );
    } else if (selectedStop?.stop_lat && selectedStop?.stop_lon) {
      map.flyTo(
        [selectedStop.stop_lat, selectedStop.stop_lon],
        16,
        { animate: true, duration: 1.2 }
      );
    }
  }, [selectedBus?.id, selectedStop?.stop_id, highlightedBus?.id, map]);

  return null;
}

export default function LiveMap({ vehicles, lastUpdatedTimestamp }: LiveMapProps) {
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [highlightedBusId, setHighlightedBusId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [isInitialModalOpen, setIsInitialModalOpen] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(13);

  const [showBuses, setShowBuses] = useState(true);
  const [showShapes, setShowShapes] = useState(true);
  const [showStops, setShowStops] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isOthersOpen, setIsOthersOpen] = useState(false);

  // Derive exact generation time of the GTFS-RT feed from OiseMob server
  const lastUpdated = lastUpdatedTimestamp ? new Date(lastUpdatedTimestamp) : new Date();

  // Derive live data
  const selectedBus = vehicles.find(v => v.id === selectedBusId) || null;
  const highlightedBus = vehicles.find(v => v.id === highlightedBusId) || null;

  // Filter vehicles by the selected line or active bus's line
  const filteredVehicles = useMemo(() => {
    const activeRouteId = selectedLineId || selectedBus?.route_id || highlightedBus?.route_id;
    if (!activeRouteId) return vehicles;
    return vehicles.filter(v => v.route_id === activeRouteId);
  }, [vehicles, selectedLineId, selectedBus?.route_id, highlightedBus?.route_id]);

  // Group close or overlapping vehicles and apply spiderfy angular offsets
  const spiderfiedVehicles = useMemo(() => {
    const coordsCount: Record<string, number> = {};
    const coordsIndex: Record<string, number> = {};

    // 1st pass: Count buses at approximate coordinate locations (4 decimal places ~ 11 meters)
    filteredVehicles.forEach((v) => {
      if (!v.position?.lat || !v.position?.lon) return;
      const key = `${v.position.lat.toFixed(4)}_${v.position.lon.toFixed(4)}`;
      coordsCount[key] = (coordsCount[key] || 0) + 1;
    });

    // 2nd pass: Shift overlapping markers in a neat circle
    return filteredVehicles.map((v) => {
      if (!v.position?.lat || !v.position?.lon) return null;
      const key = `${v.position.lat.toFixed(4)}_${v.position.lon.toFixed(4)}`;
      const count = coordsCount[key];

      if (count > 1) {
        const index = coordsIndex[key] || 0;
        coordsIndex[key] = index + 1;

        // Spread radius in degrees (~15 meters)
        const radius = 0.00018; 
        const angle = (2 * Math.PI * index) / count;

        return {
          ...v,
          originalPosition: v.position,
          position: {
            ...v.position,
            lat: v.position.lat + Math.sin(angle) * radius,
            lon: v.position.lon + Math.cos(angle) * radius,
          }
        };
      }
      return v;
    }).filter(Boolean) as Vehicle[];
  }, [filteredVehicles]);

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

  // Sort shapes so primary lines A, B, C1, C2, D are rendered last and sit on top of secondary shapes
  const sortedShapes = useMemo(() => {
    if (!shapesData?.shapes) return [];
    const primaryList = ["A", "B", "C1", "C2", "D"];
    return [...shapesData.shapes].sort((a: any, b: any) => {
      const aIsPrimary = primaryList.includes(a.route_id);
      const bIsPrimary = primaryList.includes(b.route_id);
      if (aIsPrimary && !bIsPrimary) return 1;
      if (!aIsPrimary && bIsPrimary) return -1;
      return 0;
    });
  }, [shapesData]);

  // Filter stops to show
  const stopsToShow = useMemo(() => {
    if (!showStops) return selectedStop ? [selectedStop] : [];
    
    // Only show stops serving the selected line or the active bus's line!
    const activeRouteId = selectedLineId || selectedBus?.route_id || highlightedBus?.route_id;
    if (activeRouteId && allStopsData?.stops) {
      return allStopsData.stops.filter((s: any) => s.lines?.includes(activeRouteId));
    }
    return allStopsData?.stops || [];
  }, [showStops, selectedStop, selectedBus, highlightedBus, selectedLineId, allStopsData]);

  // Filtered stops based on textual search query with fuzzy matching and accent insensitivity
  const filteredStops = useMemo(() => {
    if (!searchQuery.trim() || !allStopsData?.stops) return [];
    
    return allStopsData.stops
      .map((stop: any) => {
        const score = getFuzzyMatchScore(stop.stop_name || "", searchQuery);
        return { stop, score };
      })
      .filter((item: any) => item.score > 25)
      .sort((a: any, b: any) => b.score - a.score)
      .map((item: any) => item.stop)
      .slice(0, 8); // Premium compact view limit
  }, [searchQuery, allStopsData]);

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
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-950/92 border border-white/10 rounded-[32px] p-8 max-w-sm w-full shadow-[0_25px_60px_rgba(0,0,0,0.75)] flex flex-col gap-6 text-center backdrop-blur-3xl relative overflow-hidden">
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
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-950/92 border border-white/10 backdrop-blur-3xl shadow-lg">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
          MAJ Bus • {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      {/* Top Floating Line Filter Bar */}
      <div className="absolute top-16 left-4 right-4 z-[1000] flex flex-col items-center pointer-events-none gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 bg-slate-950/92 border border-white/10 backdrop-blur-3xl rounded-2xl shadow-2xl overflow-x-auto max-w-full no-scrollbar">
          <button
            onClick={() => {
              setSelectedLineId(null);
              setSelectedBusId(null);
              setSelectedStopId(null);
              setIsOthersOpen(false);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 border ${
              !selectedLineId
                ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                : "bg-slate-950/65 border-white/5 text-slate-400 hover:text-white"
            }`}
          >
            Toutes Lignes
          </button>
          
          {/* Primary network lines */}
          {["A", "B", "C1", "C2", "D"].map((line) => {
            const lineColor = LINE_COLORS[line];
            const isActive = selectedLineId === line;
            return (
              <button
                key={line}
                onClick={() => {
                  setSelectedLineId(line);
                  setSelectedBusId(null);
                  setSelectedStopId(null);
                  setIsOthersOpen(false);
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

          {/* Active other line indicator pill */}
          {selectedLineId && ["E", "EXAL", "F", "S1", "S2", "S3", "S5", "S6", "S7"].includes(selectedLineId) && (
            <button
              onClick={() => {
                setSelectedLineId(null);
                setSelectedBusId(null);
                setSelectedStopId(null);
              }}
              className="px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 border flex items-center gap-1.5 shrink-0 animate-in zoom-in duration-300"
              style={{
                backgroundColor: `${LINE_COLORS[selectedLineId]}33`,
                borderColor: LINE_COLORS[selectedLineId],
                color: "#ffffff",
                boxShadow: `0 0 10px ${LINE_COLORS[selectedLineId]}40`,
              }}
            >
              Ligne {selectedLineId}
              <X size={12} className="text-white/60 hover:text-white shrink-0 ml-0.5" />
            </button>
          )}

          {/* + Autres sub-menu button toggle */}
          <button
            onClick={() => setIsOthersOpen(!isOthersOpen)}
            className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 border flex items-center gap-1 shrink-0 ${
              isOthersOpen
                ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                : "bg-slate-950/65 border-white/5 text-slate-400 hover:text-white"
            }`}
          >
            <span>+ Autres</span>
            <ChevronDown size={11} className={`transition-transform duration-300 shrink-0 ${isOthersOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Dropdown submenu for "Autres Lignes" */}
        {isOthersOpen && (
          <div className="pointer-events-auto bg-slate-950/92 backdrop-blur-3xl border border-white/10 p-5 rounded-[28px] shadow-[0_20px_40px_rgba(0,0,0,0.6)] flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-2 duration-300 max-w-sm w-[92vw] overflow-hidden">
            <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
              <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                <Bus size={11} className="text-amber-500" />
                Autres Lignes du Réseau
              </h4>
              <button
                onClick={() => setIsOthersOpen(false)}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Fermer"
              >
                <X size={10} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1">
              {["E", "EXAL", "F", "S1", "S2", "S3", "S5", "S6", "S7"].map((line) => {
                const lineColor = LINE_COLORS[line];
                const isActive = selectedLineId === line;
                return (
                  <button
                    key={line}
                    onClick={() => {
                      setSelectedLineId(line);
                      setSelectedBusId(null);
                      setSelectedStopId(null);
                      setIsOthersOpen(false); // Close submenu automatically
                    }}
                    className="py-2.5 px-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      backgroundColor: isActive ? `${lineColor}33` : "rgba(2, 6, 23, 0.65)",
                      borderColor: isActive ? lineColor : "rgba(255, 255, 255, 0.05)",
                      color: isActive ? "#ffffff" : lineColor,
                      boxShadow: isActive ? `0 0 10px ${lineColor}30` : "none",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lineColor }} />
                    {line}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating Filter Controls & Search Bar */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Text Search Panel */}
          {isSearchOpen && (
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-950/92 border border-white/10 backdrop-blur-3xl rounded-2xl shadow-xl animate-in slide-in-from-right-3 duration-200">
              <Search size={13} className="text-slate-400 ml-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un arrêt..."
                className="bg-transparent border-none text-slate-200 placeholder-slate-500 font-bold text-xs focus:ring-0 outline-none w-40 md:w-52 py-0.5"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="w-5 h-5 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          )}

          {/* Search Toggle Button */}
          <button
            onClick={() => {
              setIsSearchOpen(!isSearchOpen);
              if (isSearchOpen) setSearchQuery("");
            }}
            className={`flex items-center justify-center w-10 h-10 rounded-2xl border shadow-lg backdrop-blur-3xl transition-all duration-300 ${isSearchOpen
                ? "bg-cyan-500 border-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                : "bg-slate-950/92 border-white/10 text-slate-200 hover:bg-slate-900/90 hover:border-white/20"
              }`}
            title="Rechercher un arrêt"
          >
            <Search size={15} />
          </button>

          {/* Filters Toggle Button */}
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center gap-2 px-3.5 py-2.5 h-10 rounded-2xl border text-xs font-bold shadow-lg backdrop-blur-3xl transition-all duration-300 ${isFilterOpen
                ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                : "bg-slate-950/92 border-white/10 text-slate-200 hover:bg-slate-900/90 hover:border-white/20"
              }`}
          >
            <SlidersHorizontal size={14} className={isFilterOpen ? "animate-pulse" : ""} />
            <span>Filtres</span>
          </button>
        </div>

        {/* Search Results Dropdown */}
        {isSearchOpen && searchQuery.trim().length > 0 && (
          <div className="pointer-events-auto bg-slate-950/95 border border-white/10 p-3 rounded-[20px] w-64 md:w-80 shadow-2xl flex flex-col gap-1 max-h-56 overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200 mt-1">
            {filteredStops.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-4 font-black uppercase tracking-wider">
                Aucun arrêt trouvé
              </div>
            ) : (
              filteredStops.map((stop: any) => (
                <button
                  key={stop.stop_id}
                  onClick={() => {
                    setSelectedStopId(stop.stop_id);
                    setSelectedBusId(null);
                    setSearchQuery("");
                    setIsSearchOpen(false); // Auto close
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left transition-all duration-200"
                >
                  <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                    <span className="text-xs font-bold text-slate-200 truncate font-mono uppercase tracking-wide">
                      {stop.stop_name}
                    </span>
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      {stop.lines?.length > 0 ? `Lignes : ${stop.lines.join(", ")}` : "Aucune ligne"}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700">
                    <MapPin size={12} />
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Dropdown Menu */}
        {isFilterOpen && (
          <div className="bg-slate-950/92 backdrop-blur-3xl border border-white/10 p-4 rounded-2xl w-60 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
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
        /* Neon animation keyframes for selected bus marker */
        @keyframes rotate-neon {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse-neon {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px #ff007f) drop-shadow(0 0 10px #00f0ff); }
          50% { transform: scale(1.1); filter: drop-shadow(0 0 10px #00ff66) drop-shadow(0 0 18px #ff007f); }
        }

        /* Bus stop custom marker: remove Leaflet's default wrapper styling */
        .custom-stop-marker {
          background: transparent !important;
          border: none !important;
        }

        /* Ultra-modern glassmorphic, compact stop label */
        .stop-label-pill {
          background: rgba(15, 23, 42, 0.8) !important;
          backdrop-filter: blur(4px) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
          color: #cbd5e1 !important;
          font-size: 8px !important;
          font-weight: 700 !important;
          font-family: system-ui, -apple-system, sans-serif !important;
          letter-spacing: 0.02em !important;
          padding: 2px 6.5px !important;
          white-space: nowrap !important;
          pointer-events: none !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .stop-label-pill::before {
          display: none !important;
        }

        /* Selected stop label: vibrant golden accent, neon border glow */
        .stop-label-selected {
          background: rgba(245, 158, 11, 0.15) !important;
          border: 1px solid #f59e0b !important;
          color: #f59e0b !important;
          font-size: 8.5px !important;
          padding: 2.5px 8px !important;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.3), 0 4px 14px rgba(0, 0, 0, 0.6) !important;
          font-weight: 800 !important;
        }

        /* Legacy transparent halo labels (used when zoomed out and many labels visible) */
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
          color: #22d3ee !important;
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
              setHighlightedBusId(null);
            }}
          />

          <MapFocusController
            selectedBus={selectedBus}
            selectedStop={selectedStop}
            highlightedBus={highlightedBus}
          />

          {/* Dark Mode CartoDB layer */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* Network Polylines (Shapes) */}
          {showShapes && sortedShapes?.map((shape: any) => {
            // Determine if this line should be highlighted
            const activeRouteId = selectedLineId || selectedBus?.route_id || highlightedBus?.route_id;
            const hasActiveFilter = !!activeRouteId;
            const isLineSelected = activeRouteId === shape.route_id;

            // If a filter is set, completely hide other shapes
            if (hasActiveFilter && !isLineSelected) return null;

            const isPrimary = ["A", "B", "C1", "C2", "D"].includes(shape.route_id);

            // Priority styling: Primary lines (A-D) are bolder and brighter; secondary lines (E, F, EXAL, S-series) are softer background elements
            const opacity = hasActiveFilter ? 1 : isPrimary ? 0.75 : 0.35;
            const weight = hasActiveFilter ? 6 : isPrimary ? 4.5 : 2.5;

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

          {/* Physical Network Stops — Multi-color ring markers + white pill labels */}
          {stopsToShow?.map((stop: any) => {
            const isSelected = selectedStopId === stop.stop_id;
            const stopLines: string[] = stop.lines || [];

            // Check if a bus is currently parked or sitting right on top of this stop
            const busOnTop = (spiderfiedVehicles as any[]).find(v => 
              v.position?.lat && v.position?.lon &&
              Math.abs(v.position.lat - stop.stop_lat) < 0.00018 &&
              Math.abs(v.position.lon - stop.stop_lon) < 0.00018
            );

            const displayPosition: [number, number] = busOnTop 
              ? [stop.stop_lat + 0.00028, stop.stop_lon + 0.00028] // Shift north-east by ~30 meters to ensure full clickability
              : [stop.stop_lat, stop.stop_lon];

            return (
              <Fragment key={stop.stop_id}>
                {busOnTop && (
                  <Polyline
                    positions={[[stop.stop_lat, stop.stop_lon], displayPosition]}
                    pathOptions={{
                      color: "#00f0ff", // High-visibility cyber-cyan neon color
                      weight: 2.2,
                      opacity: 0.85,
                      dashArray: "4, 4",
                      lineCap: "round",
                      interactive: false
                    }}
                  />
                )}
                <Marker
                  position={displayPosition}
                  icon={createStopIcon(isSelected, stopLines)}
                  interactive={true}
                  zIndexOffset={isSelected ? 100 : 10}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      setSelectedStopId(stop.stop_id);
                      setSelectedBusId(null);
                    }
                  }}
                >
                  {(zoomLevel >= 15 || isSelected) && (
                    <Tooltip
                       direction="right"
                       offset={[12, 0]}
                       opacity={1}
                       permanent
                       interactive={false}
                       className={`stop-label-pill ${isSelected ? "stop-label-selected" : ""}`}
                    >
                      {stop.stop_name}
                    </Tooltip>
                  )}
                </Marker>
              </Fragment>
            );
          })}

          {/* Real-time Buses */}
          {showBuses && (spiderfiedVehicles as any[]).map((vehicle) => {
            if (!vehicle.position?.lat || !vehicle.position?.lon) return null;

            const isDelayed = (vehicle.delay || 0) > 60;
            const isSelected = selectedBusId === vehicle.id || highlightedBusId === vehicle.id;
            return (
              <Marker
                key={vehicle.id}
                position={[vehicle.position.lat, vehicle.position.lon]}
                icon={createBusIcon(vehicle.route_id, vehicle.position.bearing || 0, vehicle.delay || 0, isSelected)}
                zIndexOffset={isSelected ? 3000 : 1000}
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

      {/* Premium Integrated Bottom Sheet/Side-panel Drawer */}
      <div
        className={`fixed z-50 transition-all duration-300 ease-out 
          /* Mobile styles */
          bottom-20 left-0 right-0 h-[38vh] w-full 
          /* Desktop floating sidebar styles */
          md:bottom-24 md:left-6 md:right-auto md:w-[380px] md:h-[calc(100vh-220px)] md:max-h-[580px]
          ${(selectedBus || selectedStop) 
            ? "translate-y-0 md:scale-100 md:opacity-100 opacity-100" 
            : "translate-y-[calc(100%+80px)] md:scale-95 md:opacity-0 md:translate-y-0 opacity-0 pointer-events-none"
          }`}
      >
        <div className="h-full bg-slate-950/92 backdrop-blur-3xl border-t md:border border-white/10 rounded-t-[32px] md:rounded-[24px] p-5 shadow-[0_-15px_30px_rgba(0,0,0,0.5)] md:shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col gap-3.5 overflow-hidden">
          {/* Drag Handle Indicator */}
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto shrink-0 mb-1 md:hidden" />

          {/* CONTENT FOR SELECTED BUS */}
          {selectedBus && (
            <>
              {/* Airy & Premium Header Row */}
              <div className="flex flex-col gap-3 shrink-0 pb-3 border-b border-white/5">
                <div className="flex justify-between items-start w-full">
                  <div className="flex items-center gap-3">
                    {/* Route Badge */}
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border shadow-lg"
                      style={{
                        backgroundColor: `${getLineColor(selectedBus.route_id)}25`,
                        color: getLineColor(selectedBus.route_id),
                        borderColor: `${getLineColor(selectedBus.route_id)}90`,
                        boxShadow: `0 0 12px ${getLineColor(selectedBus.route_id)}20`
                      }}
                    >
                      {selectedBus.route_id || "B"}
                    </div>
                    
                    {/* Bus Name & Type */}
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-lg font-black text-white tracking-wide leading-tight">
                        Bus {formatBusName(selectedBus.vehicle_id || "Inconnu")}
                      </h3>
                      <div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${
                          getVehicleType(selectedBus.vehicle_id || "") === "Articulé"
                            ? "bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.15)] animate-pulse"
                            : "bg-slate-800 border border-slate-700 text-slate-400"
                        }`}>
                          {getVehicleType(selectedBus.vehicle_id || "")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setSelectedBusId(null)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-all border border-white/5 shadow-md active:scale-95"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Second Row: Real-time stop status */}
                {currentStopInfo?.name && (
                  <div className="w-full">
                    <span className={`inline-flex w-full items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                      currentStopInfo.status === 1 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                        : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                    }`}>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                      </span>
                      {currentStopInfo.status === 1 ? "À l'arrêt" : "En approche de"} : {currentStopInfo.name}
                    </span>
                  </div>
                )}

                {/* Third Row: Destination Info */}
                <div className="flex items-center gap-2 bg-slate-950/60 border border-white/5 rounded-xl px-3 py-1.5">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest shrink-0">
                    DIRECTION
                  </span>
                  <span className="text-xs font-bold text-amber-500 font-mono uppercase tracking-wide truncate">
                    {selectedBus.trip_headsign || "SANS VOYAGEURS"}
                  </span>
                </div>
              </div>

              {/* Compact Delay / Status Pill */}
              <div className="flex gap-2 shrink-0">
                {departureStatus ? (
                  <div className="flex-1 flex items-center justify-center gap-1.5 py-1 rounded-lg border bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px] font-extrabold uppercase tracking-wide">
                    <Clock size={12} className="animate-pulse" />
                    <span>Attente Terminus • Départ {departureStatus.minutes} min</span>
                  </div>
                ) : (
                  <div className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-lg border text-[10px] font-extrabold uppercase tracking-wide ${
                    (selectedBus.delay || 0) > 60
                      ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  }`}>
                    <Clock size={12} />
                    <span>{(selectedBus.delay || 0) > 60 ? `Retard : +${Math.round((selectedBus.delay || 0) / 60)} min` : "Service à l'heure"}</span>
                  </div>
                )}
              </div>

              {/* Scrollable Course Timeline (Ultra-tight & spacious) */}
              <div className="flex-1 overflow-y-auto no-scrollbar rounded-xl bg-slate-950/40 border border-white/5 p-3.5 mt-0.5">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                  <MapPin size={11} className="text-amber-500" />
                  Trajet en temps réel
                </h4>

                <div className="relative pl-6 border-l-2 border-slate-800 space-y-3.5">
                  {!staticData?.stops && (
                    <div className="text-slate-500 text-xs animate-pulse">Chargement du trajet...</div>
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

                    const dotClass = isPassed ? "bg-slate-700 border-slate-600" : isNext ? "animate-pulse" : "bg-slate-500 border-slate-700";
                    const dotStyle = isNext ? { backgroundColor: activeColor, borderColor: activeColor, boxShadow: `0 0 10px ${activeColor}cc` } : {};

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
                      busStyle = { top: "-8px", transform: "translateY(-50%)" };
                    } else {
                      // IN_TRANSIT_TO: Between this stop and the previous one
                      busStyle = { top: "-18px", transform: "translateY(-50%)" };
                    }

                    if (isPassed && stopSeq < currentSeq - 1) return null;

                    return (
                      <div key={stop.stop_id} className="relative flex items-center justify-between min-h-[30px] py-1">
                        {/* Static stop dot (Centered mathematically on the 2px border line) */}
                        <div className={`absolute -left-[29.5px] w-3.5 h-3.5 rounded-full border-2 z-10 ${dotClass}`} style={dotStyle} />

                        {/* Real-time animated bus on the timeline */}
                        {isNext && (
                          <div
                            className="absolute -left-[34.5px] w-6 h-6 rounded-full flex items-center justify-center z-20 transition-all duration-1000 ease-in-out"
                            style={{
                              ...busStyle,
                              boxShadow: `0 0 12px ${activeColor}`
                            }}
                          >
                            <div
                              className="absolute inset-0 rounded-full animate-ping opacity-45"
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

                        <div className={`text-sm font-bold truncate pr-3 ${textColor}`} style={textColorStyle}>
                          {stop.stop_name}
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasUpdate && expectedTime ? (
                            <div className="flex flex-col items-end gap-0.5">
                              {/* Expected real-time arrival */}
                              <div className={`text-xs font-black bg-slate-900 border border-white/5 px-2 py-0.5 rounded-lg shadow-inner ${timeColor}`} style={timeColorStyle}>
                                {expectedTime}
                              </div>
                              
                              {/* Scheduled time and delay status indicator */}
                              <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider">
                                <span className="text-slate-500 line-through">
                                  {scheduledTime}
                                </span>
                                {isWaitingToDepart ? (
                                  <span className="px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold animate-pulse">
                                    Départ {departureStatus.minutes}m
                                  </span>
                                ) : delayMin > 0 ? (
                                  <span className="px-1 py-0.2 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                                    +{delayMin}m
                                  </span>
                                ) : delayMin < 0 ? (
                                  <span className="px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                    {delayMin}m
                                  </span>
                                ) : (
                                  <span className="px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                    À l'heure
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Fallback to theoretical only */
                            <div className={`text-[10px] font-extrabold bg-slate-900 border border-white/5 px-2.5 py-0.5 rounded-lg shadow-inner ${timeColor}`} style={timeColorStyle}>
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
                      const isFirst = index === 0;

                      return (
                        <button
                          key={`${b.vehicle.id}-${index}`}
                          onClick={() => {
                            setHighlightedBusId(b.vehicle.id);
                          }}
                          className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] cursor-pointer text-left ${
                            isFirst
                              ? "border-[1.5px] shadow-lg animate-pulse"
                              : "bg-slate-900 border border-white/5 hover:bg-slate-800/80"
                          }`}
                          style={isFirst ? {
                            backgroundColor: `${activeColor}15`,
                            borderColor: activeColor,
                            boxShadow: `0 0 16px ${activeColor}25`
                          } : {}}
                        >
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
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold text-slate-200">
                                  Bus {formatBusName(b.vehicle.vehicle_id || "Inconnu")}
                                </span>
                                <span className={`px-1 py-0.2 rounded text-[7px] font-black uppercase tracking-wider ${
                                  getVehicleType(b.vehicle.vehicle_id || "") === "Articulé"
                                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                    : "bg-slate-800 border border-slate-700 text-slate-400"
                                }`}>
                                  {getVehicleType(b.vehicle.vehicle_id || "")}
                                </span>
                                {isFirst && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse"
                                    style={{
                                      backgroundColor: `${activeColor}25`,
                                      color: activeColor
                                    }}
                                  >
                                    PROCHAIN
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold" style={isImminent ? { color: activeColor, animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" } : { color: isFirst ? "#ffffff" : "#cbd5e1" }}>
                              {isImminent ? "À l'approche" : `${b.etaMinutes} min`}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(b.arrivalTime * 1000).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </button>
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
