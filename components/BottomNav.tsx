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
    <nav className="fixed bottom-0 left-0 right-0 h-20 backdrop-blur-3xl bg-slate-950/60 border-t border-white/[0.08] z-50 px-4 pb-safe flex justify-between items-center shadow-[0_-20px_40px_rgba(0,0,0,0.4)]">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        if (item.isCenter) {
          return (
            <div key={item.href} className="relative flex justify-center w-full h-full -mt-6">
              <Link 
                href={item.href}
                className={`flex items-center justify-center w-14 h-14 rounded-full border transition-all duration-300 active:scale-95 shadow-lg backdrop-blur-md ${
                  isActive 
                    ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)]" 
                    : "bg-slate-950/75 border-white/10 text-amber-500 hover:border-amber-500/50 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                }`}
              >
                <Icon size={26} className="stroke-[2.5]" />
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
            className="relative flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            {/* Active Indicator Line for normal items */}
            {isActive && (
              <div className="absolute top-0 w-10 h-[3px] bg-amber-500 rounded-b-full shadow-[0_0_12px_rgba(245,158,11,1)]" />
            )}
            
            <Icon 
              size={22} 
              className={`transition-all duration-300 ${
                isActive 
                  ? "text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                  : "text-slate-400 group-hover:text-slate-300"
              }`} 
            />
            <span className={`text-[10px] font-medium transition-colors duration-300 ${
              isActive 
                ? "text-amber-500 font-bold" 
                : "text-slate-500"
            }`}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
