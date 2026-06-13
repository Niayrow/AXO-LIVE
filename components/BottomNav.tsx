"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Compass, List, Activity, Home, ChevronDown, Menu } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  isCenter?: boolean;
}

export default function BottomNav() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // OPTIMISATION SSR : On attend que le composant soit monté sur le client 
  // pour lire le localStorage sans casser l'hydratation de Next.js
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("navCollapsed");
    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const handleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem("navCollapsed", String(collapsed));
  };

  const navItems: NavItem[] = [
    { name: "Carte", href: "/map", icon: Map },
    { name: "Itinéraires", href: "/itinerary", icon: Compass },
    { name: "Accueil", href: "/", icon: Home, isCenter: true },
    { name: "Arrêts", href: "/stops", icon: List },
    { name: "Infos Trafic", href: "/supervision", icon: Activity },
  ];

  // Rendu d'attente neutre pendant le chargement SSR pour éviter les sauts d'UI
  if (!mounted) return null;

  return (
    <>
      {/* Floating Expand FAB when collapsed */}
      <button
        onClick={() => handleCollapse(false)}
        className={`fixed bottom-4 right-4 w-12 h-12 bg-slate-950/60 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-amber-500 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:scale-110 active:scale-95 transition-all duration-300 z-50 cursor-pointer ${isCollapsed ? "translate-y-0 opacity-100 scale-100" : "translate-y-24 opacity-0 scale-95 pointer-events-none"
          }`}
        title="Ouvrir la navigation"
      >
        <Menu size={20} className="stroke-[2.5]" />
      </button>

      {/* Main Navigation Bar Wrapper */}
      {/* OPTIMISATION CLIC : "pointer-events-none" sur le parent pour laisser traverser les clics sur la carte */}
      <div
        className={`fixed bottom-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[500px] z-50 pointer-events-none transition-all duration-300 transform ${isCollapsed ? "translate-y-24 opacity-0 scale-95" : "translate-y-0 opacity-100 scale-100"
          }`}
      >
        {/* OPTIMISATION CLIC : "pointer-events-auto" uniquement sur la barre pour interagir avec les boutons */}
        <nav className="relative h-16 w-full bg-slate-950/45 backdrop-blur-xl border border-white/10 rounded-2xl px-6 flex justify-between items-center shadow-[0_12px_40px_rgba(0,0,0,0.6)] pointer-events-auto">

          {/* Inner Minimize Button */}
          {/* OPTIMISATION TACTILE : Zone de clic agrandie à h-8 w-8 et centrée pour les doigts */}
          <button
            onClick={() => handleCollapse(true)}
            className="absolute top-0.5 right-1 w-8 h-8 flex items-center justify-center text-slate-500 hover:text-amber-500 transition-colors z-20 cursor-pointer rounded-full hover:bg-white/5"
            title="Réduire le menu"
          >
            <ChevronDown size={15} />
          </button>

          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            if (item.isCenter) {
              return (
                <div key={item.href} className="relative flex flex-col items-center justify-center w-full h-full">
                  <Link
                    href={item.href}
                    className={`flex items-center justify-center w-12 h-12 rounded-full border transition-all duration-300 hover:scale-105 active:scale-90 shadow-lg backdrop-blur-md -mt-7 ${isActive
                        ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_22px_rgba(245,158,11,0.5)]"
                        : "bg-slate-900/60 border-white/10 text-amber-500 hover:border-amber-500/50 hover:bg-slate-900/80 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                      }`}
                  >
                    <Icon size={22} className="stroke-[2.5] transition-transform duration-300 hover:rotate-6" />
                  </Link>
                  <span className={`text-[8px] font-black uppercase tracking-widest mt-1 transition-colors ${isActive ? "text-amber-500" : "text-slate-500"
                    }`}>
                    {item.name}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 hover:scale-105 active:scale-95"
              >
                {/* Active Indicator Line for normal items */}
                {isActive && (
                  <div className="absolute top-0 w-8 h-[3px] bg-amber-500 rounded-b-full shadow-[0_0_12px_rgba(245,158,11,1)] animate-pulse" />
                )}

                <Icon
                  size={18}
                  className={`transition-all duration-300 ${isActive
                      ? "text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] scale-105"
                      : "text-slate-400 group-hover:text-slate-200 group-hover:scale-110"
                    }`}
                />
                <span className={`text-[8px] font-black uppercase tracking-widest transition-colors duration-300 ${isActive
                    ? "text-amber-500"
                    : "text-slate-500 group-hover:text-slate-300"
                  }`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}