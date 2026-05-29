import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import Papa from "papaparse";

const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";

let cachedAllStops: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

const TARGET_LINES = ["A", "B", "C1", "C2", "D", "E", "EXAL", "F", "S1", "S2", "S3", "S5", "S6", "S7"];

export const revalidate = 86400; // Cache at the Edge for 24 hours to eliminate Serverless Function invocations

export async function GET(req: NextRequest) {
  try {
    const hasNewLines = cachedAllStops?.some((s: any) => s.lines.includes("E"));
    if (!cachedAllStops || !hasNewLines || Date.now() - lastCacheTime > CACHE_TTL) {
      const response = await fetch(GTFS_STATIC_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch GTFS static: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const zip = new AdmZip(Buffer.from(buffer));

      // Extract all needed files
      const routesFile = zip.getEntry("routes.txt")?.getData().toString("utf8") || "";
      const tripsFile = zip.getEntry("trips.txt")?.getData().toString("utf8") || "";
      const stopTimesFile = zip.getEntry("stop_times.txt")?.getData().toString("utf8") || "";
      const stopsFile = zip.getEntry("stops.txt")?.getData().toString("utf8") || "";

      const parsedRoutes = Papa.parse(routesFile, { header: true }).data as any[];
      const parsedTrips = Papa.parse(tripsFile, { header: true }).data as any[];
      const parsedStopTimes = Papa.parse(stopTimesFile, { header: true }).data as any[];
      const parsedStops = Papa.parse(stopsFile, { header: true }).data as any[];

      // 1. Get route_ids for the target lines and map them to their short name
      const targetRouteIds = new Set(
        parsedRoutes
          .filter(r => TARGET_LINES.includes(r.route_short_name))
          .map(r => r.route_id)
      );

      const tripIdToRouteName = new Map();
      parsedTrips.forEach((t: any) => {
        const route = parsedRoutes.find(r => r.route_id === t.route_id);
        if (route && TARGET_LINES.includes(route.route_short_name)) {
          tripIdToRouteName.set(t.trip_id, route.route_short_name);
        }
      });

      // 2. Map stop_ids to their serving lines
      const stopIdToRoutes = new Map<string, Set<string>>();
      parsedStopTimes.forEach((st: any) => {
        const routeName = tripIdToRouteName.get(st.trip_id);
        if (routeName) {
          if (!stopIdToRoutes.has(st.stop_id)) {
            stopIdToRoutes.set(st.stop_id, new Set());
          }
          stopIdToRoutes.get(st.stop_id)!.add(routeName);
        }
      });

      // 3. Get stop_ids for those trips
      const targetStopIds = new Set(
        parsedStopTimes
          .filter(st => tripIdToRouteName.has(st.trip_id))
          .map(st => st.stop_id)
      );

      // 4. Extract stops matching the stop_ids and append serving lines
      const uniqueStops = new Map();
      parsedStops.forEach((s) => {
        if (targetStopIds.has(s.stop_id) && s.stop_lat && s.stop_lon && s.stop_name) {
          const routesServing = Array.from(stopIdToRoutes.get(s.stop_id) || []);
          if (!uniqueStops.has(s.stop_id)) {
            uniqueStops.set(s.stop_id, {
              stop_id: s.stop_id,
              stop_name: s.stop_name,
              stop_lat: parseFloat(s.stop_lat),
              stop_lon: parseFloat(s.stop_lon),
              lines: routesServing
            });
          }
        }
      });

      cachedAllStops = Array.from(uniqueStops.values());
      lastCacheTime = Date.now();
    }

    return NextResponse.json({ stops: cachedAllStops });
  } catch (error: any) {
    console.error("All Stops API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
