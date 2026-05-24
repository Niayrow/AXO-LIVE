export const LINE_COLORS: Record<string, string> = {
  "A": "#ef4444", // red-500
  "B": "#3b82f6", // blue-500
  "C1": "#a3e635", // lime-400 (clair)
  "C2": "#15803d", // green-700 (foncé)
  "D": "#eab308", // yellow-500
};

export const getLineColor = (routeId?: string) => LINE_COLORS[routeId || ""] || "#f59e0b"; // default amber-500
