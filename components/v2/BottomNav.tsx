"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Route, Home, MapPin, Signal } from "lucide-react";

const navItems = [
  { name: "Carte", href: "/v2/map", icon: Map, color: "#E8574A" },
  { name: "Trajet", href: "/v2/itinerary", icon: Route, color: "#3A7D5C" },
  { name: "Home", href: "/v2", icon: Home, color: "#E8574A", isCenter: true },
  { name: "Arrêts", href: "/v2/stops", icon: MapPin, color: "#2F80ED" },
  { name: "Trafic", href: "/v2/supervision", icon: Signal, color: "#F2994A" },
];

export default function V2BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-[70] px-4 pointer-events-none pb-safe">
      <div
        className="pointer-events-auto relative max-w-md mx-auto flex items-end justify-between gap-0.5 px-1.5 pt-1.5 pb-1.5 rounded-[26px] border border-white/70 shadow-[0_12px_40px_rgba(45,52,54,0.16)]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(247,248,250,0.94) 100%)",
          backdropFilter: "blur(20px)",
        }}
      >
        {navItems.map((item) => {
          const isActive =
            item.href === "/v2"
              ? pathname === "/v2"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <div
                key={item.href}
                className="flex-1 flex flex-col items-center justify-end -mt-7"
              >
                <Link
                  href={item.href}
                  className="flex items-center justify-center w-14 h-14 rounded-full border-[3px] border-white transition-all duration-200 hover:scale-105 active:scale-90"
                  style={{
                    backgroundColor: item.color,
                    color: "#fff",
                    boxShadow: isActive
                      ? `0 8px 24px ${item.color}55, 0 0 0 3px ${item.color}25`
                      : `0 8px 22px ${item.color}40`,
                  }}
                  title="Accueil"
                >
                  <Icon size={24} strokeWidth={2.5} />
                </Link>
                <span
                  className="text-[9px] font-extrabold tracking-wide mt-1"
                  style={{ color: isActive ? item.color : "#8B949E" }}
                >
                  {item.name}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-[20px] transition-all duration-200 active:scale-95"
              style={
                isActive
                  ? {
                      background: `linear-gradient(160deg, ${item.color}18 0%, ${item.color}08 100%)`,
                    }
                  : undefined
              }
            >
              <div
                className="flex items-center justify-center w-9 h-9 rounded-2xl transition-all duration-200"
                style={
                  isActive
                    ? {
                        backgroundColor: item.color,
                        color: "#fff",
                        boxShadow: `0 6px 16px ${item.color}45`,
                      }
                    : {
                        backgroundColor: "transparent",
                        color: "#8B949E",
                      }
                }
              >
                <Icon
                  size={isActive ? 18 : 17}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className="text-[9px] font-extrabold tracking-wide transition-colors"
                style={{ color: isActive ? item.color : "#8B949E" }}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
