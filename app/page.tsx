"use client";

import { useState, useMemo } from "react";
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
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LINE_COLORS, getLineColor } from "@/components/lineColors";

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
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const { data: alertsData } = useQuery({
    queryKey: ["networkAlerts"],
    queryFn: async () => {
      const res = await fetch("/api/axo/alerts");
      if (!res.ok) return { alerts: [] };
      return res.json();
    },
    refetchInterval: 1200000, // 20 minutes
  });

  const LINE_SORT_ORDER = useMemo(() => ["A", "B", "C1", "C2", "D", "E", "F"], []);

  const groupedAlerts = useMemo(() => {
    if (!alertsData?.alerts) return [];

    const groupsMap: Record<string, { id: string; name: string; hexColor: string; alerts: any[] }> = {};
    const networkAlerts: any[] = [];

    alertsData.alerts.forEach((alert: any) => {
      if (!alert.impactedLines || alert.impactedLines.length === 0) {
        networkAlerts.push(alert);
      } else {
        alert.impactedLines.forEach((line: string) => {
          const cleanLine = line.replace(/\s+/g, "");
          if (!groupsMap[cleanLine]) {
            const hexColor = LINE_COLORS[cleanLine] || "#ef4444";
            groupsMap[cleanLine] = {
              id: cleanLine,
              name: `Ligne ${cleanLine}`,
              hexColor,
              alerts: []
            };
          }
          if (!groupsMap[cleanLine].alerts.some(a => a.id === alert.id)) {
            groupsMap[cleanLine].alerts.push(alert);
          }
        });
      }
    });

    const sortedLineGroups = Object.values(groupsMap).sort((a, b) => {
      const idxA = LINE_SORT_ORDER.indexOf(a.id);
      const idxB = LINE_SORT_ORDER.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.id.localeCompare(b.id);
    });

    const result = [...sortedLineGroups];
    if (networkAlerts.length > 0) {
      result.push({
        id: "network",
        name: "Réseau / Informations",
        hexColor: "#ef4444",
        alerts: networkAlerts
      });
    }

    return result;
  }, [alertsData?.alerts, LINE_SORT_ORDER]);

  const displayedGroups = showAllAlerts ? groupedAlerts : groupedAlerts.slice(0, 3);

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

  const filteredVehicles = searchQuery.trim()
    ? (realtimeData?.vehicles || []).filter((v: any) => {
        const cleanQuery = searchQuery.toLowerCase().replace("rcr", "").trim();
        const cleanVehicleId = (v.vehicle_id || "").toLowerCase().replace("rcr", "").trim();
        return cleanVehicleId.includes(cleanQuery);
      })
    : [];

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
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center pt-16 pb-28 px-6">
      
      {/* Multi-layered ambient radial glows */}
      <div className="absolute top-[-250px] left-[-200px] w-[600px] h-[600px] bg-amber-500/5 blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute top-[-250px] right-[-200px] w-[600px] h-[600px] bg-cyan-500/5 blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-150px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-500/4 blur-[160px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center pt-4">

        {/* Logo / Brand */}
        <div className="mb-8 text-center mt-4 relative w-full flex items-center justify-center">
          <div className="flex flex-col items-center">
            <h1 className="text-4xl font-black tracking-tight flex items-center">
              <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-transparent bg-clip-text">
                AXO
              </span>
              <span className="text-white"> Live</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 ml-2 shadow-[0_0_8px_#10b981] animate-pulse shrink-0" />
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-2 tracking-wide">
              Réseau de bus • Bassin de Creil
            </p>
          </div>
          
          {/* Subtle Hidden Search Trigger */}
          <button
            onClick={() => setIsSearchExpanded(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-slate-900/40 hover:bg-slate-800/80 border border-white/5 hover:border-white/10 flex items-center justify-center text-slate-500 hover:text-amber-500 transition-all duration-200 active:scale-[0.95] cursor-pointer"
            title="Rechercher un bus par numéro"
          >
            <Search size={15} />
          </button>
        </div>


        {/* Navigation Grid */}
        <div className="grid grid-cols-2 gap-3.5 w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex flex-col items-center text-center bg-slate-900/40 hover:bg-slate-900/80 border border-white/5 hover:border-white/15 rounded-2xl p-5 transition-all duration-355 active:scale-[0.97] overflow-hidden"
                style={{
                  backdropFilter: "blur(12px)",
                }}
              >
                {/* Hover gradient glow */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, ${item.color} 0%, transparent 70%)`
                  }}
                />

                {/* Subtle light reflect line on top */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50 group-hover:via-white/15 transition-all duration-300" />

                {/* Arrow indicator sliding in */}
                <ArrowRight 
                  size={12} 
                  className="absolute top-4 right-4 text-slate-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" 
                  style={{ color: item.color }}
                />

                {/* Icon Wrapper */}
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110 border"
                  style={{ 
                    backgroundColor: `${item.color}10`,
                    borderColor: `${item.color}25`,
                    boxShadow: `0 0 15px ${item.color}05, inset 0 0 10px ${item.color}03`,
                  }}
                >
                  <Icon size={20} style={{ color: item.color }} className="transition-transform duration-300 group-hover:rotate-[5deg]" />
                </div>

                {/* Text */}
                <h2 className="text-[13px] font-extrabold text-slate-200 group-hover:text-white tracking-wide transition-colors">
                  {item.name}
                </h2>
                <p className="text-[9.5px] text-slate-500 group-hover:text-slate-400 font-bold mt-1 leading-snug transition-colors">
                  {item.subtitle}
                </p>
              </Link>
            );
          })}
        </div>

        {/* Unified Real-time Network Status Dashboard */}
        <div className="w-full mt-7 bg-slate-900/30 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Statut Réseau en Direct
              </span>
            </div>
            <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700 tracking-widest uppercase">
              Live Feed
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Bus Count Segment */}
            <Link 
              href="/map"
              className="flex items-center gap-2.5 bg-slate-950/40 hover:bg-slate-900/60 border border-white/5 hover:border-white/10 p-2.5 rounded-xl transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <Bus size={13} className="text-cyan-400" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-black text-white leading-tight">
                  {busCount}
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                  Bus en ligne
                </span>
              </div>
            </Link>

            {/* Alert Summary Segment */}
            <Link 
              href="/supervision"
              className="flex items-center gap-2.5 bg-slate-950/40 hover:bg-slate-900/60 border border-white/5 hover:border-white/10 p-2.5 rounded-xl transition-all cursor-pointer"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                alertCount > 0 
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400" 
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              }`}>
                <AlertCircle size={13} className={alertCount > 0 ? "animate-pulse" : ""} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className={`text-[14px] font-black leading-tight ${
                  alertCount > 0 ? "text-amber-400" : "text-emerald-400"
                }`}>
                  {alertCount > 0 ? alertCount : "RAS"}
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                  Perturbation{alertCount > 1 ? 's' : ''}
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Live Alerts Feed section */}
        <div className="flex flex-col gap-2.5 w-full mt-6">
          {alertCount > 0 && (
            <div className="flex flex-col gap-2.5">
              {displayedGroups.map((group: any, idx: number) => {
                const isExpanded = expandedGroupId === group.id;
                const hexColor = group.hexColor;
                
                // For a single alert, we can show its dateRange or title, otherwise show summary
                const dateRangeStr = group.alerts.length === 1 
                  ? formatAlertDateRange(group.alerts[0].startTime, group.alerts[0].endTime) 
                  : "";

                return (
                  <div
                    key={`${group.id}-${idx}`}
                    onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                    className="w-full text-left flex flex-col gap-2 rounded-2xl p-4 transition-all hover:bg-slate-900/50 backdrop-blur-md border shadow-md relative overflow-hidden group cursor-pointer"
                    style={{
                      backgroundColor: "rgba(2, 6, 23, 0.4)", // Dark glass
                      borderColor: `${hexColor}30`,
                    }}
                  >
                    {/* Glowing highlight border on hover */}
                    <div 
                      className="absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at 100% 0%, ${hexColor} 0%, transparent 60%)`
                      }}
                    />

                    {/* Top Alert Label & Navigation Indicator */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        {group.id === "network" ? (
                          <AlertCircle size={12} className="text-amber-500 animate-pulse" />
                        ) : (
                          <AlertTriangle size={12} style={{ color: hexColor }} className="animate-pulse" />
                        )}
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: hexColor }}>
                          {group.id === "network" ? "Info Réseau" : `Perturbation Ligne ${group.id}`}
                        </span>
                      </div>
                      
                      <span className="text-[9px] font-bold text-slate-500 group-hover:text-slate-300 transition-colors flex items-center gap-1 uppercase tracking-wider">
                        {isExpanded ? "Réduire" : "Déplier"} 
                        <ChevronDown size={10} className={`transform transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                      </span>
                    </div>

                    {/* Title or Summary of alerts */}
                    <h3 className={`text-[13px] font-extrabold text-white leading-snug tracking-wide uppercase transition-all duration-200 ${isExpanded ? "" : "line-clamp-1"}`}>
                      {group.alerts.length === 1 
                        ? group.alerts[0].title 
                        : `${group.alerts.length} perturbations signalées`
                      }
                    </h3>

                    {/* Active Dates (if single alert) */}
                    {dateRangeStr && (
                      <p className="text-[9px] font-bold uppercase tracking-wider leading-none" style={{ color: hexColor }}>
                        {dateRangeStr}
                      </p>
                    )}

                    {/* Line badge / group indicator when collapsed */}
                    {!isExpanded && group.id !== "network" && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span 
                          className="text-[9px] font-black px-2 py-0.5 rounded shadow-sm tracking-wider"
                          style={{
                            backgroundColor: `${hexColor}20`,
                            color: hexColor,
                            border: `1px solid ${hexColor}30`
                          }}
                        >
                          Ligne {group.id}
                        </span>
                      </div>
                    )}

                    {/* Accordion Content showing the list of alerts for this group */}
                    <div 
                      className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <div className="overflow-hidden flex flex-col gap-4">
                        {group.alerts.map((alert: any, alertIdx: number) => {
                          const alertDateRange = formatAlertDateRange(alert.startTime, alert.endTime);
                          return (
                            <div 
                              key={alert.id} 
                              className={`flex flex-col gap-2 ${alertIdx > 0 ? "border-t border-white/10 pt-3 mt-1" : "border-t border-white/15 pt-2"}`}
                              onClick={(e) => {
                                // Prevent double toggling if they click inside the inner alert details
                                e.stopPropagation();
                              }}
                            >
                              <h4 className="text-[12px] font-black text-white uppercase tracking-wide">
                                {alert.title}
                              </h4>

                              {alertDateRange && (
                                <p className="text-[9px] font-extrabold uppercase tracking-wider leading-none" style={{ color: hexColor }}>
                                  {alertDateRange}
                                </p>
                              )}

                              {alert.description && (
                                <p className="text-[11px] text-slate-300 font-medium leading-relaxed whitespace-pre-line select-text">
                                  {alert.description}
                                </p>
                              )}

                              {/* Impacted lines for this specific alert */}
                              {alert.impactedLines?.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
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
                            </div>
                          );
                        })}

                        {/* Direct line tracking action (only if it's a specific line group) */}
                        {group.id !== "network" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `/supervision?line=${encodeURIComponent(group.id)}`;
                            }}
                            className="w-full h-9 mt-1 rounded-xl flex items-center justify-center gap-2 font-extrabold text-[10px] transition-all active:scale-[0.98] shadow-lg text-white"
                            style={{
                              background: `linear-gradient(135deg, ${hexColor}cc, ${hexColor})`,
                              boxShadow: `0 4px 15px -3px ${hexColor}50`,
                            }}
                          >
                            <Activity size={12} />
                            Suivre la ligne {group.id} en direct
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {groupedAlerts.length > 3 && (
                <button
                  onClick={() => setShowAllAlerts(!showAllAlerts)}
                  className="w-full mt-1.5 py-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 hover:border-white/10 text-xs font-black uppercase tracking-wider text-amber-500 hover:text-amber-400 flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                >
                  {showAllAlerts ? (
                    <>
                      Voir moins <ChevronUp size={14} />
                    </>
                  ) : (
                    <>
                      Voir plus ({groupedAlerts.length - 3} de plus) <ChevronDown size={14} />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live status footer */}
        <div className="flex flex-col items-center gap-2 mt-10 mb-10 pb-6">
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

      {/* Premium Search Modal Overlay (Menu Caché) */}
      {isSearchExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop with intense blur */}
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
            onClick={() => {
              setIsSearchExpanded(false);
              setSearchQuery("");
            }}
          />

          {/* Modal Box */}
          <div 
            className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden z-10 flex flex-col gap-4 animate-scale-up"
            style={{
              boxShadow: `0 10px 40px -10px rgba(245,158,11,0.15), 0 0 50px -10px rgba(0,0,0,0.5)`,
            }}
          >
            {/* Decorative side ambient glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[60px] rounded-full pointer-events-none" />

            {/* Header: Title and Close button */}
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Bus size={14} />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Suivi de bus par numéro
                </span>
              </div>
              
              <button 
                onClick={() => {
                  setIsSearchExpanded(false);
                  setSearchQuery("");
                }}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-white/5 active:scale-95"
              >
                <X size={16} />
              </button>
            </div>

            {/* Input */}
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Numéro du bus (ex: 4031, 57...)"
                className="w-full pl-10 pr-10 py-3 bg-slate-950/80 border border-white/5 focus:border-amber-500/50 rounded-xl text-xs font-bold text-white placeholder-slate-500 outline-none transition-colors"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 w-5 h-5 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={10} />
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1 no-scrollbar select-none">
              {filteredVehicles.length > 0 ? (
                filteredVehicles.map((vehicle: any) => {
                  const cleanName = (vehicle.vehicle_id || "").replace("RCR", "");
                  const lineColor = getLineColor(vehicle.route_id);
                  return (
                    <Link
                      key={vehicle.id}
                      href={`/map?bus=${encodeURIComponent(vehicle.id)}`}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/40 hover:bg-slate-800/60 active:scale-[0.98] border border-white/5 hover:border-white/10 transition-all text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Line badge */}
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border shrink-0"
                          style={{
                            backgroundColor: `${lineColor}20`,
                            color: lineColor,
                            borderColor: `${lineColor}40`,
                          }}
                        >
                          {vehicle.route_id}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black text-white">
                            Bus {cleanName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium truncate">
                            Dir. {vehicle.trip_headsign || "Sans voyageurs"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <ArrowRight size={12} className="text-slate-500" />
                      </div>
                    </Link>
                  );
                })
              ) : searchQuery.trim() ? (
                <div className="text-[10px] text-slate-500 text-center py-6 font-black uppercase tracking-wider">
                  Aucun bus trouvé pour "{searchQuery}"
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 mb-1">
                    Suggestions en circulation
                  </div>
                  {(realtimeData?.vehicles || []).slice(0, 4).map((vehicle: any) => {
                    const cleanName = (vehicle.vehicle_id || "").replace("RCR", "");
                    const lineColor = getLineColor(vehicle.route_id);
                    return (
                      <Link
                        key={vehicle.id}
                        href={`/map?bus=${encodeURIComponent(vehicle.id)}`}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/20 hover:bg-slate-800/40 border border-white/5 transition-all text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border shrink-0"
                            style={{
                              backgroundColor: `${lineColor}20`,
                              color: lineColor,
                              borderColor: `${lineColor}40`,
                            }}
                          >
                            {vehicle.route_id}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-white">
                              Bus {cleanName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium truncate">
                              Dir. {vehicle.trip_headsign || "Sans voyageurs"}
                            </span>
                          </div>
                        </div>
                        <ArrowRight size={12} className="text-slate-500" />
                      </Link>
                    );
                  })}
                  {(!realtimeData?.vehicles || realtimeData.vehicles.length === 0) && (
                    <div className="text-[10px] text-slate-500 text-center py-4 font-black uppercase tracking-wider">
                      Aucun bus en circulation
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
