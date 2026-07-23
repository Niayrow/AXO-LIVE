"use client";

import { usePathname } from "next/navigation";
import { preferV2, v2PathFromV1 } from "@/lib/versionPreference";

/** Subtle chip on legacy v1 pages to return to the default v2 UI */
export default function V1LegacyHint() {
  const pathname = usePathname();

  if (pathname.startsWith("/v2")) return null;

  const goV2 = (e: React.MouseEvent) => {
    e.preventDefault();
    preferV2();
    window.location.href = v2PathFromV1(pathname);
  };

  return (
    <div className="sticky top-0 z-[60] flex justify-center pointer-events-none px-3 py-1.5">
      <a
        href={v2PathFromV1(pathname)}
        onClick={goV2}
        className="pointer-events-auto text-[10px] font-semibold tracking-wide text-slate-500 hover:text-amber-400/90 bg-slate-950/70 border border-white/5 hover:border-amber-500/25 rounded-full px-3 py-1 backdrop-blur-md transition-colors"
        title="Revenir à l'interface actuelle"
      >
        Interface classique · <span className="text-amber-500/80">passer en v2</span>
      </a>
    </div>
  );
}
