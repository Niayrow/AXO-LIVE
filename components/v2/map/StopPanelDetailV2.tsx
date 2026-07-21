"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bus, Calendar, Clock, MapPin, X } from "lucide-react";
import { getLineColor } from "@/components/lineColors";
import type { Vehicle } from "@/components/LiveMap";

interface StopPanelDetailV2Props {
  selectedStop: any;
  setSelectedStopId: (id: string | null) => void;
  filteredVehicles: Vehicle[];
  setHighlightedBusId: (id: string | null) => void;
  allStops?: any[];
}

const formatBusName = (vehicleId: string) =>
  vehicleId ? vehicleId.replace("RCR", "") : "";

const timeToSeconds = (time: string) => {
  const [h = 0, m = 0, s = 0] = time.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

const getParisTimeString = () =>
  new Date().toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export default function StopPanelDetailV2({
  selectedStop,
  setSelectedStopId,
  filteredVehicles,
  setHighlightedBusId,
  allStops = [],
}: StopPanelDetailV2Props) {
  const siblingStopIds = useMemo(() => {
    if (!selectedStop) return [];
    const sameName = allStops
      .filter((s: any) => s.stop_name === selectedStop.stop_name)
      .map((s: any) => s.stop_id);
    if (sameName.length > 0) return sameName;
    return selectedStop.stop_id ? [selectedStop.stop_id] : [];
  }, [selectedStop, allStops]);

  const { data: scheduleData, isLoading: isScheduleLoading } = useQuery({
    queryKey: ["stopSchedule", "map", selectedStop?.stop_name, siblingStopIds.join(",")],
    queryFn: async () => {
      const res = await fetch(
        `/api/axo/stop-schedule?stop_ids=${siblingStopIds.join(",")}`
      );
      if (!res.ok) throw new Error("Failed to load schedule");
      return res.json();
    },
    enabled: siblingStopIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const upcomingBusesForStop = useMemo(() => {
    if (!selectedStop || !filteredVehicles) return [];
    return filteredVehicles
      .map((v) => {
        const update = v.stop_time_updates?.find((u) =>
          siblingStopIds.includes(u.stop_id)
        );
        if (
          update &&
          v.current_stop_sequence !== undefined &&
          update.stop_sequence >= v.current_stop_sequence
        ) {
          const arrivalTime = update.arrival?.time;
          if (arrivalTime) {
            return {
              vehicle: v,
              arrivalTime,
              etaMinutes: Math.floor(
                (arrivalTime - Math.floor(Date.now() / 1000)) / 60
              ),
            };
          }
        }
        return null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.arrivalTime - b.arrivalTime);
  }, [selectedStop, filteredVehicles, siblingStopIds]);

  const theoreticalNext2Hours = useMemo(() => {
    const schedules = scheduleData?.schedules || [];
    if (schedules.length === 0) return [];

    const nowSec = timeToSeconds(getParisTimeString());
    const endSec = nowSec + 2 * 3600;

    return schedules
      .filter((s: any) => {
        const dep = timeToSeconds(s.departure_time);
        return dep >= nowSec && dep < endSec;
      })
      .sort(
        (a: any, b: any) =>
          timeToSeconds(a.departure_time) - timeToSeconds(b.departure_time)
      );
  }, [scheduleData]);

  return (
    <>
      <div className="flex justify-between items-start shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-om-coral/10 text-om-coral border border-om-coral/20 shrink-0">
            <MapPin size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-om-muted uppercase tracking-wider">
              Arrêt
            </p>
            <h3 className="text-base font-extrabold text-om-charcoal truncate">
              {selectedStop.stop_name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {(selectedStop.lines || []).map((l: string) => (
                <span
                  key={l}
                  className="px-2 py-0.5 rounded-lg text-[9px] font-black text-white"
                  style={{ backgroundColor: getLineColor(l) }}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => setSelectedStopId(null)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-om-surface text-om-muted hover:text-om-charcoal border border-om-border active:scale-95 shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 mt-2">
        {/* Temps réel */}
        <div className="rounded-xl bg-om-surface border border-om-border p-4">
          <h4 className="text-xs font-bold text-om-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Bus size={14} className="text-om-coral" />
            Prochains passages
          </h4>

          <div className="space-y-2">
            {upcomingBusesForStop.length === 0 ? (
              <p className="text-sm text-om-muted text-center py-4">
                Aucun passage prévu dans l&apos;immédiat.
              </p>
            ) : (
              upcomingBusesForStop.map((b: any, index: number) => {
                const isImminent = b.etaMinutes <= 0;
                const color = getLineColor(b.vehicle.route_id);
                const isFirst = index === 0;

                return (
                  <button
                    key={`${b.vehicle.id}-${index}`}
                    onClick={() => setHighlightedBusId(b.vehicle.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left active:scale-[0.99] ${
                      isFirst
                        ? "border-2 shadow-om bg-white"
                        : "bg-white border border-om-border hover:bg-om-surface"
                    }`}
                    style={
                      isFirst
                        ? {
                            borderColor: color,
                            boxShadow: `0 4px 16px ${color}20`,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {b.vehicle.route_id}
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-om-charcoal">
                          Bus {formatBusName(b.vehicle.vehicle_id)}
                        </p>
                        {isFirst && (
                          <span
                            className="text-[9px] font-bold uppercase"
                            style={{ color }}
                          >
                            Prochain passage
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className="text-sm font-extrabold"
                        style={{
                          color: isImminent || isFirst ? color : undefined,
                        }}
                      >
                        {isImminent ? "À l'approche" : `${b.etaMinutes} min`}
                      </p>
                      <p className="text-[10px] text-om-muted">
                        {new Date(b.arrivalTime * 1000).toLocaleTimeString(
                          "fr-FR",
                          {
                            timeZone: "Europe/Paris",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Horaires théoriques — 2 prochaines heures */}
        <div className="rounded-2xl border-2 border-om-charcoal/10 bg-gradient-to-b from-om-surface to-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-om-charcoal uppercase tracking-wider flex items-center gap-2">
              <Calendar size={14} className="text-om-coral" />
              Horaires théoriques
            </h4>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-om-muted bg-white border border-om-border rounded-lg px-2 py-1">
              <Clock size={11} />
              2 h
            </span>
          </div>

          {isScheduleLoading ? (
            <p className="text-sm text-om-muted animate-pulse text-center py-3">
              Chargement des horaires…
            </p>
          ) : theoreticalNext2Hours.length === 0 ? (
            <p className="text-sm text-om-muted text-center py-3 bg-white/70 rounded-xl border border-dashed border-om-border">
              Aucun départ théorique dans les 2 prochaines heures.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {theoreticalNext2Hours.map((sched: any, idx: number) => {
                const color = getLineColor(sched.route_id);
                return (
                  <div
                    key={`${sched.trip_id}-${sched.departure_time}-${idx}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-om-border"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {sched.route_id}
                      </span>
                      <span className="text-xs text-om-muted truncate font-medium">
                        {sched.trip_headsign || "Direction inconnue"}
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-om-charcoal tabular-nums shrink-0">
                      {sched.departure_time.slice(0, 5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
