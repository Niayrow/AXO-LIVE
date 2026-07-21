"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, ArrowUpDown } from "lucide-react";

interface SearchCardProps {
  stopNames?: string[];
}

export default function SearchCard({ stopNames = [] }: SearchCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"itineraire" | "horaires">("itineraire");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stopSearch, setStopSearch] = useState("");

  const handleSearch = () => {
    if (activeTab === "itineraire" && from && to) {
      router.push(
        `/v2/itinerary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
    } else if (activeTab === "horaires" && stopSearch) {
      router.push(`/v2/stops?q=${encodeURIComponent(stopSearch)}`);
    }
  };

  const handleSwap = () => {
    const temp = from;
    setFrom(to);
    setTo(temp);
  };

  return (
    <div className="bg-white rounded-om-lg shadow-om-lg border border-om-border overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-om-border">
        <button
          onClick={() => setActiveTab("itineraire")}
          className={`flex-1 py-3.5 text-sm font-bold transition-all ${
            activeTab === "itineraire"
              ? "bg-om-charcoal text-white"
              : "text-om-muted hover:bg-om-surface"
          }`}
        >
          Itinéraires
        </button>
        <button
          onClick={() => setActiveTab("horaires")}
          className={`flex-1 py-3.5 text-sm font-bold transition-all ${
            activeTab === "horaires"
              ? "bg-om-charcoal text-white"
              : "text-om-muted hover:bg-om-surface"
          }`}
        >
          Horaires
        </button>
      </div>

      <div className="p-5 space-y-4 relative">
        {activeTab === "itineraire" ? (
          <>
            <div className="relative">
              <label className="text-xs font-bold text-om-muted uppercase tracking-wider mb-1.5 block">
                Départ
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-om-coral" />
                <select
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-om-surface border border-om-border rounded-xl text-sm font-semibold text-om-charcoal focus:outline-none focus:ring-2 focus:ring-om-coral/30 focus:border-om-coral appearance-none cursor-pointer"
                >
                  <option value="">Choisir un arrêt...</option>
                  {stopNames.map((name) => (
                    <option key={`from-${name}`} value={name} disabled={name === to}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSwap}
              type="button"
              className="absolute right-8 top-[108px] w-9 h-9 bg-om-coral hover:bg-om-coral-dark text-white rounded-full flex items-center justify-center shadow-md z-10 transition-all active:scale-95"
              title="Inverser"
            >
              <ArrowUpDown size={16} />
            </button>

            <div className="relative">
              <label className="text-xs font-bold text-om-muted uppercase tracking-wider mb-1.5 block">
                Destination
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-om-green" />
                <select
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-om-surface border border-om-border rounded-xl text-sm font-semibold text-om-charcoal focus:outline-none focus:ring-2 focus:ring-om-coral/30 focus:border-om-coral appearance-none cursor-pointer"
                >
                  <option value="">Choisir une destination...</option>
                  {stopNames.map((name) => (
                    <option key={`to-${name}`} value={name} disabled={name === from}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className="text-xs font-bold text-om-muted uppercase tracking-wider mb-1.5 block">
              Rechercher un arrêt
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-om-coral" />
              <input
                type="text"
                value={stopSearch}
                onChange={(e) => setStopSearch(e.target.value)}
                placeholder="Nom de l'arrêt..."
                className="w-full pl-10 pr-4 py-3 bg-om-surface border border-om-border rounded-xl text-sm font-semibold text-om-charcoal placeholder-om-muted/60 focus:outline-none focus:ring-2 focus:ring-om-coral/30 focus:border-om-coral"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSearch}
          disabled={
            activeTab === "itineraire" ? !from || !to : !stopSearch.trim()
          }
          className="w-full py-3.5 rounded-xl bg-om-coral hover:bg-om-coral-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
        >
          <Search size={18} />
          Rechercher
        </button>
      </div>
    </div>
  );
}
