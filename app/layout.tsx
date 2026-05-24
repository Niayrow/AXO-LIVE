import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "AXO Live Dashboard",
  description: "Supervision en temps réel du réseau de bus AXO",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AXO Live",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-50 overscroll-none h-screen w-screen overflow-hidden`}>
        <Providers>
          <div className="h-full w-full pb-20 overflow-y-auto no-scrollbar">
            {children}
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
