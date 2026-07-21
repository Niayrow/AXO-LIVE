import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ContactBubble from "@/components/ContactBubble";
import V2PromoBanner from "@/components/V2PromoBanner";
import Providers from "./providers";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://axo-live.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AXO Live - Horaires & Bus en Temps Réel Creil",
    template: "%s | AXO Live"
  },
  description: "Suivez en direct la position des bus du réseau AXO (Creil), consultez les horaires de passage en temps réel, l'état du trafic, les perturbations et planifiez votre trajet.",
  keywords: [
    "AXO Live",
    "bus Creil",
    "transports Creil",
    "AXO bus",
    "horaires bus Creil",
    "bus en direct",
    "temps réel",
    "itinéraires AXO",
    "Oise Mobilité",
    "perturbations bus Creil",
    "ligne A Creil",
    "ligne B Creil",
    "réseau AXO",
    "bus Oise"
  ],
  authors: [{ name: "Sofiane", url: "https://sofianeweb.fr" }],
  creator: "Sofiane",
  publisher: "AXO Live",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    title: "AXO Live - Suivi Bus et Horaires en Temps Réel",
    description: "Suivez en temps réel la position des bus AXO (Bassin de Creil). Horaires de passage actualisés en direct, état du trafic et calcul d'itinéraire.",
    siteName: "AXO Live",
    images: [
      {
        url: "/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "AXO Live - Bus en temps réel",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AXO Live - Suivi Bus et Horaires en Temps Réel",
    description: "Suivez en direct la position des bus du réseau AXO (Creil). Horaires, itinéraire et info trafic en temps réel.",
    images: ["/icon-512x512.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AXO Live",
  },
};


const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "AXO Live",
    "url": siteUrl,
    "description": "Suivi en temps réel, horaires et état du trafic du réseau de bus AXO (Bassin de Creil).",
    "inLanguage": "fr-FR",
    "publisher": {
      "@type": "Organization",
      "name": "AXO Live",
      "logo": {
        "@type": "ImageObject",
        "url": `${siteUrl}/icon-512x512.png`
      }
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "TransitMap",
    "name": "Carte Temps Réel AXO Live",
    "url": `${siteUrl}/map`,
    "description": "Carte interactive de suivi des bus du réseau AXO Creil en temps réel.",
    "spatialCoverage": {
      "@type": "Place",
      "name": "Bassin de Creil, Oise, France",
      "geo": {
        "@type": "GeoShape",
        "addressCountry": "FR",
        "addressRegion": "Hauts-de-France"
      }
    }
  }
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.className} bg-slate-950 text-slate-50 overscroll-none h-[100dvh] w-full max-w-[100vw] overflow-hidden`}>
        <Providers>
          <div className="h-full w-full overflow-y-auto overflow-x-hidden no-scrollbar">
            <V2PromoBanner />
            {children}
          </div>
          <BottomNav />
          <ContactBubble />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}

