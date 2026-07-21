"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, ArrowRight, X } from "lucide-react";

const STORAGE_KEY = "axo-v2-banner-dismissed";

export default function V2PromoBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/v2")) {
      setVisible(false);
      return;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setVisible(false);
        return;
      }
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, [pathname]);

  if (!visible || pathname.startsWith("/v2")) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="sticky top-0 z-[60] w-full border-b border-amber-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 shadow-[0_8px_30px_rgba(245,158,11,0.15)]">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 py-2.5 sm:px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
          <Sparkles size={15} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-bold text-slate-100 leading-snug">
            La version 2 d&apos;AXO Live est disponible maintenant
          </p>
          <p className="text-[10px] text-slate-400 hidden sm:block">
            Nouvelle interface, carte et itinéraires améliorés
          </p>
        </div>

        <Link
          href="/v2"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 px-3 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-950 transition-all shadow-md"
        >
          Passer à la v2
          <ArrowRight size={12} strokeWidth={2.5} />
        </Link>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer le bandeau"
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
