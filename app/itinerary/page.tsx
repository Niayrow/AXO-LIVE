"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Compass, 
  MapPin, 
  ArrowUpDown, 
  Search, 
  Clock, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  HelpCircle,
  Play
} from "lucide-react";
import { getLineColor } from "@/components/lineColors";

// Subcomponent to fetch and render the live/theoretical upcoming departures for Leg 1 boarding stop
function NextLegDepartures({ stopName, lineId }: { stopName: string; lineId: string }) {
  // 1. Fetch all stops to find the stop_ids corresponding to this stopName
  const { data: allStopsData } = useQuery({
    queryKey: ["allStops"],
    queryFn: async () => {
      const res = await fetch("/api/axo/all-stops");
      return res.json();
    },
    staleTime: Infinity,
  });

  const stopIds = useMemo(() => {
    const stops = allStopsData?.stops || [];
    return stops
      .filter((s: any) => s.stop_name === stopName)
      .map((s: any) => s.stop_id);
  }, [allStopsData, stopName]);

  // 2. Fetch schedules for these stop IDs
  const { data: scheduleData, isLoading: isScheduleLoading } = useQuery({
    queryKey: ["stopSchedule", stopName],
    queryFn: async () => {
      if (stopIds.length === 0) return { schedules: [] };
      const res = await fetch(`/api/axo/stop-schedule?stop_ids=${stopIds.join(",")}`);
      return res.json();
    },
    enabled: stopIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // 3. Fetch real-time vehicles
  const { data: realtimeData } = useQuery({
    queryKey: ["realtime"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime");
      return res.json();
    },
    refetchInterval: 20000,
  });

  // Combine realtime + static schedules
  const upcomingDepartures = useMemo(() => {
    if (stopIds.length === 0) return [];
    
    // Check real-time first
    const vehicles = realtimeData?.vehicles || [];
    const realtimeDepartures: any[] = [];
    
    vehicles.forEach((v: any) => {
      if (v.route_id !== lineId || !v.stop_time_updates) return;
      const update = v.stop_time_updates.find((u: any) => stopIds.includes(u.stop_id));
      if (update && v.current_stop_sequence !== undefined && update.stop_sequence >= v.current_stop_sequence) {
        const arrivalTime = update.arrival?.time || update.departure?.time;
        if (arrivalTime) {
          const etaSeconds = arrivalTime - Math.floor(Date.now() / 1000);
          realtimeDepartures.push({
            isRealtime: true,
            etaMinutes: Math.max(0, Math.floor(etaSeconds / 60)),
            time: new Date(arrivalTime * 1000).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }),
            direction: v.trip_headsign || "En route"
          });
        }
      }
    });

    if (realtimeDepartures.length > 0) {
      return realtimeDepartures.sort((a, b) => a.etaMinutes - b.etaMinutes).slice(0, 2);
    }

    // Fallback to static schedules
    const schedules = scheduleData?.schedules || [];
    const now = new Date();
    const currentParisTime = now.toLocaleTimeString("fr-FR", { 
      timeZone: "Europe/Paris", 
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    return schedules
      .filter((s: any) => s.route_id === lineId && s.departure_time >= currentParisTime)
      .slice(0, 2)
      .map((s: any) => ({
        isRealtime: false,
        time: s.departure_time.slice(0, 5),
        direction: s.trip_headsign
      }));
  }, [realtimeData, scheduleData, stopIds, lineId]);

  if (isScheduleLoading) {
    return <div className="text-[10px] text-slate-500 animate-pulse">Recherche des départs...</div>;
  }

  if (upcomingDepartures.length === 0) {
    return <div className="text-[10px] text-slate-500">Aucun départ proche planifié</div>;
  }

  return (
    <div className="flex flex-col gap-1.5 mt-2 bg-slate-950 p-2.5 rounded-xl border border-white/5 shadow-inner">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
        <Play size={8} className="text-amber-500 fill-amber-500" />
        Prochains départs de {stopName}
      </div>
      <div className="flex flex-col gap-1">
        {upcomingDepartures.map((dep: any, idx: number) => (
          <div key={idx} className="flex justify-between items-center text-xs">
            <span className="text-slate-300 truncate max-w-[160px]">
              Vers : {dep.direction}
            </span>
            <span className="font-bold flex items-center gap-1 shrink-0" style={{ color: getLineColor(lineId) }}>
              {dep.time}
              {dep.isRealtime && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded">TR</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ItineraryPage() {
  const [startStop, setStartStop] = useState("");
  const [endStop, setEndStop] = useState("");
  const [expandedItinIdx, setExpandedItinIdx] = useState<number | null>(null);

  // Fetch unique stop names
  const { data: stopNamesData, isLoading: isStopsLoading } = useQuery({
    queryKey: ["stopNames"],
    queryFn: async () => {
      const res = await fetch("/api/axo/route-planner");
      if (!res.ok) throw new Error("Failed to fetch stop names");
      return res.json();
    },
    staleTime: Infinity,
  });

  // Fetch itineraries when start & end are selected
  const { data: itineraryData, isLoading: isItinLoading, isError } = useQuery({
    queryKey: ["itineraries", startStop, endStop],
    queryFn: async () => {
      if (!startStop || !endStop) return { itineraries: [] };
      const res = await fetch(`/api/axo/route-planner?start=${encodeURIComponent(startStop)}&end=${encodeURIComponent(endStop)}`);
      if (!res.ok) throw new Error("Failed to calculate itineraries");
      return res.json();
    },
    enabled: !!startStop && !!endStop,
  });

  const stopNames = stopNamesData?.stopNames || [];
  const itineraries = itineraryData?.itineraries || [];

  const handleSwap = () => {
    const temp = startStop;
    setStartStop(endStop);
    setEndStop(temp);
    setExpandedItinIdx(null);
  };

  // Estimate duration assuming 2 minutes average per stop segment
  const estimateDuration = (stopCount: number) => {
    return stopCount * 2;
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-white pb-24">
      {/* Header & Inputs */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-safe-top shadow-xl">
        <div className="px-6 py-5">
          <h1 className="text-2xl font-black tracking-tight text-white mb-4 flex items-center gap-2">
            <Compass size={24} className="text-amber-500 animate-[spin_8s_linear_infinite]" />
            Calcul d'itinéraire
          </h1>

          {/* Form */}
          <div className="relative flex flex-col gap-3 bg-slate-900 border border-white/5 p-4 rounded-2xl shadow-inner">
            {/* Start stop selector */}
            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Départ
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500" />
                <select
                  value={startStop}
                  onChange={(e) => {
                    setStartStop(e.target.value);
                    setExpandedItinIdx(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none transition-all cursor-pointer font-medium"
                >
                  <option value="" disabled className="text-slate-500">Choisir un arrêt de départ...</option>
                  {stopNames.map((name: string) => (
                    <option key={`start-${name}`} value={name} disabled={name === endStop}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Swap button in the center */}
            <button
              onClick={handleSwap}
              type="button"
              className="absolute right-8 top-1/2 -translate-y-1/2 w-10 h-10 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-full flex items-center justify-center shadow-lg z-10 border-2 border-slate-900 transition-all"
              title="Inverser départ et arrivée"
            >
              <ArrowUpDown size={18} className="font-bold" />
            </button>

            {/* End stop selector */}
            <div className="relative pr-10">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Destination
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-400" />
                <select
                  value={endStop}
                  onChange={(e) => {
                    setEndStop(e.target.value);
                    setExpandedItinIdx(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none transition-all cursor-pointer font-medium"
                >
                  <option value="" disabled className="text-slate-500">Choisir une destination...</option>
                  {stopNames.map((name: string) => (
                    <option key={`end-${name}`} value={name} disabled={name === startStop}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Results Container */}
      <main className="flex-1 px-4 py-4 space-y-4">
        {isStopsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
             <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
             <div className="text-slate-400 font-medium tracking-wide">Chargement du réseau...</div>
          </div>
        ) : !startStop || !endStop ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 gap-4">
            <Compass size={48} className="text-slate-800 animate-pulse" />
            <div className="max-w-[280px]">
              <h3 className="text-slate-300 font-bold mb-1">Prêt pour le calcul</h3>
              <p className="text-xs">Sélectionnez un arrêt de départ et une destination pour trouver le meilleur itinéraire AXO.</p>
            </div>
          </div>
        ) : isItinLoading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
             <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
             <div className="text-slate-400 font-medium tracking-wide">Calcul de l'itinéraire optimal...</div>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={20} className="shrink-0" />
            Une erreur est survenue lors du calcul de l'itinéraire.
          </div>
        ) : itineraries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 gap-3 border border-white/5 rounded-2xl bg-slate-900/40">
            <AlertCircle size={32} className="text-slate-600" />
            <div className="max-w-[260px]">
              <h3 className="text-slate-300 font-bold mb-1">Aucun itinéraire trouvé</h3>
              <p className="text-xs">Ces deux stations ne semblent pas connectées directement ou avec une seule correspondance.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">
              Itinéraires recommandés ({itineraries.length})
            </h2>

            {itineraries.map((itin: any, idx: number) => {
              const isExpanded = expandedItinIdx === idx;
              const duration = estimateDuration(itin.stopCount);
              
              if (itin.type === "direct") {
                const activeColor = getLineColor(itin.line);
                return (
                  <div 
                    key={idx}
                    className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-lg transition-all duration-300"
                  >
                    {/* Header */}
                    <button
                      onClick={() => setExpandedItinIdx(isExpanded ? null : idx)}
                      className="w-full flex items-center justify-between p-4 focus:outline-none hover:bg-slate-800/30 transition-all text-left"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0 mr-2">
                        {/* Line Badge */}
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm border shadow-inner"
                          style={{
                            backgroundColor: `${activeColor}20`,
                            color: activeColor,
                            borderColor: `${activeColor}50`
                          }}
                        >
                          {itin.line}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-200 text-sm tracking-wide flex items-center gap-1.5">
                            Direct en Ligne {itin.line}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                            Sans correspondance • {itin.stopCount} stations
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-sm font-black text-slate-200 flex items-center gap-1 justify-end">
                            <Clock size={12} className="text-amber-500" />
                            ~{duration} min
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="bg-slate-950/80 px-4 py-4 border-t border-white/5 space-y-4">
                        {/* Next Live departure */}
                        <NextLegDepartures stopName={itin.startName} lineId={itin.line} />

                        {/* Stations timeline */}
                        <div className="pt-2">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">
                            Liste des stations desservies
                          </h4>
                          <div className="relative pl-4 border-l-2 ml-2 space-y-5" style={{ borderColor: `${activeColor}40` }}>
                            {itin.stops.map((stop: string, sIdx: number) => {
                              const isStart = sIdx === 0;
                              const isEnd = sIdx === itin.stops.length - 1;
                              return (
                                <div key={sIdx} className="relative flex items-center gap-3">
                                  {/* Point */}
                                  <div 
                                    className="absolute -left-[1.325rem] w-2.5 h-2.5 rounded-full border-2 bg-slate-950"
                                    style={{
                                      borderColor: isStart || isEnd ? activeColor : `${activeColor}60`,
                                      transform: isStart || isEnd ? "scale(1.2)" : "scale(1)"
                                    }}
                                  />
                                  <span className={`text-xs ${isStart || isEnd ? "font-bold text-slate-200" : "text-slate-400"}`}>
                                    {stop}
                                    {isStart && <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1 rounded ml-1.5 uppercase font-black">Départ</span>}
                                    {isEnd && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded ml-1.5 uppercase font-black">Arrivée</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              } else {
                // Transfer route
                const activeColor1 = getLineColor(itin.line1);
                const activeColor2 = getLineColor(itin.line2);

                return (
                  <div 
                    key={idx}
                    className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-lg transition-all duration-300"
                  >
                    {/* Header */}
                    <button
                      onClick={() => setExpandedItinIdx(isExpanded ? null : idx)}
                      className="w-full flex items-center justify-between p-4 focus:outline-none hover:bg-slate-800/30 transition-all text-left"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0 mr-2">
                        {/* Compound badges */}
                        <div className="flex items-center shrink-0 gap-1.5">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border shadow-inner"
                            style={{
                              backgroundColor: `${activeColor1}20`,
                              color: activeColor1,
                              borderColor: `${activeColor1}50`
                            }}
                          >
                            {itin.line1}
                          </div>
                          <ArrowRight size={12} className="text-slate-600" />
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border shadow-inner"
                            style={{
                              backgroundColor: `${activeColor2}20`,
                              color: activeColor2,
                              borderColor: `${activeColor2}50`
                            }}
                          >
                            {itin.line2}
                          </div>
                        </div>
                        
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-200 text-sm tracking-wide truncate">
                            Corresp. à {itin.transferStop}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                            1 correspondance • {itin.stopCount} stations
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-sm font-black text-slate-200 flex items-center gap-1 justify-end">
                            <Clock size={12} className="text-amber-500" />
                            ~{duration} min
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="bg-slate-950/80 px-4 py-4 border-t border-white/5 space-y-5">
                        
                        {/* LEG 1 */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span 
                              className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shadow-inner"
                              style={{
                                backgroundColor: `${activeColor1}15`,
                                color: activeColor1,
                                borderColor: `${activeColor1}40`
                              }}
                            >
                              Ligne {itin.line1}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Étape 1 : Embarquer
                            </span>
                          </div>

                          <NextLegDepartures stopName={itin.segment1[0]} lineId={itin.line1} />

                          <div className="relative pl-4 border-l-2 ml-2 space-y-4 mt-4" style={{ borderColor: `${activeColor1}40` }}>
                            {itin.segment1.map((stop: string, sIdx: number) => {
                              const isStart = sIdx === 0;
                              const isEnd = sIdx === itin.segment1.length - 1;
                              return (
                                <div key={sIdx} className="relative flex items-center gap-3">
                                  <div 
                                    className="absolute -left-[1.325rem] w-2.5 h-2.5 rounded-full border-2 bg-slate-950"
                                    style={{
                                      borderColor: isStart || isEnd ? activeColor1 : `${activeColor1}60`,
                                      transform: isStart || isEnd ? "scale(1.2)" : "scale(1)"
                                    }}
                                  />
                                  <span className={`text-xs ${isStart || isEnd ? "font-bold text-slate-200" : "text-slate-400"}`}>
                                    {stop}
                                    {isStart && <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1 rounded ml-1.5 uppercase font-black">Départ</span>}
                                    {isEnd && <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1 rounded ml-1.5 uppercase font-black">Correspondance</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* LEG 2 */}
                        <div className="border-t border-white/5 pt-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span 
                              className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shadow-inner"
                              style={{
                                backgroundColor: `${activeColor2}15`,
                                color: activeColor2,
                                borderColor: `${activeColor2}40`
                              }}
                            >
                              Ligne {itin.line2}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Étape 2 : Changer à {itin.transferStop}
                            </span>
                          </div>

                          <NextLegDepartures stopName={itin.transferStop} lineId={itin.line2} />

                          <div className="relative pl-4 border-l-2 ml-2 space-y-4 mt-4" style={{ borderColor: `${activeColor2}40` }}>
                            {itin.segment2.map((stop: string, sIdx: number) => {
                              const isStart = sIdx === 0;
                              const isEnd = sIdx === itin.segment2.length - 1;
                              return (
                                <div key={sIdx} className="relative flex items-center gap-3">
                                  <div 
                                    className="absolute -left-[1.325rem] w-2.5 h-2.5 rounded-full border-2 bg-slate-950"
                                    style={{
                                      borderColor: isStart || isEnd ? activeColor2 : `${activeColor2}60`,
                                      transform: isStart || isEnd ? "scale(1.2)" : "scale(1)"
                                    }}
                                  />
                                  <span className={`text-xs ${isStart || isEnd ? "font-bold text-slate-200" : "text-slate-400"}`}>
                                    {stop}
                                    {isStart && <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1 rounded ml-1.5 uppercase font-black">Embarquer</span>}
                                    {isEnd && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded ml-1.5 uppercase font-black">Arrivée</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              }
            })}
          </div>
        )}
      </main>
    </div>
  );
}
