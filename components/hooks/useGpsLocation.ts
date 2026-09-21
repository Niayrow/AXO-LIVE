import { useState } from "react";
import L from "leaflet";

// Calculates absolute geodesic distance between two points in meters using Haversine algorithm
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
};

const GPS_ERROR_FALLBACK = "Impossible d'obtenir votre position";

const GPS_ERROR_MESSAGES: Record<number, string> = {
  1: "Localisation refusée : autorisez le GPS pour ce site",
  2: "Position indisponible : vérifiez votre GPS",
  3: "Localisation trop lente : réessayez",
};

export function useGpsLocation() {
  const [isLocating, setIsLocating] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);
  const [nearestStopBanner, setNearestStopBanner] = useState<string | null>(null);

  const handleLocateUser = (
    map: L.Map | null,
    allStops: any[] | undefined,
    setSelectedStopId: (id: string | null) => void,
    setSelectedBusId: (id: string | null) => void
  ) => {
    if (!navigator.geolocation) {
      setGpsWarning("Géolocalisation non supportée par ce navigateur");
      setTimeout(() => {
        setGpsWarning(null);
      }, 6000);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setUserCoords({ lat, lon });

        if (allStops && allStops.length > 0) {
          // Find closest stop
          let minDistance = Infinity;
          let closestStop: any = null;

          allStops.forEach((stop: any) => {
            const dist = getDistance(lat, lon, stop.stop_lat, stop.stop_lon);
            if (dist < minDistance) {
              minDistance = dist;
              closestStop = stop;
            }
          });

          if (closestStop) {
            // Check if too far (more than 20km)
            if (minDistance > 20000) {
              setGpsWarning("Position hors réseau AXO ou GPS imprécis (plus de 20 km)");
              setTimeout(() => {
                setGpsWarning(null);
              }, 6000);
              return;
            }

            if (map) {
              map.flyTo([lat, lon], 17, { animate: true, duration: 1.5 });
            }

            setSelectedStopId(closestStop.stop_id);
            setSelectedBusId(null);

            // Show a temporary banner with nearest stop
            setNearestStopBanner(closestStop.stop_name);
            setTimeout(() => {
              setNearestStopBanner(null);
            }, 6000);
          }
        }
      },
      (error) => {
        setIsLocating(false);
        // GeolocationPositionError n'est pas sérialisable : on log les champs utiles.
        console.warn(
          `Géolocalisation indisponible (code ${error.code}) : ${error.message}`
        );
        setGpsWarning(GPS_ERROR_MESSAGES[error.code] ?? GPS_ERROR_FALLBACK);
        setTimeout(() => {
          setGpsWarning(null);
        }, 6000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  return {
    isLocating,
    userCoords,
    gpsWarning,
    nearestStopBanner,
    setGpsWarning,
    setNearestStopBanner,
    handleLocateUser,
    getDistance
  };
}
