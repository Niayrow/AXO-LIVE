"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Clock, ChevronDown, Filter, Calendar, Map as MapIcon } from "lucide-react";
import { getLineColor } from "@/components/lineColors";

const TARGET_LINES = ["A", "B", "C1", "C2", "D"];

// Subcomponent to handle details and schedule loading for a specific stop when expanded
function StopDetails({ stop, realtimeData }: { stop: any; realtimeData: any }) {
  const [showAllSchedule, setShowAllSchedule] = useState(false);

  // Date picker state — default to today (empty string = today)
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }); // YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;

  // Fetch scheduled/theoretical times for this stop
  const { data: scheduleData, isLoading: isScheduleLoading } = useQuery({
    queryKey: ["stopSchedule", stop.stop_name, selectedDate],
    queryFn: async () => {
      const dateParam = isToday ? "" : `&date=${selectedDate}`;
      const res = await fetch(`/api/axo/stop-schedule?stop_ids=${stop.stop_ids.join(",")}${dateParam}`);
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

    // If viewing a different date, always show the full day
    if (!isToday || showAllSchedule) {
      return schedules;
    }

    // For today: filter to upcoming only
    const now = new Date();
    const currentParisTime = now.toLocaleTimeString("fr-FR", { 
      timeZone: "Europe/Paris", 
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    const upcoming = schedules.filter((s: any) => s.departure_time >= currentParisTime);
    return upcoming.slice(0, 4);
  }, [scheduleData, showAllSchedule, isToday]);

  return (
    <div className="bg-slate-950/60 px-3.5 py-3.5 border-t border-white/5 space-y-4">
      {/* SECTION 1: PASSAGES EN DIRECT (REALTIME) */}
      <div>
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
          <Clock size={12} className="text-amber-500" />
          Passages en direct
        </h4>
        
        <div className="space-y-1.5">
          {upcomingBuses.length === 0 ? (
            <div className="text-[12px] text-slate-500 bg-slate-900/30 rounded-xl p-3 text-center border border-white/5">
              Aucun passage en direct prévu actuellement.
            </div>
          ) : (
            upcomingBuses.map((b, idx) => {
              const isImminent = b.etaMinutes <= 0;
              const activeColor = getLineColor(b.vehicle.route_id);
              
              return (
                <div key={`${b.vehicle.id}-${idx}`} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/40 border border-white/5 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border shadow-inner"
                      style={{
                        backgroundColor: `${activeColor}20`,
                        color: activeColor,
                        borderColor: `${activeColor}50`
                      }}
                    >
                      {b.vehicle.route_id || "B"}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[12px] font-bold text-slate-200 truncate">
                        Bus {b.vehicle.vehicle_id}
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold truncate mt-0.5" style={{ color: activeColor }}>
                        Direction: {b.vehicle.trip_headsign || "Inconnue"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div 
                        className="text-xs font-black" 
                        style={isImminent ? { color: activeColor, animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" } : { color: "#cbd5e1" }}
                      >
                        {isImminent ? "À l'approche" : `${b.etaMinutes} min`}
                      </div>
                      <div className="text-[9px] font-medium text-slate-500">
                        {new Date(b.arrivalTime * 1000).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>

                    <Link
                      href={`/map?bus=${b.vehicle.id}`}
                      className="p-2 rounded-xl bg-slate-950/80 border border-white/5 text-slate-400 hover:text-amber-500 hover:border-amber-500/30 transition-all shadow-md shrink-0 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                      title="Voir sur la carte"
                    >
                      <MapIcon size={14} />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 2: HORAIRES PREVISIONNELS (GTFS SCHEDULE) */}
      <div className="border-t border-white/5 pt-3">
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar size={12} className="text-purple-400" />
            Horaires théoriques
          </h4>
          <div className="flex items-center gap-1.5">
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="text-[9px] font-bold text-amber-500 hover:text-amber-400 transition-colors uppercase tracking-wider cursor-pointer"
              >
                Aujourd'hui
              </button>
            )}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setShowAllSchedule(false);
              }}
              className="bg-slate-900/60 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all cursor-pointer [color-scheme:dark]"
            />
          </div>
        </div>

        {isScheduleLoading ? (
          <div className="text-center py-3 text-[11px] text-slate-500 animate-pulse">Chargement de la grille horaire...</div>
        ) : processedSchedules.length === 0 ? (
          <div className="text-[12px] text-slate-500 bg-slate-900/30 rounded-xl p-3 text-center border border-white/5">
            {isToday
              ? "Aucun horaire planifié pour le reste de la journée."
              : `Aucun horaire planifié pour le ${new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}.`
            }
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {processedSchedules.map((sched: any, idx: number) => {
                const activeColor = getLineColor(sched.route_id);
                const timeFormatted = sched.departure_time.slice(0, 5);

                return (
                  <div 
                    key={`${sched.trip_id}-${idx}`} 
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-white/5 shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <span 
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border shadow-inner"
                        style={{
                          backgroundColor: `${activeColor}15`,
                          color: activeColor,
                          borderColor: `${activeColor}40`
                        }}
                      >
                        {sched.route_id}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-bold text-slate-200 truncate">
                          Ligne {sched.route_id}
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium truncate">
                          Vers : {sched.trip_headsign || "Inconnue"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-250 tracking-wide bg-slate-950 px-2 py-0.5 rounded border border-white/5 shadow-inner">
                        {timeFormatted}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Toggle to see whole day schedules */}
            {scheduleData?.schedules && scheduleData.schedules.length > 4 && (
              <button
                onClick={() => setShowAllSchedule(!showAllSchedule)}
                className="w-full text-center py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-amber-500 transition-colors pt-1"
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
    refetchInterval: 60000,
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
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-safe-top shadow-xl">
        <div className="max-w-2xl mx-auto w-full px-5 py-4">
          <h1 className="text-xl font-black tracking-tight text-white mb-3">Liste des arrêts</h1>
          
          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un arrêt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-white/5 rounded-2xl py-2.5 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all text-sm shadow-inner"
            />
          </div>

          {/* Quick Line Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedLine(null)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1 border ${
                selectedLine === null
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                  : "bg-slate-900/60 text-slate-450 border-white/5 hover:text-white"
              }`}
            >
              <Filter size={10} />
              Tous
            </button>
            
            {TARGET_LINES.map((lineId) => {
              const activeColor = getLineColor(lineId);
              const isSelected = selectedLine === lineId;
              
              return (
                <button
                  key={lineId}
                  onClick={() => setSelectedLine(isSelected ? null : lineId)}
                  className="px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border"
                  style={{
                    backgroundColor: isSelected ? activeColor : "rgba(15, 23, 42, 0.4)",
                    color: isSelected ? "#000" : activeColor,
                    borderColor: isSelected ? activeColor : `${activeColor}22`,
                    boxShadow: isSelected ? `0 0 12px ${activeColor}40` : "none"
                  }}
                >
                  {lineId}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main List */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-2">
        {isStopsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
             <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
             <div className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Chargement des arrêts...</div>
          </div>
        ) : filteredStops.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Aucun arrêt trouvé {selectedLine ? `sur la Ligne ${selectedLine}` : ""} {search ? `pour "${search}"` : ""}
          </div>
        ) : (
          filteredStops.map((stop) => {
            const isExpanded = expandedStopId === stop.stop_name;
            
            return (
              <div 
                key={stop.stop_name} 
                className="bg-slate-900/50 border border-white/[0.05] rounded-xl overflow-hidden transition-all duration-300 shadow-md"
              >
                {/* Stop Header (Clickable - single row layout) */}
                <button 
                  onClick={() => setExpandedStopId(isExpanded ? null : stop.stop_name)}
                  className="w-full flex items-center justify-between p-3 text-left focus:outline-none hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isExpanded ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-slate-850 text-slate-400 border border-white/5"}`}>
                      <MapPin size={16} />
                    </div>
                    <span className="font-bold text-slate-200 text-sm tracking-wide truncate">{stop.stop_name}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    {/* Line Badges Inline on the right side */}
                    <div className="flex items-center gap-1">
                      {stop.lines.map((l: string) => {
                        const lineColor = getLineColor(l);
                        return (
                          <span 
                            key={l}
                            className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0"
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
                    <ChevronDown 
                      size={16} 
                      className={`text-slate-500 transition-transform duration-300 ${isExpanded ? "rotate-180 text-amber-500" : ""}`} 
                    />
                  </div>
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
