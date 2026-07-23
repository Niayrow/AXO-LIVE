import Link from "next/link";
import {
  Map,
  Compass,
  Clock,
  Activity,
  Info,
} from "lucide-react";

const links = [
  { name: "Carte interactive", href: "/v2/map", icon: Map },
  { name: "Itinéraires", href: "/v2/itinerary", icon: Compass },
  { name: "Horaires arrêts", href: "/v2/stops", icon: Clock },
  { name: "Infos trafic", href: "/v2/supervision", icon: Activity },
  { name: "À propos", href: "/v2/about", icon: Info },
];

export default function QuickLinksBar() {
  return (
    <div className="relative -mt-8 mx-4 max-w-3xl lg:mx-auto">
      <div className="bg-white rounded-om-lg shadow-om-lg border border-om-border p-3">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-om-surface transition-all group active:scale-[0.97]"
              >
                <div className="w-10 h-10 rounded-xl bg-om-coral/8 flex items-center justify-center group-hover:bg-om-coral/15 transition-colors">
                  <Icon size={20} className="text-om-coral" strokeWidth={2} />
                </div>
                <span className="text-[10px] font-bold text-om-charcoal text-center leading-tight">
                  {link.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
