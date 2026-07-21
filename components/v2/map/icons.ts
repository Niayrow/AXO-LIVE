import L from "leaflet";
import { getLineColor } from "@/components/lineColors";

const V2_BG = "#FFFFFF";
const V2_CORAL = "#E8574A";
const V2_CHARCOAL = "#2D3436";

/** Vue de dessus d'un bus — forme allongée orientée selon le cap */
const busTopDownSvg = (lineColor: string, isSelected: boolean) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 44" width="28" height="44" style="display:block;filter:${
    isSelected
      ? `drop-shadow(0 0 6px ${lineColor}aa) drop-shadow(0 2px 4px rgba(45,52,54,0.25))`
      : "drop-shadow(0 2px 4px rgba(45,52,54,0.22))"
  };">
    <!-- Carrosserie -->
    <rect x="5" y="3" width="18" height="38" rx="7" fill="${V2_BG}" stroke="${lineColor}" stroke-width="${isSelected ? "2.8" : "2.2"}"/>

    <!-- Pare-brise avant (sens de marche = haut) -->
    <rect x="7.5" y="5.5" width="13" height="9" rx="3" fill="${lineColor}" opacity="0.92"/>

    <!-- Vitres latérales -->
    <rect x="7" y="17" width="5" height="10" rx="1.5" fill="${lineColor}" opacity="0.18"/>
    <rect x="16" y="17" width="5" height="10" rx="1.5" fill="${lineColor}" opacity="0.18"/>

    <!-- Hayon arrière -->
    <rect x="8" y="34" width="12" height="4" rx="1.5" fill="${lineColor}" opacity="0.35"/>

    <!-- Roues -->
    <rect x="3" y="10" width="3.5" height="7" rx="1.5" fill="${V2_CHARCOAL}" opacity="0.75"/>
    <rect x="21.5" y="10" width="3.5" height="7" rx="1.5" fill="${V2_CHARCOAL}" opacity="0.75"/>
    <rect x="3" y="27" width="3.5" height="7" rx="1.5" fill="${V2_CHARCOAL}" opacity="0.75"/>
    <rect x="21.5" y="27" width="3.5" height="7" rx="1.5" fill="${V2_CHARCOAL}" opacity="0.75"/>

    <!-- Flèche directionnelle discrète à l'avant -->
    <path d="M14 7 L11 11 L17 11 Z" fill="white" opacity="0.95"/>
  </svg>
`;

export const createBusIconV2 = (
  routeId: string = "B",
  bearing: number = 0,
  delaySeconds: number = 0,
  isSelected: boolean = false
) => {
  const lineColor = getLineColor(routeId);
  const isDelayed = delaySeconds >= 300;
  const normalizedBearing = ((bearing % 360) + 360) % 360;

  const html = `
    <div style="position:relative;width:40px;height:52px;overflow:visible;">
      <!-- Badge ligne — reste droit -->
      <div style="
        position:absolute;top:0;left:50%;transform:translateX(-50%);
        min-width:${isSelected ? "20px" : "18px"};height:${isSelected ? "16px" : "15px"};padding:0 5px;
        background:${lineColor};color:white;
        border:1.5px solid white;border-radius:7px;
        font-size:${isSelected ? "9px" : "8px"};font-weight:900;font-family:'Nunito',system-ui,sans-serif;
        display:flex;align-items:center;justify-content:center;
        white-space:nowrap;line-height:1;z-index:20;
        box-shadow:${isSelected ? `0 2px 10px ${lineColor}66` : "0 2px 6px rgba(45,52,54,0.2)"};
        letter-spacing:0.02em;
      ">${routeId}</div>

      <!-- Corps du bus — rotation selon le cap GTFS -->
      <div
        class="v2-bus-body${isSelected ? " v2-bus-body--selected" : ""}"
        style="
          position:absolute;top:14px;left:50%;
          width:28px;height:44px;
          margin-left:-14px;
          transform:rotate(${normalizedBearing}deg)${isSelected ? " scale(1.08)" : ""};
          z-index:10;
        "
      >
        ${
          isSelected
            ? `<div class="v2-bus-halo" style="
                position:absolute;left:50%;top:50%;
                width:34px;height:48px;
                border-radius:16px;
                background:${lineColor}20;
                box-shadow:0 0 0 2.5px ${lineColor}, 0 0 16px ${lineColor}50;
                pointer-events:none;z-index:0;
              "></div>`
            : ""
        }
        <div style="position:relative;z-index:1;">
          ${busTopDownSvg(lineColor, isSelected)}
        </div>
      </div>

      ${isDelayed ? `
        <div style="
          position:absolute;top:12px;right:2px;width:9px;height:9px;
          background:${V2_CORAL};border:2px solid white;border-radius:50%;
          z-index:25;box-shadow:0 1px 4px rgba(232,87,74,0.5);
        " title="Bus en retard"></div>` : ""}
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-bus-marker-v2",
    iconSize: [40, 52],
    iconAnchor: [20, 36],
  });
};

