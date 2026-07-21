"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Navigation, Bus, Map as MapIcon } from "lucide-react";

const formatBusName = (vehicleId: string): string =>
  vehicleId ? vehicleId.replace("RCR", "") : "";

const getVehicleType = (vehicleId: string): string => {
  const cleanId = formatBusName(vehicleId);
  return ["53", "57", "58", "65", "66", "67", "68"].includes(cleanId)
    ? "Articulé"
    : "Standard";
};

export interface Stop {
  stop_id: string;
  stop_name: string;
  stop_sequence: number;
}

export interface StopTimeUpdate {
  stop_sequence?: number;
  stop_id?: string;
  arrival?: { time?: number; delay?: number } | null;
  departure?: { time?: number; delay?: number } | null;
}

export interface Vehicle {
  id: string;
  vehicle_id: string;
  route_id?: string;
  stop_id?: string;
  current_stop_sequence?: number;
  current_status?: number;
  delay?: number;
  trip_headsign?: string;
  stop_time_updates?: StopTimeUpdate[];
  timestamp?: number;
}

interface EnrichedVehicle extends Vehicle {
  statusText: string;
  statusClass: string;
  delayText: string;
  isDelayed: boolean;
  /** 0 = départ arrêt précédent, 1 = arrivée arrêt cible */
  progress: number;
  atStop: boolean;
  fromStopId: string | null;
  toStopId: string | null;
}

interface LineTimelineV2Props {
  stops: Stop[];
  vehicles: Vehicle[];
  lineColor?: string;
}

/**
 * Estime la progression du bus entre l'arrêt précédent et l'arrêt courant
 * à partir du statut GTFS-RT + horaires prédits (stop_time_updates).
 */
export function estimateBusProgress(
  vehicle: Vehicle,
  stops: Stop[],
  nowSec: number
): {
  progress: number;
  atStop: boolean;
  fromStop: Stop | null;
  toStop: Stop | null;
} {
  const seq = vehicle.current_stop_sequence;
  const status = vehicle.current_status ?? 0;

  if (seq === undefined || seq === null || stops.length === 0) {
    return { progress: 0, atStop: true, fromStop: null, toStop: null };
  }

  const toIdx = stops.findIndex((s) => s.stop_sequence === seq);
  const toStop = toIdx >= 0 ? stops[toIdx] : null;
  const fromStop = toIdx > 0 ? stops[toIdx - 1] : null;

  // STOPPED_AT
  if (status === 1) {
    return { progress: 1, atStop: true, fromStop, toStop };
  }

  // Pas d'arrêt précédent connu → collé à la cible
  if (!fromStop || !toStop) {
    return {
      progress: status === 2 ? 0.9 : 0.5,
      atStop: false,
      fromStop,
      toStop,
    };
  }

  const updates = vehicle.stop_time_updates || [];
  const prevU =
    updates.find((u) => u.stop_id === fromStop.stop_id) ||
    updates.find((u) => u.stop_sequence === fromStop.stop_sequence);
  const nextU =
    updates.find((u) => u.stop_id === toStop.stop_id) ||
    updates.find((u) => u.stop_sequence === toStop.stop_sequence);

  const t0 =
    prevU?.departure?.time ||
    prevU?.arrival?.time ||
    null;
  const t1 =
    nextU?.arrival?.time ||
    nextU?.departure?.time ||
    null;

  if (t0 && t1 && t1 > t0) {
    const raw = (nowSec - t0) / (t1 - t0);
    const minP = status === 2 ? 0.75 : 0.05;
    const maxP = status === 2 ? 0.97 : 0.95;
    return {
      progress: Math.min(maxP, Math.max(minP, raw)),
      atStop: false,
      fromStop,
      toStop,
    };
  }

  // Seulement l'heure d'arrivée connue → progression depuis l'ETA
  if (t1) {
    const eta = t1 - nowSec;
    const assumedSegmentSec = 120;
    const raw = 1 - eta / assumedSegmentSec;
    const minP = status === 2 ? 0.75 : 0.08;
    const maxP = 0.95;
    return {
      progress: Math.min(maxP, Math.max(minP, raw)),
      atStop: false,
      fromStop,
      toStop,
    };
  }

  // Fallback heuristique selon le statut
  if (status === 2) {
    return { progress: 0.88, atStop: false, fromStop, toStop };
  }

  // IN_TRANSIT_TO : avance douce selon l'âge du dernier message RT
  const ageSec = vehicle.timestamp
    ? Math.max(0, nowSec - vehicle.timestamp)
    : 0;
  const drift = Math.min(0.35, ageSec / 180);
  return {
    progress: Math.min(0.85, 0.35 + drift),
    atStop: false,
    fromStop,
    toStop,
  };
}

