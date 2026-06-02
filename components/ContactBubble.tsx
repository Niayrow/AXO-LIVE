"use client";

import { useState } from "react";
import { MessageCircle, X, Mail } from "lucide-react";

export default function ContactBubble() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-24 right-4 z-[60] flex flex-col items-end gap-3">
      {/* Contact Card */}
      <div
        className={`w-72 bg-slate-950/70 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-300 origin-bottom-right ${
          isOpen
            ? "scale-100 opacity-100 translate-y-0 pointer-events-auto"
            : "scale-90 opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {/* Card Header */}
        <div className="relative px-5 pt-5 pb-4 border-b border-white/5">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <h3 className="text-sm font-black text-white tracking-wide">
            Nous contacter
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
            Une question ? Un problème ? Nous sommes à votre écoute.
          </p>
        </div>

        {/* Contact Options */}
        <div className="p-3 space-y-2">
          <a
            href="mailto:contact@sofianeweb.fr"
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:border-amber-500/30 hover:bg-slate-900/80 transition-all group"
          >
            <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
              <Mail size={16} className="text-amber-500" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-slate-200 group-hover:text-white transition-colors">
                Email
              </span>
              <span className="text-[9px] text-slate-500 truncate">
                contact@sofianeweb.fr
              </span>
            </div>
          </a>

          <div
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-white/5 opacity-50 cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <MessageCircle size={16} className="text-sky-500" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-slate-200">
                Chat en direct
              </span>
              <span className="text-[9px] text-amber-500/80 font-semibold">
                Bientôt disponible
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bubble Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 cursor-pointer hover:scale-110 active:scale-95 border ${
          isOpen
            ? "bg-slate-950/80 backdrop-blur-xl border-white/10 text-slate-300 rotate-0"
            : "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
        }`}
        title="Nous contacter"
      >
        {isOpen ? (
          <X size={20} className="stroke-[2.5]" />
        ) : (
          <MessageCircle size={20} className="stroke-[2.5]" />
        )}
      </button>
    </div>
  );
}
