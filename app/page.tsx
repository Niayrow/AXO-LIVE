"use client";

import Link from "next/link";
import { 
  Map, 
  Compass, 
  List, 
  Activity, 
  ArrowRight, 
  Bus, 
  AlertCircle, 
  Info,
  Clock
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  // Fetch real-time alerts to display a live ticker or status badge on the home page
  const { data: alertsData } = useQuery({
    queryKey: ["networkAlerts"],
    queryFn: async () => {
      const res = await fetch("/api/axo/alerts");
      if (!res.ok) return { alerts: [] };
      return res.json();
    },
    refetchInterval: 60000, // Refresh alerts every minute
  });

  const activeAlerts = alertsData?.alerts || [];
  const alertCount = activeAlerts.length;

  const tools = [
    {
      name: "Infos Trafic",
      description: "Consultez l'état du réseau en direct, visualisez la régularité des lignes, le taux de ponctualité et les alertes info trafic actives.",
      href: "/supervision",
      icon: Activity,
      tag: "Dashboard Live",
      colorClass: "from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-400",
      badge: alertCount > 0 ? `${alertCount} alerte${alertCount > 1 ? 's' : ''}` : "Trafic normal",
      badgeColor: alertCount > 0 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    {
      name: "Carte Interactive",
      description: "Visualisez la position géographique des bus en direct sur la carte du bassin de Creil, ainsi que le tracé complet de toutes les lignes AXO.",
      href: "/map",
      icon: Map,
      tag: "Suivi Direct",
      colorClass: "from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400",
      badge: "Positions GPS",
      badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    {
      name: "Planificateur d'Itinéraires",
      description: "Calculez instantanément le trajet optimal d'un point A à un point B, avec des calculs de correspondances automatiques et les prochains départs.",
      href: "/itinerary",
      icon: Compass,
      tag: "Calcul Intelligent",
      colorClass: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400",
      badge: "Multimodal",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    {
      name: "Horaires & Arrêts",
      description: "Accédez à la liste complète de toutes les stations, recherchez votre arrêt et consultez les grilles horaires théoriques ainsi que les prochains passages.",
      href: "/stops",
      icon: List,
      tag: "Fiches Horaires",
      colorClass: "from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-400",
      badge: "Temps Réel",
      badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
  ];

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col items-center justify-start overflow-x-hidden">
      
      {/* Decorative Premium Glow Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-amber-500/10 to-transparent blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-gradient-to-t from-blue-500/5 to-transparent blur-[100px] rounded-full pointer-events-none z-0" />
      
      {/* Core Container */}
      <div className="relative z-10 w-full max-w-5xl px-6 pt-16 pb-24 flex flex-col items-center">
        
        {/* Top Premium Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-white/10 shadow-lg mb-6 backdrop-blur-md animate-fade-in">
          <Bus size={14} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
            Réseau AXO • Bassin de Creil
          </span>
        </div>

        {/* Hero Header */}
        <div className="text-center max-w-2xl mb-12 space-y-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
            Portail de Mobilité <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-gold text-transparent bg-clip-text drop-shadow-[0_2px_15px_rgba(245,158,11,0.2)]">
              AXO Live
            </span>
          </h1>
          <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed max-w-lg mx-auto">
            Accédez à toutes vos informations de déplacement en direct. Suivez le trafic, planifiez vos trajets et consultez les horaires temps réel en un instant.
          </p>
        </div>

        {/* Active Alert Banner if any */}
        {alertCount > 0 && (
          <div className="w-full mb-8 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3 backdrop-blur-xl shadow-lg animate-pulse">
            <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide">
                Perturbations en cours ({alertCount})
              </h4>
              <p className="text-xs text-slate-300 mt-1 line-clamp-1">
                {activeAlerts[0]?.header_text || "Des perturbations affectent actuellement le réseau de bus AXO."}
              </p>
              <Link href="/supervision" className="text-[10px] font-bold text-red-400 hover:underline flex items-center gap-1 mt-2">
                Voir toutes les alertes infos trafic <ArrowRight size={10} />
              </Link>
            </div>
          </div>
        )}

        {/* 2x2 Interactive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-2">
          {tools.map((tool, idx) => {
            const IconComponent = tool.icon;
            return (
              <Link 
                key={idx}
                href={tool.href}
                className="group relative flex flex-col justify-between bg-slate-900/40 hover:bg-slate-900/80 border border-white/5 hover:border-amber-500/30 rounded-3xl p-6 md:p-8 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(245,158,11,0.06)] backdrop-blur-md overflow-hidden"
              >
                {/* Visual Glass Glow inside card */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent blur-2xl rounded-full pointer-events-none group-hover:scale-125 transition-transform duration-500" />
                
                <div>
                  {/* Card Top Row */}
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-4.5 rounded-2xl bg-slate-950 border border-white/5 text-amber-500 transition-transform duration-300 group-hover:scale-110 shadow-inner flex items-center justify-center`}>
                      <IconComponent size={24} className="text-amber-500" />
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-amber-500 transition-colors">
                        {tool.tag}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${tool.badgeColor}`}>
                        {tool.badge}
                      </span>
                    </div>
                  </div>

                  {/* Card Typography */}
                  <h3 className="text-lg font-bold text-slate-100 group-hover:text-white tracking-wide transition-colors">
                    {tool.name}
                  </h3>
                  
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed mt-2.5">
                    {tool.description}
                  </p>
                </div>

                {/* Card Action footer */}
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500/70 group-hover:text-amber-400 mt-6 transition-colors">
                  Accéder à l'outil 
                  <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Live Network Status Widget */}
        <div className="w-full mt-12 bg-slate-900/30 border border-white/5 rounded-3xl p-6 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200">État général du réseau AXO</h4>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Données GTFS-RT provenant de l'autorité Oise Mobilité
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-center sm:text-right">
              <div className="text-base font-black text-slate-200">En direct</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Mises à jour: ~20s</div>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-400">Système opérationnel</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
