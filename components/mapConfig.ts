import L from "leaflet";

// Fix Leaflet's default icon paths in Next.js
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

export const MAP_STYLES = `
  @keyframes marquee-scroll {
    0% { transform: translate3d(0, 0, 0); }
    15% { transform: translate3d(0, 0, 0); }
    85% { transform: translate3d(var(--scroll-dist, 0px), 0, 0); }
    100% { transform: translate3d(var(--scroll-dist, 0px), 0, 0); }
  }
  .animate-direction-marquee {
    animation: marquee-scroll 8s ease-in-out infinite alternate;
  }
  @keyframes marquee-infinite {
    0% { transform: translate3d(0, 0, 0); }
    100% { transform: translate3d(-100%, 0, 0); }
  }
  .animate-marquee-infinite {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    animation: marquee-infinite var(--marquee-duration, 30s) linear infinite;
  }
  .marquee-parent:hover .animate-marquee-infinite {
    animation-play-state: paused;
  }

  /* Neon animation keyframes for selected bus marker */
  @keyframes rotate-neon {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes pulse-neon {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px #ff007f) drop-shadow(0 0 10px #00f0ff); }
    50% { transform: scale(1.1); filter: drop-shadow(0 0 10px #00ff66) drop-shadow(0 0 18px #ff007f); }
  }

  /* Bus stop custom marker: remove Leaflet's default wrapper styling */
  .custom-stop-marker {
    background: transparent !important;
    border: none !important;
  }

  /* Ultra-modern glassmorphic, compact stop label */
  .stop-label-pill {
    background: rgba(15, 23, 42, 0.85) !important;
    backdrop-filter: blur(6px) !important;
    border: 1.2px solid rgba(255, 255, 255, 0.15) !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6) !important;
    color: #cbd5e1 !important;
    font-size: 10.5px !important;
    font-weight: 700 !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    letter-spacing: 0.02em !important;
    padding: 3px 7.5px !important;
    white-space: nowrap !important;
    pointer-events: auto !important;
    cursor: pointer !important;
    transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, color 0.2s ease-in-out, box-shadow 0.2s ease-in-out !important;
  }
  .stop-label-pill::before {
    display: none !important;
  }

  /* Selected stop label: vibrant golden accent, neon border glow */
  .stop-label-selected {
    background: rgba(245, 158, 11, 0.2) !important;
    border: 1.5px solid #f59e0b !important;
    color: #f59e0b !important;
    font-size: 12px !important;
    padding: 4px 10px !important;
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.4), 0 4px 16px rgba(0, 0, 0, 0.7) !important;
    font-weight: 850 !important;
  }

  /* Legacy transparent halo labels (used when zoomed out and many labels visible) */
  .stop-tooltip-clean {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    color: #f8fafc !important;
    font-size: 11px !important;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    font-weight: 700 !important;
    letter-spacing: 0.01em !important;
    padding: 0 !important;
    margin-top: 4px !important;
    cursor: pointer !important;
    text-shadow: 
      -1.5px -1.5px 0 #020617,  
       1.5px -1.5px 0 #020617,
      -1.5px  1.5px 0 #020617,
       1.5px  1.5px 0 #020617,
       0px 4px 10px rgba(0,0,0,0.9) !important;
    pointer-events: auto !important;
    cursor: pointer !important;
    transition: color 0.2s ease-in-out;
  }
  .stop-tooltip-clean::before {
    display: none !important;
  }
  .stop-tooltip-selected {
    color: #22d3ee !important;
  }

  /* Force buses (markers) to render ABOVE stop names (tooltips) */
  .leaflet-marker-pane {
    z-index: 700 !important;
  }
  .leaflet-tooltip-pane {
    z-index: 600 !important;
  }

  /* Prevent light background flash when zooming or panning Google Maps tiles */
  .leaflet-container {
    background-color: #e5e7eb !important;
  }
`;
