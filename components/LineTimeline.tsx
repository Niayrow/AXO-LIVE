"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Clock, Navigation, Bus, Map } from "lucide-react";

// Clean and format bus names (remove RCR prefix)
const formatBusName = (vehicleId: string): string => {
  return vehicleId ? vehicleId.replace("RCR", "") : "";
};

// Identify bus type (Standard or Articulé for: 53, 57, 58, 65, 66, 67, 68)
const getVehicleType = (vehicleId: string): string => {
  const cleanId = formatBusName(vehicleId);
  const articulatedIds = ["53", "57", "58", "65", "66", "67", "68"];
  return articulatedIds.includes(cleanId) ? "Articulé" : "Standard";
};

export interface Stop {
  stop_id: string;
  stop_name: string;
  stop_sequence: number;
}

export interface Vehicle {
  id: string;
  vehicle_id: string;
  route_id?: string;
  stop_id?: string;
  current_stop_sequence?: number;
  current_status?: number; // 0: IN_TRANSIT_TO, 1: STOPPED_AT, 2: INCOMING_AT
  delay?: number;
  trip_headsign?: string;
}

interface EnrichedVehicle extends Vehicle {
  statusText: string;
  statusColor: string;
  delayText: string;
  isDelayed: boolean;
}

interface LineTimelineProps {
  stops: Stop[];
  vehicles: Vehicle[];
  lineColor?: string;
}

