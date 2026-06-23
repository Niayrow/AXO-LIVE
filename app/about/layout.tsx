import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "À propos & Mentions Légales",
  description: "Informations sur le projet indépendant AXO Live, les sources de données open data de transport (GTFS) et la politique de protection des données (RGPD).",
  keywords: [
    "à propos AXO Live",
    "mentions légales AXO Live",
    "projet indépendant bus Creil",
    "RGPD AXO Live",
    "open data Oise Mobilité",
    "GTFS Creil"
  ],
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "À propos & Mentions Légales | AXO Live",
    description: "Tout savoir sur le projet indépendant AXO Live, les données de transport utilisées en direct et le respect de la vie privée (sans cookies).",
    url: "/about",
    type: "website",
  }
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
