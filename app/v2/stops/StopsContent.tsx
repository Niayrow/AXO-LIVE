"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  MapPin,
  Clock,
  ChevronDown,
  Filter,
  Calendar,
  Map as MapIcon,
} from "lucide-react";
import { getLineColor } from "@/components/lineColors";
import SectionTitle from "@/components/v2/SectionTitle";

const TARGET_LINES = ["A", "B", "C1", "C2", "D"];

function StopDetails({
  stop,
  realtimeData,
}: {
  stop: any;
  realtimeData: any;
}) {
  const [showAllSchedule, setShowAllSchedule] = useState(false);
  const todayStr = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Paris",
  });
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;

  const { data: scheduleData, isLoading: isScheduleLoading } = useQuery({
    queryKey: ["stopSchedule", stop.stop_name, selectedDate],
    queryFn: async () => {
      const dateParam = isToday ? "" : `&date=${selectedDate}`;
      const res = await fetch(
        `/api/axo/stop-schedule?stop_ids=${stop.stop_ids.join(",")}${dateParam}`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });

  const upcomingBuses = useMemo(() => {
    const vehicles = realtimeData?.vehicles || [];
    const upcoming: any[] = [];
    vehicles.forEach((v: any) => {
      if (!v.stop_time_updates) return;
      const update = v.stop_time_updates.find((u: any) =>
        stop.stop_ids.includes(u.stop_id)
      );
      if (
        update &&
        v.current_stop_sequence !== undefined &&
        update.stop_sequence >= v.current_stop_sequence
      ) {
        const arrivalTime = update.arrival?.time;
        if (arrivalTime) {
          upcoming.push({
            vehicle: v,
            arrivalTime,
            etaMinutes: Math.floor(
              (arrivalTime - Math.floor(Date.now() / 1000)) / 60
            ),
          });
        }
      }
    });
    return upcoming.sort((a, b) => a.arrivalTime - b.arrivalTime);
  }, [realtimeData, stop.stop_ids]);

  const processedSchedules = useMemo(() => {
    const schedules = scheduleData?.schedules || [];
    if (schedules.length === 0) return [];
    if (!isToday || showAllSchedule) return schedules;
    const now = new Date();
    const currentParisTime = now.toLocaleTimeString("fr-FR", {
      timeZone: "Europe/Paris",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return schedules
      .filter((s: any) => s.departure_time >= currentParisTime)
      .slice(0, 4);
  }, [scheduleData, showAllSchedule, isToday]);

  return (
    <div className="px-4 pb-4 border-t border-om-border bg-om-surface/50 space-y-4 pt-4">
      <div>
        <h4 className="text-xs font-bold text-om-green uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Clock size={12} />
          Passages en direct
        </h4>
        {upcomingBuses.length === 0 ? (
          <p className="text-sm text-om-muted bg-white rounded-xl p-3 border border-om-border text-center">
            Aucun passage en direct prévu.
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingBuses.map((b, idx) => {
              const color = getLineColor(b.vehicle.route_id);
              return (
                <div
                  key={`${b.vehicle.id}-${idx}`}
                  className="flex items-center justify-between p-3 bg-white rounded-xl border border-om-border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {b.vehicle.route_id}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-om-charcoal">
                        Bus {b.vehicle.vehicle_id}
                      </p>
                      <p className="text-xs text-om-muted truncate">
                        {b.vehicle.trip_headsign}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="font-extrabold text-sm"
                      style={{ color }}
                    >
                      {b.etaMinutes <= 0
                        ? "À l'approche"
                        : `${b.etaMinutes} min`}
                    </span>
                    <Link
                      href={`/v2/map?bus=${b.vehicle.id}`}
                      className="p-2 rounded-lg bg-om-surface text-om-coral hover:bg-om-coral/10 transition-all"
                    >
                      <MapIcon size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-om-muted uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={12} />
            Horaires théoriques
          </h4>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setShowAllSchedule(false);
            }}
            className="bg-white border border-om-border rounded-lg px-2 py-1 text-xs font-semibold text-om-charcoal focus:outline-none focus:ring-2 focus:ring-om-coral/30"
          />
        </div>

        {isScheduleLoading ? (
          <p className="text-sm text-om-muted animate-pulse text-center py-3">
            Chargement...
          </p>
        ) : processedSchedules.length === 0 ? (
          <p className="text-sm text-om-muted bg-white rounded-xl p-3 border border-om-border text-center">
            Aucun horaire planifié.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {processedSchedules.map((sched: any, idx: number) => {
              const color = getLineColor(sched.route_id);
              return (
                <div
                  key={`${sched.trip_id}-${idx}`}
                  className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-om-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {sched.route_id}
                    </span>
                    <span className="text-[10px] text-om-muted truncate">
                      {sched.trip_headsign}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-om-charcoal">
                    {sched.departure_time.slice(0, 5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {scheduleData?.schedules?.length > 4 && (
          <button
            onClick={() => setShowAllSchedule(!showAllSchedule)}
            className="w-full text-center py-2 text-xs font-bold text-om-coral hover:text-om-coral-dark mt-2"
          >
            {showAllSchedule
              ? "Voir moins"
              : `Voir toute la journée (${scheduleData.schedules.length})`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function StopsContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
  }, [searchParams]);

  const { data: allStopsData, isLoading } = useQuery({
    queryKey: ["allStops"],
    queryFn: async () => {
      const res = await fetch("/api/axo/all-stops");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: Infinity,
  });

  const { data: realtimeData } = useQuery({
    queryKey: ["realtime"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const groupedStops = useMemo(() => {
    const stops = allStopsData?.stops || [];
    const groups = new Map<string, any>();
    stops.forEach((s: any) => {
      if (!groups.has(s.stop_name)) {
        groups.set(s.stop_name, {
          stop_name: s.stop_name,
          stop_ids: [s.stop_id],
          lines: [...(s.lines || [])],
        });
      } else {
        const g = groups.get(s.stop_name);
        g.stop_ids.push(s.stop_id);
        s.lines?.forEach((l: string) => {
          if (!g.lines.includes(l)) g.lines.push(l);
        });
      }
    });
    return Array.from(groups.values())
      .map((g) => {
        g.lines.sort(
          (a: string, b: string) =>
            TARGET_LINES.indexOf(a) - TARGET_LINES.indexOf(b)
        );
        return g;
      })
      .sort((a, b) => a.stop_name.localeCompare(b.stop_name));
  }, [allStopsData]);

  const filteredStops = useMemo(() => {
    let result = groupedStops;
    if (selectedLine) {
      result = result.filter((s) => s.lines.includes(selectedLine));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        s.stop_name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [groupedStops, selectedLine, search]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 v2-animate-in">
      <SectionTitle title="Horaires aux arrêts" />

      <div className="relative mb-4">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-om-muted"
        />
        <input
          type="text"
          placeholder="Rechercher un arrêt..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-om-border rounded-om shadow-om text-sm font-semibold placeholder-om-muted/60 focus:outline-none focus:ring-2 focus:ring-om-coral/30"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-5 pb-1">
        <button
          onClick={() => setSelectedLine(null)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 border ${
            selectedLine === null
              ? "bg-om-coral text-white border-om-coral"
              : "bg-white text-om-muted border-om-border hover:border-om-coral/30"
          }`}
        >
          <Filter size={10} />
          Tous
        </button>
        {TARGET_LINES.map((lineId) => {
          const color = getLineColor(lineId);
          const isSelected = selectedLine === lineId;
          return (
            <button
              key={lineId}
              onClick={() => setSelectedLine(isSelected ? null : lineId)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border"
              style={{
                backgroundColor: isSelected ? color : "white",
                color: isSelected ? "white" : color,
                borderColor: isSelected ? color : `${color}40`,
              }}
            >
              {lineId}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-8 h-8 border-3 border-om-coral border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-om-muted text-sm font-semibold">
            Chargement des arrêts...
          </p>
        </div>
      ) : filteredStops.length === 0 ? (
        <p className="text-center py-12 text-om-muted text-sm">
          Aucun arrêt trouvé
        </p>
      ) : (
        <div className="space-y-2">
          {filteredStops.map((stop) => {
            const isExpanded = expandedStopId === stop.stop_name;
            return (
              <div
                key={stop.stop_name}
                className="bg-white rounded-om border border-om-border shadow-om overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedStopId(isExpanded ? null : stop.stop_name)
                  }
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-om-surface/50 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isExpanded
                          ? "bg-om-coral/10 text-om-coral"
                          : "bg-om-surface text-om-muted"
                      }`}
                    >
                      <MapPin size={16} />
                    </div>
                    <span className="font-extrabold text-sm text-om-charcoal truncate">
                      {stop.stop_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex gap-1">
                      {stop.lines.map((l: string) => (
                        <span
                          key={l}
                          className="px-1.5 py-0.5 rounded text-[8px] font-black text-white"
                          style={{ backgroundColor: getLineColor(l) }}
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-om-muted transition-transform ${
                        isExpanded ? "rotate-180 text-om-coral" : ""
                      }`}
                    />
                  </div>
                </button>
                {isExpanded && (
                  <StopDetails stop={stop} realtimeData={realtimeData} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
