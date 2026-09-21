"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Bus, ArrowUpRight } from "lucide-react";
import { getLineColor } from "@/components/lineColors";

/**
 * Recherche discrète d'un bus par son numéro (reprise de la v1).
 * Le bouton loupe reste sobre : il s'intègre dans le bloc de marque.
 */
export default function BusSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Monté dans .v2-root (hors du conteneur animé) pour conserver le thème v2.
  useEffect(() => {
    setPortalTarget(
      (document.querySelector(".v2-root") as HTMLElement) || document.body
    );
  }, []);

  // Même clé que la page d'accueil : les données sont partagées, pas refetchées.
  const { data: realtimeData } = useQuery({
    queryKey: ["realtimeHome"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime");
      if (!res.ok) return { vehicles: [] };
      return res.json();
    },
    refetchInterval: 60000,
    enabled: isOpen,
  });

  const vehicles = realtimeData?.vehicles || [];

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const cleanQuery = query.toLowerCase().replace("rcr", "").trim();
    return vehicles.filter((v: any) => {
      const cleanVehicleId = (v.vehicle_id || "")
        .toLowerCase()
        .replace("rcr", "")
        .trim();
      return cleanVehicleId.includes(cleanQuery);
    });
  }, [vehicles, query]);

  const close = () => {
    setIsOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const suggestions = vehicles.slice(0, 4);
  const listed = query.trim() ? results : suggestions;

  const overlay = (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center p-4 pt-20 animate-fade-in">
      <div
        className="absolute inset-0 bg-om-charcoal/50 backdrop-blur-sm"
        onClick={close}
      />

      <div className="relative z-10 w-full max-w-sm bg-white rounded-[24px] border border-om-border shadow-om-lg overflow-hidden animate-scale-up">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-om-border">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-om-coral/10 text-om-coral flex items-center justify-center shrink-0">
              <Bus size={14} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-om-muted truncate">
              Suivi d&apos;un bus par numéro
            </span>
          </div>
          <button
            onClick={close}
            aria-label="Fermer la recherche"
            className="w-8 h-8 rounded-xl bg-om-surface hover:bg-om-border/60 text-om-muted hover:text-om-charcoal flex items-center justify-center transition-all active:scale-95 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 pb-2">
          <div className="relative flex items-center">
            <Search
              size={15}
              className="absolute left-3.5 text-om-muted pointer-events-none"
            />
            <input
              type="text"
              inputMode="numeric"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Numéro du bus (ex : 4031, 57...)"
              autoFocus
              className="w-full pl-10 pr-10 py-3 bg-om-surface border border-om-border rounded-xl text-sm font-semibold text-om-charcoal placeholder-om-muted/60 focus:outline-none focus:ring-2 focus:ring-om-coral/30 focus:border-om-coral transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Effacer"
                className="absolute right-3 w-5 h-5 rounded-full bg-om-border/70 text-om-muted hover:text-om-charcoal flex items-center justify-center transition-colors"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 pt-1">
          {!query.trim() && suggestions.length > 0 && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-om-muted px-0.5 mb-2">
              En circulation
            </p>
          )}

          <div className="space-y-2 max-h-[260px] overflow-y-auto no-scrollbar">
            {listed.map((vehicle: any) => {
              const lineColor = getLineColor(vehicle.route_id);
              const cleanName = (vehicle.vehicle_id || "").replace("RCR", "");
              return (
                <Link
                  key={vehicle.id}
                  href={`/v2/map?bus=${encodeURIComponent(vehicle.id)}`}
                  onClick={close}
                  className="flex items-center gap-3 bg-white rounded-2xl border border-om-border px-3 py-2.5 hover:bg-om-surface transition-all active:scale-[0.98]"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0"
                    style={{ backgroundColor: lineColor }}
                  >
                    {vehicle.route_id}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-sm text-om-charcoal">
                      Bus {cleanName}
                    </p>
                    <p className="text-[11px] text-om-muted font-semibold truncate">
                      {vehicle.trip_headsign || "Sans voyageurs"}
                    </p>
                  </div>
                  <ArrowUpRight size={14} className="text-om-muted shrink-0" />
                </Link>
              );
            })}

            {query.trim() && results.length === 0 && (
              <p className="text-xs font-semibold text-om-muted text-center py-6">
                Aucun bus trouvé pour «&nbsp;{query}&nbsp;»
              </p>
            )}

            {!query.trim() && suggestions.length === 0 && (
              <p className="text-xs font-semibold text-om-muted text-center py-6">
                Aucun bus en circulation pour le moment.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Rechercher un bus par numéro"
        aria-label="Rechercher un bus par numéro"
        className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95"
      >
        <Search size={15} />
      </button>

      {/* Portail : la page est animée (transform), l'overlay serait sinon
          piégé sous le header et la barre de navigation. */}
      {isOpen && portalTarget && createPortal(overlay, portalTarget)}
    </>
  );
}
