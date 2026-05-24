"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Bus, Clock, ChevronDown, Filter, Calendar } from "lucide-react";
import { getLineColor } from "@/components/lineColors";

const TARGET_LINES = ["A", "B", "C1", "C2", "D"];

// Subcomponent to handle details and schedule loading for a specific stop when expanded
function StopDetails({ stop, realtimeData }: { stop: any; realtimeData: any }) {
  const [showAllSchedule, setShowAllSchedule] = useState(false);

  // Fetch scheduled/theoretical times for this stop
  const { data: scheduleData, isLoading: isScheduleLoading } = useQuery({
    queryKey: ["stopSchedule", stop.stop_name],
    queryFn: async () => {
      const res = await fetch(`/api/axo/stop-schedule?stop_ids=${stop.stop_ids.join(",")}`);
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
    staleTime: 1000 * 60 * 10, // Cache static schedules for 10 minutes
  });

  // Calculate real-time upcoming passages
  const upcomingBuses = useMemo(() => {
    const vehicles = realtimeData?.vehicles || [];
    const upcoming: any[] = [];
    
    vehicles.forEach((v: any) => {
      if (!v.stop_time_updates) return;
      const update = v.stop_time_updates.find((u: any) => stop.stop_ids.includes(u.stop_id));
      if (update && v.current_stop_sequence !== undefined && update.stop_sequence >= v.current_stop_sequence) {
        const arrivalTime = update.arrival?.time;
        if (arrivalTime) {
          const etaSeconds = arrivalTime - Math.floor(Date.now() / 1000);
          upcoming.push({
            vehicle: v,
            arrivalTime,
            etaMinutes: Math.floor(etaSeconds / 60)
          });
        }
      }
    });
    
    return upcoming.sort((a, b) => a.arrivalTime - b.arrivalTime);
  }, [realtimeData, stop.stop_ids]);

  // Process planned schedules (upcoming or all day)
  const processedSchedules = useMemo(() => {
    const schedules = scheduleData?.schedules || [];
    if (schedules.length === 0) return [];

    // Get current Paris time in HH:MM:SS format
    const now = new Date();
    const currentParisTime = now.toLocaleTimeString("fr-FR", { 
      timeZone: "Europe/Paris", 
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    // Separate into upcoming and past
    const upcoming = schedules.filter((s: any) => s.departure_time >= currentParisTime);
    
    if (showAllSchedule) {
      return schedules; // return full day schedule sorted
    }
    
    // Default: show next 6 upcoming scheduled runs
    return upcoming.slice(0, 6);
  }, [scheduleData, showAllSchedule]);

  return (
    <div className="bg-slate-950/80 px-4 py-4 border-t border-white/5 space-y-5">
      {/* SECTION 1: PASSAGES EN DIRECT (REALTIME) */}
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Clock size={14} className="text-amber-500" />
          Passages en direct
        </h4>
        
        <div className="space-y-2">
          {upcomingBuses.length === 0 ? (
            <div className="text-sm text-slate-500 bg-slate-900/50 rounded-xl p-4 text-center border border-white/5">
              Aucun passage en direct prévu actuellement.
            </div>
          ) : (
            upcomingBuses.map((b, idx) => {
              const isImminent = b.etaMinutes <= 0;
              const activeColor = getLineColor(b.vehicle.route_id);
              
              return (
                <div key={`${b.vehicle.id}-${idx}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-white/5 shadow-md">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border shadow-inner"
                      style={{
                        backgroundColor: `${activeColor}20`,
                        color: activeColor,
                        borderColor: `${activeColor}50`
                      }}
                    >
                      {b.vehicle.route_id || "B"}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-bold text-slate-200 truncate">
                        Bus {b.vehicle.vehicle_id}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold truncate mt-0.5" style={{ color: activeColor }}>
                        Direction: {b.vehicle.trip_headsign || "Inconnue"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div 
                      className="text-sm font-black" 
                      style={isImminent ? { color: activeColor, animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" } : { color: "#cbd5e1" }}
                    >
                      {isImminent ? "À l'approche" : `${b.etaMinutes} min`}
                    </div>
                    <div className="text-[10px] font-medium text-slate-500">
                      {new Date(b.arrivalTime * 1000).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 2: HORAIRES PREVISIONNELS (GTFS SCHEDULE) */}
      <div className="border-t border-white/5 pt-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Calendar size={14} className="text-purple-400" />
          Horaires théoriques
        </h4>

        {isScheduleLoading ? (
          <div className="text-center py-4 text-xs text-slate-500 animate-pulse">Chargement de la grille horaire...</div>
        ) : processedSchedules.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-900/50 rounded-xl p-4 text-center border border-white/5">
            Aucun horaire planifié pour le reste de la journée.
          </div>
        ) : (
          <div className="space-y-2">
            {processedSchedules.map((sched: any, idx: number) => {
              const activeColor = getLineColor(sched.route_id);
              // Format HH:MM:SS to HH:MM
              const timeFormatted = sched.departure_time.slice(0, 5);

              return (
                <div 
                  key={`${sched.trip_id}-${idx}`} 
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-white/5 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    <span 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 border shadow-inner"
                      style={{
                        backgroundColor: `${activeColor}15`,
                        color: activeColor,
                        borderColor: `${activeColor}40`
                      }}
                    >
                      {sched.route_id}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-bold text-slate-200 truncate">
                        Ligne {sched.route_id}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                        Vers : {sched.trip_headsign || "Inconnue"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-slate-200 tracking-wide bg-slate-950 px-2.5 py-1 rounded-lg border border-white/5 shadow-inner">
                      {timeFormatted}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Toggle to see whole day schedules */}
            {scheduleData?.schedules && scheduleData.schedules.length > 6 && (
              <button
                onClick={() => setShowAllSchedule(!showAllSchedule)}
                className="w-full text-center py-2 text-xs font-semibold text-slate-400 hover:text-amber-500 transition-colors pt-2"
              >
                {showAllSchedule ? "Voir moins d'horaires" : `Voir toute la journée (${scheduleData.schedules.length} départs)`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StopsPage() {
  const [search, setSearch] = useState("");
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);

  // Fetch stops
  const { data: allStopsData, isLoading: isStopsLoading } = useQuery({
    queryKey: ["allStops"],
    queryFn: async () => {
      const res = await fetch("/api/axo/all-stops");
      if (!res.ok) throw new Error("Failed to fetch stops");
      return res.json();
    },
    staleTime: Infinity,
  });

  // Fetch real-time vehicles
  const { data: realtimeData } = useQuery({
    queryKey: ["realtime"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime");
      if (!res.ok) throw new Error("Failed to fetch realtime data");
      return res.json();
    },
    refetchInterval: 20000,
  });

  const stops = allStopsData?.stops || [];
  
  // Group stops by name to avoid duplicate UI entries for opposite platforms
  const groupedStops = useMemo(() => {
    const groups = new Map<string, any>();
    stops.forEach((s: any) => {
      if (!groups.has(s.stop_name)) {
        groups.set(s.stop_name, {
          stop_name: s.stop_name,
          stop_ids: [s.stop_id],
          stop_lat: s.stop_lat,
          stop_lon: s.stop_lon,
          lines: [...(s.lines || [])]
        });
      } else {
        const group = groups.get(s.stop_name);
        group.stop_ids.push(s.stop_id);
        if (s.lines) {
          s.lines.forEach((l: string) => {
            if (!group.lines.includes(l)) {
              group.lines.push(l);
            }
          });
        }
      }
    });

    // Sort lines inside each stop for clean badges ordering
    const sortedGroups = Array.from(groups.values()).map(g => {
      g.lines.sort((a: string, b: string) => TARGET_LINES.indexOf(a) - TARGET_LINES.indexOf(b));
      return g;
    });

    return sortedGroups.sort((a, b) => a.stop_name.localeCompare(b.stop_name));
  }, [stops]);

  const filteredStops = useMemo(() => {
    let result = groupedStops;

    // 1. Filter by selected line
    if (selectedLine) {
      result = result.filter(s => s.lines.includes(selectedLine));
    }

    // 2. Filter by search query
    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(s => s.stop_name.toLowerCase().includes(lowerSearch));
    }

    return result;
  }, [groupedStops, selectedLine, search]);

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-safe-top shadow-xl">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-black tracking-tight text-white mb-3">Liste des arrêts</h1>
          
          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher un arrêt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all text-sm"
            />
          </div>

          {/* Quick Line Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedLine(null)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 border ${
                selectedLine === null
                  ? "bg-white text-slate-950 border-white"
                  : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <Filter size={12} />
              Tous
            </button>
            
            {TARGET_LINES.map((lineId) => {
              const activeColor = getLineColor(lineId);
              const isSelected = selectedLine === lineId;
              
              return (
                <button
                  key={lineId}
                  onClick={() => setSelectedLine(isSelected ? null : lineId)}
                  className="px-4.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all border"
                  style={{
                    backgroundColor: isSelected ? activeColor : "rgba(15, 23, 42, 0.6)",
                    color: isSelected ? "#000" : activeColor,
                    borderColor: isSelected ? activeColor : `${activeColor}33`,
                  }}
                >
                  Ligne {lineId}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3">
        {isStopsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
             <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
             <div className="text-slate-400 font-medium tracking-wide">Chargement du réseau...</div>
          </div>
        ) : filteredStops.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            Aucun arrêt trouvé {selectedLine ? `sur la Ligne ${selectedLine}` : ""} {search ? `pour "${search}"` : ""}
          </div>
        ) : (
          filteredStops.map((stop) => {
            const isExpanded = expandedStopId === stop.stop_name;
            
            return (
              <div 
                key={stop.stop_name} 
                className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 shadow-lg"
              >
                {/* Stop Header (Clickable) */}
                <button 
                  onClick={() => setExpandedStopId(isExpanded ? null : stop.stop_name)}
                  className="w-full flex items-center justify-between p-4 text-left focus:outline-none hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${isExpanded ? "bg-amber-500/20 text-amber-500" : "bg-slate-800 text-slate-400"}`}>
                      <MapPin size={20} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-slate-200 text-base tracking-wide truncate">{stop.stop_name}</span>
                      
                      {/* Line Badges directly under the Stop name */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {stop.lines.map((l: string) => {
                          const lineColor = getLineColor(l);
                          return (
                            <span 
                              key={l}
                              className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border"
                              style={{
                                color: lineColor,
                                borderColor: `${lineColor}40`,
                                backgroundColor: `${lineColor}15`
                              }}
                            >
                              {l}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <ChevronDown 
                    size={18} 
                    className={`text-slate-500 shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180 text-amber-500" : ""}`} 
                  />
                </button>

                {/* Expanded Content: StopDetails Subcomponent */}
                {isExpanded && (
                  <StopDetails stop={stop} realtimeData={realtimeData} />
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
