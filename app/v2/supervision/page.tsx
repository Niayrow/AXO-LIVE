"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Bus,
} from "lucide-react";
import LineTimelineV2 from "@/components/v2/LineTimelineV2";
import ActiveBusCardV2 from "@/components/v2/ActiveBusCardV2";
import SectionTitle from "@/components/v2/SectionTitle";
import { getLineColor } from "@/components/lineColors";

const AVAILABLE_LINES = ["A", "B", "C1", "C2", "D"];

const formatAlertDateRange = (start?: string, end?: string) => {
  if (!start && !end) return "";
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  };
  if (start && end) return `Du ${formatDate(start)} au ${formatDate(end)}`;
  if (start) return `À partir du ${formatDate(start)}`;
  return `Jusqu'au ${formatDate(end!)}`;
};

export default function V2SupervisionPage() {
  const [selectedLine, setSelectedLine] = useState("A");
  const [expandedAlerts, setExpandedAlerts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const line = params.get("line");
    if (line && AVAILABLE_LINES.includes(line)) setSelectedLine(line);
  }, []);

  const { data: staticData, isLoading: isStaticLoading } = useQuery({
    queryKey: ["staticLine", selectedLine],
    queryFn: async () => {
      const res = await fetch(`/api/axo/static-line?line=${selectedLine}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: Infinity,
  });

  const { data: realtimeData, isLoading: isRealtimeLoading } = useQuery({
    queryKey: ["realtime"],
    queryFn: async () => {
      const res = await fetch("/api/axo/realtime");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 20000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await fetch("/api/axo/alerts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 1200000,
  });

  const routeVehicles = useMemo(() => {
    return (
      realtimeData?.vehicles?.filter(
        (v: any) =>
          v.route_id === staticData?.route_id || v.route_id === selectedLine
      ) || []
    );
  }, [realtimeData, staticData, selectedLine]);

  const lineAlerts = useMemo(() => {
    return (
      alertsData?.alerts?.filter((alert: any) =>
        alert.impactedLines?.some(
          (line: string) =>
            line === selectedLine ||
            line.replace(" ", "") === selectedLine.replace(" ", "")
        )
      ) || []
    );
  }, [alertsData, selectedLine]);

  const stats = useMemo(() => {
    const vehicles = realtimeData?.vehicles || [];
    const total = vehicles.length;
    const late = vehicles.filter((v: any) => (v.delay || 0) > 60).length;
    const ontime = vehicles.filter(
      (v: any) => Math.abs(v.delay || 0) <= 60
    ).length;
    return {
      total,
      late,
      ontime,
      regularityRate: total > 0 ? Math.round((ontime / total) * 100) : 100,
    };
  }, [realtimeData]);

  const lineColor = getLineColor(selectedLine);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 v2-animate-in">
      <SectionTitle title="Infos trafic" />

      {/* Line selector */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-1">
        {AVAILABLE_LINES.map((line) => {
          const color = getLineColor(line);
          const isSelected = selectedLine === line;
          return (
            <button
              key={line}
              onClick={() => setSelectedLine(line)}
              className="px-5 py-2.5 rounded-xl text-sm font-extrabold whitespace-nowrap transition-all border shrink-0"
              style={{
                backgroundColor: isSelected ? color : "white",
                color: isSelected ? "white" : color,
                borderColor: isSelected ? color : `${color}40`,
              }}
            >
              Ligne {line}
            </button>
          );
        })}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-om border border-om-border p-4 shadow-om text-center">
          <p className="text-2xl font-black text-om-charcoal">{stats.total}</p>
          <p className="text-[10px] font-bold text-om-muted uppercase">Bus actifs</p>
        </div>
        <div className="bg-white rounded-om border border-om-border p-4 shadow-om text-center">
          <p className="text-2xl font-black text-om-green">{stats.regularityRate}%</p>
          <p className="text-[10px] font-bold text-om-muted uppercase">Ponctualité</p>
        </div>
        <div className="bg-white rounded-om border border-om-border p-4 shadow-om text-center">
          <p className="text-2xl font-black text-om-coral">{stats.late}</p>
          <p className="text-[10px] font-bold text-om-muted uppercase">En retard</p>
        </div>
      </div>

      {/* Line alerts */}
      {lineAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-xs font-bold text-om-muted uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-om-coral" />
            Perturbations — Ligne {selectedLine}
          </h3>
          {lineAlerts.map((alert: any) => {
            const isExpanded = expandedAlerts[alert.id];
            return (
              <div
                key={alert.id}
                className="bg-white rounded-om border border-om-coral/30 shadow-om overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedAlerts((prev) => ({
                      ...prev,
                      [alert.id]: !prev[alert.id],
                    }))
                  }
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-om-charcoal">
                      {alert.title}
                    </p>
                    {formatAlertDateRange(alert.startTime, alert.endTime) && (
                      <p className="text-xs text-om-coral font-semibold mt-0.5">
                        {formatAlertDateRange(alert.startTime, alert.endTime)}
                      </p>
                    )}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-om-muted shrink-0 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isExpanded && alert.description && (
                  <div className="px-4 pb-4 border-t border-om-border">
                    <p className="text-sm text-om-muted leading-relaxed whitespace-pre-line pt-3">
                      {alert.description}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline section */}
      <div className="bg-white rounded-om-lg border border-om-border shadow-om overflow-hidden">
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: `3px solid ${lineColor}` }}
        >
          <div>
            <h3 className="font-extrabold text-om-charcoal">
              Ligne {selectedLine} en direct
            </h3>
            <p className="text-xs text-om-muted font-semibold">
              {routeVehicles.length} bus en circulation
            </p>
          </div>
          <Link
            href={`/v2/map`}
            className="flex items-center gap-1 text-xs font-bold text-om-coral hover:text-om-coral-dark"
          >
            Carte <ArrowRight size={12} />
          </Link>
        </div>

        <div className="p-4 bg-om-surface/30">
          {isStaticLoading || isRealtimeLoading ? (
            <div className="flex flex-col items-center py-12 bg-white rounded-om border border-om-border">
              <Loader2 className="w-8 h-8 text-om-coral animate-spin mb-3" />
              <p className="text-sm text-om-muted">Chargement de la timeline...</p>
            </div>
          ) : staticData?.stops ? (
            <div className="bg-white rounded-om border border-om-border p-3 shadow-sm">
              <LineTimelineV2
                stops={staticData.stops}
                vehicles={routeVehicles}
                lineColor={lineColor}
              />
            </div>
          ) : (
            <p className="text-center text-om-muted py-8 text-sm bg-white rounded-om border border-om-border">
              Données indisponibles pour cette ligne.
            </p>
          )}
        </div>
      </div>

      {/* Active buses list */}
      {routeVehicles.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold text-om-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-om-green" />
            Bus actifs — Ligne {selectedLine}
            <span className="ml-auto text-om-coral font-extrabold normal-case">
              {routeVehicles.length}
            </span>
          </h3>
          <div className="space-y-2">
            {routeVehicles.map((v: any) => (
              <ActiveBusCardV2 key={v.id} vehicle={v} lineColor={lineColor} />
            ))}
          </div>
        </div>
      )}

      {routeVehicles.length === 0 && !isRealtimeLoading && (
        <div className="mt-6 bg-white rounded-om border border-om-border p-6 text-center shadow-om">
          <Bus size={32} className="text-om-border mx-auto mb-3" />
          <p className="font-extrabold text-om-charcoal text-sm mb-1">
            Aucun bus en circulation
          </p>
          <p className="text-xs text-om-muted">
            Aucun véhicule actif sur la ligne {selectedLine} pour le moment.
          </p>
        </div>
      )}
    </div>
  );
}
