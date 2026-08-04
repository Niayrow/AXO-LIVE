import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import Papa from "papaparse";
import { applyStopCoordinateOverride } from "@/lib/stopCoordinateOverrides";

const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";

let cachedStops: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 heures

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineNumber = searchParams.get("line") || "68"; // Par défaut Ligne 68 si non fourni
  const directionId = searchParams.get("directionId") || "0";
  const tripId = searchParams.get("trip_id");

  try {
    if (!cachedStops || Date.now() - lastCacheTime > CACHE_TTL) {
      // 1. Téléchargement du ZIP GTFS
      const response = await fetch(GTFS_STATIC_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch GTFS static: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const zip = new AdmZip(Buffer.from(buffer));

      // 2. Extraction des fichiers texte
      const routesFile = zip.getEntry("routes.txt")?.getData().toString("utf8") || "";
      const tripsFile = zip.getEntry("trips.txt")?.getData().toString("utf8") || "";
      const stopsFile = zip.getEntry("stops.txt")?.getData().toString("utf8") || "";
      const stopTimesFile = zip.getEntry("stop_times.txt")?.getData().toString("utf8") || "";

      // 3. Parsing des fichiers CSV
      const routes = Papa.parse(routesFile, { header: true }).data as any[];
      const trips = Papa.parse(tripsFile, { header: true }).data as any[];
      const stops = Papa.parse(stopsFile, { header: true }).data as any[];
      const stopTimes = Papa.parse(stopTimesFile, { header: true }).data as any[];

      // OPTIMISATION MAJEURE 1 : Indexer les arrêts par stop_id dans une Map O(1)
      const stopMap = new Map<string, any>();
      stops.forEach((s: any) => {
        if (s.stop_id) stopMap.set(s.stop_id, applyStopCoordinateOverride(s));
      });

      // OPTIMISATION MAJEURE 2 : Indexer les stop_times par trip_id (Group By)
      const stopTimesByTrip = new Map<string, any[]>();
      stopTimes.forEach((st: any) => {
        if (!st.trip_id) return;
        if (!stopTimesByTrip.has(st.trip_id)) {
          stopTimesByTrip.set(st.trip_id, []);
        }
        stopTimesByTrip.get(st.trip_id)!.push(st);
      });

      cachedStops = { routes, trips, stopMap, stopTimesByTrip };
      lastCacheTime = Date.now();
    }

    const { routes, trips, stopMap, stopTimesByTrip } = cachedStops;

    let trip: any = null;
    let finalRouteId = null;

    if (tripId) {
      trip = trips.find((t: any) => t.trip_id === tripId);
      if (!trip) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      }
      finalRouteId = trip.route_id;
    } else {
      // 4. Trouver la route par son nom court ou son id
      const route = routes.find((r: any) => r.route_short_name === lineNumber || r.route_id === lineNumber);
      if (!route) {
        return NextResponse.json({ error: "Route not found" }, { status: 404 });
      }
      finalRouteId = route.route_id;

      // 5. Trouver le trip représentatif de la route et de la direction
      trip = trips.find((t: any) => t.route_id === route.route_id && t.direction_id === directionId);
      if (!trip) {
        // Fallback si aucune direction ne correspond
        trip = trips.find((t: any) => t.route_id === route.route_id);
      }
      if (!trip) {
        return NextResponse.json({ error: "Trip not found for this route/direction" }, { status: 404 });
      }
    }

    // 6. Récupérer les arrêts séquentiels de ce trajet (Lecture instantanée via les index Map)
    const rawStopTimes = stopTimesByTrip.get(trip.trip_id) || [];

    const tripStops = rawStopTimes
      .sort((a: any, b: any) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
      .map((st: any) => {
        // Accès instantané O(1) à la Map au lieu du .find() sur tout le tableau
        const stop = stopMap.get(st.stop_id);
        return {
          stop_id: st.stop_id,
          stop_name: stop?.stop_name || "Unknown",
          stop_sequence: parseInt(st.stop_sequence),
          stop_lat: parseFloat(stop?.stop_lat || "0"),
          stop_lon: parseFloat(stop?.stop_lon || "0"),
          arrival_time: st.arrival_time,
          departure_time: st.departure_time,
        };
      });

    return NextResponse.json({
      line: lineNumber,
      route_id: finalRouteId,
      trip_id: trip.trip_id,
      direction_id: trip.direction_id,
      stops: tripStops,
    });
  } catch (error: any) {
    console.error("GTFS Static API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}