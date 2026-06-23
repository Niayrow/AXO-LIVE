import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Carte interactive en temps réel",
  description: "Visualisez en temps réel sur la carte interactive la position exacte de tous les bus du réseau AXO à Creil. Suivi GPS en direct et horaires à chaque arrêt.",
  keywords: [
    "carte bus Creil",
    "position bus temps réel",
    "carte live AXO",
    "suivi bus GPS Creil",
    "bus en direct Creil",
    "carte interactive transports Creil"
  ],
  alternates: {
    canonical: "/map",
  },
  openGraph: {
    title: "Carte interactive en temps réel | AXO Live",
    description: "Visualisez la position en direct des bus AXO sur une carte interactive avec tracé des lignes et heures de passage à chaque arrêt.",
    url: "/map",
    type: "website",
  }
};

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
