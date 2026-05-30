"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import LineTimeline from "@/components/LineTimeline";
import { AlertTriangle, Loader2, Signal } from "lucide-react";

const AVAILABLE_LINES = ["A", "B", "C1", "C2", "D"];

const formatAlertDateRange = (start?: string, end?: string) => {
  if (!start && !end) return "";
  
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} À ${hours}H${minutes}`;
  };

  if (start && end) {
    return `DU ${formatDate(start)} AU ${formatDate(end)}`;
  } else if (start) {
    return `À PARTIR DU ${formatDate(start)}`;
  } else if (end) {
    return `JUSQU'AU ${formatDate(end)}`;
  }
  return "";
};

const LINE_COLORS: Record<string, { bg: string, text: string, border: string, shadow: string, hex: string }> = {
  "A": { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-400/50", shadow: "shadow-[0_0_15px_rgba(239,68,68,0.2)]", hex: "#ef4444" },
  "B": { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-400/50", shadow: "shadow-[0_0_15px_rgba(59,130,246,0.2)]", hex: "#3b82f6" },
  "C1": { bg: "bg-lime-500/20", text: "text-lime-400", border: "border-lime-400/50", shadow: "shadow-[0_0_15px_rgba(132,204,22,0.2)]", hex: "#a3e635" },
  "C2": { bg: "bg-green-700/20", text: "text-green-500", border: "border-green-500/50", shadow: "shadow-[0_0_15px_rgba(34,197,94,0.2)]", hex: "#15803d" },
  "D": { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-400/50", shadow: "shadow-[0_0_15px_rgba(234,179,8,0.2)]", hex: "#eab308" },
};

export default function SupervisionPage() {
  const [selectedLine, setSelectedLine] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const line = params.get("line");
      if (line && AVAILABLE_LINES.includes(line)) return line;
    }
    return "A";
  });

  // Fetch static line data (Stops sequence)
  const { data: staticData, isLoading: isStaticLoading } = useQuery({
    queryKey: ["staticLine", selectedLine],
    queryFn: async () => {
      const res = await fetch(`/api/axo/static-line?line=${selectedLine}`);
      if (!res.ok) throw new Error("Failed to fetch static line data");
      return res.json();
    },
    staleTime: Infinity, // Seldom changes
  });

  // Fetch real-time vehicles data with 20s polling
  const { data: realtimeData, isLoading: isRealtimeLoading } = useQuery({
    queryKey: ["realtime"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime");
      if (!res.ok) throw new Error("Failed to fetch real-time data");
      return res.json();
    },
    refetchInterval: 60000, // Poll every 1m
  });

  // Fetch alerts
  const { data: alertsData } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await fetch("/api/axo/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
    refetchInterval: 1200000, // 20m
  });

  // Filter vehicles for the specific selected route
  const routeVehicles = realtimeData?.vehicles?.filter(
    (v: any) => v.route_id === staticData?.route_id || v.route_id === selectedLine
  ) || [];

  const lineAlerts = alertsData?.alerts?.filter((alert: any) => 
    alert.impactedLines?.some((line: string) => line === selectedLine || line.replace(' ', '') === selectedLine.replace(' ', ''))
  ) || [];

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-white">
      {/* Fixed Header with Line Selector */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 pt-safe-top shadow-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Signal className="text-cyan-400" />
              Infos Trafic
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {isRealtimeLoading ? "Recherche de bus..." : `${routeVehicles.length} bus en circulation`} 
              {realtimeData?.timestamp && ` • ${new Date(realtimeData.timestamp).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: '2-digit', minute:'2-digit'})}`}
            </p>
          </div>
          
          {/* Pulsing Status Indicator */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30">
            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)] animate-pulse" />
          </div>
        </div>

        {/* Horizontal Line Selector */}
        <div className="w-full overflow-x-auto no-scrollbar px-6 pb-4">
          <div className="flex gap-3">
            {AVAILABLE_LINES.map((line) => {
              const isSelected = selectedLine === line;
              const colorClasses = LINE_COLORS[line] || { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-400/50", shadow: "shadow-[0_0_15px_rgba(34,211,238,0.2)]" };
              
              return (
                <button
                  key={line}
                  onClick={() => setSelectedLine(line)}
                  className={`shrink-0 h-12 min-w-[3rem] px-5 rounded-2xl font-bold text-lg transition-all duration-300 border ${
                    isSelected 
                      ? `${colorClasses.bg} ${colorClasses.text} ${colorClasses.border} ${colorClasses.shadow}` 
                      : "bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {line}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Line Alerts List */}
      {lineAlerts.length > 0 && (
        <div className="px-4 mt-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 pl-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
              Info Trafic
            </span>
          </div>
          
          <div className="flex flex-col gap-3">
            {lineAlerts.map((alert: any, idx: number) => {
              const hexColor = LINE_COLORS[selectedLine]?.hex || "#f59e0b";
              const dateRangeStr = formatAlertDateRange(alert.startTime, alert.endTime);

              return (
                <div 
                  key={`${alert.id}-${idx}`}
                  className="rounded-2xl p-5 border backdrop-blur-md"
                  style={{
                    backgroundColor: "rgba(2, 6, 23, 0.6)", // premium slate-950 transparency
                    borderColor: `${hexColor}30`,
                    boxShadow: `0 4px 20px ${hexColor}05`,
                  }}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${hexColor}10`,
                        borderColor: `${hexColor}20`,
                      }}
                    >
                      <AlertTriangle size={18} style={{ color: hexColor }} />
                    </div>

                    {/* Content */}
                    <div className="flex flex-col pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white text-sm leading-tight">
                          {alert.title}
                        </h3>
                        <div 
                          className="px-2 py-0.5 rounded text-[11px] font-black tracking-wider shadow-sm"
                          style={{
                            backgroundColor: hexColor,
                            color: "#ffffff" // Ensuring white text for contrast on badge
                          }}
                        >
                          {selectedLine}
                        </div>
                      </div>
                      
                      {dateRangeStr && (
                        <p 
                          className="text-[10px] font-bold uppercase tracking-wider mt-1.5"
                          style={{ color: hexColor }}
                        >
                          {dateRangeStr}
                        </p>
                      )}

                      <p className="text-slate-300 text-[13px] mt-3 leading-relaxed">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full mt-4">
        {isStaticLoading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            <p className="text-slate-400 font-medium">Chargement du tracé...</p>
          </div>
        ) : !staticData?.stops || staticData.stops.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4 px-6 text-center">
            <p className="text-slate-500 font-medium text-sm">
              Aucun arrêt trouvé pour la ligne {selectedLine}.<br />
              Vérifiez la disponibilité de l'open data GTFS.
            </p>
          </div>
        ) : (
          <LineTimeline stops={staticData.stops} vehicles={routeVehicles} lineColor={LINE_COLORS[selectedLine]?.hex} />
        )}
      </main>
    </div>
  );
}
