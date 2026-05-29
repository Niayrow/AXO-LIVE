export const LINE_COLORS: Record<string, string> = {
  "A": "#ef4444", // Red
  "B": "#3b82f6", // Blue
  "C1": "#a3e635", // Lime (clair)
  "C2": "#15803d", // Green (foncé)
  "D": "#eab308", // Yellow
  "E": "#50B032", // Greenish Lime
  "EXAL": "#E2007A", // Magenta/Pink
  "F": "#F29200", // Orange
  "S1": "#842082", // Purple
  "S2": "#FFCC01", // Gold
  "S3": "#EB5078", // Pink/Coral
  "S5": "#93C120", // Apple Green
  "S6": "#00B2EC", // Cyan/Sky Blue
  "S7": "#BF9616", // Bronze/Olive
};

export const getLineColor = (routeId?: string) => LINE_COLORS[routeId || ""] || "#f59e0b"; // default amber-500
