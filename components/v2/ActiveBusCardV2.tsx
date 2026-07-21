"use client";

import Link from "next/link";
import { Clock, Map, Bus } from "lucide-react";
import { getLineColor } from "@/components/lineColors";

const formatBusName = (vehicleId: string) =>
  vehicleId ? vehicleId.replace("RCR", "") : "";

const getVehicleType = (vehicleId: string) => {
  const id = formatBusName(vehicleId);
  return ["53", "57", "58", "65", "66", "67", "68"].includes(id)
    ? "Articulé"
    : "Standard";
};

const getStatusInfo = (status?: number) => {
  if (status === 1)
    return {
      text: "À l'arrêt",
      className: "text-om-green bg-om-green-light border-om-green/30",
    };
  if (status === 2)
    return {
      text: "En approche",
      className: "text-om-coral bg-om-coral/10 border-om-coral/30",
    };
  return {
    text: "En route",
    className: "text-om-charcoal bg-om-surface border-om-border",
  };
};

interface ActiveBusCardV2Props {
  vehicle: any;
  lineColor: string;
}

export default function ActiveBusCardV2({
  vehicle,
  lineColor,
}: ActiveBusCardV2Props) {
  const delay = vehicle.delay || 0;
  const delayMin = Math.round(delay / 60);
  const status = getStatusInfo(vehicle.current_status);
  const isDelayed = delay >= 300;

  return (
    <Link
      href={`/v2/map?bus=${encodeURIComponent(vehicle.id)}`}
      className="flex flex-col gap-3 p-4 bg-white rounded-om border border-om-border shadow-om hover:shadow-om-lg transition-all group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-sm group-hover:scale-105 transition-transform"
            style={{ backgroundColor: lineColor }}
          >
            {vehicle.route_id}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-extrabold text-sm text-om-charcoal">
                Bus {formatBusName(vehicle.vehicle_id)}
              </p>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-om-surface border border-om-border text-om-muted">
                {getVehicleType(vehicle.vehicle_id)}
              </span>
            </div>
            <p className="text-xs text-om-muted truncate mt-0.5">
              {vehicle.trip_headsign || "Direction inconnue"}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`text-xs font-extrabold flex items-center gap-1 ${
              isDelayed
                ? "text-om-coral"
                : delay < -60
                  ? "text-om-green"
                  : "text-om-charcoal"
            }`}
          >
            <Clock size={11} />
            {Math.abs(delayMin) <= 1
              ? "À l'heure"
              : delayMin > 0
                ? `+${delayMin} min`
                : `${delayMin} min`}
          </span>
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${status.className}`}
          >
            {status.text}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-om-border pt-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-om-muted uppercase tracking-wider">
          <Bus size={12} className="text-om-coral" />
          Suivre en direct
        </div>
        <span className="flex items-center gap-1 text-[10px] font-bold text-om-coral group-hover:text-om-coral-dark transition-colors">
          <Map size={12} />
          Voir sur la carte
        </span>
      </div>
    </Link>
  );
}