function enrichVehicle(
  vehicle: Vehicle,
  stops: Stop[],
  nowSec: number
): EnrichedVehicle | null {
  const seq = vehicle.current_stop_sequence;
  if (seq === undefined || seq === null) return null;

  const delay = vehicle.delay || 0;
  const isDelayed = delay >= 300;
  const delayMins = Math.round(delay / 60);
  const { progress, atStop, fromStop, toStop } = estimateBusProgress(
    vehicle,
    stops,
    nowSec
  );

  let statusText = "Entre deux arrêts";
  let statusClass =
    "text-om-charcoal bg-om-surface border-om-border";

  if (vehicle.current_status === 1) {
    statusText = "À l'arrêt";
    statusClass = "text-om-green bg-om-green-light border-om-green/30";
  } else if (vehicle.current_status === 2) {
    statusText = "En approche";
    statusClass = "text-om-coral bg-om-coral/10 border-om-coral/30";
  } else {
    statusText = "En circulation";
    statusClass = "text-om-charcoal bg-om-surface border-om-border";
  }

  return {
    ...vehicle,
    statusText,
    statusClass,
    delayText: isDelayed ? `Retard ${delayMins} min` : "À l'heure",
    isDelayed,
    progress,
    atStop,
    fromStopId: fromStop?.stop_id ?? null,
    toStopId: toStop?.stop_id ?? null,
  };
}

function BusMarker({
  color,
  atStop,
  size = 28,
}: {
  color: string;
  atStop: boolean;
  size?: number;
}) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full border-2 bg-white shadow-om transition-all duration-700 ease-linear"
      style={{
        width: size,
        height: size,
        color: atStop ? "#3A7D5C" : color,
        borderColor: atStop ? "#3A7D5C" : color,
        boxShadow: `0 2px 10px ${atStop ? "rgba(58,125,92,0.25)" : `${color}35`}`,
      }}
    >
      <div
        className="absolute inset-0 -m-1 rounded-full animate-ping opacity-25"
        style={{ backgroundColor: atStop ? "#3A7D5C" : color }}
      />
      <Bus size={size > 24 ? 13 : 11} strokeWidth={2.5} className="relative z-[1]" />
    </div>
  );
}

