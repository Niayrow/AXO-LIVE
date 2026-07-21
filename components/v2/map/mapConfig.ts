import L from "leaflet";

export const V2_MAP_STYLES = `
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

  @keyframes v2-pulse-ring {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.08); opacity: 0.85; }
  }
  @keyframes v2-rotate-coral {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes v2-bus-halo-pulse {
    0%, 100% { opacity: 0.9; transform: translate(-50%, -50%) scale(1); }
    50% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
  }

  .custom-bus-marker-v2 {
    background: transparent !important;
    border: none !important;
  }

  .v2-bus-body {
    transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center center;
  }

  .v2-bus-halo {
    transform: translate(-50%, -50%);
    animation: v2-bus-halo-pulse 1.8s ease-in-out infinite;
  }

  .custom-stop-marker {
    background: transparent !important;
    border: none !important;
  }

  .stop-label-pill {
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(8px) !important;
    border: 1.5px solid #E8ECF0 !important;
    border-radius: 10px !important;
    box-shadow: 0 4px 16px rgba(45, 52, 54, 0.12) !important;
    color: #2D3436 !important;
    font-size: 10.5px !important;
    font-weight: 700 !important;
    font-family: var(--font-nunito, 'Nunito', system-ui, sans-serif) !important;
    padding: 4px 10px !important;
    white-space: nowrap !important;
    pointer-events: auto !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
  }
  .stop-label-pill::before {
    display: none !important;
  }

  .stop-label-selected {
    background: rgba(232, 87, 74, 0.12) !important;
    border: 1.5px solid #E8574A !important;
    color: #E8574A !important;
    font-size: 12px !important;
    font-weight: 800 !important;
    box-shadow: 0 0 12px rgba(232, 87, 74, 0.25), 0 4px 16px rgba(45, 52, 54, 0.1) !important;
  }

  .stop-tooltip-clean {
    background: transparent !important;
    border: none !important;
    color: #2D3436 !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    text-shadow: 0 1px 2px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.8) !important;
    padding: 0 !important;
    pointer-events: auto !important;
    cursor: pointer !important;
  }
  .stop-tooltip-clean::before { display: none !important; }
  .stop-tooltip-selected { color: #E8574A !important; }

  .leaflet-marker-pane { z-index: 700 !important; }
  .leaflet-tooltip-pane { z-index: 600 !important; }

  .leaflet-container {
    background-color: #F7F8FA !important;
  }
  .leaflet-tile {
    filter: saturate(1.05) brightness(1.02) !important;
  }
`;
