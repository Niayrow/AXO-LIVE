"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { Vehicle } from "@/components/LiveMap";

const LiveMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full w-full bg-om-surface">
      <Loader2 className="w-12 h-12 text-om-coral animate-spin" />
      <p className="text-om-muted mt-4 font-semibold">
        Chargement de la carte...
      </p>
    </div>
  ),
});

export default function V2MapPage() {
  const { data: realtimeData } = useQuery({
    queryKey: ["realtime"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 35000,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const vehicles: Vehicle[] = useMemo(
    () => realtimeData?.vehicles || [],
    [realtimeData]
  );

  return (
    <div className="fixed inset-0 z-40 h-[100dvh] w-full overflow-hidden bg-om-surface">
      <LiveMap
        vehicles={vehicles}
        lastUpdatedTimestamp={realtimeData?.timestamp}
        variant="v2"
      />
    </div>
  );
}
