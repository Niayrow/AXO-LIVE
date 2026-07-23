"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio } from "lucide-react";
import SwitchToV1Link from "./SwitchToV1Link";

export default function V2Header() {
  const pathname = usePathname();

  if (pathname === "/v2/map") {
    return (
      <div className="fixed bottom-[5.75rem] left-3 z-[1100] pointer-events-none">
        <div className="pointer-events-auto rounded-full bg-white/70 backdrop-blur-md border border-om-border/50 px-2 py-0.5 shadow-sm">
          <SwitchToV1Link />
        </div>
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 pb-1">
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3 h-12 px-4 rounded-2xl bg-white/90 backdrop-blur-xl border border-om-border/80 shadow-om">
        <Link href="/v2" className="flex items-center gap-2.5 min-w-0 group">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-om-green animate-ping opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-om-green" />
          </span>
          <span className="text-[15px] font-black tracking-tight text-om-charcoal truncate">
            AXO<span className="text-om-coral">Live</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-om-muted">
            <Radio size={11} className="text-om-coral" />
            Temps réel
          </span>
          <SwitchToV1Link />
        </div>
      </div>
    </header>
  );
}
