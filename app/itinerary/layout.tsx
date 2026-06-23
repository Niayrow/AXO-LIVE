import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculateur d'Itinéraire & Trajets",
  description: "Calculez votre itinéraire en bus sur le réseau AXO (Bassin de Creil). Trouvez le trajet le plus rapide avec les correspondances et les prochains passages en direct.",
  keywords: [
    "calcul itinéraire bus Creil",
    "trajet bus AXO",
    "itinéraire transports Creil",
    "bus creil correspondance",
    "planifier trajet bus Oise",
    "meilleur itinéraire AXO"
  ],
  alternates: {
    canonical: "/itinerary",
  },
  openGraph: {
    title: "Calculateur d'Itinéraire & Trajets | AXO Live",
    description: "Saisissez votre arrêt de départ et votre destination pour obtenir le meilleur itinéraire en bus sur le réseau AXO avec temps de trajet estimé.",
    url: "/itinerary",
    type: "website",
  }
};

export default function ItineraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
