"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { Vehicle } from "@/components/LiveMap";

// Import dynamique obligatoire sans SSR pour Leaflet
const LiveMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full w-full bg-slate-950">
      <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      <p className="text-slate-400 mt-4 font-medium tracking-wide">Chargement de la carte en direct...</p>
    </div>
  ),
});

export default function MapPage() {
  const { data: realtimeData } = useQuery({
    queryKey: ["realtime"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime");
      if (!res.ok) throw new Error("Failed to fetch real-time data");
      return res.json();
    },
    refetchInterval: 35000,       // Optimisé : Rafraîchissement toutes les 35 secondes pour un suivi plus précis
    refetchOnWindowFocus: false, // Évite les micro-saccades quand l'usager revient sur son écran
    staleTime: 30000,            // Marque la donnée comme fraîche pendant 30 secondes
  });

  // Mémorisation de la liste pour bloquer les rerendus carte inutiles
  const vehicles: Vehicle[] = useMemo(() => realtimeData?.vehicles || [], [realtimeData]);

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-slate-950">
      {/* Conteneur de carte pleine page */}
      <div className="h-full w-full">
        <LiveMap vehicles={vehicles} lastUpdatedTimestamp={realtimeData?.timestamp} />
      </div>
    </div>
  );
}