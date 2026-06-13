import { useState, useEffect, useMemo, useRef } from "react";
import { X, MapPin, Bus } from "lucide-react";
import { getLineColor } from "../lineColors";
import type { Vehicle } from "../LiveMap";

interface BusPanelDetailProps {
  selectedBus: Vehicle;
  staticData: any;
  setSelectedBusId: (id: string | null) => void;
}

const formatBusName = (vehicleId: string) => {
  return vehicleId ? vehicleId.replace("RCR", "") : "";
};

const getVehicleType = (vehicleId: string) => {
  const cleanId = formatBusName(vehicleId);
  const articulatedIds = ["53", "57", "58", "65", "66", "67", "68"];
  return articulatedIds.includes(cleanId) ? "Articulé" : "Standard";
};

export default function BusPanelDetail({
  selectedBus,
  staticData,
  setSelectedBusId,
}: BusPanelDetailProps) {
  const directionRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    if (directionRef.current) {
      const parent = directionRef.current.parentElement;
      if (parent) {
        const diff = directionRef.current.scrollWidth - parent.clientWidth;
        setScrollDistance(diff > 0 ? diff + 12 : 0);
      }
    } else {
      setScrollDistance(0);
    }
  }, [selectedBus?.id, selectedBus?.trip_headsign]);

  const departureStatus = useMemo(() => {
    if (!selectedBus || !staticData?.stops?.length) return null;
    const firstStop = staticData.stops[0];
    const currentSeq = selectedBus.current_stop_sequence || 0;

    if (currentSeq <= firstStop.stop_sequence) {
      const update = selectedBus.stop_time_updates?.find((u: any) => u.stop_id === firstStop.stop_id);
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

  const currentStopInfo = useMemo(() => {
    if (!selectedBus || !staticData?.stops?.length) return null;
    const currentSeq = selectedBus.current_stop_sequence;
    const stop = staticData.stops.find((s: any) => s.stop_sequence === currentSeq);
    return {
      name: stop?.stop_name || null,
      status: selectedBus.current_status // 0: IN_TRANSIT_TO, 1: STOPPED_AT, 2: INCOMING_AT
    };
  }, [selectedBus, staticData]);

  const currentStopDelay = useMemo(() => {
    if (!selectedBus || !staticData?.stops?.length) return null;
    const currentSeq = selectedBus.current_stop_sequence || 0;

    const currentStop = staticData.stops.find((s: any) => s.stop_sequence === currentSeq);
    if (!currentStop) {
      return selectedBus.delay !== undefined ? Math.round(selectedBus.delay / 60) : 0;
    }

    const update = selectedBus.stop_time_updates?.find((u: any) => u.stop_id === currentStop.stop_id);
    const hasUpdate = !!update?.arrival?.time;

    const scheduledTime = currentStop.arrival_time?.slice(0, 5) || "--:--";
    const expectedTime = hasUpdate
      ? new Date((update.arrival!.time as number) * 1000).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
      : null;

    let delayMin = 0;
    if (hasUpdate && expectedTime) {
      if (update.arrival?.delay !== undefined && update.arrival?.delay !== null) {
        delayMin = Math.round(update.arrival.delay / 60);
      } else {
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
      return delayMin;
    }

    return selectedBus.delay !== undefined ? Math.round(selectedBus.delay / 60) : 0;
  }, [selectedBus, staticData]);

  return (
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
                {/* Delay / On-time Status */}
                {departureStatus ? (
                  <span className="px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-400 animate-pulse">
                    Départ {departureStatus.minutes}m
                  </span>
                ) : (
                  <span className={`px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-wider border ${currentStopDelay !== null && currentStopDelay > 0
                      ? "bg-orange-500/15 border-orange-500/30 text-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.15)]"
                      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.15)]"
                    }`}>
                    {currentStopDelay !== null
                      ? currentStopDelay > 0
                        ? `Retard de ${currentStopDelay} min`
                        : currentStopDelay < 0
                          ? `Avance de ${Math.abs(currentStopDelay)} min`
                          : "À l'heure"
                      : "À l'heure"
                    }
                  </span>
                )}
                <span className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-wider ${getVehicleType(selectedBus.vehicle_id || "") === "Articulé"
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
                    className={`absolute left-0 top-0 whitespace-nowrap transition-transform ${scrollDistance > 0 ? "animate-direction-marquee" : ""
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

              {/* Telemetry Row (Live update freshness) */}
              {selectedBus.timestamp && (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[8.5px] md:text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wide">
                  <span className="flex items-center gap-1.5 bg-slate-900/60 border border-white/5 px-2 py-0.5 rounded-lg text-slate-400 font-bold normal-case shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Actualisé {(() => {
                      const ageSec = Math.floor(Date.now() / 1000) - selectedBus.timestamp;
                      if (ageSec < 5) return "à l'instant";
                      if (ageSec < 60) return `il y a ${ageSec}s`;
                      return `il y a ${Math.floor(ageSec / 60)}m`;
                    })()}
                  </span>
                </div>
              )}
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

        {/* Second Row: Real-time stop status */}
        {currentStopInfo?.name && (
          <div className="w-full">
            <span className={`inline-flex w-full items-center gap-1.5 px-2 py-0.5 rounded-md border text-[8px] md:text-[9px] font-black uppercase tracking-widest ${currentStopInfo.status === 1
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

      {/* Scrollable Course Timeline */}
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

            const update = selectedBus.stop_time_updates?.find((u: any) => u.stop_id === stop.stop_id);
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

            let busStyle = {};
            const status = selectedBus.current_status ?? 0;

            if (status === 1) {
              busStyle = { top: "50%", transform: "translateY(-50%)" };
            } else if (status === 2) {
              busStyle = { top: "-8px", transform: "translateY(-50%)" };
            } else {
              busStyle = { top: "-18px", transform: "translateY(-50%)" };
            }

            if (isPassed && stopSeq < currentSeq - 1) return null;

            return (
              <div key={stop.stop_id} className="relative flex items-center justify-between min-h-[26px] md:min-h-[30px] py-0.5 md:py-1">
                {/* Static stop dot */}
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
                      <div className={`text-xs font-black bg-slate-900 border border-white/5 px-2 py-0.5 rounded-lg shadow-inner ${timeColor}`} style={timeColorStyle}>
                        {expectedTime}
                      </div>

                      <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider">
                        <span className="text-slate-400 line-through font-extrabold text-[9px]">
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
  );
}
