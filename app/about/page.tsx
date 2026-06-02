"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Code, Shield, Heart, Globe, Cookie, Server } from "lucide-react";

export default function AboutPage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col items-center overflow-hidden px-6 py-10">

      {/* Ambient glow effects */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-amber-500/8 blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-50px] w-[300px] h-[300px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Back button (Floating glassmorphic circular button in the top-left corner of the screen) */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center justify-center w-10 h-10 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 text-slate-400 hover:text-white hover:border-white/20 hover:bg-slate-850 transition-all duration-300 hover:scale-110 active:scale-95 shadow-[0_4px_12px_rgba(0,0,0,0.3)] group z-20"
        title="Retour"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
      </Link>

      <div className="relative z-10 w-full max-w-md flex flex-col">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tight mb-2">
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-transparent bg-clip-text">
              AXO
            </span>
            <span className="text-white"> Live</span>
          </h1>
          <p className="text-xs text-slate-500 font-semibold tracking-wide">
            Suivi en temps réel du réseau de bus
          </p>
        </div>

        {/* Main disclaimer card */}
        <div className="bg-slate-950/60 backdrop-blur-3xl border border-white/[0.08] rounded-[24px] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.4)] mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Shield size={20} className="text-amber-500" />
            </div>
            <h2 className="text-base font-black text-white uppercase tracking-wide">
              Avertissement
            </h2>
          </div>
          <p className="text-[13px] text-slate-300 leading-relaxed">
            <strong className="text-white">AXO Live</strong> est un <strong className="text-amber-400">projet personnel indépendant</strong>. 
            Cette application n'est en aucun cas affiliée, sponsorisée, approuvée ou liée de quelque manière que ce soit 
            au réseau de transport <strong className="text-white">AXO</strong>, à ses opérateurs, 
            ni à aucune collectivité ou autorité organisatrice de transport.
          </p>
          <p className="text-[12px] text-slate-400 leading-relaxed mt-3">
            Les données affichées proviennent de sources publiques ouvertes (GTFS / GTFS-RT). 
            Elles sont fournies à titre purement informatif et ne saurait engager la responsabilité de l'auteur 
            en cas d'inexactitude ou de retard.
          </p>
        </div>

        {/* Developer card */}
        <div className="bg-slate-950/60 backdrop-blur-3xl border border-white/[0.08] rounded-[24px] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.4)] mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Code size={20} className="text-cyan-400" />
            </div>
            <h2 className="text-base font-black text-white uppercase tracking-wide">
              Développeur
            </h2>
          </div>
          <p className="text-[13px] text-slate-300 leading-relaxed">
            Application conçue et développée avec passion par{" "}
            <a
              href="https://sofianeweb.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-amber-400 font-bold hover:text-amber-300 transition-colors underline underline-offset-2 decoration-amber-400/30"
            >
              sofianeweb.fr
              <ExternalLink size={11} className="shrink-0" />
            </a>
          </p>
          <p className="text-[12px] text-slate-400 leading-relaxed mt-2">
            Stack technique : Next.js, React, Leaflet, TanStack Query, Tailwind CSS, GTFS-RT (Protobuf).
          </p>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
            <Server size={12} className="text-slate-500 shrink-0" />
            <p className="text-[11px] text-slate-500">
              Hébergé sur <strong className="text-slate-400">Vercel</strong> — Edge Network mondial.
            </p>
          </div>
        </div>

        {/* Data sources card */}
        <div className="bg-slate-950/60 backdrop-blur-3xl border border-white/[0.08] rounded-[24px] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.4)] mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Globe size={20} className="text-emerald-400" />
            </div>
            <h2 className="text-base font-black text-white uppercase tracking-wide">
              Sources de données
            </h2>
          </div>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span className="text-[12px] text-slate-300">
                <strong className="text-white">Positions en temps réel</strong> — Flux GTFS-RT (Oise Mobilité / Cityway)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span className="text-[12px] text-slate-300">
                <strong className="text-white">Tracés & arrêts</strong> — Données GTFS statiques (open data)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span className="text-[12px] text-slate-300">
                <strong className="text-white">Alertes & perturbations</strong> — GTFS-RT Service Alerts
              </span>
            </li>
          </ul>
        </div>

        {/* RGPD & Cookies card */}
        <div className="bg-slate-950/60 backdrop-blur-3xl border border-white/[0.08] rounded-[24px] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.4)] mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
              <Cookie size={20} className="text-violet-400" />
            </div>
            <h2 className="text-base font-black text-white uppercase tracking-wide">
              RGPD & Cookies
            </h2>
          </div>
          <p className="text-[13px] text-slate-300 leading-relaxed">
            Cette application <strong className="text-emerald-400">ne collecte aucune donnée personnelle</strong> et 
            ne dépose <strong className="text-emerald-400">aucun cookie</strong>. 
            Seul <strong className="text-white">Vercel Analytics</strong> est utilisé pour mesurer la fréquentation de manière 
            anonyme et respectueuse de la vie privée (aucun traceur publicitaire, aucune donnée revendue).
          </p>
          <p className="text-[12px] text-slate-400 leading-relaxed mt-3">
            Aucune inscription n'est requise. Toutes les données de transport transitent directement depuis les flux publics vers votre appareil, sans stockage côté serveur.
          </p>
        </div>

        {/* Made with love */}
        <div className="bg-slate-950/60 backdrop-blur-3xl border border-white/[0.08] rounded-[24px] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.4)] mb-6">
          <p className="text-[12px] text-slate-400 text-center leading-relaxed flex items-center justify-center gap-1.5 flex-wrap">
            Fait avec <Heart size={12} className="text-red-400 fill-red-400 animate-pulse" /> dans le Bassin Creillois
          </p>
        </div>

        {/* Copyright footer */}
        <div className="text-center space-y-2 pb-6">
          <p className="text-[11px] text-slate-500 font-semibold">
            © {currentYear} —{" "}
            <a
              href="https://sofianeweb.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-500/80 hover:text-amber-400 transition-colors"
            >
              sofianeweb.fr
            </a>
          </p>
          <p className="text-[10px] text-slate-600">
            Tous droits réservés. Projet personnel non-affilié au réseau AXO.
          </p>
        </div>
      </div>
    </div>
  );
}
