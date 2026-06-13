"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import LineTimeline from "@/components/LineTimeline";
import Link from "next/link";
import { 
  AlertTriangle, 
  Loader2, 
  Signal, 
  Lock, 
  Unlock, 
  Search, 
  Compass, 
  MapPin, 
  Activity, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  X,
  ChevronDown
} from "lucide-react";

const AVAILABLE_LINES = ["A", "B", "C1", "C2", "D"];

const formatAlertDateRange = (start?: string, end?: string) => {
  if (!start && !end) return "";
  
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} À ${hours}H${minutes}`;
  };

  if (start && end) {
    return `DU ${formatDate(start)} AU ${formatDate(end)}`;
  } else if (start) {
    return `À PARTIR DU ${formatDate(start)}`;
  } else if (end) {
    return `JUSQU'AU ${formatDate(end)}`;
  }
  return "";
};

const LINE_COLORS: Record<string, { bg: string, text: string, border: string, shadow: string, hex: string }> = {
  "A": { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-400/50", shadow: "shadow-[0_0_15px_rgba(239,68,68,0.2)]", hex: "#ef4444" },
  "B": { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-400/50", shadow: "shadow-[0_0_15px_rgba(59,130,246,0.2)]", hex: "#3b82f6" },
  "C1": { bg: "bg-lime-500/20", text: "text-lime-400", border: "border-lime-400/50", shadow: "shadow-[0_0_15px_rgba(132,204,22,0.2)]", hex: "#a3e635" },
  "C2": { bg: "bg-green-700/20", text: "text-green-500", border: "border-green-500/50", shadow: "shadow-[0_0_15px_rgba(34,197,94,0.2)]", hex: "#15803d" },
  "D": { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-400/50", shadow: "shadow-[0_0_15px_rgba(234,179,8,0.2)]", hex: "#eab308" },
};

const sha256 = async (message: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};

export default function SupervisionPage() {
  const [selectedLine, setSelectedLine] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const line = params.get("line");
      if (line && AVAILABLE_LINES.includes(line)) return line;
    }
    return "A";
  });
  const [expandedAlerts, setExpandedAlerts] = useState<Record<string, boolean>>({});

  // Admin authentication states
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Admin dashboard view filters and tabs
  const [activeTab, setActiveTab] = useState<"live" | "logs">("live");
  const [adminSearch, setAdminSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "late" | "early" | "ontime">("all");
  const [sortBy, setSortBy] = useState<"delay" | "line" | "id">("delay");

  // Check auth session storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("axo_admin_auth");
      if (auth === "true") {
        setIsAuthenticated(true);
      }
    }
  }, []);

  // Fetch static line data (Stops sequence)
  const { data: staticData, isLoading: isStaticLoading } = useQuery({
    queryKey: ["staticLine", selectedLine],
    queryFn: async () => {
      const res = await fetch(`/api/axo/static-line?line=${selectedLine}`);
      if (!res.ok) throw new Error("Failed to fetch static line data");
      return res.json();
    },
    staleTime: Infinity, // Seldom changes
  });

  // Fetch all stops static lookup
  const { data: allStopsData } = useQuery({
    queryKey: ["allStops"],
    queryFn: async () => {
      const res = await fetch("/api/axo/all-stops");
      if (!res.ok) throw new Error("Failed to fetch all stops");
      return res.json();
    },
    staleTime: Infinity,
  });

  const stopsMap = useMemo(() => {
    const map = new Map<string, string>();
    allStopsData?.stops?.forEach((s: any) => {
      map.set(s.stop_id, s.stop_name);
    });
    return map;
  }, [allStopsData]);

  // Fetch real-time vehicles data with 20s polling for high dispatch precision
  const { data: realtimeData, isLoading: isRealtimeLoading } = useQuery({
    queryKey: ["realtime"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime");
      if (!res.ok) throw new Error("Failed to fetch real-time data");
      return res.json();
    },
    refetchInterval: 20000,
  });

  // Fetch real-time logs history for today (polls every 20s when logs tab is open)
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["historyLogs"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime?history=true");
      if (!res.ok) throw new Error("Failed to fetch history logs");
      return res.json();
    },
    refetchInterval: 20000,
    enabled: isAdminMode && activeTab === "logs",
  });

  // Fetch alerts
  const { data: alertsData } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await fetch("/api/axo/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
    refetchInterval: 1200000, // 20m
  });

  // Filter vehicles for the specific selected route (standard timeline view)
  const routeVehicles = useMemo(() => {
    return realtimeData?.vehicles?.filter(
      (v: any) => v.route_id === staticData?.route_id || v.route_id === selectedLine
    ) || [];
  }, [realtimeData, staticData, selectedLine]);

  const lineAlerts = useMemo(() => {
    return alertsData?.alerts?.filter((alert: any) => 
      alert.impactedLines?.some((line: string) => line === selectedLine || line.replace(' ', '') === selectedLine.replace(' ', ''))
    ) || [];
  }, [alertsData, selectedLine]);

  // Admin calculations
  const activeVehicles = useMemo(() => {
    return realtimeData?.vehicles || [];
  }, [realtimeData]);

  const stats = useMemo(() => {
    const total = activeVehicles.length;
    const late = activeVehicles.filter((v: any) => (v.delay || 0) > 60).length;
    const early = activeVehicles.filter((v: any) => (v.delay || 0) < -60).length;
    const ontime = total - late - early;
    
    // Average delay of moving vehicles
    const relativeDelays = activeVehicles.map((v: any) => v.delay || 0);
    const avgDelaySec = relativeDelays.length > 0 
      ? relativeDelays.reduce((a: number, b: number) => a + b, 0) / relativeDelays.length
      : 0;

    return {
      total,
      late,
      early,
      ontime,
      avgDelaySec,
      regularityRate: total > 0 ? Math.round((ontime / total) * 100) : 100
    };
  }, [activeVehicles]);

  // Search, Filter & Sort active vehicles for Admin view
  const processedAdminVehicles = useMemo(() => {
    let result = [...activeVehicles];

    // 1. Search Filter
    if (adminSearch.trim()) {
      const query = adminSearch.toLowerCase();
      result = result.filter((v: any) => {
        const busName = `bus ${v.vehicle_id || ""}`.toLowerCase();
        const vehicleId = (v.vehicle_id || "").toLowerCase();
        const routeId = (v.route_id || "").toLowerCase();
        const headsign = (v.trip_headsign || "").toLowerCase();
        const stopName = (v.stop_id ? stopsMap.get(v.stop_id) || "" : "").toLowerCase();
        
        return (
          vehicleId.includes(query) ||
          busName.includes(query) ||
          routeId.includes(query) ||
          headsign.includes(query) ||
          stopName.includes(query)
        );
      });
    }

    // 2. Status Filter
    if (statusFilter !== "all") {
      result = result.filter((v: any) => {
        const delay = v.delay || 0;
        if (statusFilter === "late") return delay > 60;
        if (statusFilter === "early") return delay < -60;
        if (statusFilter === "ontime") return Math.abs(delay) <= 60;
        return true;
      });
    }

    // 3. Sorting
    result.sort((a: any, b: any) => {
      if (sortBy === "delay") {
        return Math.abs(b.delay || 0) - Math.abs(a.delay || 0);
      }
      if (sortBy === "line") {
        return (a.route_id || "").localeCompare(b.route_id || "");
      }
      if (sortBy === "id") {
        return (a.vehicle_id || "").localeCompare(b.vehicle_id || "");
      }
      return 0;
    });

    return result;
  }, [activeVehicles, adminSearch, statusFilter, sortBy, stopsMap]);

  // Filter and sort logs for Activity Logs console
  const filteredLogs = useMemo(() => {
    if (!historyData?.history) return [];
    
    let result = [...historyData.history];
    
    // Sort logs by newest first (descending log_time)
    result.sort((a: any, b: any) => b.log_time - a.log_time);
    
    if (adminSearch.trim()) {
      const query = adminSearch.toLowerCase();
      result = result.filter((log: any) => {
        const vehicleId = (log.vehicle_id || "").toLowerCase();
        const routeId = (log.route_id || "").toLowerCase();
        const headsign = (log.trip_headsign || "").toLowerCase();
        const stopName = (log.stop_id ? stopsMap.get(log.stop_id) || "" : "").toLowerCase();
        const cleanName = vehicleId.replace("rcr", "");
        const busSearchName = `bus ${cleanName}`.toLowerCase();
        
        return (
          vehicleId.includes(query) ||
          busSearchName.includes(query) ||
          routeId.includes(query) ||
          headsign.includes(query) ||
          stopName.includes(query)
        );
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((log: any) => {
        const delay = log.delay || 0;
        if (statusFilter === "late") return delay > 60;
        if (statusFilter === "early") return delay < -60;
        if (statusFilter === "ontime") return Math.abs(delay) <= 60;
        return true;
      });
    }
    
    return result;
  }, [historyData, adminSearch, statusFilter, stopsMap]);

  const downloadLogs = () => {
    if (!historyData?.history) return;
    const blob = new Blob([JSON.stringify(historyData.history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `axo-bus-logs-${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hash = await sha256(passwordInput);
    if (hash === "c560970174e26807e130a90d6d0b6c567ef8383aea2c339033c07a6985d9859a") {
      setIsAuthenticated(true);
      setIsAdminMode(true);
      setShowAuthModal(false);
      setPasswordError(false);
      setPasswordInput("");
      if (typeof window !== "undefined") {
        sessionStorage.setItem("axo_admin_auth", "true");
      }
    } else {
      setPasswordError(true);
      setTimeout(() => setPasswordError(false), 800);
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-white pb-24 relative overflow-x-hidden">
      {/* Shake Keyframe Animation style */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-6px); }
          30%, 60%, 90% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.6s ease-in-out;
        }
      `}} />

      {/* Dynamic ambient background glows */}
      {isAdminMode ? (
        <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-red-500/5 blur-[160px] rounded-full pointer-events-none transition-all duration-500" />
      ) : (
        <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-amber-500/5 blur-[160px] rounded-full pointer-events-none transition-all duration-500" />
      )}
      
      {/* Fixed Header with Mode Selector */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-safe-top shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Signal className={isAdminMode ? "text-red-400" : "text-cyan-400"} />
              {isAdminMode ? "Supervision Admin" : "Infos Trafic"}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium truncate">
              {isAdminMode ? (
                <span className="text-red-400/85 font-black uppercase tracking-wider">Régulation Réseau Global</span>
              ) : (
                <>
                  {isRealtimeLoading ? "Recherche de bus..." : `${routeVehicles.length} bus en circulation`} 
                  {realtimeData?.timestamp && ` • ${new Date(realtimeData.timestamp).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: '2-digit', minute:'2-digit'})}`}
                </>
              )}
            </p>
          </div>
          
          {/* Header Controls */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Admin Toggle button */}
            <button
              onClick={() => {
                if (isAdminMode) {
                  setIsAdminMode(false);
                } else if (isAuthenticated) {
                  setIsAdminMode(true);
                } else {
                  setShowAuthModal(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-95 ${
                isAdminMode
                  ? "bg-red-500/25 border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {isAdminMode ? <Unlock size={13} /> : <Lock size={13} />}
              {isAdminMode ? "Mode Standard" : "Espace Admin"}
            </button>

            {/* Pulsing Status Indicator */}
            <div className={`flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full border ${isAdminMode ? "bg-red-500/10 border-red-500/30" : "bg-cyan-500/10 border-cyan-500/30"}`}>
              <div className={`w-2 h-2 rounded-full shadow-md animate-pulse ${isAdminMode ? "bg-red-400" : "bg-cyan-400"}`} />
            </div>
          </div>
        </div>

        {/* Horizontal Line Selector (User mode only) */}
        {!isAdminMode && (
          <div className="w-full overflow-x-auto no-scrollbar px-6 pb-4">
            <div className="flex gap-3">
              {AVAILABLE_LINES.map((line) => {
                const isSelected = selectedLine === line;
                const colorClasses = LINE_COLORS[line] || { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-400/50", shadow: "shadow-[0_0_15px_rgba(34,211,238,0.2)]" };
                
                return (
                  <button
                    key={line}
                    onClick={() => setSelectedLine(line)}
                    className={`shrink-0 h-11 min-w-[2.8rem] px-4 rounded-xl font-bold text-base transition-all duration-300 border ${
                      isSelected 
                        ? `${colorClasses.bg} ${colorClasses.text} ${colorClasses.border} ${colorClasses.shadow}` 
                        : "bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {line}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {isAdminMode ? (
        /* --- ADMIN REGULATION DASHBOARD VIEW --- */
        <div className="flex-1 flex flex-col p-4 md:p-6 gap-6 max-w-4xl mx-auto w-full">
          
          {/* Dispatcher Tabs Selection */}
          <div className="flex border-b border-white/10 gap-6">
            <button
              onClick={() => setActiveTab("live")}
              className={`pb-3 text-xs md:text-sm font-black uppercase tracking-wider relative transition-all cursor-pointer ${
                activeTab === "live" ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Supervision Live
              {activeTab === "live" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`pb-3 text-xs md:text-sm font-black uppercase tracking-wider relative transition-all cursor-pointer ${
                activeTab === "logs" ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Journal d'Activité (Logs)
              {activeTab === "logs" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 rounded-full" />
              )}
            </button>
          </div>

          {activeTab === "live" ? (
            <>
              {/* Dashboard Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Card 1: Active buses count */}
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-4 rounded-2xl flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Bus en service</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">{stats.total}</span>
                    <span className="text-[10px] font-bold text-slate-400">véhicules</span>
                  </div>
                </div>

                {/* Card 2: Late count */}
                <div className="bg-slate-900/40 backdrop-blur-md border border-red-500/10 p-4 rounded-2xl flex flex-col gap-1 shadow-[0_4px_20px_rgba(239,68,68,0.02)]">
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock size={10} /> Retards ({">"}1m)
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-red-500">{stats.late}</span>
                    <span className="text-[10px] font-bold text-slate-400">bus</span>
                  </div>
                </div>

                {/* Card 3: Early count */}
                <div className="bg-slate-900/40 backdrop-blur-md border border-cyan-500/10 p-4 rounded-2xl flex flex-col gap-1 shadow-[0_4px_20px_rgba(34,211,238,0.02)]">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                    <Compass size={10} /> Avances ({"<-"}1m)
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-cyan-500">{stats.early}</span>
                    <span className="text-[10px] font-bold text-slate-400">bus</span>
                  </div>
                </div>

                {/* Card 4: Regularity Rate */}
                <div className="bg-slate-900/40 backdrop-blur-md border border-emerald-500/10 p-4 rounded-2xl flex flex-col gap-1 shadow-[0_4px_20px_rgba(16,185,129,0.02)]">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 size={10} /> Régularité
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-emerald-500">{stats.regularityRate}%</span>
                    <span className="text-[10px] font-bold text-slate-400">à l'heure</span>
                  </div>
                </div>
              </div>

              {/* Network Delay summary */}
              <div className="bg-slate-900/30 backdrop-blur-sm border border-white/5 px-4 py-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">Écart moyen du réseau</span>
                <span className={`font-black uppercase tracking-wider px-2.5 py-0.5 rounded text-[10px] ${
                  stats.avgDelaySec > 30 
                    ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                    : stats.avgDelaySec < -30 
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}>
                  {stats.avgDelaySec > 0 ? "+" : ""}
                  {Math.floor(stats.avgDelaySec / 60)}m {Math.abs(Math.round(stats.avgDelaySec % 60))}s
                </span>
              </div>

              {/* Control Bar: Filters, search, sort */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/50 border border-white/10 p-4 rounded-2xl">
                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input
                    type="text"
                    placeholder="Bus, Ligne, Destination..."
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 transition-colors"
                  />
                  {adminSearch && (
                    <button 
                      onClick={() => setAdminSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Select controls */}
                <div className="flex gap-2 w-full sm:w-auto">
                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="flex-1 sm:flex-initial bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 focus:outline-none focus:border-red-500/50 cursor-pointer"
                  >
                    <option value="all">Tous ({stats.total})</option>
                    <option value="late">Retards ({stats.late})</option>
                    <option value="early">Avances ({stats.early})</option>
                    <option value="ontime">À l'heure ({stats.ontime})</option>
                  </select>

                  {/* Sort controls */}
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="flex-1 sm:flex-initial bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 focus:outline-none focus:border-red-500/50 cursor-pointer"
                  >
                    <option value="delay">Trier: Retard</option>
                    <option value="line">Trier: Ligne</option>
                    <option value="id">Trier: Bus ID</option>
                  </select>
                </div>
              </div>

              {/* Active Buses monitor List */}
              <div className="flex flex-col gap-3">
                {isRealtimeLoading && processedAdminVehicles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                    <p className="text-slate-400 text-xs font-medium">Chargement de la régulation...</p>
                  </div>
                ) : processedAdminVehicles.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-semibold bg-slate-900/10 border border-dashed border-white/5 rounded-2xl">
                    Aucun véhicule ne correspond aux critères de régulation.
                  </div>
                ) : (
                  processedAdminVehicles.map((vehicle: any) => {
                    const delay = vehicle.delay || 0;
                    const isLate = delay > 60;
                    const isEarly = delay < -60;
                    
                    // Get line color
                    const lineColor = LINE_COLORS[vehicle.route_id]?.hex || "#ffffff";
                    
                    // Resolve stop name
                    const currentStopName = vehicle.stop_id 
                      ? stopsMap.get(vehicle.stop_id) || `Arrêt ${vehicle.stop_id}`
                      : "N/A";

                    // Status text matching GTFS-RT status codes
                    let statusLabel = "";
                    let statusColorClass = "";
                    if (vehicle.current_status === 1) {
                      statusLabel = `🛑 À l'arrêt : ${currentStopName}`;
                      statusColorClass = "text-emerald-400";
                    } else if (vehicle.current_status === 2) {
                      statusLabel = `⏳ En approche de : ${currentStopName}`;
                      statusColorClass = "text-cyan-400";
                    } else {
                      statusLabel = `🔄 En transit vers : ${currentStopName}`;
                      statusColorClass = "text-slate-300";
                    }

                    return (
                      <div
                        key={vehicle.id}
                        className="relative bg-slate-900/40 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all duration-200 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        {/* Left side: Route, ID and direction */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Ligne badge */}
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border shadow-md shrink-0"
                            style={{
                              backgroundColor: `${lineColor}15`,
                              color: lineColor,
                              borderColor: `${lineColor}40`,
                            }}
                          >
                            {vehicle.route_id || "?"}
                          </div>

                          {/* Info block */}
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-black text-white tracking-wide">
                                Bus {vehicle.vehicle_id || "Inconnu"}
                              </span>
                              <span className="text-[8px] bg-slate-800 text-slate-400 border border-slate-700 px-1 py-0.2 rounded font-black uppercase tracking-wider">
                                ID: {vehicle.id}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide truncate mt-0.5">
                              Direction: <span className="text-amber-500">{vehicle.trip_headsign || "Sans voyageurs"}</span>
                            </span>
                          </div>
                        </div>

                        {/* Middle: Live stop sequence status */}
                        <div className="flex flex-col gap-1 shrink-0 md:text-right">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${statusColorClass}`}>
                            {statusLabel}
                          </span>
                          {vehicle.timestamp && (
                            <span className="text-[8px] text-slate-500 font-medium normal-case">
                              Signal mis à jour {(() => {
                                const ageSec = Math.floor(Date.now() / 1000) - vehicle.timestamp;
                                if (ageSec < 5) return "à l'instant";
                                if (ageSec < 60) return `il y a ${ageSec}s`;
                                return `il y a ${Math.floor(ageSec / 60)}m`;
                              })()}
                            </span>
                          )}
                        </div>

                        {/* Right side: Delay Badge & Quick map focus action */}
                        <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-0 border-white/5 shrink-0">
                          {/* Delay/Advance Badge */}
                          <div className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                            isLate
                              ? "bg-red-500/15 border-red-500/30 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
                              : isEarly
                              ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.15)]"
                              : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          }`}>
                            {isLate ? (
                              `+${Math.floor(delay / 60)}m ${delay % 60}s`
                            ) : isEarly ? (
                              `-${Math.floor(Math.abs(delay) / 60)}m ${Math.abs(delay) % 60}s`
                            ) : (
                              "À l'heure"
                            )}
                          </div>

                          {/* Map Focus Link */}
                          <Link
                            href={`/map?bus=${encodeURIComponent(vehicle.id)}`}
                            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-white/5 active:scale-95 transition-all cursor-pointer"
                            title="Localiser sur la carte"
                          >
                            <ArrowRight size={14} />
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              {/* --- ACTIVITY LOGS VIEW --- */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/50 border border-white/10 p-4 rounded-2xl">
                {/* Search Log Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input
                    type="text"
                    placeholder="Filtrer les logs par bus, arrêt..."
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 transition-colors"
                  />
                  {adminSearch && (
                    <button 
                      onClick={() => setAdminSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Filter & Export control */}
                <div className="flex gap-2 w-full sm:w-auto items-center">
                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 focus:outline-none focus:border-red-500/50 cursor-pointer"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="late">Retards uniquement</option>
                    <option value="early">Avances uniquement</option>
                    <option value="ontime">À l'heure uniquement</option>
                  </select>

                  {/* Export Button */}
                  <button
                    onClick={downloadLogs}
                    className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl transition-all cursor-pointer active:scale-95"
                  >
                    Exporter (.json)
                  </button>
                </div>
              </div>

              {/* Monospace terminal Activity logs feed */}
              <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 font-mono text-[10px] md:text-xs text-slate-300 flex flex-col gap-2 min-h-[350px] max-h-[600px] overflow-y-auto shadow-inner">
                {isHistoryLoading && filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                    <p className="text-slate-500 font-medium">Chargement du journal d'activité...</p>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-20 text-slate-600 font-bold">
                    Aucun log d'activité enregistré pour le moment.
                  </div>
                ) : (
                  filteredLogs.map((log: any, idx: number) => {
                    const logDate = new Date(log.log_time);
                    const timeStr = logDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    
                    // Delay color mapping
                    const delay = log.delay || 0;
                    const isLate = delay > 60;
                    const isEarly = delay < -60;
                    const delayText = isLate
                      ? `+${Math.floor(delay / 60)}m ${delay % 60}s (RETARD)`
                      : isEarly
                      ? `-${Math.floor(Math.abs(delay) / 60)}m ${Math.abs(delay) % 60}s (AVANCE)`
                      : "À L'HEURE";
                    
                    const delayColorClass = isLate 
                      ? "text-red-400 font-bold" 
                      : isEarly 
                      ? "text-cyan-400 font-bold" 
                      : "text-emerald-400 font-bold";

                    // Status label mapping
                    let eventLabel = "";
                    const stopName = log.stop_id ? stopsMap.get(log.stop_id) || `Arrêt ${log.stop_id}` : "N/A";
                    if (log.current_status === 1) {
                      eventLabel = `ARRÊTÉ À : ${stopName}`;
                    } else if (log.current_status === 2) {
                      eventLabel = `EN APPROCHE DE : ${stopName}`;
                    } else {
                      eventLabel = `EN TRANSIT VERS : ${stopName}`;
                    }

                    // Get Line Color Hex
                    const lineColor = LINE_COLORS[log.route_id]?.hex || "#ffffff";

                    return (
                      <div 
                        key={`${log.timestamp}-${idx}`} 
                        className="py-1.5 border-b border-white/5 last:border-0 flex items-start gap-2 leading-relaxed"
                      >
                        <span className="text-slate-500 shrink-0 select-none">[{timeStr}]</span>
                        <span 
                          className="font-black shrink-0 px-1 rounded text-[9px]"
                          style={{
                            backgroundColor: `${lineColor}15`,
                            color: lineColor,
                            border: `1px solid ${lineColor}30`
                          }}
                        >
                          LIGNE {log.route_id}
                        </span>
                        <span className="text-white font-extrabold shrink-0">Bus {log.vehicle_id?.replace("RCR", "")} :</span>
                        <span className="flex-1 text-slate-300">{eventLabel}</span>
                        <span className={`shrink-0 ${delayColorClass}`}>{delayText}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        /* --- STANDARD USER DETAILS VIEW (Timeline & Alerts) --- */
        <>
          {/* Line Alerts List */}
          {lineAlerts.length > 0 && (
            <div className="px-4 mt-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 pl-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                  Info Trafic
                </span>
              </div>
              
              <div className="flex flex-col gap-3">
                {lineAlerts.map((alert: any, idx: number) => {
                  const hexColor = LINE_COLORS[selectedLine]?.hex || "#f59e0b";
                  const dateRangeStr = formatAlertDateRange(alert.startTime, alert.endTime);

                  return (
                    <div 
                      key={`${alert.id}-${idx}`}
                      className="rounded-xl border backdrop-blur-md overflow-hidden transition-all duration-300"
                      style={{
                        backgroundColor: "rgba(2, 6, 23, 0.6)",
                        borderColor: `${hexColor}30`,
                        boxShadow: `0 4px 15px ${hexColor}03`,
                      }}
                    >
                      {/* Accordion Header Trigger */}
                      <button
                        onClick={() => setExpandedAlerts(prev => ({ ...prev, [alert.id]: !prev[alert.id] }))}
                        className="w-full flex items-center justify-between gap-3 p-2.5 text-left transition-colors hover:bg-white/5 active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Compact Icon */}
                          <div 
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                            style={{
                              backgroundColor: `${hexColor}10`,
                              borderColor: `${hexColor}20`,
                            }}
                          >
                            <AlertTriangle size={13} style={{ color: hexColor }} />
                          </div>

                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <h3 className="font-bold text-white text-xs leading-snug truncate flex-1">
                              {alert.title}
                            </h3>
                            <div 
                              className="px-1.5 py-0.2 rounded text-[8px] font-black tracking-wider shadow-sm uppercase shrink-0"
                              style={{
                                backgroundColor: hexColor,
                                color: "#ffffff"
                              }}
                            >
                              Ligne {selectedLine}
                            </div>
                          </div>
                        </div>
                        <ChevronDown 
                          size={14} 
                          className={`text-slate-400 transition-transform duration-300 shrink-0 ${
                            expandedAlerts[alert.id] ? "rotate-180 text-white" : ""
                          }`} 
                        />
                      </button>

                      {/* Expandable Body */}
                      <div className={`grid transition-all duration-300 ease-in-out ${
                        expandedAlerts[alert.id] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}>
                        <div className="overflow-hidden">
                          <div className="px-3 pb-3 pt-1 border-t border-white/5 flex flex-col gap-2 bg-slate-950/20">
                            {dateRangeStr && (
                              <p 
                                className="text-[9px] font-black uppercase tracking-wider"
                                style={{ color: hexColor }}
                              >
                                {dateRangeStr}
                              </p>
                            )}
                            <p className="text-slate-350 text-[11px] leading-relaxed">
                              {alert.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <main className="flex-1 w-full mt-4">
            {isStaticLoading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                <p className="text-slate-400 font-medium">Chargement du tracé...</p>
              </div>
            ) : !staticData?.stops || staticData.stops.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4 px-6 text-center">
                <p className="text-slate-500 font-medium text-sm">
                  Aucun arrêt trouvé pour la ligne {selectedLine}.<br />
                  Vérifiez la disponibilité de l'open data GTFS.
                </p>
              </div>
            ) : (
              <LineTimeline stops={staticData.stops} vehicles={routeVehicles} lineColor={LINE_COLORS[selectedLine]?.hex} />
            )}
          </main>
        </>
      )}

      {/* PASSWORD AUTHENTICATION MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-6">
          <div 
            className={`w-full max-w-sm bg-slate-900/90 border rounded-3xl p-6 shadow-2xl relative transition-all duration-300 ${
              passwordError ? "animate-shake border-red-500/50" : "border-white/10"
            }`}
          >
            {/* Close Button */}
            <button 
              onClick={() => {
                setShowAuthModal(false);
                setPasswordInput("");
                setPasswordError(false);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>

            {/* Lock Icon */}
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4 mx-auto">
              <Lock size={20} className="animate-pulse" />
            </div>

            {/* Title */}
            <h2 className="text-lg font-black text-center text-white tracking-wide">
              Accès Administrateur
            </h2>
            <p className="text-[11px] text-center text-slate-400 mt-1 mb-6">
              Veuillez saisir le mot de passe administrateur pour accéder à la supervision réseau en temps réel.
            </p>

            {/* Input Form */}
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="password"
                  placeholder="Mot de passe"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-sm text-center text-white placeholder-slate-600 focus:outline-none transition-colors ${
                    passwordError 
                      ? "border-red-500 focus:border-red-500 text-red-400" 
                      : "border-white/10 focus:border-amber-500/50"
                  }`}
                />
              </div>

              {passwordError && (
                <p className="text-[10px] text-red-400 font-bold text-center animate-pulse">
                  Mot de passe incorrect
                </p>
              )}

              <button
                type="submit"
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition-all duration-200 active:scale-98 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                Déverrouiller
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
