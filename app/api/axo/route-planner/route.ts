import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import Papa from "papaparse";

const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";
const TARGET_LINES = ["A", "B", "C1", "C2", "D"];

let cachedRouteDb: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 heures

interface RouteElement {
  line: string;
  dir: string;
  stopsList: string[];
}

async function getRouteDb() {
  if (cachedRouteDb && Date.now() - lastCacheTime < CACHE_TTL) {
    return cachedRouteDb;
  }

  try {
    const response = await fetch(GTFS_STATIC_URL);
    if (!response.ok) throw new Error("Failed to fetch static GTFS");
    const buffer = await response.arrayBuffer();
    const zip = new AdmZip(Buffer.from(buffer));

    const routesFile = zip.getEntry("routes.txt")?.getData().toString("utf8") || "";
    const tripsFile = zip.getEntry("trips.txt")?.getData().toString("utf8") || "";
    const stopsFile = zip.getEntry("stops.txt")?.getData().toString("utf8") || "";
    const stopTimesFile = zip.getEntry("stop_times.txt")?.getData().toString("utf8") || "";

    const routes = Papa.parse(routesFile, { header: true }).data as any[];
    const trips = Papa.parse(tripsFile, { header: true }).data as any[];
    const stops = Papa.parse(stopsFile, { header: true }).data as any[];
    const stopTimes = Papa.parse(stopTimesFile, { header: true }).data as any[];

    // Indexation des arrêts
    const stopMap = new Map<string, any>();
    stops.forEach((s: any) => {
      if (s.stop_id) {
        stopMap.set(s.stop_id, {
          stop_id: s.stop_id,
          stop_name: s.stop_name,
          stop_lat: parseFloat(s.stop_lat || "0"),
          stop_lon: parseFloat(s.stop_lon || "0")
        });
      }
    });

    // Indexer stop_times par trip_id (Group By)
    const stopTimesByTrip = new Map<string, any[]>();
    stopTimes.forEach((st: any) => {
      if (!st.trip_id) return;
      if (!stopTimesByTrip.has(st.trip_id)) {
        stopTimesByTrip.set(st.trip_id, []);
      }
      stopTimesByTrip.get(st.trip_id)!.push(st);
    });

    // Filtrer les lignes cibles
    const targetRoutes = routes.filter((r: any) => TARGET_LINES.includes(r.route_short_name));

    // Préparer la structure lineStops
    const lineStopsObj: any = {};
    TARGET_LINES.forEach(line => {
      lineStopsObj[line] = { "0": [], "1": [] };
    });

    targetRoutes.forEach((route: any) => {
      const line = route.route_short_name;
      const routeTrips = trips.filter((t: any) => t.route_id === route.route_id);

      ["0", "1"].forEach(dir => {
        const dirTrips = routeTrips.filter((t: any) => t.direction_id === dir);
        if (dirTrips.length > 0) {
          let longestTrip = dirTrips[0];
          let maxStops = 0;

          dirTrips.forEach((t: any) => {
            const count = stopTimesByTrip.get(t.trip_id)?.length || 0;
            if (count > maxStops) {
              maxStops = count;
              longestTrip = t;
            }
          });

          const stopsForTrip = (stopTimesByTrip.get(longestTrip.trip_id) || [])
            .sort((a: any, b: any) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
            .map((st: any) => st.stop_id);

          lineStopsObj[line][dir] = stopsForTrip;
        }
      });
    });

    const stopNames = Array.from(new Set(
      stops
        .filter((s: any) => s.stop_name && stopMap.has(s.stop_id))
        .map((s: any) => s.stop_name)
    )).sort();

    // Indexation pour la recherche au runtime
    const stopToLinesMap: { [stopName: string]: RouteElement[] } = {};

    TARGET_LINES.forEach(line => {
      ["0", "1"].forEach(dir => {
        const stopIds = lineStopsObj[line]?.[dir] || [];
        const names = stopIds.map((id: string) => stopMap.get(id)?.stop_name).filter(Boolean);

        names.forEach((name: string) => {
          if (!stopToLinesMap[name]) stopToLinesMap[name] = [];
          stopToLinesMap[name].push({ line, dir, stopsList: names });
        });
      });
    });

    cachedRouteDb = {
      stopMap: Object.fromEntries(stopMap),
      lineStops: lineStopsObj,
      stopNames,
      stopToLinesMap
    };
    lastCacheTime = Date.now();
  } catch (e) {
    console.error("Failed to load route database:", e);
    return cachedRouteDb || { stopMap: {}, lineStops: {}, stopNames: [], stopToLinesMap: {} };
  }

  return cachedRouteDb;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  try {
    const db = await getRouteDb();

    if (!start || !end) {
      return NextResponse.json({ stopNames: db.stopNames });
    }

    const { stopToLinesMap } = db;
    const directRoutes: any[] = [];
    const transferRoutes: any[] = [];

    const startLines: RouteElement[] = stopToLinesMap[start] || [];
    const endLines: RouteElement[] = stopToLinesMap[end] || [];

    // 1. Recherche Directe (Correction du typage ici pour 'startRoute' et 'e')
    startLines.forEach((startRoute: RouteElement) => {
      const matchEnd = endLines.find((e: RouteElement) => e.line === startRoute.line && e.dir === startRoute.dir);
      if (matchEnd) {
        const lStops = startRoute.stopsList;
        const startIndex = lStops.indexOf(start);
        const endIndex = lStops.indexOf(end);

        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
          const segmentStopNames = lStops.slice(startIndex, endIndex + 1);
          directRoutes.push({
            type: "direct",
            line: startRoute.line,
            direction: startRoute.dir,
            stops: segmentStopNames,
            startName: start,
            endName: end,
            stopCount: segmentStopNames.length - 1
          });
        }
      }
    });

    // 2. Recherche de correspondances (Correction du typage ici pour 'r1' et 'r2')
    startLines.forEach((r1: RouteElement) => {
      endLines.forEach((r2: RouteElement) => {
        if (r1.line === r2.line) return;

        const l1Stops = r1.stopsList;
        const l2Stops = r2.stopsList;

        const startIndex = l1Stops.indexOf(start);
        const endIndex = l2Stops.indexOf(end);

        if (startIndex === -1 || endIndex === -1) return;

        l1Stops.slice(startIndex + 1).forEach((intersectionStop: string) => {
          const intersectIndexL2 = l2Stops.indexOf(intersectionStop);

          if (intersectIndexL2 !== -1 && intersectIndexL2 < endIndex) {
            const segment1 = l1Stops.slice(startIndex, l1Stops.indexOf(intersectionStop) + 1);
            const segment2 = l2Stops.slice(intersectIndexL2, endIndex + 1);

            transferRoutes.push({
              type: "transfer",
              transferStop: intersectionStop,
              line1: r1.line,
              dir1: r1.dir,
              line2: r2.line,
              dir2: r2.dir,
              segment1,
              segment2,
              stopCount: segment1.length + segment2.length - 2
            });
          }
        });
      });
    });

    directRoutes.sort((a, b) => a.stopCount - b.stopCount);
    transferRoutes.sort((a, b) => a.stopCount - b.stopCount);

    return NextResponse.json({ itineraries: [...directRoutes, ...transferRoutes] });
  } catch (error: any) {
    console.error("Route Planner API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}