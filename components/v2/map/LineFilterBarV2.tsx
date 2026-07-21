"use client";

import { X, Bus, ChevronDown } from "lucide-react";
import { LINE_COLORS } from "@/components/lineColors";

const PRIMARY_LINES = ["A", "B", "C1", "C2", "D"];
const OTHER_LINES = ["E", "EXAL", "F", "S1", "S2", "S3", "S5", "S6", "S7"];

interface LineFilterBarV2Props {
  selectedLineId: string | null;
  activeLinesSet: Set<string>;
  isOthersOpen: boolean;
  setSelectedLineId: (id: string | null) => void;
  setSelectedBusId: (id: string | null) => void;
  setSelectedStopId: (id: string | null) => void;
  setIsOthersOpen: (open: boolean) => void;
}

export default function LineFilterBarV2({
  selectedLineId,
  activeLinesSet,
  isOthersOpen,
  setSelectedLineId,
  setSelectedBusId,
  setSelectedStopId,
  setIsOthersOpen,
}: LineFilterBarV2Props) {
  const selectLine = (line: string | null) => {
    setSelectedLineId(line);
    setSelectedBusId(null);
    setSelectedStopId(null);
    setIsOthersOpen(false);
  };

  const isOtherSelected =
    !!selectedLineId && OTHER_LINES.includes(selectedLineId);

  return (
    <div className="absolute top-24 md:top-16 left-4 right-4 z-[1000] flex flex-col items-center pointer-events-none gap-2.5">
      {/* Barre principale */}
      <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md border border-om-border rounded-2xl shadow-om max-w-full overflow-x-auto no-scrollbar">
        {/* Toutes */}
        <button
          onClick={() => selectLine(null)}
          className={`h-9 px-3.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wide transition-all shrink-0 active:scale-95 ${
            !selectedLineId
              ? "bg-om-charcoal text-white shadow-sm"
              : "bg-om-surface text-om-muted hover:text-om-charcoal hover:bg-om-border/60"
          }`}
          title="Toutes les lignes"
        >
          Toutes
        </button>

        <div className="w-px h-5 bg-om-border shrink-0" />

        {/* Lignes principales */}
        {PRIMARY_LINES.map((line) => {
          const color = LINE_COLORS[line];
          const isActive = selectedLineId === line;
          const hasBuses = activeLinesSet.has(line);

          return (
            <button
              key={line}
              onClick={() => selectLine(line)}
              className={`relative h-9 min-w-9 px-2.5 rounded-xl text-[12px] font-black uppercase transition-all shrink-0 active:scale-95 flex items-center justify-center gap-1 ${
                !isActive && !hasBuses ? "opacity-40" : ""
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: color,
                      color: "#fff",
                      boxShadow: `0 4px 14px ${color}45`,
                    }
                  : {
                      backgroundColor: `${color}12`,
                      color: color,
                      border: `1.5px solid ${color}30`,
                    }
              }
              title={`Ligne ${line}${!hasBuses ? " — aucun bus" : ""}`}
            >
              {line}
              {hasBuses && !isActive && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white"
                  style={{ backgroundColor: color }}
                />
              )}
            </button>
          );
        })}

        {/* Ligne secondaire actuellement sélectionnée */}
        {isOtherSelected && (
          <>
            <div className="w-px h-5 bg-om-border shrink-0" />
            <button
              onClick={() => selectLine(null)}
              className="h-9 px-3 rounded-xl text-[12px] font-black uppercase transition-all shrink-0 active:scale-95 flex items-center gap-1.5 text-white animate-in zoom-in duration-200"
              style={{
                backgroundColor: LINE_COLORS[selectedLineId!],
                boxShadow: `0 4px 14px ${LINE_COLORS[selectedLineId!]}45`,
              }}
              title={`Ligne ${selectedLineId} — cliquer pour retirer`}
            >
              {selectedLineId}
              <X size={12} className="opacity-80" />
            </button>
          </>
        )}

        <div className="w-px h-5 bg-om-border shrink-0" />

        {/* Autres lignes */}
        <button
          onClick={() => setIsOthersOpen(!isOthersOpen)}
          className={`h-9 px-3 rounded-xl text-[11px] font-extrabold transition-all shrink-0 active:scale-95 flex items-center gap-1 ${
            isOthersOpen
              ? "bg-om-coral text-white shadow-sm"
              : "bg-om-surface text-om-muted hover:text-om-coral hover:bg-om-coral/8"
          }`}
          title="Autres lignes"
        >
          Autres
          <ChevronDown
            size={13}
            className={`transition-transform duration-200 ${
              isOthersOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Panneau autres lignes */}
      {isOthersOpen && (
        <div className="pointer-events-auto bg-white border border-om-border p-4 rounded-2xl shadow-om-lg w-[min(340px,92vw)] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-om-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-om-coral/10 flex items-center justify-center">
                <Bus size={14} className="text-om-coral" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-om-charcoal">
                  Autres lignes
                </p>
                <p className="text-[10px] font-semibold text-om-muted">
                  Express, scolaires & secondaires
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOthersOpen(false)}
              className="w-7 h-7 rounded-lg bg-om-surface hover:bg-om-border flex items-center justify-center text-om-muted hover:text-om-charcoal transition-colors"
              title="Fermer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {OTHER_LINES.map((line) => {
              const color = LINE_COLORS[line];
              const isActive = selectedLineId === line;
              const hasBuses = activeLinesSet.has(line);

              return (
                <button
                  key={line}
                  onClick={() => selectLine(line)}
                  className={`relative py-3 px-2 rounded-xl text-[12px] font-black uppercase tracking-wide transition-all flex flex-col items-center gap-1.5 active:scale-95 ${
                    !isActive && !hasBuses ? "opacity-40" : ""
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: color,
                          color: "#fff",
                          boxShadow: `0 4px 14px ${color}40`,
                        }
                      : {
                          backgroundColor: `${color}10`,
                          color: color,
                          border: `1.5px solid ${color}25`,
                        }
                  }
                  title={`Ligne ${line}${!hasBuses ? " — aucun bus" : ""}`}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-sm"
                    style={{
                      backgroundColor: isActive
                        ? "rgba(255,255,255,0.25)"
                        : color,
                    }}
                  >
                    {line}
                  </span>
                  <span className="text-[9px] font-bold opacity-80">
                    {hasBuses ? "En service" : "Inactif"}
                  </span>
                  {hasBuses && !isActive && (
                    <span
                      className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white"
                      style={{ backgroundColor: color }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
