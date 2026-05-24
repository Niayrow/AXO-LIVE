"use client";

import React, { useMemo } from "react";

export const SEGMENT_HEIGHT = 64;

export interface Stop {
  stop_id: string;
  stop_name: string;
  stop_sequence: number;
}

export interface Vehicle {
  id: string;
  vehicle_id: string;
  route_id?: string;
  stop_id?: string;
  current_stop_sequence?: number;
  current_status?: number; // 0: IN_TRANSIT_TO, 1: STOPPED_AT, 2: INCOMING_AT
  delay?: number;
}

interface LineTimelineProps {
  stops: Stop[];
  vehicles: Vehicle[];
  lineColor?: string;
}

export default function LineTimeline({ stops, vehicles, lineColor = "#34d399" }: LineTimelineProps) {
  // Compute positions of vehicles on the timeline
  const vehiclePositions = useMemo(() => {
    return vehicles.map(vehicle => {
      const seq = vehicle.current_stop_sequence;
      if (seq === undefined || seq === null) return null;

      // Find the index of the stop this vehicle is heading to or stopped at
      const targetStopIndex = stops.findIndex(s => s.stop_sequence === seq);
      if (targetStopIndex === -1) return null;

      let pixelOffset = targetStopIndex * SEGMENT_HEIGHT;
      let statusText = "En route";

      // 1 = STOPPED_AT, 2 = INCOMING_AT, 0 = IN_TRANSIT_TO
      if (vehicle.current_status === 1) {
        // Exactly at the stop
        statusText = "À l'arrêt";
      } else if (vehicle.current_status === 2) {
        // Incoming: slightly before the stop (20% of segment)
        pixelOffset -= SEGMENT_HEIGHT * 0.2;
        statusText = "En approche";
      } else {
        // In transit from previous stop (50% of segment)
        pixelOffset -= SEGMENT_HEIGHT * 0.5;
      }

      // Cap at the top (can't go before index 0)
      if (pixelOffset < 0) pixelOffset = 0;

      // Note: We use inline styles for dynamic colors since tailwind arbitrary values are tricky at runtime
      const delay = vehicle.delay || 0;
      const isDelayed = delay > 60;
      const delayMins = Math.round(delay / 60);

      return {
        ...vehicle,
        top: pixelOffset,
        statusText,
        delayText: isDelayed ? `Retard +${delayMins}m` : "À l'heure",
        isDelayed,
        lineColor, // Use the provided line color
      };
    }).filter(Boolean);
  }, [stops, vehicles, lineColor]);

  return (
    <div className="w-full h-full overflow-y-auto no-scrollbar pb-32">
      {/* Background container: blurred and subtle */}
      <div className="relative w-full max-w-md mx-auto py-8 px-4 min-h-full">
        <div className="relative">
          {/* Central neon subtle line connecting all stops */}
          <div 
            className="absolute left-[112px] top-4 bottom-4 w-[2px] bg-white/10 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.05)]"
          />

          {/* Theoretical Stops */}
          {stops.map((stop) => (
            <div 
              key={stop.stop_id} 
              className="relative flex items-center"
              style={{ height: `${SEGMENT_HEIGHT}px` }}
            >
              {/* Stop Dot */}
              <div className="absolute left-[108px] w-[10px] h-[10px] bg-slate-950 border-2 border-slate-600 rounded-full z-10" />
              
              {/* Stop Name */}
              <div className="ml-[136px] w-full pr-4 flex flex-col justify-center">
                <span className="font-semibold text-[15px] text-slate-300 truncate tracking-wide">
                  {stop.stop_name}
                </span>
              </div>
            </div>
          ))}

          {/* Real-time Vehicles overlay */}
          {vehiclePositions.map((vp: any) => (
            <div
              key={vp.id}
              className="absolute top-0 left-[97px] z-20 flex items-center transition-transform duration-1000 ease-in-out"
              style={{ transform: `translateY(${vp.top + (SEGMENT_HEIGHT / 2) - 16}px)` }} // Center the 32px height icon
            >
              {/* Data Bubble (Placed on the LEFT side of the timeline) */}
              <div className="absolute right-full mr-3 flex flex-col items-end px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 shadow-xl whitespace-nowrap">
                <span className="text-[10px] font-bold text-white tracking-wider leading-none mb-1">
                  Bus {vp.vehicle_id}
                </span>
                <span 
                  className="text-[9px] font-black leading-none"
                  style={{ color: vp.isDelayed ? "#ef4444" : vp.lineColor }} // Red text if delayed, otherwise line color
                >
                  {vp.delayText}
                </span>
              </div>

              {/* Pulsing aura */}
              <div 
                className="absolute inset-0 -m-1 rounded-full animate-ping opacity-40" 
                style={{ backgroundColor: vp.lineColor }} 
              />
              
              {/* Bus Indicator (Line index) */}
              <div 
                className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 bg-slate-950 font-black text-xs shadow-lg"
                style={{ 
                  color: vp.lineColor, 
                  borderColor: vp.lineColor, 
                  boxShadow: `0 0 10px ${vp.lineColor}80` 
                }}
              >
                {vp.route_id || "B"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
