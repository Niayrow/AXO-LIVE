"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Map,
  Route,
  MapPin,
  Signal,
  Bus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { LINE_COLORS, getLineColor } from "@/components/lineColors";

const formatAlertDateRange = (start?: string, end?: string) => {
  if (!start && !end) return "";
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    return `${day}/${month} ${hours}h${minutes}`;
  };
  if (start && end) return `${formatDate(start)} → ${formatDate(end)}`;
  if (start) return `Dès ${formatDate(start)}`;
  if (end) return `Jusqu'au ${formatDate(end)}`;
  return "";
};

const ACTIONS = [
  {
    name: "Carte live",
    desc: "Suivre les bus",
    href: "/v2/map",
    icon: Map,
    accent: "#E8574A",
  },
  {
    name: "Itinéraire",
    desc: "Calculer un trajet",
    href: "/v2/itinerary",
    icon: Route,
    accent: "#2D3436",
  },
  {
    name: "Arrêts",
    desc: "Horaires & passages",
    href: "/v2/stops",
    icon: MapPin,
    accent: "#3A7D5C",
  },
  {
    name: "Trafic",
    desc: "État du réseau",
    href: "/v2/supervision",
    icon: Signal,
    accent: "#D44A3E",
  },
];

export default function V2HomePage() {
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const { data: alertsData } = useQuery({
    queryKey: ["networkAlerts"],
    queryFn: async () => {
      const res = await fetch("/api/axo/alerts");
      if (!res.ok) return { alerts: [] };
      return res.json();
    },
    refetchInterval: 1200000,
  });

  const { data: realtimeData } = useQuery({
    queryKey: ["realtimeHome"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime");
      if (!res.ok) return { vehicles: [] };
      return res.json();
    },
    refetchInterval: 60000,
  });

  const LINE_SORT_ORDER = useMemo(
    () => ["A", "B", "C1", "C2", "D", "E", "F"],
    []
  );

  const groupedAlerts = useMemo(() => {
    if (!alertsData?.alerts) return [];
    const groupsMap: Record<
      string,
      { id: string; name: string; hexColor: string; alerts: any[] }
    > = {};
    const networkAlerts: any[] = [];

    alertsData.alerts.forEach((alert: any) => {
      if (!alert.impactedLines || alert.impactedLines.length === 0) {
        networkAlerts.push(alert);
      } else {
        alert.impactedLines.forEach((line: string) => {
          const cleanLine = line.replace(/\s+/g, "");
          if (!groupsMap[cleanLine]) {
            groupsMap[cleanLine] = {
              id: cleanLine,
              name: `Ligne ${cleanLine}`,
              hexColor: LINE_COLORS[cleanLine] || "#E8574A",
              alerts: [],
            };
          }
          if (!groupsMap[cleanLine].alerts.some((a) => a.id === alert.id)) {
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
        name: "Réseau",
        hexColor: "#E8574A",
        alerts: networkAlerts,
      });
    }
    return result;
  }, [alertsData?.alerts, LINE_SORT_ORDER]);

  const displayedGroups = showAllAlerts
    ? groupedAlerts
    : groupedAlerts.slice(0, 2);

  const alertCount = alertsData?.alerts?.length || 0;
  const busCount = realtimeData?.vehicles?.length || 0;
  const vehicles = realtimeData?.vehicles || [];

  const lineActivity = useMemo(() => {
    const counts: Record<string, number> = {};
    vehicles.forEach((v: any) => {
      const id = v.route_id;
      if (!id) return;
      counts[id] = (counts[id] || 0) + 1;
    });
    return ["A", "B", "C1", "C2", "D"].map((line) => ({
      line,
      count: counts[line] || 0,
    }));
  }, [vehicles]);

  return (
    <div className="v2-animate-in max-w-lg mx-auto px-4 pt-2">
      {/* Brand block */}
      <section className="relative overflow-hidden rounded-[28px] bg-om-charcoal text-white px-5 pt-7 pb-6 mb-5">
        <div className="absolute -top-16 -right-10 w-44 h-44 rounded-full bg-om-coral/25 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-om-green/20 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-om-green animate-ping opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-om-green" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
              Flux live · Creil
            </span>
          </div>

          <h1 className="text-[2.15rem] leading-[0.95] font-black tracking-tight mb-2">
            AXO
            <span className="text-om-coral">Live</span>
          </h1>
          <p className="text-sm text-white/65 font-semibold max-w-[240px] mb-6">
            Positions, horaires et trafic du réseau AXO — actualisés en continu.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <Link
              href="/v2/map"
              className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3 hover:bg-white/15 transition-all active:scale-[0.98]"
            >
              <p className="text-2xl font-black tabular-nums">{busCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mt-0.5">
                Bus actifs
              </p>
            </Link>
            <Link
              href="/v2/supervision"
              className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3 hover:bg-white/15 transition-all active:scale-[0.98]"
            >
              <p
                className={`text-2xl font-black tabular-nums ${
                  alertCount > 0 ? "text-om-coral" : "text-om-green"
                }`}
              >
                {alertCount > 0 ? alertCount : "OK"}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mt-0.5">
                {alertCount > 0 ? "Alertes" : "Réseau stable"}
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="mb-6">
        <div className="grid grid-cols-2 gap-2.5">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group relative bg-white rounded-2xl border border-om-border p-4 shadow-om hover:shadow-om-lg transition-all active:scale-[0.98] overflow-hidden"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-white"
                  style={{ backgroundColor: action.accent }}
                >
                  <Icon size={18} />
                </div>
                <p className="font-extrabold text-sm text-om-charcoal">
                  {action.name}
                </p>
                <p className="text-[11px] font-semibold text-om-muted mt-0.5">
                  {action.desc}
                </p>
                <ArrowUpRight
                  size={14}
                  className="absolute top-4 right-4 text-om-border group-hover:text-om-coral transition-colors"
                />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Lines pulse */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3 px-0.5">
          <h2 className="text-sm font-extrabold text-om-charcoal">
            Activité par ligne
          </h2>
          <Link
            href="/v2/map"
            className="text-[11px] font-bold text-om-coral hover:text-om-coral-dark"
          >
            Carte
          </Link>
        </div>
        <div className="bg-white rounded-2xl border border-om-border shadow-om p-3 flex gap-2 overflow-x-auto no-scrollbar">
          {lineActivity.map(({ line, count }) => {
            const color = getLineColor(line);
            return (
              <Link
                key={line}
                href={`/v2/supervision?line=${line}`}
                className="shrink-0 flex flex-col items-center gap-1.5 min-w-[58px] py-2 px-2 rounded-xl hover:bg-om-surface transition-all"
              >
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black"
                  style={{ backgroundColor: color }}
                >
                  {line}
                </span>
                <span className="text-[10px] font-bold text-om-muted tabular-nums">
                  {count} bus
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Live buses */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3 px-0.5">
          <h2 className="text-sm font-extrabold text-om-charcoal flex items-center gap-2">
            <Bus size={15} className="text-om-coral" />
            En circulation
          </h2>
          <span className="text-[10px] font-bold text-om-muted uppercase tracking-wider">
            {Math.min(vehicles.length, 5)} / {busCount}
          </span>
        </div>
        <div className="space-y-2">
          {vehicles.slice(0, 5).map((vehicle: any) => {
            const lineColor = getLineColor(vehicle.route_id);
            const cleanName = (vehicle.vehicle_id || "").replace("RCR", "");
            return (
              <Link
                key={vehicle.id}
                href={`/v2/map?bus=${encodeURIComponent(vehicle.id)}`}
                className="flex items-center gap-3 bg-white rounded-2xl border border-om-border px-3.5 py-3 shadow-om hover:shadow-om-lg transition-all"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0"
                  style={{ backgroundColor: lineColor }}
                >
                  {vehicle.route_id}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-sm text-om-charcoal">
                    Bus {cleanName}
                  </p>
                  <p className="text-xs text-om-muted truncate">
                    {vehicle.trip_headsign || "En route"}
                  </p>
                </div>
                <span className="w-2 h-2 rounded-full bg-om-green animate-pulse shrink-0" />
              </Link>
            );
          })}
          {vehicles.length === 0 && (
            <div className="bg-white rounded-2xl border border-om-border p-5 text-center text-sm text-om-muted font-semibold">
              Aucun bus signalé pour le moment.
            </div>
          )}
        </div>
      </section>

      {/* Alerts */}
      {alertCount > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3 px-0.5">
            <h2 className="text-sm font-extrabold text-om-charcoal flex items-center gap-2">
              <AlertTriangle size={15} className="text-om-coral" />
              Perturbations
            </h2>
            <Link
              href="/v2/supervision"
              className="text-[11px] font-bold text-om-coral"
            >
              Tout voir
            </Link>
          </div>
          <div className="space-y-2">
            {displayedGroups.map((group: any) => {
              const isExpanded = expandedGroupId === group.id;
              const hexColor = group.hexColor;
              return (
                <div
                  key={group.id}
                  onClick={() =>
                    setExpandedGroupId(isExpanded ? null : group.id)
                  }
                  className="bg-white rounded-2xl border border-om-border shadow-om overflow-hidden cursor-pointer"
                >
                  <div className="p-3.5 flex items-start gap-3">
                    <div
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{ backgroundColor: hexColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider mb-0.5"
                        style={{ color: hexColor }}
                      >
                        {group.id === "network"
                          ? "Réseau"
                          : `Ligne ${group.id}`}
                      </p>
                      <p className="font-extrabold text-sm text-om-charcoal leading-snug">
                        {group.alerts.length === 1
                          ? group.alerts[0].title
                          : `${group.alerts.length} alertes`}
                      </p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-om-muted shrink-0 mt-0.5 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 space-y-2 border-t border-om-border pt-3 bg-om-surface/40">
                      {group.alerts.map((alert: any) => (
                        <div key={alert.id}>
                          <p className="font-bold text-xs text-om-charcoal">
                            {alert.title}
                          </p>
                          {formatAlertDateRange(
                            alert.startTime,
                            alert.endTime
                          ) && (
                            <p className="text-[10px] font-semibold text-om-muted mt-0.5">
                              {formatAlertDateRange(
                                alert.startTime,
                                alert.endTime
                              )}
                            </p>
                          )}
                          {alert.description && (
                            <p className="text-xs text-om-muted mt-1 whitespace-pre-line leading-relaxed">
                              {alert.description}
                            </p>
                          )}
                        </div>
                      ))}
                      {group.id !== "network" && (
                        <Link
                          href={`/v2/supervision?line=${encodeURIComponent(group.id)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-white text-xs font-bold"
                          style={{ backgroundColor: hexColor }}
                        >
                          <Activity size={13} />
                          Suivre ligne {group.id}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {groupedAlerts.length > 2 && (
              <button
                onClick={() => setShowAllAlerts(!showAllAlerts)}
                className="w-full py-2.5 text-xs font-bold text-om-coral flex items-center justify-center gap-1"
              >
                {showAllAlerts ? (
                  <>
                    Réduire <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    +{groupedAlerts.length - 2} de plus{" "}
                    <ChevronDown size={14} />
                  </>
                )}
              </button>
            )}
          </div>
        </section>
      )}

      <footer className="text-center pb-4 space-y-1.5">
        <p className="text-[10px] text-om-muted font-semibold">
          Données GTFS-RT · Oise Mobilité
        </p>
        <div className="flex items-center justify-center gap-3 text-[11px] font-bold">
          <Link href="/v2/about" className="text-om-coral">
            Mentions légales
          </Link>
          <span className="text-om-border">·</span>
          <Link href="/" className="text-om-muted hover:text-om-coral">
            Version 1.0
          </Link>
        </div>
      </footer>
    </div>
  );
}
