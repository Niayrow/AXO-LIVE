import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import V2Header from "@/components/v2/Header";
import V2BottomNav from "@/components/v2/BottomNav";
import "./globals-v2.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: {
    default: "AXO Live 2.0 — Bus en Temps Réel Creil",
    template: "%s | AXO Live 2.0",
  },
  description:
    "Nouvelle interface AXO Live — Suivez les bus du réseau AXO en temps réel, consultez les horaires et planifiez vos trajets.",
};

export default function V2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`v2-root ${nunito.className} min-h-[100dvh] bg-om-surface font-nunito`}
    >
      <V2Header />
      <main className="pb-28">{children}</main>
      <V2BottomNav />
    </div>
  );
}
