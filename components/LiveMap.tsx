"use client";

import { useState, useEffect, useMemo, Fragment, useRef } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMapEvents, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, MapPin, Bus, SlidersHorizontal, Search, Locate, AlertCircle } from "lucide-react";
import { LINE_COLORS, getLineColor } from "./lineColors";
import { MAP_STYLES } from "./mapConfig";
import { useFuzzySearch } from "./hooks/useFuzzySearch";
import { useGpsLocation } from "./hooks/useGpsLocation";
import BusPanelDetail from "./subcomponents/BusPanelDetail";
import StopPanelDetail from "./subcomponents/StopPanelDetail";
import BusPanelDetailV2 from "./v2/map/BusPanelDetailV2";
import StopPanelDetailV2 from "./v2/map/StopPanelDetailV2";
import { V2_MAP_STYLES } from "./v2/map/mapConfig";
import { createBusIconV2, createStopIconV2, createUserIconV2 } from "./v2/map/icons";
import { getMapUi } from "./v2/map/uiTheme";
import LineFilterBarV2 from "./v2/map/LineFilterBarV2";

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
  timestamp?: number;
}

interface LiveMapProps {
  vehicles: Vehicle[];
  lastUpdatedTimestamp?: number;
  variant?: "default" | "v2";
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
// Highly adaptive: dynamically scales size, border, radius and opacity based on active selections and zoom levels
const createStopIcon = (
  isSelected: boolean = false,
  lines: string[] = [],
  zoomLevel: number = 13,
  activeLineId: string | null = null,
  stopName: string = ""
) => {
  // Sizing and opacity logic based on zoom level and selection states
  const isStopOnActiveLine = activeLineId ? lines.includes(activeLineId) : false;
  const isMajorStop = lines.length >= 3 || /Gare|Mairie|Lycée|Collège/i.test(stopName);

  let size = 14;
  let opacity = 1;

  if (isSelected) {
    size = 24;
    opacity = 1;
  } else if (activeLineId) {
    if (isStopOnActiveLine) {
      if (zoomLevel >= 18) {
        size = 22;
      } else if (zoomLevel >= 16) {
        size = 18;
      } else if (zoomLevel >= 14) {
        size = 12;
      } else {
        size = 8;
      }
      opacity = 1;
    } else {
      if (zoomLevel >= 18) {
        size = 10;
        opacity = 0.35;
      } else if (zoomLevel >= 16) {
        size = 8;
        opacity = 0.3;
      } else if (zoomLevel >= 14) {
        size = 5;
        opacity = 0.15;
      } else {
        size = 0;
        opacity = 0;
      }
    }
  } else {
    // Global view
    if (isMajorStop) {
      if (zoomLevel >= 18) {
        size = 22;
      } else if (zoomLevel >= 16) {
        size = 18;
      } else if (zoomLevel >= 14) {
        size = 12;
      } else {
        size = 8;
      }
      opacity = 0.9;
    } else {
      if (zoomLevel >= 18) {
        size = 18;
        opacity = 0.85;
      } else if (zoomLevel >= 16) {
        size = 14;
        opacity = 0.75;
      } else if (zoomLevel >= 14) {
        size = 6;
        opacity = 0.35;
      } else {
        size = 0;
        opacity = 0;
      }
    }
  }

  // If size is 0 or opacity is 0, we can return an invisible tiny placeholder icon
  if (size <= 0 || opacity <= 0) {
    return L.divIcon({
      html: '<div style="display: none;"></div>',
      className: 'custom-stop-marker-hidden',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  const borderWidth = isSelected ? 3.5 : Math.max(1.5, size * 0.16);
  const innerSize = Math.max(2, size - borderWidth * 2);
  const radius = isSelected ? 7 : Math.max(2, size * 0.28); // rounded-square corners

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
    : `0 1px 5px rgba(0,0,0,0.45)`;

  const dotColor = isSelected ? '#f59e0b' : '#ffffff';
  const dotSize = isSelected ? 6 : Math.max(1.5, size * 0.22);

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
      opacity: ${opacity};
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    ">
      <div style="
        width: ${innerSize}px;
        height: ${innerSize}px;
        background: #0f172a;
        border-radius: ${Math.max(1, radius - 1.5)}px;
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

// Custom User Marker Icon (Blue pulsing dot)
const createUserIcon = () => {
  if (typeof window === "undefined") return null as any;
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center w-6 h-6">
        <div class="absolute w-5 h-5 bg-sky-500/30 rounded-full animate-ping"></div>
        <div class="absolute w-3.5 h-3.5 bg-sky-500 border-2 border-white rounded-full shadow-lg"></div>
      </div>
    `,
    className: "custom-user-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
  const lastFocusedIdRef = useRef<string | null>(null);
  const lastFocusedStopIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Prioritize Highlighted Bus (temporary hover or focus)
    if (highlightedBus?.position?.lat && highlightedBus?.position?.lon) {
      const focusKey = `highlight-${highlightedBus.id}`;
      if (lastFocusedIdRef.current !== focusKey) {
        lastFocusedIdRef.current = focusKey;
        map.flyTo(
          [highlightedBus.position.lat, highlightedBus.position.lon],
          18,
          { animate: true, duration: 1.2 }
        );
      }
    }
    // 2. Selected Bus (deep linked or clicked)
    else if (selectedBus?.position?.lat && selectedBus?.position?.lon) {
      const focusKey = `bus-${selectedBus.id}`;
      if (lastFocusedIdRef.current !== focusKey) {
        lastFocusedIdRef.current = focusKey;

        // Use a small timeout to ensure map container has adjusted and is fully ready
        const timer = setTimeout(() => {
          map.flyTo(
            [selectedBus.position.lat, selectedBus.position.lon],
            18,
            { animate: true, duration: 1.2 }
          );
        }, 100);
        return () => clearTimeout(timer);
      }
    }
    // 3. Selected Stop
    else if (selectedStop?.stop_lat && selectedStop?.stop_lon) {
      const focusKey = `stop-${selectedStop.stop_id}`;
      if (lastFocusedStopIdRef.current !== focusKey) {
        lastFocusedStopIdRef.current = focusKey;
        const timer = setTimeout(() => {
          map.flyTo(
            [selectedStop.stop_lat, selectedStop.stop_lon],
            18,
            { animate: true, duration: 1.2 }
          );
        }, 100);
        return () => clearTimeout(timer);
      }
    }

    // Reset focused refs if selections are cleared
    if (!selectedBus) {
      if (lastFocusedIdRef.current && lastFocusedIdRef.current.startsWith("bus-")) {
        lastFocusedIdRef.current = null;
      }
    }
    if (!highlightedBus) {
      if (lastFocusedIdRef.current && lastFocusedIdRef.current.startsWith("highlight-")) {
        lastFocusedIdRef.current = null;
      }
    }
    if (!selectedStop) {
      lastFocusedStopIdRef.current = null;
    }
  }, [
    selectedBus?.id,
    selectedBus?.position?.lat,
    selectedBus?.position?.lon,
    selectedStop?.stop_id,
    highlightedBus?.id,
    highlightedBus?.position?.lat,
    highlightedBus?.position?.lon,
    map
  ]);

  return null;
}

export default function LiveMap({ vehicles, lastUpdatedTimestamp, variant = "default" }: LiveMapProps) {
  const isV2 = variant === "v2";
  const ui = getMapUi(isV2);
  const mapStyles = isV2 ? V2_MAP_STYLES : MAP_STYLES;
  const mkBusIcon = isV2 ? createBusIconV2 : createBusIcon;
  const mkStopIcon = isV2 ? createStopIconV2 : createStopIcon;
  const mkUserIcon = isV2 ? createUserIconV2 : createUserIcon;
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [highlightedBusId, setHighlightedBusId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(13);

  // Set of lines with at least one active bus
  const activeLinesSet = useMemo(() => {
    const active = new Set<string>();
    vehicles.forEach(v => {
      if (v.route_id) {
        active.add(v.route_id.trim());
      }
    });
    return active;
  }, [vehicles]);

  const [showBuses, setShowBuses] = useState(true);
  const [showShapes, setShowShapes] = useState(true);
  const [showStops, setShowStops] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isOthersOpen, setIsOthersOpen] = useState(false);

  const [map, setMap] = useState<L.Map | null>(null);

  // Integrate Location Custom Hook
  const {
    isLocating,
    userCoords,
    gpsWarning,
    nearestStopBanner,
    handleLocateUser,
    getDistance
  } = useGpsLocation();

  // Fetch real-time traffic alerts from OiseMob server
  const { data: alertsData } = useQuery({
    queryKey: ["networkAlerts"],
    queryFn: async () => {
      const res = await fetch("/api/axo/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
    refetchInterval: 120000, // every 2 minutes
  });

  // Combine active alerts into JSX elements for the scrolling marquee ticker
  const scrollingAlertContent = useMemo(() => {
    if (!alertsData?.alerts || alertsData.alerts.length === 0) {
      return (
        <span className="flex items-center gap-1.5">
          ✅ Trafic normal sur l'ensemble du réseau AXO. Aucun incident signalé. Voyagez sereinement !
        </span>
      );
    }

    return (
      <div className="flex items-center gap-6">
        {alertsData.alerts.map((a: any, i: number) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            {i > 0 && <span className="text-slate-600 font-normal mx-2">|</span>}
            <span>⚠️ {a.title} : {a.description}</span>
            {a.impactedLines?.map((lineId: string) => {
              const cleanLine = lineId.replace(' ', '');
              const lineColor = getLineColor(cleanLine);
              return (
                <span
                  key={lineId}
                  className="w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] border shadow-md shrink-0 ml-1"
                  style={{
                    backgroundColor: `${lineColor}25`,
                    color: lineColor,
                    borderColor: `${lineColor}90`,
                    boxShadow: `0 0 6px ${lineColor}20`
                  }}
                  title={`Ligne ${cleanLine}`}
                >
                  {cleanLine}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  }, [alertsData]);

  // Derive exact generation time of the GTFS-RT feed from OiseMob server
  const lastUpdated = lastUpdatedTimestamp ? new Date(lastUpdatedTimestamp) : new Date();

  // Derive live data
  const selectedBus = vehicles.find(v => v.id === selectedBusId) || null;
  const highlightedBus = vehicles.find(v => v.id === highlightedBusId) || null;

  // Measure live alerts scroll width to set a constant speed (preventing speed-up on long content)
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [marqueeDuration, setMarqueeDuration] = useState(32);



  useEffect(() => {
    const timer = setTimeout(() => {
      if (marqueeRef.current) {
        const width = marqueeRef.current.scrollWidth;
        const calculatedDuration = Math.max(15, Math.round(width / 50));
        setMarqueeDuration(calculatedDuration);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [scrollingAlertContent]);

  // Check URL query parameters on mount to focus a specific bus (deep linking)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const busId = params.get("bus");
      if (busId) {
        setSelectedBusId(busId);
        const bus = vehicles.find(v => v.id === busId);
        if (bus?.route_id) {
          setSelectedLineId(bus.route_id);
        }
      }
    }
  }, [vehicles]);

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

    filteredVehicles.forEach((v) => {
      if (!v.position?.lat || !v.position?.lon) return;
      const key = `${v.position.lat.toFixed(4)}_${v.position.lon.toFixed(4)}`;
      coordsCount[key] = (coordsCount[key] || 0) + 1;
    });

    return filteredVehicles.map((v) => {
      if (!v.position?.lat || !v.position?.lon) return null;
      const key = `${v.position.lat.toFixed(4)}_${v.position.lon.toFixed(4)}`;
      const count = coordsCount[key];

      if (count > 1) {
        const index = coordsIndex[key] || 0;
        coordsIndex[key] = index + 1;

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

  const triggerLocateUser = () => {
    handleLocateUser(map, allStopsData?.stops, setSelectedStopId, setSelectedBusId);
  };

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
    const activeRouteId = selectedLineId || selectedBus?.route_id || highlightedBus?.route_id;

    return [...shapesData.shapes].sort((a: any, b: any) => {
      if (activeRouteId) {
        if (a.route_id === activeRouteId && b.route_id !== activeRouteId) return 1;
        if (a.route_id !== activeRouteId && b.route_id === activeRouteId) return -1;
      }

      const aIsPrimary = primaryList.includes(a.route_id);
      const bIsPrimary = primaryList.includes(b.route_id);
      if (aIsPrimary && !bIsPrimary) return 1;
      if (!aIsPrimary && bIsPrimary) return -1;
      return 0;
    });
  }, [shapesData, selectedLineId, selectedBus?.route_id, highlightedBus?.route_id]);

  // Filter stops to show dynamically based on selections and zoom breaks
  const stopsToShow = useMemo(() => {
    if (!showStops) return selectedStop ? [selectedStop] : [];

    const activeRouteId = selectedLineId || selectedBus?.route_id || highlightedBus?.route_id;
    let stops = allStopsData?.stops || [];

    if (activeRouteId) {
      stops = stops.filter((s: any) => s.lines?.includes(activeRouteId));
    } else {
      if (zoomLevel < 14) {
        stops = stops.filter((s: any) =>
          s.stop_id === selectedStopId ||
          (s.lines && s.lines.length >= 3) ||
          /Gare|Mairie|Lycée|Collège/i.test(s.stop_name || "")
        );
      }
    }
    return stops;
  }, [showStops, selectedStop, selectedBus, highlightedBus, selectedLineId, allStopsData, zoomLevel, selectedStopId]);

  // Fuzzy search results using custom hook
  const filteredStops = useFuzzySearch(allStopsData?.stops, searchQuery);

  const center: [number, number] = [49.2583, 2.4764];

  return (
    <div className={ui?.root ?? "relative w-full h-full overflow-hidden bg-slate-950"}>
      <style dangerouslySetInnerHTML={{ __html: mapStyles }} />

      {/* Top Floating Marquee Alert Banner */}
      {scrollingAlertContent && (
        <div className={ui?.alertBanner ?? "absolute top-0 md:top-4 left-0 md:left-1/2 md:-translate-x-1/2 z-[1000] w-full md:w-[60vw] max-w-3xl h-8 md:h-9 bg-slate-950/40 backdrop-blur-xl border-b md:border border-white/10 rounded-none md:rounded-full flex items-center px-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] overflow-hidden pointer-events-auto"}>
          <div className={`flex items-center gap-1.5 shrink-0 px-2.5 py-0.5 md:py-1 rounded-full border z-10 ${
            (!alertsData?.alerts || alertsData.alerts.length === 0)
              ? (ui?.alertBadgeOk ?? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400")
              : (ui?.alertBadgeWarn ?? "bg-red-500/10 border-red-500/20 text-red-400")
          }`}>
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${(!alertsData?.alerts || alertsData.alerts.length === 0) ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${(!alertsData?.alerts || alertsData.alerts.length === 0) ? "bg-emerald-500" : "bg-red-500"}`} />
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest">
              {(!alertsData?.alerts || alertsData.alerts.length === 0) ? (
                <>
                  <span className="hidden md:inline">Trafic Normal</span>
                  <span className="inline md:hidden">Normal</span>
                </>
              ) : (
                <>
                  <span className="hidden md:inline">Alerte</span>
                  <span className="inline md:hidden">Alerte</span>
                </>
              )}
            </span>
          </div>

          <div className="flex-1 overflow-hidden relative mx-3 h-full flex items-center marquee-parent">
            <div className="flex w-max">
              <div
                ref={marqueeRef}
                className={`${ui?.alertText ?? "animate-marquee-infinite text-[11px] font-bold text-slate-100 flex items-center gap-4 shrink-0 pr-8"}`}
                style={{ "--marquee-duration": `${marqueeDuration}s` } as React.CSSProperties}
              >
                {scrollingAlertContent}
              </div>
              <div
                className={`${ui?.alertText ?? "animate-marquee-infinite text-[11px] font-bold text-slate-100 flex items-center gap-4 shrink-0 pr-8"}`}
                style={{ "--marquee-duration": `${marqueeDuration}s` } as React.CSSProperties}
              >
                {scrollingAlertContent}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Floating Real-time Update Indicator */}
      <div className={ui?.updateIndicator ?? "absolute top-11 md:top-4 left-4 z-[1000] flex items-center gap-2 px-3 py-1.5 md:py-2.5 rounded-xl md:rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/10 shadow-md"}>
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isV2 ? "bg-om-green" : "bg-emerald-400"}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isV2 ? "bg-om-green" : "bg-emerald-500"}`}></span>
        </span>
        <span className={ui?.updateText ?? "text-[10px] font-bold text-slate-100 uppercase tracking-wider"}>
          MAJ Bus • {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      {/* Top Floating Line Filter Bar */}
      {isV2 ? (
        <LineFilterBarV2
          selectedLineId={selectedLineId}
          activeLinesSet={activeLinesSet}
          isOthersOpen={isOthersOpen}
          setSelectedLineId={setSelectedLineId}
          setSelectedBusId={setSelectedBusId}
          setSelectedStopId={setSelectedStopId}
          setIsOthersOpen={setIsOthersOpen}
        />
      ) : (
      <div className="absolute top-24 md:top-16 left-4 right-4 z-[1000] flex flex-col items-center pointer-events-none gap-2">
        <div className={ui?.lineFilterBar ?? "pointer-events-auto flex items-center gap-1 p-1 bg-slate-950/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-x-auto max-w-full no-scrollbar"}>
          <button
            onClick={() => {
              setSelectedLineId(null);
              setSelectedBusId(null);
              setSelectedStopId(null);
              setIsOthersOpen(false);
            }}
            className={`${ui?.lineBtnBase ?? "w-8 h-8 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 border flex items-center justify-center hover:scale-105 active:scale-95"} ${!selectedLineId
                ? (ui?.lineBtnAllActive ?? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]")
                : (ui?.lineBtnAllInactive ?? "bg-slate-900/30 border-white/10 text-slate-300 hover:text-white")
              }`}
            title="Toutes les lignes"
          >
            ALL
          </button>

          {/* Primary network lines */}
          {["A", "B", "C1", "C2", "D"].map((line) => {
            const lineColor = LINE_COLORS[line];
            const isActive = selectedLineId === line;
            const hasBuses = activeLinesSet.has(line);
            return (
              <button
                key={line}
                onClick={() => {
                  setSelectedLineId(line);
                  setSelectedBusId(null);
                  setSelectedStopId(null);
                  setIsOthersOpen(false);
                }}
                className={`w-8 h-8 rounded-xl text-[10.5px] font-black uppercase transition-all duration-300 border flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 hover:brightness-110 ${!isActive && !hasBuses ? "opacity-35" : ""
                  }`}
                style={{
                  backgroundColor: isActive ? `${lineColor}40` : "rgba(15, 23, 42, 0.3)",
                  borderColor: isActive ? lineColor : "rgba(255, 255, 255, 0.08)",
                  color: isActive ? "#ffffff" : (hasBuses ? lineColor : "#94a3b8"),
                  boxShadow: isActive ? `0 0 10px ${lineColor}40` : "none",
                }}
                title={`Ligne ${line} ${!hasBuses ? "(aucun bus en circulation)" : ""}`}
              >
                {line}
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
              className="px-2.5 h-8 rounded-xl text-[10.5px] font-black uppercase transition-all duration-300 border flex items-center gap-1 shrink-0 animate-in zoom-in duration-300 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: `${LINE_COLORS[selectedLineId]}50`,
                borderColor: LINE_COLORS[selectedLineId],
                color: "#ffffff",
                boxShadow: `0 0 10px ${LINE_COLORS[selectedLineId]}40`,
              }}
              title={`Ligne ${selectedLineId}`}
            >
              {selectedLineId}
              <X size={10} className="text-white/60 hover:text-white shrink-0 ml-0.5" />
            </button>
          )}

          {/* + Autres sub-menu button toggle */}
          <button
            onClick={() => setIsOthersOpen(!isOthersOpen)}
            className={`${ui?.lineBtnBase ?? "w-8 h-8 rounded-xl text-[11px] font-black uppercase transition-all duration-300 border flex items-center justify-center shrink-0 hover:scale-105 active:scale-95"} ${isOthersOpen
                ? (ui?.lineBtnAllActive ?? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]")
                : (ui?.lineBtnAllInactive ?? "bg-slate-900/30 border-white/10 text-slate-300 hover:text-white")
              }`}
            title="Autres lignes"
          >
            +
          </button>
        </div>

        {/* Dropdown submenu for "Autres Lignes" */}
        {isOthersOpen && (
          <div className={ui?.othersMenu ?? "pointer-events-auto bg-slate-950/45 backdrop-blur-2xl border border-white/10 p-5 rounded-[28px] shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-2 duration-300 max-w-sm w-[92vw] overflow-hidden"}>
            <div className={`flex justify-between items-center border-b pb-2.5 ${isV2 ? "border-om-border" : "border-white/5"}`}>
              <h4 className={ui?.othersTitle ?? "text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5"}>
                <Bus size={11} className={isV2 ? "text-om-coral" : "text-amber-500"} />
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
                const hasBuses = activeLinesSet.has(line);
                return (
                  <button
                    key={line}
                    onClick={() => {
                      setSelectedLineId(line);
                      setSelectedBusId(null);
                      setSelectedStopId(null);
                      setIsOthersOpen(false); // Close submenu automatically
                    }}
                    className={`py-2.5 px-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1 shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${!isActive && !hasBuses ? "opacity-35" : ""
                      }`}
                    style={{
                      backgroundColor: isActive ? `${lineColor}40` : "rgba(15, 23, 42, 0.3)",
                      borderColor: isActive ? lineColor : "rgba(255, 255, 255, 0.08)",
                      color: isActive ? "#ffffff" : (hasBuses ? lineColor : "#94a3b8"),
                      boxShadow: isActive ? `0 0 10px ${lineColor}30` : "none",
                    }}
                    title={`Ligne ${line} ${!hasBuses ? "(aucun bus en circulation)" : ""}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hasBuses ? lineColor : "#64748b" }} />
                    {line}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Floating Filter Controls & Search Bar */}
      <div className="absolute top-11 md:top-4 right-4 z-[1000] flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Text Search Panel */}
          {isSearchOpen && (
            <div className={ui?.searchPanel ?? "flex items-center gap-1.5 p-1.5 bg-slate-950/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg animate-in slide-in-from-right-3 duration-200"}>
              <Search size={13} className={isV2 ? "text-om-muted ml-2 shrink-0" : "text-slate-400 ml-2 shrink-0"} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un arrêt..."
                className={ui?.searchInput ?? "bg-transparent border-none text-slate-200 placeholder-slate-400 font-bold text-xs focus:ring-0 outline-none w-40 md:w-52 py-0.5"}
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

          {/* Geolocation Button */}
          <button
            onClick={triggerLocateUser}
            disabled={isLocating}
            className={`${ui?.controlBtn ?? "flex items-center justify-center w-10 h-10 rounded-2xl border shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"} ${userCoords
                ? (ui?.controlBtnGpsActive ?? "bg-sky-500 border-sky-400 text-slate-950 shadow-[0_0_15px_rgba(14,165,233,0.4)]")
                : (ui?.controlBtn ?? "bg-slate-950/40 backdrop-blur-xl border border-white/10 text-slate-200 hover:bg-slate-900 hover:border-white/20")
              }`}
            title="Me géolocaliser et suggérer un arrêt"
          >
            {isLocating ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Locate size={15} className={userCoords ? "animate-pulse" : ""} />
            )}
          </button>

          {/* Search Toggle Button */}
          <button
            onClick={() => {
              setIsSearchOpen(!isSearchOpen);
              if (isSearchOpen) setSearchQuery("");
            }}
            className={`${ui?.controlBtn ?? "flex items-center justify-center w-10 h-10 rounded-2xl border shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"} ${isSearchOpen
              ? (ui?.controlBtnActive ?? "bg-cyan-500 border-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.4)]")
              : (ui?.controlBtn ?? "bg-slate-950/40 backdrop-blur-xl border border-white/10 text-slate-200 hover:bg-slate-900 hover:border-white/20")
              }`}
            title="Rechercher un arrêt"
          >
            <Search size={15} />
          </button>

          {/* Filters Toggle Button */}
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center gap-2 px-3.5 py-2.5 h-10 rounded-2xl border text-xs font-bold shadow-lg transition-all duration-300 ${isFilterOpen
              ? (ui?.filtersBtnActive ?? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]")
              : (ui?.filtersBtnInactive ?? "bg-slate-950/40 backdrop-blur-xl border border-white/10 text-slate-200 hover:bg-slate-900 hover:border-white/20")
              }`}
          >
            <SlidersHorizontal size={14} className={isFilterOpen ? "animate-pulse" : ""} />
            <span>Filtres</span>
          </button>
        </div>

        {/* Search & Suggestions Results Dropdown */}
        {isSearchOpen && (
          <div className={ui?.searchResults ?? "pointer-events-auto bg-slate-950/50 backdrop-blur-2xl border border-white/10 p-3 rounded-[20px] w-64 md:w-80 shadow-2xl flex flex-col gap-1 max-h-72 overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200 mt-1"}>
            {searchQuery.trim().length > 0 ? (
              filteredStops.length === 0 ? (
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
                    className={ui?.searchResultItem ?? "w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left transition-all duration-200"}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                      <span className={ui?.searchResultName ?? "text-xs font-bold text-slate-200 truncate font-mono uppercase tracking-wide"}>
                        {stop.stop_name}
                      </span>
                      <span className={ui?.searchResultMeta ?? "text-[8px] font-black text-slate-400 uppercase tracking-widest"}>
                        {stop.lines?.length > 0 ? `Lignes : ${stop.lines.join(", ")}` : "Aucune ligne"}
                      </span>
                    </div>
                    <div className={ui?.searchResultIcon ?? "shrink-0 flex items-center justify-center w-6 h-6 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700"}>
                      <MapPin size={12} />
                    </div>
                  </button>
                ))
              )
            ) : (
              /* Geolocation / Nearby stops suggestion */
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1 border-b border-white/5 pb-2">
                  <MapPin size={11} className="text-cyan-400 animate-pulse" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    À proximité de vous
                  </span>
                </div>

                {!userCoords ? (
                  <button
                    onClick={triggerLocateUser}
                    className={ui?.gpsSuggestBtn ?? "w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-500/20 text-cyan-400 font-bold text-xs uppercase tracking-wider transition-all duration-200 hover:scale-102 active:scale-98"}
                  >
                    {isLocating ? (
                      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <MapPin size={12} />
                    )}
                    Activer la position GPS
                  </button>
                ) : (
                  allStopsData?.stops ? (
                    (() => {
                      const nearbyWithDistance = allStopsData.stops.map((stop: any) => ({
                        ...stop,
                        distance: getDistance(userCoords.lat, userCoords.lon, stop.stop_lat, stop.stop_lon)
                      }));

                      const closestStop = [...nearbyWithDistance].sort((a, b) => a.distance - b.distance)[0];

                      if (closestStop && closestStop.distance > 20000) {
                        return (
                          <div className="p-3 text-center bg-red-500/10 border border-red-500/20 rounded-xl animate-in fade-in duration-200">
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block">
                              Position hors réseau AXO
                            </span>
                            <span className="text-[9px] text-slate-555 font-bold mt-1 block normal-case">
                              Votre GPS indique que vous êtes à plus de 20 km du réseau.
                            </span>
                          </div>
                        );
                      }

                      const nearby = [...nearbyWithDistance]
                        .sort((a, b) => a.distance - b.distance)
                        .slice(0, 3);

                      return nearby.map((stop: any) => (
                        <button
                          key={stop.stop_id}
                          onClick={() => {
                            setSelectedStopId(stop.stop_id);
                            setSelectedBusId(null);
                            setIsSearchOpen(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left transition-all duration-200"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                            <span className="text-xs font-bold text-slate-200 truncate font-mono uppercase tracking-wide">
                              {stop.stop_name}
                            </span>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <span>Lignes : {stop.lines?.join(", ") || "Aucune"}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-700" />
                              <span className="text-cyan-400 font-bold font-sans">
                                {stop.distance < 1000
                                  ? `${Math.round(stop.distance)}m`
                                  : `${(stop.distance / 1000).toFixed(1)}km`}
                              </span>
                            </span>
                          </div>
                          <div className={ui?.searchResultIcon ?? "shrink-0 flex items-center justify-center w-6 h-6 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700"}>
                            <MapPin size={12} />
                          </div>
                        </button>
                      ));
                    })()
                  ) : (
                    <div className="text-[10px] text-slate-500 text-center py-2">
                      Calcul des distances...
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Dropdown Menu */}
        {isFilterOpen && (
          <div className={ui?.filterMenu ?? "bg-slate-950/45 backdrop-blur-2xl border border-white/10 p-3 rounded-2xl w-60 shadow-2xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200"}>
            <h4 className={ui?.filterTitle ?? "text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-1 px-2"}>
              Affichage de la carte
            </h4>

            {/* Toggle Buses */}
            <button
              onClick={() => setShowBuses(!showBuses)}
              className={ui?.filterItem ?? "flex items-center justify-between w-full group py-2 px-2 rounded-xl hover:bg-white/5 active:scale-[0.98] transition-all text-left"}
            >
              <span className={ui?.filterLabel ?? "text-xs font-bold text-slate-300 group-hover:text-white transition-colors flex items-center gap-2.5"}>
                <span className={`w-2.5 h-2.5 rounded-full ${isV2 ? "bg-om-coral" : "bg-amber-500 shadow-[0_0_8px_#f59e0b]"}`} />
                Bus en circulation
              </span>
              <div
                className={`relative w-[36px] h-[20px] rounded-full transition-all duration-300 shrink-0 ${showBuses
                    ? (ui?.filterToggleOn ?? "bg-amber-500/20 border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.25)]")
                    : (ui?.filterToggleOff ?? "bg-slate-900/30 border border-white/10")
                  }`}
              >
                <div
                  className={`absolute top-[3px] left-[3px] w-[14px] h-[14px] rounded-full transition-all duration-300 ${showBuses
                      ? (ui?.filterKnobOn ?? "translate-x-[16px] bg-amber-500 shadow-[0_0_6px_#f59e0b]")
                      : (ui?.filterKnobOff ?? "translate-x-0 bg-slate-500")
                    }`}
                />
              </div>
            </button>

            <button
              onClick={() => setShowShapes(!showShapes)}
              className={ui?.filterItem ?? "flex items-center justify-between w-full group py-2 px-2 rounded-xl hover:bg-white/5 active:scale-[0.98] transition-all text-left"}
            >
              <span className={ui?.filterLabel ?? "text-xs font-bold text-slate-300 group-hover:text-white transition-colors flex items-center gap-2.5"}>
                <span className={`w-2.5 h-2.5 rounded-full ${isV2 ? "bg-om-green" : "bg-emerald-400 shadow-[0_0_8px_#34d399]"}`} />
                Tracés des lignes
              </span>
              <div
                className={`relative w-[36px] h-[20px] rounded-full transition-all duration-300 shrink-0 ${showShapes
                    ? (isV2 ? "bg-om-green-light border border-om-green/40" : "bg-emerald-500/20 border border-emerald-500/50 shadow-[0_0_8px_rgba(52,211,153,0.25)]")
                    : (ui?.filterToggleOff ?? "bg-slate-900/30 border border-white/10")
                  }`}
              >
                <div
                  className={`absolute top-[3px] left-[3px] w-[14px] h-[14px] rounded-full transition-all duration-300 ${showShapes
                      ? (isV2 ? "translate-x-[16px] bg-om-green" : "translate-x-[16px] bg-emerald-400 shadow-[0_0_6px_#34d399]")
                      : (ui?.filterKnobOff ?? "translate-x-0 bg-slate-500")
                    }`}
                />
              </div>
            </button>

            <button
              onClick={() => setShowStops(!showStops)}
              className={ui?.filterItem ?? "flex items-center justify-between w-full group py-2 px-2 rounded-xl hover:bg-white/5 active:scale-[0.98] transition-all text-left"}
            >
              <span className={ui?.filterLabel ?? "text-xs font-bold text-slate-300 group-hover:text-white transition-colors flex items-center gap-2.5"}>
                <span className={`w-2.5 h-2.5 rounded-full ${isV2 ? "bg-om-muted" : "bg-purple-400 shadow-[0_0_8px_#c084fc]"}`} />
                Points d'arrêts
              </span>
              <div
                className={`relative w-[36px] h-[20px] rounded-full transition-all duration-300 shrink-0 ${showStops
                    ? (isV2 ? "bg-om-surface border border-om-border" : "bg-purple-500/20 border border-purple-500/50 shadow-[0_0_8px_rgba(192,132,252,0.25)]")
                    : (ui?.filterToggleOff ?? "bg-slate-900/30 border border-white/10")
                  }`}
              >
                <div
                  className={`absolute top-[3px] left-[3px] w-[14px] h-[14px] rounded-full transition-all duration-300 ${showStops
                      ? (isV2 ? "translate-x-[16px] bg-om-charcoal" : "translate-x-[16px] bg-purple-400 shadow-[0_0_6px_#c084fc]")
                      : (ui?.filterKnobOff ?? "translate-x-0 bg-slate-500")
                    }`}
                />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Map layer */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={center}
          zoom={13}
          className="w-full h-full"
          zoomControl={false}
          attributionControl={false}
          ref={setMap}
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

          {/* MapTiler Streets Tile Layer */}
          <TileLayer
            url={`https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=${
              process.env.NEXT_PUBLIC_MAPTILER_KEY || "GKbS2layBBOWyQqgNmjm"
            }`}
            attribution='&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
            tileSize={512}
            zoomOffset={-1}
          />

          {/* User Location Pulse Marker */}
          {userCoords && (
            <Marker
              position={[userCoords.lat, userCoords.lon]}
              icon={mkUserIcon()}
              zIndexOffset={1000}
            />
          )}

          {/* Network Polylines (Shapes) */}
          {showShapes && sortedShapes?.map((shape: any) => {
            const activeRouteId = selectedLineId || selectedBus?.route_id || highlightedBus?.route_id;
            const hasActiveFilter = !!activeRouteId;
            const isLineSelected = activeRouteId === shape.route_id;
            const hasBuses = activeLinesSet.has(shape.route_id);

            const isPrimary = ["A", "B", "C1", "C2", "D"].includes(shape.route_id);

            let opacity = 0.35;
            let weight = 2.5;
            let color = getLineColor(shape.route_id);

            if (hasActiveFilter) {
              if (isLineSelected) {
                opacity = hasBuses ? 1.0 : 0.6;
                weight = hasBuses ? 4.5 : 3.5;
                color = hasBuses ? getLineColor(shape.route_id) : "#64748b";
              } else {
                opacity = 0.05;
                weight = 1.2;
                color = hasBuses ? getLineColor(shape.route_id) : "#475569";
              }
            } else {
              if (isPrimary) {
                opacity = hasBuses ? 0.55 : 0.25;
                weight = hasBuses ? 3.5 : 2.5;
                color = hasBuses ? getLineColor(shape.route_id) : "#475569";
              } else {
                opacity = hasBuses ? 0.25 : 0.12;
                weight = hasBuses ? 2 : 1.5;
                color = hasBuses ? getLineColor(shape.route_id) : "#334155";
              }
            }

            return (
              <Fragment key={`shape-group-${shape.shape_id || Math.random()}`}>
                {isLineSelected && (
                  <Polyline
                    positions={shape.coordinates}
                    interactive={false}
                    pathOptions={{
                      color: color,
                      weight: 7,
                      opacity: hasBuses ? 0.28 : 0.15,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />
                )}

                <Polyline
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
                    color: color,
                    weight: weight,
                    opacity: opacity,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />

                {isLineSelected && (
                  <Polyline
                    positions={shape.coordinates}
                    interactive={false}
                    pathOptions={{
                      color: hasBuses ? "#ffffff" : "#cbd5e1",
                      weight: 1.5,
                      opacity: hasBuses ? 0.75 : 0.4,
                      dashArray: "6, 14",
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />
                )}
              </Fragment>
            );
          })}

          {/* Physical Network Stops */}
          {stopsToShow?.map((stop: any) => {
            const isSelected = selectedStopId === stop.stop_id;
            const stopLines: string[] = stop.lines || [];

            const busOnTop = (spiderfiedVehicles as any[]).find(v =>
              v.position?.lat && v.position?.lon &&
              Math.abs(v.position.lat - stop.stop_lat) < 0.00018 &&
              Math.abs(v.position.lon - stop.stop_lon) < 0.00018
            );

            const displayPosition: [number, number] = busOnTop
              ? [stop.stop_lat + 0.00028, stop.stop_lon + 0.00028]
              : [stop.stop_lat, stop.stop_lon];

            return (
              <Fragment key={stop.stop_id}>
                {busOnTop && (
                  <Polyline
                    positions={[[stop.stop_lat, stop.stop_lon], displayPosition]}
                    pathOptions={{
                      color: "#00f0ff",
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
                  icon={mkStopIcon(
                    isSelected,
                    stopLines,
                    zoomLevel,
                    selectedLineId || selectedBus?.route_id || highlightedBus?.route_id,
                    stop.stop_name || ""
                  )}
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
                  {(zoomLevel >= 18 || isSelected) && (
                    <Tooltip
                      key={`tooltip-${stop.stop_id}-${isSelected}`}
                      direction="right"
                      offset={[12, 0]}
                      opacity={1}
                      permanent
                      interactive={true}
                      className={`stop-label-pill ${isSelected ? "stop-label-selected" : ""}`}
                      eventHandlers={{
                        click: (e) => {
                          L.DomEvent.stopPropagation(e);
                          setSelectedStopId(stop.stop_id);
                          setSelectedBusId(null);
                        }
                      }}
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

            const isSelected = selectedBusId === vehicle.id || highlightedBusId === vehicle.id;
            return (
              <Marker
                key={vehicle.id}
                position={[vehicle.position.lat, vehicle.position.lon]}
                icon={mkBusIcon(vehicle.route_id, vehicle.position.bearing || 0, vehicle.delay || 0, isSelected)}
                zIndexOffset={isSelected ? 3000 : 1000}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    setSelectedBusId(vehicle.id);
                    setSelectedStopId(null);
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
          bottom-[76px] left-0 right-0 h-[50vh] max-h-[400px] w-full 
          md:bottom-24 md:left-6 md:right-auto md:w-[380px] md:h-[calc(100vh-220px)] md:max-h-[580px]
          ${isV2 ? "!bottom-[88px] md:!bottom-24" : ""}
          ${(selectedBus || selectedStop)
            ? "translate-y-0 md:scale-100 md:opacity-100 opacity-100"
            : "translate-y-[calc(100%+80px)] md:scale-95 md:opacity-0 md:translate-y-0 opacity-0 pointer-events-none"
          }`}
      >
        <div className={ui?.bottomSheet ?? "h-full bg-slate-950/45 backdrop-blur-3xl border-t md:border border-white/10 rounded-t-[32px] md:rounded-[24px] p-3.5 md:p-5 shadow-[0_-15px_30px_rgba(0,0,0,0.25)] md:shadow-[0_20px_50px_rgba(0,0,0,0.35)] flex flex-col gap-2 md:gap-3.5 overflow-hidden"}>
          <div className={ui?.dragHandle ?? "w-12 h-1 bg-white/10 rounded-full mx-auto shrink-0 mb-0.5 md:hidden"} />

          {/* CONTENT FOR SELECTED BUS */}
          {selectedBus && (
            isV2 ? (
              <BusPanelDetailV2
                selectedBus={selectedBus}
                staticData={staticData}
                setSelectedBusId={setSelectedBusId}
              />
            ) : (
              <BusPanelDetail
                selectedBus={selectedBus}
                staticData={staticData}
                setSelectedBusId={setSelectedBusId}
              />
            )
          )}

          {selectedStop && (
            isV2 ? (
              <StopPanelDetailV2
                selectedStop={selectedStop}
                setSelectedStopId={setSelectedStopId}
                filteredVehicles={filteredVehicles}
                setHighlightedBusId={setHighlightedBusId}
                allStops={allStopsData?.stops || []}
              />
            ) : (
              <StopPanelDetail
                selectedStop={selectedStop}
                setSelectedStopId={setSelectedStopId}
                filteredVehicles={filteredVehicles}
                setHighlightedBusId={setHighlightedBusId}
              />
            )
          )}

          {/* Nearest Stop Notification Banner */}
          {nearestStopBanner && (
            <div className="absolute top-24 left-4 right-4 z-[1001] flex justify-center pointer-events-none">
              <div className={ui?.gpsBanner ?? "bg-cyan-500 border border-cyan-400 text-slate-950 px-4 py-2.5 rounded-2xl shadow-[0_10px_25px_rgba(34,211,238,0.4)] flex items-center gap-2 animate-in slide-in-from-top-3 duration-300 pointer-events-auto"}>
                <MapPin size={14} className="animate-bounce shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Arrêt suggéré : {nearestStopBanner}
                </span>
              </div>
            </div>
          )}

          {/* GPS Warning Notification Banner */}
          {gpsWarning && (
            <div className="absolute top-24 left-4 right-4 z-[1001] flex justify-center pointer-events-none">
              <div className={ui?.warnBanner ?? "bg-red-500 border border-red-400 text-white px-4 py-2.5 rounded-2xl shadow-[0_10px_25px_rgba(239,68,68,0.4)] flex items-center gap-2 animate-in slide-in-from-top-3 duration-300 pointer-events-auto"}>
                <AlertCircle size={14} className="animate-pulse shrink-0 text-white" />
                <span className="text-xs font-black uppercase tracking-wider">
                  {gpsWarning}
                </span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
