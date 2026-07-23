"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { X, MapPin, Bus } from "lucide-react";
import { getLineColor } from "@/components/lineColors";
import type { Vehicle } from "@/components/LiveMap";
import { estimateBusProgress } from "@/components/v2/LineTimelineV2";

interface BusPanelDetailV2Props {
  selectedBus: Vehicle;
  staticData: any;
  setSelectedBusId: (id: string | null) => void;
  onStopClick?: (stop: { stop_id: string; stop_lat?: number; stop_lon?: number }) => void;
  focusedStopId?: string | null;
}

const formatBusName = (vehicleId: string) =>
  vehicleId ? vehicleId.replace("RCR", "") : "";

const getVehicleType = (vehicleId: string) => {
  const cleanId = formatBusName(vehicleId);
  return ["53", "57", "58", "65", "66", "67", "68"].includes(cleanId)
    ? "Articulé"
    : "Standard";
};

export default function BusPanelDetailV2({
  selectedBus,
  staticData,
  setSelectedBusId,
  onStopClick,
  focusedStopId = null,
}: BusPanelDetailV2Props) {
  const directionRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const lineColor = getLineColor(selectedBus.route_id);

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
      const update = selectedBus.stop_time_updates?.find(
        (u: any) => u.stop_id === firstStop.stop_id
      );
      const departureTime = update?.departure?.time || update?.arrival?.time;
      if (departureTime) {
        const diffSeconds = departureTime - Math.floor(Date.now() / 1000);
        if (diffSeconds > 0) {
          return { minutes: Math.max(1, Math.round(diffSeconds / 60)), isWaiting: true };
        }
      }
    }
    return null;
  }, [selectedBus, staticData]);

  const currentStopInfo = useMemo(() => {
    if (!selectedBus || !staticData?.stops?.length) return null;
    const currentSeq = selectedBus.current_stop_sequence;
    const stop = staticData.stops.find((s: any) => s.stop_sequence === currentSeq);
    return { name: stop?.stop_name || null, status: selectedBus.current_status };
  }, [selectedBus, staticData]);

  const currentStopDelay = useMemo(() => {
    if (!selectedBus || !staticData?.stops?.length) return null;
    const currentSeq = selectedBus.current_stop_sequence || 0;
    const currentStop = staticData.stops.find((s: any) => s.stop_sequence === currentSeq);
    if (!currentStop) {
      return selectedBus.delay !== undefined ? Math.round(selectedBus.delay / 60) : 0;
    }
    const update = selectedBus.stop_time_updates?.find(
      (u: any) => u.stop_id === currentStop.stop_id
    );
    if (update?.arrival?.time) {
      if (update.arrival?.delay !== undefined && update.arrival?.delay !== null) {
        return Math.round(update.arrival.delay / 60);
      }
    }
    return selectedBus.delay !== undefined ? Math.round(selectedBus.delay / 60) : 0;
  }, [selectedBus, staticData]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 2000);
    return () => window.clearInterval(id);
  }, []);

  const busProgress = useMemo(() => {
    if (!selectedBus || !staticData?.stops?.length) {
      return { progress: 1, atStop: true };
    }
    return estimateBusProgress(
      selectedBus,
      staticData.stops,
      Math.floor(nowMs / 1000)
    );
  }, [selectedBus, staticData, nowMs]);

  return (
    <>
      <div className="flex flex-col gap-2 shrink-0 pb-3 border-b border-om-border">
        <div className="flex justify-between items-center w-full gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-base text-white shrink-0 shadow-sm"
              style={{ backgroundColor: lineColor }}
            >
              {selectedBus.route_id || "B"}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base font-extrabold text-om-charcoal">
                  Bus {formatBusName(selectedBus.vehicle_id || "Inconnu")}
                </h3>
                {departureStatus ? (
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase bg-om-coral/10 border border-om-coral/30 text-om-coral animate-pulse">
                    Départ {departureStatus.minutes}m
                  </span>
                ) : (
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border ${
                      currentStopDelay !== null && currentStopDelay > 0
                        ? "bg-om-coral/10 border-om-coral/30 text-om-coral"
                        : "bg-om-green-light border-om-green/30 text-om-green"
                    }`}
                  >
                    {currentStopDelay !== null
                      ? currentStopDelay > 0
                        ? `Retard ${currentStopDelay} min`
                        : currentStopDelay < 0
                          ? `Avance ${Math.abs(currentStopDelay)} min`
                          : "À l'heure"
                      : "À l'heure"}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase bg-om-surface border border-om-border text-om-muted">
                  {getVehicleType(selectedBus.vehicle_id || "")}
                </span>
              </div>
              <div className="text-xs font-semibold text-om-muted flex items-center gap-1 overflow-hidden">
                <span className="shrink-0">Direction :</span>
                <div className="relative overflow-hidden flex-1">
                  <div
                    ref={directionRef}
                    className={`whitespace-nowrap ${scrollDistance > 0 ? "animate-direction-marquee" : ""}`}
                    style={
                      scrollDistance > 0
                        ? ({ "--scroll-dist": `-${scrollDistance}px` } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <span className="font-extrabold text-om-coral uppercase">
                      {selectedBus.trip_headsign || "Sans voyageurs"}
                    </span>
                  </div>
                </div>
              </div>
              {selectedBus.timestamp && (
                <span className="flex items-center gap-1.5 text-[10px] text-om-muted font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-om-green animate-pulse" />
                  Actualisé{" "}
                  {(() => {
                    const ageSec = Math.floor(Date.now() / 1000) - selectedBus.timestamp!;
                    if (ageSec < 5) return "à l'instant";
                    if (ageSec < 60) return `il y a ${ageSec}s`;
                    return `il y a ${Math.floor(ageSec / 60)}m`;
                  })()}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setSelectedBusId(null)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-om-surface hover:bg-om-border text-om-muted hover:text-om-charcoal transition-all border border-om-border active:scale-95 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {currentStopInfo?.name && (
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${
              currentStopInfo.status === 1
                ? "bg-om-green-light border-om-green/30 text-om-green"
                : "bg-om-coral/10 border-om-coral/30 text-om-coral"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {currentStopInfo.status === 1
              ? "À l'arrêt"
              : currentStopInfo.status === 2
                ? "En approche de"
                : "En route vers"}{" "}
            : {currentStopInfo.name}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar rounded-xl bg-om-surface border border-om-border p-4 mt-1">
        <h4 className="text-[10px] font-black text-om-muted uppercase tracking-widest mb-3 flex items-center gap-1.5 border-b border-om-border pb-2">
          <MapPin size={12} className="text-om-coral" />
          Trajet en temps réel
        </h4>

        <div className="relative pl-6 border-l-2 border-om-border space-y-3">
          {!staticData?.stops && (
            <div className="text-om-muted text-xs animate-pulse">Chargement...</div>
          )}

          {staticData?.stops?.map((stop: any) => {
            const currentSeq = selectedBus.current_stop_sequence || 0;
            const stopSeq = stop.stop_sequence;
            const isPassed = stopSeq < currentSeq;
            const isTarget = stopSeq === currentSeq;
            if (isPassed && stopSeq < currentSeq - 1) return null;

            const update = selectedBus.stop_time_updates?.find(
              (u: any) => u.stop_id === stop.stop_id
            );
            const expectedTime = update?.arrival?.time
              ? new Date(update.arrival.time * 1000).toLocaleTimeString("fr-FR", {
                  timeZone: "Europe/Paris",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;
            const scheduledTime = stop.arrival_time?.slice(0, 5) || "--:--";

            let showBus = false;
            let busTop = "50%";
            if (busProgress.atStop && isTarget) {
              showBus = true;
              busTop = "50%";
            } else if (isTarget && !busProgress.atStop) {
              showBus = true;
              const px = -28 + busProgress.progress * 28;
              busTop = `${px}px`;
            }

            return (
              <button
                type="button"
                key={stop.stop_id}
                onClick={() => onStopClick?.(stop)}
                className={`relative flex items-center justify-between min-h-[32px] w-full text-left rounded-lg transition-colors ${
                  onStopClick
                    ? "cursor-pointer hover:bg-om-coral/5 active:bg-om-coral/10 -mx-1 px-1"
                    : ""
                } ${
                  focusedStopId === stop.stop_id
                    ? "bg-om-coral/10 ring-1 ring-om-coral/20"
                    : ""
                }`}
              >
                <div
                  className={`absolute -left-[29px] w-3 h-3 rounded-full border-2 z-10 ${
                    isPassed
                      ? "bg-om-border border-om-muted/30"
                      : isTarget
                        ? "animate-pulse"
                        : "bg-white border-om-border"
                  }`}
                  style={
                    isTarget || focusedStopId === stop.stop_id
                      ? { backgroundColor: lineColor, borderColor: lineColor }
                      : undefined
                  }
                />
                {showBus && (
                  <div
                    className="absolute -left-[34px] w-6 h-6 rounded-full flex items-center justify-center z-20 border-2 bg-white transition-all duration-700 ease-linear pointer-events-none"
                    style={{
                      borderColor: lineColor,
                      color: lineColor,
                      top: busTop,
                      transform: "translateY(-50%)",
                    }}
                  >
                    <Bus size={11} />
                  </div>
                )}
                <span
                  className={`text-sm font-semibold truncate pr-3 ${
                    isPassed
                      ? "text-om-muted line-through"
                      : isTarget || focusedStopId === stop.stop_id
                        ? "font-extrabold"
                        : "text-om-charcoal"
                  }`}
                  style={
                    isTarget || focusedStopId === stop.stop_id
                      ? { color: lineColor }
                      : undefined
                  }
                >
                  {stop.stop_name}
                </span>
                <span
                  className={`text-xs font-extrabold px-2 py-0.5 rounded-lg border shrink-0 ${
                    isPassed
                      ? "text-om-muted border-om-border bg-om-surface"
                      : "bg-white border-om-border"
                  }`}
                  style={
                    isTarget || focusedStopId === stop.stop_id
                      ? { color: lineColor, borderColor: `${lineColor}40` }
                      : undefined
                  }
                >
                  {expectedTime || scheduledTime}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
