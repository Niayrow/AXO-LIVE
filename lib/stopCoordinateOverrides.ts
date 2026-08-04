/**
 * Corrections manuelles de coordonnées GTFS (lat/lon incorrectes côté open data).
 * Clé = stop_id GTFS.
 */
export const STOP_COORDINATE_OVERRIDES: Record<
  string,
  { stop_lat: number; stop_lon: number }
> = {
  // Marseillaise — direction Place de la République (ligne D)
  maxmar1: { stop_lat: 49.233389, stop_lon: 2.460133 },
};

export function applyStopCoordinateOverride<
  T extends { stop_id?: string; stop_lat?: number | string; stop_lon?: number | string },
>(stop: T): T {
  if (!stop?.stop_id) return stop;
  const override = STOP_COORDINATE_OVERRIDES[stop.stop_id];
  if (!override) return stop;
  return {
    ...stop,
    stop_lat: override.stop_lat,
    stop_lon: override.stop_lon,
  };
}

export function getOverriddenStopCoords(
  stopId: string,
  lat: number,
  lon: number
): { lat: number; lon: number } {
  const override = STOP_COORDINATE_OVERRIDES[stopId];
  if (!override) return { lat, lon };
  return { lat: override.stop_lat, lon: override.stop_lon };
}
