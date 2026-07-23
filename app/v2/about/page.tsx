"use client";

import Link from "next/link";
import {
  ExternalLink,
  Code,
  Shield,
  Globe,
  Cookie,
  Server,
  ArrowLeft,
} from "lucide-react";

function InfoCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  children,
}: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  iconColor: string;
  iconBg: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-om-lg border border-om-border shadow-om p-6">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
        >
          <Icon size={20} className={iconColor} />
        </div>
        <h2 className="text-base font-extrabold text-om-charcoal">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function V2AboutPage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 v2-animate-in">
      <Link
        href="/v2"
        className="inline-flex items-center gap-2 text-sm font-bold text-om-muted hover:text-om-coral transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Retour à l&apos;accueil
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-om-charcoal mb-1">
          axo <span className="text-om-green">live</span>{" "}
          <span className="text-om-coral text-lg">2.0</span>
        </h1>
        <p className="text-sm text-om-muted font-semibold">
          Suivi en temps réel du réseau de bus AXO
        </p>
      </div>

      <div className="space-y-4">
        <InfoCard
          icon={Shield}
          iconColor="text-om-coral"
          iconBg="bg-om-coral/10"
          title="Avertissement"
        >
          <p className="text-sm text-om-muted leading-relaxed">
            <strong className="text-om-charcoal">AXO Live</strong> est un{" "}
            <strong className="text-om-coral">projet personnel indépendant</strong>.
            Cette application n&apos;est en aucun cas affiliée au réseau de transport{" "}
            <strong className="text-om-charcoal">AXO</strong>, à ses opérateurs, ni à
            aucune collectivité.
          </p>
          <p className="text-xs text-om-muted leading-relaxed mt-3">
            Les données proviennent de sources publiques ouvertes (GTFS / GTFS-RT) et
            sont fournies à titre informatif.
          </p>
        </InfoCard>

        <InfoCard
          icon={Code}
          iconColor="text-om-green"
          iconBg="bg-om-green-light"
          title="Développeur"
        >
          <p className="text-sm text-om-muted leading-relaxed">
            Application conçue par{" "}
            <a
              href="https://sofianeweb.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-om-coral font-bold hover:text-om-coral-dark transition-colors"
            >
              sofianeweb.fr
              <ExternalLink size={11} />
            </a>
          </p>
          <p className="text-xs text-om-muted mt-2">
            Next.js, React, Leaflet, TanStack Query, Tailwind CSS, GTFS-RT.
          </p>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-om-border">
            <Server size={12} className="text-om-muted" />
            <p className="text-xs text-om-muted">
              Hébergé sur <strong className="text-om-charcoal">Vercel</strong>
            </p>
          </div>
        </InfoCard>

        <InfoCard
          icon={Globe}
          iconColor="text-om-green"
          iconBg="bg-om-green-light"
          title="Sources de données"
        >
          <ul className="space-y-2">
            {[
              "Positions en temps réel — GTFS-RT (Oise Mobilité / Cityway)",
              "Tracés & arrêts — Données GTFS statiques (open data)",
              "Alertes & perturbations — GTFS-RT Service Alerts",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-om-green mt-2 shrink-0" />
                <span className="text-xs text-om-muted">{item}</span>
              </li>
            ))}
          </ul>
        </InfoCard>

        <InfoCard
          icon={Cookie}
          iconColor="text-om-muted"
          iconBg="bg-om-surface"
          title="RGPD & Cookies"
        >
          <p className="text-sm text-om-muted leading-relaxed">
            Cette application{" "}
            <strong className="text-om-green">ne collecte aucune donnée personnelle</strong>.
            Un cookie technique optionnel peut mémoriser le choix d&apos;interface (v1/v2).
            Vercel Analytics mesure la fréquentation de manière anonyme.
          </p>
        </InfoCard>
      </div>

      <footer className="text-center mt-8 pb-4 space-y-2">
        <p className="text-xs text-om-muted font-semibold">
          Conçu et développé dans le Bassin Creillois
        </p>
        <p className="text-[11px] text-om-muted">
          © {currentYear} —{" "}
          <a
            href="https://sofianeweb.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-om-coral hover:text-om-coral-dark"
          >
            sofianeweb.fr
          </a>
        </p>
      </footer>
    </div>
  );
}