function VehicleCard({
  v,
  lineColor,
  onMap,
}: {
  v: EnrichedVehicle;
  lineColor: string;
  onMap: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 p-3.5 bg-om-surface hover:bg-white border border-om-border rounded-om shadow-sm hover:shadow-om transition-all">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="flex items-center justify-center px-2.5 py-1 rounded-lg font-black text-[10px] text-white tracking-wider"
            style={{ backgroundColor: lineColor }}
          >
            BUS {formatBusName(v.vehicle_id)}
          </span>
          <span className="px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider bg-white border border-om-border text-om-muted">
            {getVehicleType(v.vehicle_id || "")}
          </span>
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${v.statusClass}`}
          >
            {v.statusText}
          </span>
          {!v.atStop && (
            <span
              className="inline-flex items-center w-14 h-1.5 rounded-full bg-om-border overflow-hidden"
              title="Progression vers le prochain arrêt"
              aria-hidden
            >
              <span
                className="h-full rounded-full transition-all duration-700 ease-linear"
                style={{
                  width: `${Math.round(v.progress * 100)}%`,
                  backgroundColor: lineColor,
                }}
              />
            </span>
          )}
        </div>
        <span
          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0 ${
            v.isDelayed
              ? "bg-om-coral/10 text-om-coral border border-om-coral/20"
              : "bg-om-green-light text-om-green border border-om-green/20"
          }`}
        >
          <Clock size={10} />
          {v.delayText}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-om-border pt-2.5">
        {v.trip_headsign && v.trip_headsign !== "Inconnue" ? (
          <div className="flex items-center gap-1.5 text-[11px] text-om-muted font-semibold truncate flex-1 min-w-0">
            <Navigation size={11} className="rotate-90 text-om-coral shrink-0" />
            <span className="truncate">{v.trip_headsign}</span>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <button
          onClick={onMap}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-om-coral hover:bg-om-coral-dark border border-om-coral text-white font-bold text-[9px] uppercase tracking-wider transition-all active:scale-95 shadow-sm cursor-pointer"
        >
          <MapIcon size={10} />
          Carte
        </button>
      </div>
    </div>
  );
}

export default function LineTimelineV2({
  stops,
  vehicles,
  lineColor = "#E8574A",
}: LineTimelineV2Props) {
  const router = useRouter();
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Recalcule la progression entre deux polls RT (~20s)
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 2000);
    return () => window.clearInterval(id);
  }, []);

  const enriched = useMemo(() => {
    const nowSec = Math.floor(nowMs / 1000);
    return vehicles
      .map((v) => enrichVehicle(v, stops, nowSec))
      .filter(Boolean) as EnrichedVehicle[];
  }, [vehicles, stops, nowMs]);

  const byStopId = useMemo(() => {
    const atStop = new Map<string, EnrichedVehicle[]>();
    const inSegmentTo = new Map<string, EnrichedVehicle[]>();

    enriched.forEach((v) => {
      if (v.atStop && v.toStopId) {
        if (!atStop.has(v.toStopId)) atStop.set(v.toStopId, []);
        atStop.get(v.toStopId)!.push(v);
      } else if (v.toStopId) {
        if (!inSegmentTo.has(v.toStopId)) inSegmentTo.set(v.toStopId, []);
        inSegmentTo.get(v.toStopId)!.push(v);
      }
    });

    return { atStop, inSegmentTo };
  }, [enriched]);

  return (
    <div className="w-full overflow-y-auto no-scrollbar pb-4 touch-pan-y">
      <div className="relative w-full py-2">
        <div
          className="absolute left-[15px] top-2 bottom-2 w-[3px] rounded-full"
          style={{ backgroundColor: `${lineColor}30` }}
        />

        <div className="space-y-0">
          {stops.map((stop, index) => {
            const stoppedHere = byStopId.atStop.get(stop.stop_id) || [];
            const approachingHere =
              byStopId.inSegmentTo.get(stop.stop_id) || [];
            const hasStopped = stoppedHere.length > 0;

            return (
              <div key={stop.stop_id} className="relative">
                {/* Segment entre arrêt précédent → cet arrêt */}
                {index > 0 && (
                  <div className="relative pl-10 h-14">
                    {approachingHere.map((v) => (
                      <div
                        key={`seg-${v.id}`}
                        className="absolute z-20 transition-all duration-700 ease-linear"
                        style={{
                          left: "2px",
                          top: `${Math.max(8, Math.min(92, v.progress * 100))}%`,
                          transform: "translateY(-50%)",
                        }}
                        title={`Bus ${formatBusName(v.vehicle_id)}`}
                      >
                        <BusMarker color={lineColor} atStop={false} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Arrêt */}
                <div className="relative pl-10 min-h-[44px] flex flex-col pb-3">
                  <div
                    className="absolute z-10 flex items-center justify-center"
                    style={
                      hasStopped
                        ? { left: "2px", top: "-2px", width: 28, height: 28 }
                        : { left: "11px", top: "6px", width: 12, height: 12 }
                    }
                  >
                    {hasStopped ? (
                      <BusMarker color={lineColor} atStop />
                    ) : (
                      <div
                        className="relative w-3 h-3 bg-white border-2 rounded-full"
                        style={{ borderColor: `${lineColor}60` }}
                      />
                    )}
                  </div>

                  <span
                    className={`font-semibold text-sm leading-tight ${
                      hasStopped || approachingHere.length > 0
                        ? "font-extrabold text-om-charcoal"
                        : "text-om-muted"
                    }`}
                  >
                    {stop.stop_name}
                  </span>

                  {/* Cartes : bus à l'arrêt + bus en approche de cet arrêt */}
                  {(stoppedHere.length > 0 || approachingHere.length > 0) && (
                    <div className="mt-2.5 space-y-2 animate-in fade-in duration-200">
                      {[...stoppedHere, ...approachingHere].map((v) => (
                        <VehicleCard
                          key={v.id}
                          v={v}
                          lineColor={lineColor}
                          onMap={() => router.push(`/v2/map?bus=${v.id}`)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
