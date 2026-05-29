"use client";

import React, { useMemo } from "react";
import { AlertCircle, Clock, Navigation, Bus } from "lucide-react";

// Clean and format bus names (remove RCR prefix)
const formatBusName = (vehicleId: string) => {
  return vehicleId ? vehicleId.replace("RCR", "") : "";
};

// Identify bus type (Standard or Articulé for: 53, 57, 58, 65, 66, 67, 68)
const getVehicleType = (vehicleId: string) => {
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

interface LineTimelineProps {
  stops: Stop[];
  vehicles: Vehicle[];
  lineColor?: string;
}

export default function LineTimeline({ stops, vehicles, lineColor = "#34d399" }: LineTimelineProps) {
  // Associate vehicles with stops
  const stopsWithVehicles = useMemo(() => {
    return stops.map(stop => {
      // Find vehicles that are related to this stop sequence
      const relatedVehicles = vehicles.map(vehicle => {
        const seq = vehicle.current_stop_sequence;
        if (seq === undefined || seq === null) return null;

        if (seq === stop.stop_sequence) {
          const delay = vehicle.delay || 0;
          const isDelayed = delay > 60;
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

          return {
            ...vehicle,
            statusText,
            statusColor,
            delayText: isDelayed ? `+${delayMins} min` : "À l'heure",
            isDelayed,
          };
        }
        return null;
      }).filter((v): v is NonNullable<typeof v> => !!v);

      return {
        ...stop,
        vehicles: relatedVehicles,
      };
    });
  }, [stops, vehicles]);

  return (
    <div className="w-full h-full overflow-y-auto no-scrollbar pb-32">
      <div className="relative w-full max-w-md mx-auto py-6 px-4 min-h-full">
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
                    <span className={`font-semibold text-sm transition-colors ${
                      hasBuses ? 'text-white font-bold' : 'text-slate-400'
                    }`}>
                      {stop.stop_name}
                    </span>
                  </div>

                  {/* Nested Bus Cards */}
                  {hasBuses && (
                    <div className="mt-2 space-y-2 pr-2">
                      {stop.vehicles.map((v: any) => (
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
                              <span className={`px-1 py-0.2 rounded text-[7px] font-black uppercase tracking-wider ${
                                getVehicleType(v.vehicle_id || "") === "Articulé"
                                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                  : "bg-slate-800 border border-slate-700 text-slate-400"
                              }`}>
                                {getVehicleType(v.vehicle_id || "")}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${v.statusColor}`}>
                                {v.statusText}
                              </span>
                            </div>

                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ${
                              v.isDelayed ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                            }`}>
                              <Clock size={10} />
                              {v.delayText}
                            </span>
                          </div>

                          {/* Row 2: Direction info */}
                          {v.trip_headsign && v.trip_headsign !== "Inconnue" && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold border-t border-white/5 pt-1.5 mt-0.5">
                              <Navigation size={10} className="rotate-90 text-slate-500" />
                              <span className="truncate">Direction: {v.trip_headsign}</span>
                            </div>
                          )}
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
