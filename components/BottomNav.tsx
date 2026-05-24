"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Compass, List, Activity } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Carte", href: "/map", icon: Map },
    { name: "Itinéraires", href: "/itinerary", icon: Compass },
    { name: "Arrêts", href: "/stops", icon: List },
    { name: "Infos Trafic", href: "/supervision", icon: Activity },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 backdrop-blur-md bg-slate-950/70 border-t border-white/10 z-50 px-6 pb-safe flex justify-between items-center">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className="relative flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            {/* Active Indicator Line */}
            {isActive && (
              <div className="absolute top-0 w-12 h-[3px] bg-amber-500 rounded-b-full shadow-[0_0_12px_rgba(245,158,11,1)]" />
            )}
            
            <Icon 
              size={24} 
              className={`transition-all duration-300 ${
                isActive 
                  ? "text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                  : "text-slate-400"
              }`} 
            />
            <span className={`text-[11px] font-medium transition-colors duration-300 ${
              isActive 
                ? "text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                : "text-slate-400"
            }`}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
