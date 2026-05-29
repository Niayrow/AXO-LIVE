"use client";

import Link from "next/link";
import { 
  Map, 
  Compass, 
  List, 
  Activity, 
  ArrowRight, 
  AlertCircle,
  Bus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LINE_COLORS } from "@/components/lineColors";

export default function Home() {
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
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 px-1 mb-0.5">
                <AlertCircle size={12} className="text-red-400" />
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                  {alertCount} alerte{alertCount > 1 ? 's' : ''} en cours
                </span>
              </div>
              {(alertsData?.alerts || []).map((alert: any, idx: number) => {
                // Determine primary line color
                const primaryLine = alert.impactedLines?.[0]?.replace(' ', '');
                const hexColor = primaryLine ? (LINE_COLORS[primaryLine] || "#ef4444") : "#ef4444";

                return (
                  <Link
                    key={`${alert.id}-${idx}`}
                    href="/supervision"
                    className="flex flex-col gap-1.5 rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform backdrop-blur-md border shadow-sm"
                    style={{
                      backgroundColor: "rgba(2, 6, 23, 0.4)", // Dark glass
                      borderColor: `${hexColor}25`,
                    }}
                  >
                    <span className="text-[12px] font-black text-white leading-snug line-clamp-2 tracking-wide uppercase">
                      {alert.title}
                    </span>
                    {alert.impactedLines?.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {alert.impactedLines.map((line: string, i: number) => {
                          const badgeHex = LINE_COLORS[line.replace(' ', '')] || hexColor;
                          return (
                            <span 
                              key={i} 
                              className="text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm tracking-wider"
                              style={{
                                backgroundColor: `${badgeHex}20`,
                                color: badgeHex
                              }}
                            >
                              Ligne {line}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </Link>
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
    </div>
  );
}
