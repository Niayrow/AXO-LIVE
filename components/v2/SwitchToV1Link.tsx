"use client";

import { usePathname } from "next/navigation";
import { preferV1, v1PathFromV2 } from "@/lib/versionPreference";

/** Discreet header control to open the legacy v1 UI */
export default function SwitchToV1Link() {
  const pathname = usePathname();
  const v1Href = v1PathFromV2(pathname);

  const goV1 = (e: React.MouseEvent) => {
    e.preventDefault();
    preferV1();
    window.location.href = v1Href;
  };

  return (
    <a
      href={v1Href}
      onClick={goV1}
      className="text-[9px] font-semibold uppercase tracking-[0.18em] text-om-muted/40 hover:text-om-muted/80 transition-colors px-1.5 py-1"
      title="Revenir à l'ancienne interface"
    >
      v1
    </a>
  );
}
