"use client";

import { useState, useEffect, useMemo, Fragment, useRef } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMapEvents, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Clock, Info, X, MapPin, Bus, SlidersHorizontal, ChevronDown, Search, Locate, AlertCircle, Edit3 } from "lucide-react";
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

// Distance calculation using Haversine formula (meters)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
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

  useEffect(() => {
    if (highlightedBus?.position?.lat && highlightedBus?.position?.lon) {
      map.flyTo(
        [highlightedBus.position.lat, highlightedBus.position.lon],
        18,
        { animate: true, duration: 1.2 }
      );
    } else if (selectedBus?.position?.lat && selectedBus?.position?.lon) {
      map.flyTo(
        [selectedBus.position.lat, selectedBus.position.lon],
        18,
        { animate: true, duration: 1.2 }
      );
    } else if (selectedStop?.stop_lat && selectedStop?.stop_lon) {
      map.flyTo(
        [selectedStop.stop_lat, selectedStop.stop_lon],
        18,
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

  const [map, setMap] = useState<L.Map | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [nearestStopBanner, setNearestStopBanner] = useState<string | null>(null);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);
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

  // Measure direction text overflow for marquee effect (initialized after selectedBus derivation)
  const directionRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (directionRef.current) {
        const container = directionRef.current.parentElement;
        if (container) {
          const diff = directionRef.current.scrollWidth - container.clientWidth;
          if (diff > 0) {
            setScrollDistance(diff + 12); // safety padding
          } else {
            setScrollDistance(0);
          }
        }
      } else {
        setScrollDistance(0);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedBus?.trip_headsign, selectedBusId]);

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
        setIsInitialModalOpen(false);
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

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude: lat, longitude: lon } = position.coords;
        setUserCoords({ lat, lon });
        
        // Find nearest stop
        if (allStopsData?.stops && allStopsData.stops.length > 0) {
          let closestStop: any = null;
          let minDistance = Infinity;
          
          allStopsData.stops.forEach((stop: any) => {
            if (!stop.stop_lat || !stop.stop_lon) return;
            const dist = getDistance(lat, lon, stop.stop_lat, stop.stop_lon);
            if (dist < minDistance) {
              minDistance = dist;
              closestStop = stop;
            }
          });
          
          if (closestStop) {
            // Check if too far (more than 20km)
            if (minDistance > 20000) {
              setGpsWarning("Position hors réseau AXO ou GPS imprécis (plus de 20 km)");
              setTimeout(() => {
                setGpsWarning(null);
              }, 6000);
              return;
            }

            if (map) {
              map.flyTo([lat, lon], 17, { animate: true, duration: 1.5 });
            }

            setSelectedStopId(closestStop.stop_id);
            setSelectedBusId(null);
            
            // Show a temporary banner with nearest stop
            setNearestStopBanner(closestStop.stop_name);
            setTimeout(() => {
              setNearestStopBanner(null);
            }, 6000);
          }
        }
      },
      (error) => {
        setIsLocating(false);
        console.error("Error getting location: ", error);
        alert("Impossible d'obtenir votre position. Veuillez vérifier vos autorisations GPS.");
      },
      { enableHighAccuracy: true }
    );
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
  // Also ensures the currently selected/active route is rendered absolute last (highest z-index on top!)
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
  // Intermediate ordinary stops are hidden at lower zooms to prevent spaghettis clutter, while major hubs stay visible!
  const stopsToShow = useMemo(() => {
    if (!showStops) return selectedStop ? [selectedStop] : [];
    
    const activeRouteId = selectedLineId || selectedBus?.route_id || highlightedBus?.route_id;
    let stops = allStopsData?.stops || [];
    
    if (activeRouteId) {
      stops = stops.filter((s: any) => s.lines?.includes(activeRouteId));
    } else {
      // Global view (no active line filter)
      // At zoom < 14: show only major terminus/stations to avoid visual clutter
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
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee-scroll {
          0% { transform: translate3d(0, 0, 0); }
          15% { transform: translate3d(0, 0, 0); }
          85% { transform: translate3d(var(--scroll-dist, 0px), 0, 0); }
          100% { transform: translate3d(var(--scroll-dist, 0px), 0, 0); }
        }
        .animate-direction-marquee {
          animation: marquee-scroll 8s ease-in-out infinite alternate;
        }
        @keyframes marquee-alert-scroll {
          0% { transform: translate3d(100%, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
        .animate-marquee-alert {
          display: inline-flex;
          align-items: center;
          gap: 16px;
          white-space: nowrap;
          animation: marquee-alert-scroll 32s linear infinite;
        }
        .animate-marquee-alert:hover {
          animation-play-state: paused;
        }
      `}} />

      {/* Top Floating Marquee Alert Banner */}
      {scrollingAlertContent && (
        <div className="absolute top-0 md:top-4 left-0 md:left-1/2 md:-translate-x-1/2 z-[1000] w-full md:w-[60vw] max-w-3xl h-8 md:h-9 bg-slate-950/40 backdrop-blur-xl border-b md:border border-white/10 rounded-none md:rounded-full flex items-center px-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden pointer-events-auto">
          <div className="flex items-center gap-2 shrink-0 bg-slate-950/70 backdrop-blur-md z-10 pr-3 border-r border-white/10 h-full">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${(!alertsData?.alerts || alertsData.alerts.length === 0) ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${(!alertsData?.alerts || alertsData.alerts.length === 0) ? "bg-emerald-500" : "bg-red-500"}`} />
            </span>
            <span className={`text-[9px] font-black uppercase tracking-widest ${(!alertsData?.alerts || alertsData.alerts.length === 0) ? "text-emerald-400" : "text-red-400"}`}>
              {(!alertsData?.alerts || alertsData.alerts.length === 0) ? (
                <>
                  <span className="hidden md:inline">Trafic Normal</span>
                  <span className="inline md:hidden">Normal</span>
                </>
              ) : (
                <>
                  <span className="hidden md:inline">Alerte en direct du réseau</span>
                  <span className="inline md:hidden">Alerte</span>
                </>
              )}
            </span>
          </div>
          
          <div className="flex-1 overflow-hidden relative mx-3 h-full flex items-center">
            <div className="animate-marquee-alert text-[11px] font-bold text-slate-300">
              {scrollingAlertContent}
            </div>
          </div>
        </div>
      )}

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
      <div className="absolute top-11 md:top-4 left-4 z-[1000] flex items-center gap-2 px-3 py-1.5 md:py-2.5 rounded-xl md:rounded-2xl bg-slate-950/92 border border-white/10 backdrop-blur-3xl shadow-lg">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
          MAJ Bus • {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      {/* Top Floating Line Filter Bar */}
      <div className="absolute top-24 md:top-16 left-4 right-4 z-[1000] flex flex-col items-center pointer-events-none gap-2">
        <div className="pointer-events-auto flex items-center gap-1 p-1 bg-slate-950/92 border border-white/10 backdrop-blur-3xl rounded-2xl shadow-2xl overflow-x-auto max-w-full no-scrollbar">
          <button
            onClick={() => {
              setSelectedLineId(null);
              setSelectedBusId(null);
              setSelectedStopId(null);
              setIsOthersOpen(false);
            }}
            className={`w-8 h-8 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 border flex items-center justify-center hover:scale-105 active:scale-95 ${
              !selectedLineId
                ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                : "bg-slate-950/65 border-white/5 text-slate-400 hover:text-white"
            }`}
            title="Toutes les lignes"
          >
            ALL
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
                className="w-8 h-8 rounded-xl text-[10.5px] font-black uppercase transition-all duration-300 border flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 hover:brightness-110"
                style={{
                  backgroundColor: isActive ? `${lineColor}33` : "rgba(2, 6, 23, 0.65)",
                  borderColor: isActive ? lineColor : "rgba(255, 255, 255, 0.05)",
                  color: isActive ? "#ffffff" : lineColor,
                  boxShadow: isActive ? `0 0 10px ${lineColor}40` : "none",
                }}
                title={`Ligne ${line}`}
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
                backgroundColor: `${LINE_COLORS[selectedLineId]}33`,
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
            className={`w-8 h-8 rounded-xl text-[11px] font-black uppercase transition-all duration-300 border flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 ${
              isOthersOpen
                ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                : "bg-slate-950/65 border-white/5 text-slate-400 hover:text-white"
            }`}
            title="Autres lignes"
          >
            +
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
      <div className="absolute top-11 md:top-4 right-4 z-[1000] flex flex-col items-end gap-1.5">
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

          {/* Geolocation Button */}
          <button
            onClick={handleLocateUser}
            disabled={isLocating}
            className={`flex items-center justify-center w-10 h-10 rounded-2xl border shadow-lg backdrop-blur-3xl transition-all duration-300 hover:scale-105 active:scale-95 ${
              userCoords
                ? "bg-sky-500 border-sky-400 text-slate-950 shadow-[0_0_15px_rgba(14,165,233,0.4)]"
                : "bg-slate-950/92 border-white/10 text-slate-200 hover:bg-slate-900/90 hover:border-white/20"
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
            className={`flex items-center justify-center w-10 h-10 rounded-2xl border shadow-lg backdrop-blur-3xl transition-all duration-300 hover:scale-105 active:scale-95 ${isSearchOpen
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

        {/* Search & Suggestions Results Dropdown */}
        {isSearchOpen && (
          <div className="pointer-events-auto bg-slate-950/95 border border-white/10 p-3 rounded-[20px] w-64 md:w-80 shadow-2xl flex flex-col gap-1 max-h-72 overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200 mt-1">
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
                    onClick={handleLocateUser}
                    className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-500/20 text-cyan-400 font-bold text-xs uppercase tracking-wider transition-all duration-200 hover:scale-102 active:scale-98"
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
                            <span className="text-[9px] text-slate-500 font-bold mt-1 block normal-case">
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
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                              <span>Lignes : {stop.lines?.join(", ") || "Aucune"}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-700" />
                              <span className="text-cyan-400 font-bold font-sans">
                                {stop.distance < 1000 
                                  ? `${Math.round(stop.distance)}m` 
                                  : `${(stop.distance / 1000).toFixed(1)}km`}
                              </span>
                            </span>
                          </div>
                          <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700">
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
          background: rgba(15, 23, 42, 0.85) !important;
          backdrop-filter: blur(6px) !important;
          border: 1.2px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6) !important;
          color: #cbd5e1 !important;
          font-size: 10.5px !important;
          font-weight: 700 !important;
          font-family: system-ui, -apple-system, sans-serif !important;
          letter-spacing: 0.02em !important;
          padding: 3px 7.5px !important;
          white-space: nowrap !important;
          pointer-events: auto !important;
          cursor: pointer !important;
          transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, color 0.2s ease-in-out, box-shadow 0.2s ease-in-out !important;
        }
        .stop-label-pill::before {
          display: none !important;
        }

        /* Selected stop label: vibrant golden accent, neon border glow */
        .stop-label-selected {
          background: rgba(245, 158, 11, 0.2) !important;
          border: 1.5px solid #f59e0b !important;
          color: #f59e0b !important;
          font-size: 12px !important;
          padding: 4px 10px !important;
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.4), 0 4px 16px rgba(0, 0, 0, 0.7) !important;
          font-weight: 850 !important;
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
          pointer-events: auto !important;
          cursor: pointer !important;
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

        /* Prevent white background flash when zooming or panning map tiles */
        .leaflet-container {
          background-color: #090909 !important;
        }

        /* Add subtle warm color tint to the dark map tiles */
        .leaflet-tile-pane {
          filter: saturate(1.6) brightness(1.05) hue-rotate(5deg) !important;
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

          {/* Dark Mode CartoDB layer */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* User Location Pulse Marker */}
          {userCoords && (
            <Marker
              position={[userCoords.lat, userCoords.lon]}
              icon={createUserIcon()}
              zIndexOffset={1000}
            />
          )}

          {/* Network Polylines (Shapes) */}
          {showShapes && sortedShapes?.map((shape: any) => {
            // Determine if this line should be highlighted
            const activeRouteId = selectedLineId || selectedBus?.route_id || highlightedBus?.route_id;
            const hasActiveFilter = !!activeRouteId;
            const isLineSelected = activeRouteId === shape.route_id;

            const isPrimary = ["A", "B", "C1", "C2", "D"].includes(shape.route_id);

            // Dynamic opacity and weight styling based on active filter and line priority
            let opacity = 0.35;
            let weight = 2.5;

            if (hasActiveFilter) {
              if (isLineSelected) {
                opacity = 1.0;
                weight = 6;
              } else {
                // Secondary background network when focusing a line
                opacity = 0.08;
                weight = 1.5;
              }
            } else {
              // Rule 1: Initial state - colorful ambient network lines
              if (isPrimary) {
                opacity = 0.50;
                weight = 4;
              } else {
                opacity = 0.25;
                weight = 2.5;
              }
            }

            return (
              <Fragment key={`shape-group-${shape.shape_id || Math.random()}`}>
                {/* Neon glow shadow under selected lines */}
                {isLineSelected && (
                  <Polyline
                    positions={shape.coordinates}
                    interactive={false}
                    pathOptions={{
                      color: getLineColor(shape.route_id),
                      weight: 14,
                      opacity: 0.15,
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
                    color: getLineColor(shape.route_id),
                    weight: weight,
                    opacity: opacity,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
              </Fragment>
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
                  icon={createStopIcon(
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
          bottom-[76px] left-0 right-0 h-[50vh] max-h-[400px] w-full 
          /* Desktop floating sidebar styles */
          md:bottom-24 md:left-6 md:right-auto md:w-[380px] md:h-[calc(100vh-220px)] md:max-h-[580px]
          ${(selectedBus || selectedStop) 
            ? "translate-y-0 md:scale-100 md:opacity-100 opacity-100" 
            : "translate-y-[calc(100%+80px)] md:scale-95 md:opacity-0 md:translate-y-0 opacity-0 pointer-events-none"
          }`}
      >
        <div className="h-full bg-slate-950/92 backdrop-blur-3xl border-t md:border border-white/10 rounded-t-[32px] md:rounded-[24px] p-3.5 md:p-5 shadow-[0_-15px_30px_rgba(0,0,0,0.5)] md:shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col gap-2 md:gap-3.5 overflow-hidden">
          {/* Drag Handle Indicator */}
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto shrink-0 mb-0.5 md:hidden" />

          {/* CONTENT FOR SELECTED BUS */}
          {selectedBus && (
            <>
              {/* Airy & Premium Header Row */}
              <div className="flex flex-col gap-1.5 md:gap-2 shrink-0 pb-1.5 md:pb-2.5 border-b border-white/5">
                <div className="flex justify-between items-center w-full gap-3">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    {/* Route Badge */}
                    <div
                      className="w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-sm md:text-lg border shadow-lg shrink-0"
                      style={{
                        backgroundColor: `${getLineColor(selectedBus.route_id)}25`,
                        color: getLineColor(selectedBus.route_id),
                        borderColor: `${getLineColor(selectedBus.route_id)}90`,
                        boxShadow: `0 0 12px ${getLineColor(selectedBus.route_id)}20`
                      }}
                    >
                      {selectedBus.route_id || "B"}
                    </div>
                    
                    {/* Bus Name, Delay & Type */}
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm md:text-lg font-black text-white tracking-wide leading-tight">
                          Bus {formatBusName(selectedBus.vehicle_id || "Inconnu")}
                        </h3>
                        {/* Delay / On-time Status (Merged into header for maximum space savings!) */}
                        {departureStatus ? (
                          <span className="px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-400 animate-pulse">
                            Départ {departureStatus.minutes}m
                          </span>
                        ) : (
                          <span className={`px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-wider border ${
                            (selectedBus.delay || 0) > 60
                              ? "bg-orange-500/15 border-orange-500/30 text-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.15)]"
                              : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.15)]"
                          }`}>
                            {(selectedBus.delay || 0) > 60 ? `Retard de ${Math.round((selectedBus.delay || 0) / 60)} min` : "À l'heure"}
                          </span>
                        )}
                        <span className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-wider ${
                          getVehicleType(selectedBus.vehicle_id || "") === "Articulé"
                            ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                            : "bg-slate-800 border border-slate-700 text-slate-400"
                        }`}>
                          {getVehicleType(selectedBus.vehicle_id || "")}
                        </span>
                      </div>
                      
                      {/* Direction Row with Scrolling Marquee on Overflow */}
                      <div className="text-[10px] md:text-xs font-semibold text-slate-400 w-full overflow-hidden flex items-center gap-1">
                        <span className="shrink-0">Direction :</span>
                        <div className="relative overflow-hidden flex-1 h-[14px] md:h-[16px]">
                          <div 
                            ref={directionRef}
                            className={`absolute left-0 top-0 whitespace-nowrap transition-transform ${
                              scrollDistance > 0 ? "animate-direction-marquee" : ""
                            }`}
                            style={{ 
                              transform: scrollDistance > 0 ? undefined : "none",
                              "--scroll-dist": `-${scrollDistance}px`
                            } as React.CSSProperties}
                          >
                            <span className="font-extrabold text-amber-500 uppercase tracking-wide">
                              {selectedBus.trip_headsign || "Sans voyageurs"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setSelectedBusId(null)}
                    className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-all border border-white/5 active:scale-95 shrink-0"
                  >
                    <X size={15} className="md:w-[18px] md:h-[18px]" />
                  </button>
                </div>

                {/* Second Row: Real-time stop status (Very compact banner!) */}
                {currentStopInfo?.name && (
                  <div className="w-full">
                    <span className={`inline-flex w-full items-center gap-1.5 px-2 py-0.5 rounded-md border text-[8px] md:text-[9px] font-black uppercase tracking-widest ${
                      currentStopInfo.status === 1 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                        : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                    }`}>
                      <span className="relative flex h-1 w-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1 w-1 bg-current"></span>
                      </span>
                      {currentStopInfo.status === 1 ? "À l'arrêt" : "En approche de"} : {currentStopInfo.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Scrollable Course Timeline (Ultra-tight & spacious) */}
              <div className="flex-1 overflow-y-auto no-scrollbar rounded-xl bg-slate-950/40 border border-white/5 p-3.5 mt-0.5">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                  <MapPin size={11} className="text-amber-500" />
                  Trajet en temps réel
                </h4>

                <div className="relative pl-6 border-l-2 border-slate-800 space-y-2 md:space-y-3.5">
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
                    
                    let delayMin = 0;
                    if (hasUpdate && expectedTime) {
                      if (update.arrival?.delay !== undefined && update.arrival?.delay !== null && update.arrival?.delay !== 0) {
                        delayMin = Math.round(update.arrival.delay / 60);
                      } else {
                        // Fallback: calculate delay from the difference between expectedTime and scheduledTime
                        const timeToMinutes = (tStr: string) => {
                          const parts = tStr.split(":");
                          return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                        };
                        const expectedMins = timeToMinutes(expectedTime);
                        const scheduledMins = timeToMinutes(scheduledTime);
                        let calculatedDelay = expectedMins - scheduledMins;
                        if (calculatedDelay < -1000) {
                          calculatedDelay += 1440;
                        } else if (calculatedDelay > 1000) {
                          calculatedDelay -= 1440;
                        }
                        delayMin = calculatedDelay;
                      }
                    }
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
                      <div key={stop.stop_id} className="relative flex items-center justify-between min-h-[26px] md:min-h-[30px] py-0.5 md:py-1">
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
                                    Retard de {delayMin} min
                                  </span>
                                ) : delayMin < 0 ? (
                                  <span className="px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                    Avance de {Math.abs(delayMin)} min
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
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center bg-slate-800 text-slate-300 border border-slate-700">
                    <MapPin size={20} className="md:w-6 md:h-6" />
                  </div>
                  <div>
                    <div className="bg-black border border-slate-800 rounded-lg md:rounded-xl px-3 py-1.5 md:px-4 md:py-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] relative overflow-hidden flex items-center justify-between min-w-[150px] md:min-w-[200px]">
                      {/* Ambient grid texture overlay to simulate LED display */}
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none" />
                      
                      <div className="relative z-10 flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">
                          Arrêt Physique
                        </span>
                        <span className="text-xs md:text-sm font-black font-mono text-cyan-400 uppercase tracking-wider leading-tight drop-shadow-[0_0_6px_rgba(34,211,238,0.85)] truncate max-w-[110px] md:max-w-[160px]">
                          {selectedStop.stop_name}
                        </span>
                      </div>
                      
                      {/* Led indicators on the right of the sign */}
                      <div className="relative z-10 flex gap-1 pl-3 border-l border-slate-800/80 shrink-0">
                        <span className="w-1 h-1 rounded-full bg-cyan-500/30 animate-pulse" />
                        <span className="w-1 h-1 rounded-full bg-cyan-400 drop-shadow-[0_0_4px_rgba(34,211,238,0.85)]" />
                      </div>
                    </div>

                    {/* Line Badges directly under the black LED panel */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {(selectedStop.lines || []).map((l: string) => {
                        const lineColor = getLineColor(l);
                        return (
                          <span 
                            key={l}
                            className="px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shrink-0"
                            style={{
                              color: lineColor,
                              borderColor: `${lineColor}40`,
                              backgroundColor: `${lineColor}15`
                            }}
                          >
                            Ligne {l}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStopId(null)}
                  className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:text-white transition-colors border border-white/5 active:scale-95"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar rounded-xl bg-slate-950/50 border border-white/5 p-3 md:p-4 mt-1.5 md:mt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Bus size={14} />
                  Prochains passages
                </h4>

                <div className="space-y-1.5 md:space-y-3">
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
                          className={`w-full flex items-center justify-between p-2 md:p-3.5 rounded-lg md:rounded-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] cursor-pointer text-left ${
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
                          <div className="flex items-center gap-2 md:gap-3">
                            <div
                              className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs border shadow-inner shrink-0"
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

        {/* Nearest Stop Notification Banner */}
        {nearestStopBanner && (
          <div className="absolute top-24 left-4 right-4 z-[1001] flex justify-center pointer-events-none">
            <div className="bg-cyan-500 border border-cyan-400 text-slate-950 px-4 py-2.5 rounded-2xl shadow-[0_10px_25px_rgba(34,211,238,0.4)] flex items-center gap-2 animate-in slide-in-from-top-3 duration-300 pointer-events-auto">
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
            <div className="bg-red-500 border border-red-400 text-white px-4 py-2.5 rounded-2xl shadow-[0_10px_25px_rgba(239,68,68,0.4)] flex items-center gap-2 animate-in slide-in-from-top-3 duration-300 pointer-events-auto">
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
