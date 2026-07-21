"use client";

import { useState } from "react";
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
} from "lucide-react";
import { getLineColor } from "@/components/lineColors";

export default function ItineraryPage() {
  const [startStop, setStartStop] = useState("");
  const [endStop, setEndStop] = useState("");
  const [expandedItinIdx, setExpandedItinIdx] = useState<number | null>(null);

  const { data: stopNamesData, isLoading: isStopsLoading } = useQuery({
    queryKey: ["stopNames"],
    queryFn: async () => {
      const res = await fetch("/api/axo/route-planner");
      if (!res.ok) throw new Error("Failed to fetch stop names");
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
      if (!res.ok) throw new Error("Failed to calculate itineraries");
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
    <div className="min-h-full flex flex-col bg-slate-950 text-white pb-24">
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-safe-top shadow-xl">
        <div className="px-6 py-5">
          <h1 className="text-2xl font-black tracking-tight text-white mb-4 flex items-center gap-2">
            <Compass
              size={24}
              className="text-amber-500 animate-[spin_8s_linear_infinite]"
            />
            Calcul d&apos;itinéraire
          </h1>

          <div className="relative flex flex-col gap-3 bg-slate-900 border border-white/5 p-4 rounded-2xl shadow-inner">
            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Départ
              </label>
              <div className="relative">
                <MapPin
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500"
                />
                <select
                  value={startStop}
                  onChange={(e) => {
                    setStartStop(e.target.value);
                    setExpandedItinIdx(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none transition-all cursor-pointer font-medium"
                >
                  <option value="" disabled className="text-slate-500">
                    Choisir un arrêt de départ...
                  </option>
                  {stopNames.map((name: string) => (
                    <option
                      key={`start-${name}`}
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
              className="absolute right-8 top-1/2 -translate-y-1/2 w-10 h-10 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-full flex items-center justify-center shadow-lg z-10 border-2 border-slate-900 transition-all"
              title="Inverser départ et arrivée"
            >
              <ArrowUpDown size={18} className="font-bold" />
            </button>

            <div className="relative pr-10">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Destination
              </label>
              <div className="relative">
                <MapPin
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-400"
                />
                <select
                  value={endStop}
                  onChange={(e) => {
                    setEndStop(e.target.value);
                    setExpandedItinIdx(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none transition-all cursor-pointer font-medium"
                >
                  <option value="" disabled className="text-slate-500">
                    Choisir une destination...
                  </option>
                  {stopNames.map((name: string) => (
                    <option
                      key={`end-${name}`}
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
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">
        {isStopsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-slate-400 font-medium tracking-wide">
              Chargement du réseau...
            </div>
          </div>
        ) : !startStop || !endStop ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 gap-4">
            <Compass size={48} className="text-slate-800 animate-pulse" />
            <div className="max-w-[280px]">
              <h3 className="text-slate-300 font-bold mb-1">
                Prêt pour le calcul
              </h3>
              <p className="text-xs">
                Sélectionnez un arrêt de départ et une destination pour trouver
                le prochain trajet planifié (lignes A, B, C1, C2, D).
              </p>
            </div>
          </div>
        ) : isItinLoading || isFetching ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-slate-400 font-medium tracking-wide">
              Calcul des horaires du jour...
            </div>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={20} className="shrink-0" />
            Une erreur est survenue lors du calcul de l&apos;itinéraire.
          </div>
        ) : itineraries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 gap-3 border border-white/5 rounded-2xl bg-slate-900/40">
            <AlertCircle size={32} className="text-slate-600" />
            <div className="max-w-[260px]">
              <h3 className="text-slate-300 font-bold mb-1">
                Aucun trajet aujourd&apos;hui
              </h3>
              <p className="text-xs">
                Pas de service planifié restant entre ces arrêts (direct ou 1
                correspondance), ou arrêts non reliés sur le réseau A–D.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">
              {itineraries.length} proposition
              {itineraries.length > 1 ? "s" : ""} · triées par arrivée
            </h2>

            {itineraries.map((itin: any, idx: number) => {
              const isExpanded = expandedItinIdx === idx;
              const legs = itin.legs || [];
              const isDirect = itin.type === "direct" || itin.transfers === 0;
              const color1 = getLineColor(legs[0]?.line || itin.line || itin.line1);
              const color2 = getLineColor(legs[1]?.line || itin.line2);

              return (
                <div
                  key={idx}
                  className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-lg transition-all duration-300"
                >
                  <button
                    onClick={() =>
                      setExpandedItinIdx(isExpanded ? null : idx)
                    }
                    className="w-full flex items-center justify-between p-4 focus:outline-none hover:bg-slate-800/30 transition-all text-left"
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0 mr-2">
                      {isDirect ? (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm border shadow-inner"
                          style={{
                            backgroundColor: `${color1}20`,
                            color: color1,
                            borderColor: `${color1}50`,
                          }}
                        >
                          {legs[0]?.line || itin.line}
                        </div>
                      ) : (
                        <div className="flex items-center shrink-0 gap-1.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border shadow-inner"
                            style={{
                              backgroundColor: `${color1}20`,
                              color: color1,
                              borderColor: `${color1}50`,
                            }}
                          >
                            {legs[0]?.line || itin.line1}
                          </div>
                          <ArrowRight size={12} className="text-slate-600" />
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border shadow-inner"
                            style={{
                              backgroundColor: `${color2}20`,
                              color: color2,
                              borderColor: `${color2}50`,
                            }}
                          >
                            {legs[1]?.line || itin.line2}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-200 text-sm tracking-wide">
                          {itin.departureAt} → {itin.arrivalAt}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                          {isDirect
                            ? `Direct · Ligne ${legs[0]?.line || itin.line} · vers ${legs[0]?.headsign || "…"}`
                            : `1 correspondance à ${itin.transferStop}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-black text-slate-200 flex items-center gap-1 justify-end">
                        <Clock size={12} className="text-amber-500" />
                        {itin.durationMin} min
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={18} className="text-slate-500" />
                      ) : (
                        <ChevronDown size={18} className="text-slate-500" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="bg-slate-950/80 px-4 py-4 border-t border-white/5 space-y-5">
                      {legs.map((leg: any, legIdx: number) => {
                        const color = getLineColor(leg.line);
                        return (
                          <div key={leg.tripId || legIdx}>
                            {legIdx > 0 && (
                              <div className="mb-4 rounded-xl border border-dashed border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-slate-400">
                                <span className="font-bold text-slate-200">
                                  Correspondance
                                </span>{" "}
                                à {itin.transferStop}
                                {typeof itin.transferWaitMin === "number" && (
                                  <> · attente ~{itin.transferWaitMin} min</>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-2 mb-3">
                              <span
                                className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shadow-inner"
                                style={{
                                  backgroundColor: `${color}15`,
                                  color,
                                  borderColor: `${color}40`,
                                }}
                              >
                                Ligne {leg.line}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                                Vers {leg.headsign} · {leg.departureAt} →{" "}
                                {leg.arrivalAt}
                              </span>
                            </div>

                            <div
                              className="relative pl-4 border-l-2 ml-2 space-y-4"
                              style={{ borderColor: `${color}40` }}
                            >
                              {(leg.stops || []).map(
                                (stop: string, sIdx: number) => {
                                  const isStart = sIdx === 0;
                                  const isEnd = sIdx === leg.stops.length - 1;
                                  return (
                                    <div
                                      key={`${stop}-${sIdx}`}
                                      className="relative flex items-center gap-3"
                                    >
                                      <div
                                        className="absolute -left-[1.325rem] w-2.5 h-2.5 rounded-full border-2 bg-slate-950"
                                        style={{
                                          borderColor:
                                            isStart || isEnd
                                              ? color
                                              : `${color}60`,
                                          transform:
                                            isStart || isEnd
                                              ? "scale(1.2)"
                                              : "scale(1)",
                                        }}
                                      />
                                      <span
                                        className={`text-xs ${
                                          isStart || isEnd
                                            ? "font-bold text-slate-200"
                                            : "text-slate-400"
                                        }`}
                                      >
                                        {stop}
                                        {isStart && (
                                          <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1 rounded ml-1.5 uppercase font-black">
                                            Départ {leg.departureAt}
                                          </span>
                                        )}
                                        {isEnd && (
                                          <span className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded ml-1.5 uppercase font-black">
                                            Arrivée {leg.arrivalAt}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