export const createStopIconV2 = (
  isSelected: boolean = false,
  lines: string[] = [],
  zoomLevel: number = 13,
  activeLineId: string | null = null,
  stopName: string = ""
) => {
  const isStopOnActiveLine = activeLineId ? lines.includes(activeLineId) : false;
  const isMajorStop = lines.length >= 3 || /Gare|Mairie|Lycée|Collège/i.test(stopName);

  let size = 14;
  let opacity = 1;

  if (isSelected) {
    size = 24;
  } else if (activeLineId) {
    if (isStopOnActiveLine) {
      size = zoomLevel >= 16 ? 18 : zoomLevel >= 14 ? 12 : 8;
    } else {
      size = zoomLevel >= 16 ? 8 : zoomLevel >= 14 ? 5 : 0;
      opacity = 0.25;
    }
  } else {
    if (isMajorStop) {
      size = zoomLevel >= 16 ? 18 : zoomLevel >= 14 ? 12 : 8;
    } else {
      size = zoomLevel >= 16 ? 14 : zoomLevel >= 14 ? 6 : 0;
      opacity = zoomLevel >= 14 ? 0.6 : 0;
    }
  }

  if (size <= 0 || opacity <= 0) {
    return L.divIcon({
      html: '<div style="display:none"></div>',
      className: "custom-stop-marker-hidden",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  const colors = lines.length > 0 ? lines.map((l) => getLineColor(l)) : ["#636E72"];
  let ringGradient: string;
  if (colors.length === 1) {
    ringGradient = colors[0];
  } else {
    const segDeg = 360 / colors.length;
    ringGradient = `conic-gradient(from 90deg, ${colors.map((c, i) => `${c} ${i * segDeg}deg ${(i + 1) * segDeg}deg`).join(", ")})`;
  }

  const borderWidth = isSelected ? 3 : Math.max(1.5, size * 0.16);
  const innerSize = Math.max(2, size - borderWidth * 2);
  const radius = isSelected ? 8 : Math.max(2, size * 0.28);
  const selectedOutline = isSelected ? `outline: 2px solid ${V2_CORAL}; outline-offset: 2px;` : "";
  const shadow = isSelected
    ? "0 0 14px rgba(232,87,74,0.35), 0 2px 8px rgba(45,52,54,0.15)"
    : "0 2px 6px rgba(45,52,54,0.12)";
  const dotColor = isSelected ? V2_CORAL : V2_CHARCOAL;

  const html = `
    <div style="width:${size}px;height:${size}px;background:${ringGradient};border-radius:${radius}px;
      display:flex;align-items:center;justify-content:center;box-shadow:${shadow};${selectedOutline};
      opacity:${opacity};cursor:pointer;transition:all 0.25s ease;">
      <div style="width:${innerSize}px;height:${innerSize}px;background:${V2_BG};border-radius:${Math.max(1, radius - 1.5)}px;
        display:flex;align-items:center;justify-content:center;">
        <div style="width:${isSelected ? 6 : Math.max(1.5, size * 0.22)}px;height:${isSelected ? 6 : Math.max(1.5, size * 0.22)}px;
          background:${dotColor};border-radius:50%;"></div>
      </div>
    </div>`;

  return L.divIcon({
    html,
    className: "custom-stop-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export const createUserIconV2 = () => {
  if (typeof window === "undefined") return null as any;
  return L.divIcon({
    html: `
      <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:20px;height:20px;background:rgba(58,125,92,0.25);border-radius:50%;animation:pulse 2s infinite;"></div>
        <div style="position:absolute;width:14px;height:14px;background:#3A7D5C;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(45,52,54,0.2);"></div>
      </div>`,
    className: "custom-user-icon-v2",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};