export default function LineTimeline({ stops, vehicles, lineColor = "#34d399" }: LineTimelineProps) {
  const router = useRouter();

  // OPTIMISATION DES PERFORMANCES : Groupement O(1) des véhicules par séquence d'arrêt
  const stopsWithVehicles = useMemo(() => {
    const vehiclesBySequence = new window.Map<number, EnrichedVehicle[]>();

    vehicles.forEach((vehicle) => {
      const seq = vehicle.current_stop_sequence;
      if (seq === undefined || seq === null) return;

      const delay = vehicle.delay || 0;
      const isDelayed = delay >= 300; // Aligné avec createBusIcon (5 minutes)
      const delayMins = Math.round(delay / 60);

      let statusText = "En route";
      let statusColor = "text-sky-400 bg-sky-500/10 border-sky-500/20";

      if (vehicle.current_status === 1) {
        statusText = "À l'arrêt";
        statusColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      } else if (vehicle.current_status === 2) {
        statusText = "En approche";
        statusColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
      }

      const enriched: EnrichedVehicle = {
        ...vehicle,
        statusText,
        statusColor,
        delayText: isDelayed ? `Retard de ${delayMins} min` : "À l'heure",
        isDelayed,
      };

      if (!vehiclesBySequence.has(seq)) {
        vehiclesBySequence.set(seq, []);
      }
      vehiclesBySequence.get(seq)!.push(enriched);
    });

    // Association instantanée sans sous-boucle lourde .map().find()
    return stops.map((stop) => ({
      ...stop,
      vehicles: vehiclesBySequence.get(stop.stop_sequence) || [],
    }));
  }, [stops, vehicles]);

  return (
    // OPTIMISATION MOBILE : Défilement fluide iOS/Android tactile et conteneur adapté aux écrans mobiles
    <div className="w-full h-full overflow-y-auto no-scrollbar pb-24 touch-pan-y selection:bg-transparent">
      <div className="relative w-full max-w-md mx-auto py-4 px-4 min-h-full">
        <div className="relative">

          {/* Vertical timeline line - placed safely on the left */}
          <div
            className="absolute left-[15px] top-3 bottom-3 w-[2px] bg-white/10 rounded-full"
          />

          {/* Stops List */}
          <div className="space-y-3">
            {stopsWithVehicles.map((stop) => {
              const hasBuses = stop.vehicles.length > 0;
              const hasBusStopped = stop.vehicles.some(v => v.current_status === 1);

              return (
                <div key={stop.stop_id} className="relative pl-8 min-h-[44px] flex flex-col justify-start">

                  {/* Stop Dot / Bus Icon */}
                  <div
                    className="absolute z-10 flex items-center justify-center transition-all duration-300"
                    style={
                      hasBuses
                        ? { left: "1px", top: "-1px", width: 28, height: 28 }
                        : { left: "11px", top: "7px", width: 10, height: 10 }
                    }
                  >
                    {hasBusStopped && (
                      <div className="absolute inset-0 -m-1 rounded-full bg-emerald-400/40 animate-ping" />
                    )}
                    {hasBuses && !hasBusStopped && (
                      <div
                        className="absolute inset-0 -m-1 rounded-full animate-ping opacity-35"
                        style={{ backgroundColor: lineColor }}
                      />
                    )}

                    {hasBuses ? (
                      /* Glowing Bus Icon Circle */
                      <div
                        className="relative flex items-center justify-center w-7 h-7 rounded-full border-2 bg-slate-950 shadow-lg"
                        style={{
                          color: hasBusStopped ? "#34d399" : lineColor,
                          borderColor: hasBusStopped ? "#34d399" : lineColor,
                          boxShadow: `0 0 10px ${hasBusStopped ? "#34d399" : lineColor}50`
                        }}
                      >
                        <Bus size={12} className="stroke-[2.5]" />
                      </div>
                    ) : (
                      /* Standard Stop Dot */
                      <div className="relative w-[10px] h-[10px] bg-slate-950 border-2 border-slate-600 rounded-full" />
                    )}
                  </div>

                  {/* Stop Details */}
                  <div className="flex flex-col justify-center py-0.5">
                    <span className={`font-semibold text-sm transition-colors ${hasBuses ? 'text-white font-bold' : 'text-slate-400'
                      }`}>
                      {stop.stop_name}
                    </span>
                  </div>

                  {/* Nested Bus Cards */}
                  {hasBuses && (
                    <div className="mt-2 space-y-2 pr-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      {stop.vehicles.map((v: EnrichedVehicle) => (
                        <div
                          key={v.id}
                          className="flex flex-col gap-2 p-3 bg-slate-900/60 hover:bg-slate-900 border border-white/5 rounded-2xl shadow-lg backdrop-blur-md transition-colors"
                        >
                          {/* Row 1: Bus ID & Status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="flex items-center justify-center px-2 py-0.5 rounded-lg font-black text-[10px] border tracking-wider"
                                style={{
                                  backgroundColor: `${lineColor}15`,
                                  color: lineColor,
                                  borderColor: `${lineColor}30`
                                }}
                              >
                                BUS {formatBusName(v.vehicle_id)}
                              </span>
                              <span className={`px-1 py-0.2 rounded text-[7px] font-black uppercase tracking-wider ${getVehicleType(v.vehicle_id || "") === "Articulé"
                                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                  : "bg-slate-800 border border-slate-700 text-slate-400"
                                }`}>
                                {getVehicleType(v.vehicle_id || "")}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${v.statusColor}`}>
                                {v.statusText}
                              </span>
                            </div>

                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ${v.isDelayed ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                              }`}>
                              <Clock size={10} />
                              {v.delayText}
                            </span>
                          </div>

                          {/* Row 2: Direction info & Voir sur la carte button */}
                          <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-2 mt-1">
                            {v.trip_headsign && v.trip_headsign !== "Inconnue" ? (
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold truncate flex-1 min-w-0 pr-1">
                                <Navigation size={10} className="rotate-90 text-slate-500 shrink-0" />
                                <span className="truncate">Direction: {v.trip_headsign}</span>
                              </div>
                            ) : (
                              <div className="flex-1" />
                            )}

                            <button
                              onClick={() => {
                                router.push(`/map?bus=${v.id}`);
                              }}
                              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500 border border-amber-500/20 hover:border-amber-400 text-amber-400 hover:text-slate-950 font-bold text-[9px] uppercase tracking-wider transition-all duration-200 active:scale-95 hover:scale-105 shadow-sm cursor-pointer"
                            >
                              <Map size={10} />
                              Voir sur la carte
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}