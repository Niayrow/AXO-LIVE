"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Map, 
  Compass, 
  List, 
  Activity, 
  ArrowRight, 
  AlertCircle,
  AlertTriangle,
  Bus,
  X,
  Calendar,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LINE_COLORS } from "@/components/lineColors";

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

export default function Home() {
  const [activeAlert, setActiveAlert] = useState<any | null>(null);
  const { data: alertsData } = useQuery({
    queryKey: ["networkAlerts"],
    queryFn: async () => {
      const res = await fetch("/api/axo/alerts");
      if (!res.ok) return { alerts: [] };
      return res.json();
    },
    refetchInterval: 1200000, // 20 minutes
  });

  const { data: realtimeData } = useQuery({
    queryKey: ["realtimeHome"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime");
      if (!res.ok) return { vehicles: [] };
      return res.json();
    },
    refetchInterval: 60000, // 1 minute
  });

  const alertCount = alertsData?.alerts?.length || 0;
  const busCount = realtimeData?.vehicles?.length || 0;

  const navItems = [
    {
      name: "Infos Trafic",
      subtitle: "État du réseau en direct",
      href: "/supervision",
      icon: Activity,
      color: "#f59e0b",
    },
    {
      name: "Carte",
      subtitle: "Position des bus en direct",
      href: "/map",
      icon: Map,
      color: "#3b82f6",
    },
    {
      name: "Itinéraire",
      subtitle: "Calculer un trajet",
      href: "/itinerary",
      icon: Compass,
      color: "#10b981",
    },
    {
      name: "Horaires",
      subtitle: "Arrêts & prochains passages",
      href: "/stops",
      icon: List,
      color: "#a855f7",
    },
  ];

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center overflow-hidden px-6">
      
      {/* Subtle ambient glow */}
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-amber-500/8 blur-[160px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">

        {/* Logo / Brand */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-transparent bg-clip-text">
              AXO
            </span>
            <span className="text-white"> Live</span>
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-2 tracking-wide">
            Réseau de bus • Bassin de Creil
          </p>
        </div>


        {/* Navigation Grid */}
        <div className="grid grid-cols-2 gap-3 w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex flex-col items-center text-center bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all duration-200 active:scale-[0.97]"
              >
                {/* Icon */}
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110"
                  style={{ 
                    backgroundColor: `${item.color}15`,
                    boxShadow: `0 0 20px ${item.color}10`,
                  }}
                >
                  <Icon size={22} style={{ color: item.color }} />
                </div>

                {/* Text */}
                <h2 className="text-sm font-bold text-white tracking-wide">
                  {item.name}
                </h2>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-tight">
                  {item.subtitle}
                </p>
              </Link>
            );
          })}
        </div>

        {/* Live Info Chips */}
        <div className="flex flex-col gap-2 w-full mt-6">
          {/* Bus count chip */}
          <div className="flex items-center gap-3 bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Bus size={16} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-slate-200">
                {busCount > 0 ? `${busCount} bus en circulation` : "Aucun bus en ligne"}
              </span>
            </div>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${busCount > 0 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${busCount > 0 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            </span>
          </div>

          {alertCount > 0 ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 px-1 mb-0.5">
                <AlertCircle size={12} className="text-red-400 animate-pulse" />
                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                  {alertCount} alerte{alertCount > 1 ? 's' : ''} en cours
                </span>
              </div>
              {(alertsData?.alerts || []).map((alert: any, idx: number) => {
                // Determine primary line color
                const primaryLine = alert.impactedLines?.[0]?.replace(' ', '');
                const hexColor = primaryLine ? (LINE_COLORS[primaryLine] || "#ef4444") : "#ef4444";
                const dateRangeStr = formatAlertDateRange(alert.startTime, alert.endTime);

                return (
                  <button
                    key={`${alert.id}-${idx}`}
                    onClick={() => setActiveAlert(alert)}
                    className="w-full text-left flex flex-col gap-2.5 rounded-2xl p-4 active:scale-[0.98] transition-all hover:bg-slate-900/50 backdrop-blur-md border shadow-md relative overflow-hidden group cursor-pointer"
                    style={{
                      backgroundColor: "rgba(2, 6, 23, 0.4)", // Dark glass
                      borderColor: `${hexColor}30`,
                    }}
                  >
                    {/* Glowing highlight border on hover */}
                    <div 
                      className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at 100% 0%, ${hexColor} 0%, transparent 60%)`
                      }}
                    />

                    {/* Top Alert Label & Navigation Indicator */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={12} style={{ color: hexColor }} className="animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: hexColor }}>
                          Perturbation
                        </span>
                      </div>
                      
                      <span className="text-[9px] font-bold text-slate-500 group-hover:text-slate-300 transition-colors flex items-center gap-1 uppercase tracking-wider">
                        Voir détails <ArrowRight size={10} className="transform group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>

                    {/* Alert Title */}
                    <h3 className="text-[13px] font-extrabold text-white leading-snug tracking-wide uppercase">
                      {alert.title}
                    </h3>

                    {/* Active Dates */}
                    {dateRangeStr && (
                      <p className="text-[9px] font-bold uppercase tracking-wider leading-none" style={{ color: hexColor }}>
                        {dateRangeStr}
                      </p>
                    )}

                    {/* Text description snippet (truncated to 3 lines max) */}
                    {alert.description && (
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed line-clamp-3">
                        {alert.description}
                      </p>
                    )}

                    {/* Impacted lines badges */}
                    {alert.impactedLines?.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {alert.impactedLines.map((line: string, i: number) => {
                          const badgeHex = LINE_COLORS[line.replace(' ', '')] || hexColor;
                          return (
                            <span 
                              key={i} 
                              className="text-[9px] font-black px-2 py-0.5 rounded shadow-sm tracking-wider"
                              style={{
                                backgroundColor: `${badgeHex}20`,
                                color: badgeHex,
                                border: `1px solid ${badgeHex}30`
                              }}
                            >
                              Ligne {line}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <AlertCircle size={16} className="text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-slate-200">Aucune perturbation</span>
            </div>
          )}
        </div>

        {/* Live status footer */}
        <div className="flex flex-col items-center gap-2 mt-6">
          <span className="text-[10px] font-semibold text-slate-600">
            Données en temps réel • Oise Mobilité
          </span>
          <Link
            href="/about"
            className="text-[10px] font-semibold text-slate-500 hover:text-amber-500 transition-colors underline underline-offset-2 decoration-slate-700"
          >
            À propos & mentions légales
          </Link>
        </div>
      </div>

      {/* Premium Alert Detail Modal */}
      {activeAlert && (() => {
        const primaryLine = activeAlert.impactedLines?.[0]?.replace(' ', '');
        const hexColor = primaryLine ? (LINE_COLORS[primaryLine] || "#ef4444") : "#ef4444";
        const dateRangeStr = formatAlertDateRange(activeAlert.startTime, activeAlert.endTime);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            {/* Backdrop with intense blur */}
            <div 
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
              onClick={() => setActiveAlert(null)}
            />

            {/* Modal Box */}
            <div 
              className="relative w-full max-w-sm bg-slate-900 border rounded-3xl p-6 shadow-2xl overflow-hidden z-10 flex flex-col gap-4 animate-scale-up"
              style={{
                borderColor: `${hexColor}30`,
                boxShadow: `0 10px 40px -10px ${hexColor}30, 0 0 50px -10px rgba(0,0,0,0.5)`,
              }}
            >
              {/* Decorative side ambient glow */}
              <div 
                className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full pointer-events-none opacity-20"
                style={{ backgroundColor: hexColor }}
              />

              {/* Header: Title and Close button */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${hexColor}10`,
                        borderColor: `${hexColor}30`,
                      }}
                    >
                      <AlertTriangle size={14} style={{ color: hexColor }} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: hexColor }}>
                      Perturbation Réseau
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setActiveAlert(null)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-white/5 active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Main Content */}
              <div className="flex flex-col gap-3">
                <h2 className="text-[15px] font-black text-white uppercase tracking-wide leading-snug">
                  {activeAlert.title}
                </h2>

                {dateRangeStr && (
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar size={12} style={{ color: hexColor }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: hexColor }}>
                      {dateRangeStr}
                    </span>
                  </div>
                )}

                <div className="h-px bg-white/10 my-1" />

                <div className="max-h-[220px] overflow-y-auto pr-1 select-text scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                    {activeAlert.description || "Aucun détail supplémentaire fourni pour cette perturbation."}
                  </p>
                </div>
              </div>

              {/* Impacted Lines & Action Button */}
              <div className="flex flex-col gap-4 mt-2">
                {activeAlert.impactedLines?.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      Lignes Impactées :
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {activeAlert.impactedLines.map((line: string, i: number) => {
                        const badgeHex = LINE_COLORS[line.replace(' ', '')] || hexColor;
                        return (
                          <span 
                            key={i} 
                            className="text-[10px] font-black px-2.5 py-1 rounded-lg shadow-sm tracking-wider"
                            style={{
                              backgroundColor: `${badgeHex}15`,
                              color: badgeHex,
                              border: `1px solid ${badgeHex}40`
                            }}
                          >
                            Ligne {line}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setActiveAlert(null);
                    const lineToSupervise = activeAlert.impactedLines?.[0] || "";
                    window.location.href = `/supervision?line=${encodeURIComponent(lineToSupervise)}`;
                  }}
                  className="w-full h-11 rounded-2xl flex items-center justify-center gap-2 font-extrabold text-xs transition-all active:scale-[0.98] shadow-lg text-white"
                  style={{
                    background: `linear-gradient(135deg, ${hexColor}cc, ${hexColor})`,
                    boxShadow: `0 4px 15px -3px ${hexColor}50`,
                  }}
                >
                  <Activity size={14} />
                  Suivre la ligne en direct
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
