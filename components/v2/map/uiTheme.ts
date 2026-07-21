export function getMapUi(isV2: boolean) {
  if (!isV2) return null;

  return {
    root: "relative w-full h-full overflow-hidden bg-om-surface",
    alertBanner:
      "absolute top-0 md:top-4 left-0 md:left-1/2 md:-translate-x-1/2 z-[1000] w-full md:w-[60vw] max-w-3xl h-9 md:h-10 bg-white/95 backdrop-blur-md border-b md:border border-om-border rounded-none md:rounded-om shadow-om flex items-center px-4 overflow-hidden pointer-events-auto",
    alertBadgeOk: "bg-om-green-light border-om-green/30 text-om-green",
    alertBadgeWarn: "bg-om-coral/10 border-om-coral/30 text-om-coral",
    alertText: "animate-marquee-infinite text-xs font-bold text-om-charcoal flex items-center gap-4 shrink-0 pr-8",
    updateIndicator:
      "absolute top-12 md:top-4 left-4 z-[1000] flex items-center gap-2 px-3 py-2 rounded-om bg-white/95 backdrop-blur-md border border-om-border shadow-om",
    updateText: "text-[10px] font-bold text-om-charcoal uppercase tracking-wider",
    lineFilterBar:
      "pointer-events-auto flex items-center gap-1 p-1.5 bg-white/95 backdrop-blur-md border border-om-border rounded-om shadow-om overflow-x-auto max-w-full no-scrollbar",
    lineBtnAllActive: "bg-om-coral border-om-coral text-white shadow-sm",
    lineBtnAllInactive: "bg-om-surface border-om-border text-om-muted hover:text-om-charcoal hover:border-om-coral/30",
    lineBtnBase: "w-9 h-9 rounded-xl text-[10px] font-black uppercase transition-all border flex items-center justify-center shrink-0 hover:scale-105 active:scale-95",
    othersMenu:
      "pointer-events-auto bg-white border border-om-border p-5 rounded-om-lg shadow-om-lg flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300 max-w-sm w-[92vw] overflow-hidden",
    othersTitle: "text-[10px] font-black text-om-muted uppercase tracking-widest flex items-center gap-1.5",
    controlBtn:
      "flex items-center justify-center w-10 h-10 rounded-om border shadow-om transition-all duration-300 hover:scale-105 active:scale-95 bg-white/95 backdrop-blur-md border-om-border text-om-charcoal hover:bg-om-surface",
    controlBtnActive: "bg-om-coral border-om-coral text-white shadow-sm",
    controlBtnGpsActive: "bg-om-green border-om-green text-white shadow-sm",
    searchPanel:
      "flex items-center gap-1.5 p-1.5 bg-white border border-om-border rounded-om shadow-om animate-in slide-in-from-right-3 duration-200",
    searchInput:
      "bg-transparent border-none text-om-charcoal placeholder-om-muted font-semibold text-xs focus:ring-0 outline-none w-40 md:w-52 py-0.5",
    searchResults:
      "pointer-events-auto bg-white border border-om-border p-3 rounded-om-lg w-64 md:w-80 shadow-om-lg flex flex-col gap-1 max-h-72 overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200 mt-1",
    searchResultItem:
      "w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-om-surface active:bg-om-surface text-left transition-all duration-200",
    searchResultName: "text-xs font-bold text-om-charcoal truncate",
    searchResultMeta: "text-[8px] font-bold text-om-muted uppercase tracking-widest",
    searchResultIcon: "shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-om-coral/10 text-om-coral border border-om-coral/20",
    filterMenu:
      "bg-white border border-om-border p-3 rounded-om-lg w-60 shadow-om-lg flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200",
    filterTitle: "text-[9px] font-black text-om-muted uppercase tracking-widest border-b border-om-border pb-2 mb-1 px-2",
    filterItem: "flex items-center justify-between w-full group py-2 px-2 rounded-xl hover:bg-om-surface active:scale-[0.98] transition-all text-left",
    filterLabel: "text-xs font-bold text-om-charcoal group-hover:text-om-coral transition-colors flex items-center gap-2.5",
    bottomSheet:
      "h-full bg-white/98 backdrop-blur-xl border-t md:border border-om-border rounded-t-om-lg md:rounded-om-lg p-4 md:p-5 shadow-om-lg flex flex-col gap-2 md:gap-3 overflow-hidden",
    dragHandle: "w-12 h-1 bg-om-border rounded-full mx-auto shrink-0 mb-0.5 md:hidden",
    gpsBanner:
      "bg-om-green border border-om-green text-white px-4 py-2.5 rounded-om shadow-om flex items-center gap-2 animate-in slide-in-from-top-3 duration-300 pointer-events-auto",
    warnBanner:
      "bg-om-coral border border-om-coral text-white px-4 py-2.5 rounded-om shadow-om flex items-center gap-2 animate-in slide-in-from-top-3 duration-300 pointer-events-auto",
    filterToggleOn: "bg-om-coral/15 border-om-coral/40",
    filterToggleOff: "bg-om-surface border-om-border",
    filterKnobOn: "translate-x-[16px] bg-om-coral",
    filterKnobOff: "translate-x-0 bg-om-muted/40",
    filtersBtnActive: "bg-om-coral border-om-coral text-white shadow-sm",
    filtersBtnInactive:
      "bg-white/95 backdrop-blur-md border-om-border text-om-charcoal hover:bg-om-surface",
    gpsSuggestBtn:
      "w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-om-green-light hover:bg-om-green hover:text-white border border-om-green/30 text-om-green font-bold text-xs uppercase tracking-wider transition-all",
  };
}

export type MapUi = NonNullable<ReturnType<typeof getMapUi>>;
