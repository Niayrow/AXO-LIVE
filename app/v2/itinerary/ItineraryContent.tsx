"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  MapPin,
  ArrowUpDown,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { getLineColor } from "@/components/lineColors";
import SectionTitle from "@/components/v2/SectionTitle";

function LegTimeline({
  leg,
  label,
}: {
  leg: any;
  label?: string;
}) {
  const color = getLineColor(leg.line);
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0"
            style={{ backgroundColor: color }}
          >
            {leg.line}
          </span>
          <div className="min-w-0">
            {label && (
              <p className="text-[10px] font-bold text-om-muted uppercase tracking-wider">
                {label}
              </p>
            )}
            <p className="text-sm font-extrabold text-om-charcoal truncate">
              Vers {leg.headsign}
            </p>
            <p className="text-xs text-om-muted">
              {leg.departureAt} → {leg.arrivalAt} · {leg.durationMin} min
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-om-muted bg-white border border-om-border rounded-lg px-2 py-1 shrink-0">
          Planifié
        </span>
      </div>

      <div
        className="relative pl-4 border-l-2 ml-2 space-y-3"
        style={{ borderColor: `${color}55` }}
      >
        {(leg.stops || []).map((stop: string, sIdx: number) => {
          const isStart = sIdx === 0;
          const isEnd = sIdx === leg.stops.length - 1;
          return (
            <div key={`${stop}-${sIdx}`} className="relative flex items-center gap-2">
              <div
                className="absolute -left-[1.3rem] w-2.5 h-2.5 rounded-full border-2 bg-white"
                style={{
                  borderColor: color,
                  transform: isStart || isEnd ? "scale(1.15)" : undefined,
                }}
              />
              <span
                className={`text-sm ${
                  isStart || isEnd
                    ? "font-bold text-om-charcoal"
                    : "text-om-muted font-medium"
                }`}
              >
                {stop}
              </span>
              {isStart && (
                <span className="text-[9px] font-bold uppercase text-om-coral">
                  Départ {leg.departureAt}
                </span>
              )}
              {isEnd && (
                <span className="text-[9px] font-bold uppercase text-om-green">
                  Arrivée {leg.arrivalAt}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ItineraryContent() {
  const searchParams = useSearchParams();
  const [startStop, setStartStop] = useState("");
  const [endStop, setEndStop] = useState("");
  const [expandedItinIdx, setExpandedItinIdx] = useState<number | null>(null);

  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from) setStartStop(from);
    if (to) setEndStop(to);
  }, [searchParams]);

  const { data: stopNamesData, isLoading: isStopsLoading } = useQuery({
    queryKey: ["stopNames"],
    queryFn: async () => {
      const res = await fetch("/api/axo/route-planner");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: Infinity,
  });

  const {
    data: itineraryData,
    isLoading: isItinLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ["itineraries", startStop, endStop],
    queryFn: async () => {
      if (!startStop || !endStop) return { itineraries: [] };
      const res = await fetch(
        `/api/axo/route-planner?start=${encodeURIComponent(startStop)}&end=${encodeURIComponent(endStop)}`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!startStop && !!endStop,
  });

  const stopNames = stopNamesData?.stopNames || [];
  const itineraries = itineraryData?.itineraries || [];

  const handleSwap = () => {
    setStartStop(endStop);
    setEndStop(startStop);
    setExpandedItinIdx(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 v2-animate-in">
      <SectionTitle title="Calcul d'itinéraire" />

      <div className="bg-white rounded-om-lg border border-om-border shadow-om p-5 mb-6 relative">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-om-muted uppercase tracking-wider mb-1.5 block">
              Départ
            </label>
            <div className="relative">
              <MapPin
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-om-coral"
              />
              <select
                value={startStop}
                onChange={(e) => {
                  setStartStop(e.target.value);
                  setExpandedItinIdx(null);
                }}
                className="w-full pl-10 pr-4 py-3 bg-om-surface border border-om-border rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-om-coral/30 appearance-none cursor-pointer"
              >
                <option value="">Choisir un arrêt de départ...</option>
                {stopNames.map((name: string) => (
                  <option
                    key={`s-${name}`}
                    value={name}
                    disabled={name === endStop}
                  >
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleSwap}
            type="button"
            className="absolute right-8 top-1/2 -translate-y-1/2 w-10 h-10 bg-om-coral hover:bg-om-coral-dark text-white rounded-full flex items-center justify-center shadow-md z-10 transition-all active:scale-95"
          >
            <ArrowUpDown size={18} />
          </button>

          <div className="pr-12">
            <label className="text-xs font-bold text-om-muted uppercase tracking-wider mb-1.5 block">
              Destination
            </label>
            <div className="relative">
              <MapPin
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-om-green"
              />
              <select
                value={endStop}
                onChange={(e) => {
                  setEndStop(e.target.value);
                  setExpandedItinIdx(null);
                }}
                className="w-full pl-10 pr-4 py-3 bg-om-surface border border-om-border rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-om-coral/30 appearance-none cursor-pointer"
              >
                <option value="">Choisir une destination...</option>
                {stopNames.map((name: string) => (
                  <option
                    key={`e-${name}`}
                    value={name}
                    disabled={name === startStop}
                  >
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {isStopsLoading ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-10 h-10 border-4 border-om-coral border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-om-muted font-semibold">Chargement du réseau...</p>
        </div>
      ) : !startStop || !endStop ? (
        <div className="text-center py-16">
          <Compass size={48} className="text-om-border mx-auto mb-4" />
          <h3 className="font-extrabold text-om-charcoal mb-1">
            Prêt pour le calcul
          </h3>
          <p className="text-sm text-om-muted max-w-xs mx-auto">
            Sélectionnez un départ et une destination pour trouver le prochain
            trajet planifié sur les lignes A, B, C1, C2 et D.
          </p>
        </div>
      ) : isItinLoading || isFetching ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-10 h-10 border-4 border-om-coral border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-om-muted font-semibold">
            Calcul des horaires du jour...
          </p>
        </div>
      ) : isError ? (
        <div className="flex items-center gap-3 p-4 rounded-om bg-om-coral/10 border border-om-coral/20 text-om-coral text-sm">
          <AlertCircle size={20} />
          Erreur lors du calcul de l&apos;itinéraire.
        </div>
      ) : itineraries.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-om border border-om-border">
          <AlertCircle size={32} className="text-om-muted mx-auto mb-3" />
          <h3 className="font-extrabold text-om-charcoal mb-1">
            Aucun trajet aujourd&apos;hui
          </h3>
          <p className="text-sm text-om-muted max-w-xs mx-auto">
            Pas de service planifié restant aujourd&apos;hui entre ces arrêts
            (direct ou 1 correspondance), ou arrêts non reliés sur le réseau
            A–D.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-om-muted uppercase tracking-wider px-1 flex items-center gap-1.5">
            <RefreshCw size={11} />
            {itineraries.length} proposition
            {itineraries.length > 1 ? "s" : ""} · triées par arrivée
          </p>

          {itineraries.map((itin: any, idx: number) => {
            const isExpanded = expandedItinIdx === idx;
            const legs = itin.legs || [];
            const firstLeg = legs[0];
            const lastLeg = legs[legs.length - 1];
            const isDirect = itin.type === "direct" || itin.transfers === 0;

            return (
              <div
                key={idx}
                className="bg-white rounded-om border border-om-border shadow-om overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedItinIdx(isExpanded ? null : idx)
                  }
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-om-surface/50 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isDirect ? (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0"
                        style={{
                          backgroundColor: getLineColor(firstLeg?.line || itin.line),
                        }}
                      >
                        {firstLeg?.line || itin.line}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white"
                          style={{
                            backgroundColor: getLineColor(
                              legs[0]?.line || itin.line1
                            ),
                          }}
                        >
                          {legs[0]?.line || itin.line1}
                        </div>
                        <ArrowRight size={12} className="text-om-muted" />
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white"
                          style={{
                            backgroundColor: getLineColor(
                              legs[1]?.line || itin.line2
                            ),
                          }}
                        >
                          {legs[1]?.line || itin.line2}
                        </div>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-extrabold text-sm text-om-charcoal">
                        {itin.departureAt} → {itin.arrivalAt}
                      </p>
                      <p className="text-xs text-om-muted truncate">
                        {isDirect
                          ? `Direct · Ligne ${firstLeg?.line || itin.line} · vers ${firstLeg?.headsign || "…"}`
                          : `1 correspondance à ${itin.transferStop}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-extrabold text-om-charcoal flex items-center gap-1">
                      <Clock size={12} className="text-om-coral" />
                      {itin.durationMin} min
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={18} className="text-om-muted" />
                    ) : (
                      <ChevronDown size={18} className="text-om-muted" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-om-border bg-om-surface/30 space-y-5 pt-4">
                    {legs.map((leg: any, legIdx: number) => (
                      <div key={leg.tripId || legIdx}>
                        {legIdx > 0 && (
                          <div className="mb-4 rounded-xl border border-dashed border-om-border bg-white px-3 py-2.5 text-xs text-om-muted">
                            <span className="font-bold text-om-charcoal">
                              Correspondance
                            </span>{" "}
                            à {itin.transferStop}
                            {typeof itin.transferWaitMin === "number" && (
                              <> · attente ~{itin.transferWaitMin} min</>
                            )}
                          </div>
                        )}
                        <LegTimeline
                          leg={leg}
                          label={
                            isDirect
                              ? "Trajet"
                              : `Étape ${legIdx + 1}`
                          }
                        />
                      </div>
                    ))}

                    {!legs.length && lastLeg == null && (
                      <p className="text-sm text-om-muted text-center py-2">
                        Détail indisponible.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
