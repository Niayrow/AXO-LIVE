import { useMemo } from "react";
import { Bus, MapPin, X } from "lucide-react";
import { getLineColor } from "../lineColors";
import type { Vehicle } from "../LiveMap";

interface StopPanelDetailProps {
  selectedStop: any;
  setSelectedStopId: (id: string | null) => void;
  filteredVehicles: Vehicle[];
  setHighlightedBusId: (id: string | null) => void;
}

const formatBusName = (vehicleId: string) => {
  return vehicleId ? vehicleId.replace("RCR", "") : "";
};

const getVehicleType = (vehicleId: string) => {
  const cleanId = formatBusName(vehicleId);
  const articulatedIds = ["53", "57", "58", "65", "66", "67", "68"];
  return articulatedIds.includes(cleanId) ? "Articulé" : "Standard";
};

export default function StopPanelDetail({
  selectedStop,
  setSelectedStopId,
  filteredVehicles,
  setHighlightedBusId,
}: StopPanelDetailProps) {
  const upcomingBusesForStop = useMemo(() => {
    if (!selectedStop || !filteredVehicles) return [];
    return filteredVehicles
      .map((v) => {
        const update = v.stop_time_updates?.find((u) => u.stop_id === selectedStop.stop_id);
        if (update && v.current_stop_sequence !== undefined && update.stop_sequence >= v.current_stop_sequence) {
          const arrivalTime = update.arrival?.time;
          if (arrivalTime) {
            const etaSeconds = arrivalTime - Math.floor(Date.now() / 1000);
            return {
              vehicle: v,
              arrivalTime,
              etaMinutes: Math.floor(etaSeconds / 60),
            };
          }
        }
        return null;
      })
      .filter((item): item is { vehicle: Vehicle; arrivalTime: number; etaMinutes: number } => item !== null)
      .sort((a, b) => a.arrivalTime - b.arrivalTime);
  }, [selectedStop, filteredVehicles]);

  return (
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
                      backgroundColor: `${lineColor}15`,
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
                  style={
                    isFirst
                      ? {
                          backgroundColor: `${activeColor}15`,
                          borderColor: activeColor,
                          boxShadow: `0 0 16px ${activeColor}25`,
                        }
                      : {}
                  }
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <div
                      className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs border shadow-inner shrink-0"
                      style={{
                        backgroundColor: `${activeColor}33`,
                        color: activeColor,
                        borderColor: `${activeColor}80`,
                      }}
                    >
                      {b.vehicle.route_id || "B"}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-200">
                          Bus {formatBusName(b.vehicle.vehicle_id || "Inconnu")}
                        </span>
                        <span
                          className={`px-1 py-0.2 rounded text-[7px] font-black uppercase tracking-wider ${
                            getVehicleType(b.vehicle.vehicle_id || "") === "Articulé"
                              ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                              : "bg-slate-800 border border-slate-700 text-slate-400"
                          }`}
                        >
                          {getVehicleType(b.vehicle.vehicle_id || "")}
                        </span>
                        {isFirst && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse"
                            style={{
                              backgroundColor: `${activeColor}25`,
                              color: activeColor,
                            }}
                          >
                            PROCHAIN
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-sm font-bold"
                      style={
                        isImminent
                          ? {
                              color: activeColor,
                              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                            }
                          : { color: isFirst ? "#ffffff" : "#cbd5e1" }
                      }
                    >
                      {isImminent ? "À l'approche" : `${b.etaMinutes} min`}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(b.arrivalTime * 1000).toLocaleTimeString("fr-FR", {
                        timeZone: "Europe/Paris",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
