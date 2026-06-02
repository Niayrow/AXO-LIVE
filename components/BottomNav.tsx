"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Compass, List, Activity, Home } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  // "Accueil" is placed in the center (index 2)
  const navItems = [
    { name: "Carte", href: "/map", icon: Map },
    { name: "Itinéraires", href: "/itinerary", icon: Compass },
    { name: "Accueil", href: "/", icon: Home, isCenter: true },
    { name: "Arrêts", href: "/stops", icon: List },
    { name: "Infos Trafic", href: "/supervision", icon: Activity },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 backdrop-blur-xl bg-black/20 border-t border-white/10 z-50 px-4 pb-safe flex justify-between items-center shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        if (item.isCenter) {
          return (
            <div key={item.href} className="relative flex justify-center w-full h-full -mt-6">
              <Link 
                href={item.href}
                className={`flex items-center justify-center w-14 h-14 rounded-full border transition-all duration-300 hover:scale-105 active:scale-90 shadow-lg backdrop-blur-md ${
                  isActive 
                    ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_22px_rgba(245,158,11,0.5)] hover:shadow-[0_0_28px_rgba(245,158,11,0.7)]" 
                    : "bg-black/50 border-white/10 text-amber-500 hover:border-amber-500/50 hover:bg-black/75 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                }`}
              >
                <Icon size={26} className="stroke-[2.5] transition-transform duration-300 hover:rotate-6" />
              </Link>
              <span className={`absolute bottom-1.5 text-[10px] font-bold tracking-wide transition-colors ${
                isActive ? "text-amber-500" : "text-slate-500"
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
              <div className="absolute top-0 w-10 h-[3px] bg-amber-500 rounded-b-full shadow-[0_0_12px_rgba(245,158,11,1)] animate-pulse" />
            )}
            
            <Icon 
              size={22} 
              className={`transition-all duration-300 ${
                isActive 
                  ? "text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] scale-105" 
                  : "text-slate-400 group-hover:text-slate-200 group-hover:scale-110"
              }`} 
            />
            <span className={`text-[10px] font-medium transition-colors duration-300 ${
              isActive 
                ? "text-amber-500 font-bold" 
                : "text-slate-500 group-hover:text-slate-300"
            }`}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
