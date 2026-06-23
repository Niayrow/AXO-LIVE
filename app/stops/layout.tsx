import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Horaires de passage & Liste des arrêts",
  description: "Consultez la liste complète des arrêts du réseau de bus AXO à Creil. Horaires de passage théoriques et prochains passages des bus en direct en temps réel.",
  keywords: [
    "horaires bus Creil",
    "arrêts de bus AXO",
    "prochains passages bus Creil",
    "fiche horaire AXO",
    "horaires bus ligne A Creil",
    "horaires bus ligne B Creil",
    "horaire bus oise"
  ],
  alternates: {
    canonical: "/stops",
  },
  openGraph: {
    title: "Horaires de passage & Liste des arrêts | AXO Live",
    description: "Recherchez votre arrêt de bus AXO et obtenez instantanément les prochains départs théoriques et les passages en direct.",
    url: "/stops",
    type: "website",
  }
};

export default function StopsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
