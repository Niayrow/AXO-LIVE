import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Infos Trafic & État du Réseau",
  description: "Suivez l'état du réseau de bus AXO à Creil en direct. Consultez les perturbations de trafic, les alertes en cours et la ponctualité (retards et avances) des bus en circulation.",
  keywords: [
    "infos trafic AXO",
    "perturbations bus Creil",
    "état réseau AXO",
    "retard bus Creil",
    "ponctualité bus AXO",
    "alertes trafic bus Oise"
  ],
  alternates: {
    canonical: "/supervision",
  },
  openGraph: {
    title: "Infos Trafic & État du Réseau | AXO Live",
    description: "Consultez en direct les perturbations, travaux et déviations sur le réseau de bus AXO de Creil, ainsi que la ponctualité de tous les bus.",
    url: "/supervision",
    type: "website",
  }
};

export default function SupervisionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
