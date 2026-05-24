import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import Papa from "papaparse";

const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";
const TARGET_LINES = ["A", "B", "C1", "C2", "D"];

let cachedRouteDb: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

async function getRouteDb() {
  if (!cachedRouteDb || Date.now() - lastCacheTime > CACHE_TTL) {
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

      // Stop ID to Stop Details Map
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

      // Filter target routes
      const targetRoutes = routes.filter((r: any) => TARGET_LINES.includes(r.route_short_name));

      // Build stop sequences per line per direction
      const lineStops = new Map<string, { [direction: string]: string[] }>();
      TARGET_LINES.forEach(line => {
        lineStops.set(line, { "0": [], "1": [] });
      });

      targetRoutes.forEach((route: any) => {
        const line = route.route_short_name;
        const routeTrips = trips.filter((t: any) => t.route_id === route.route_id);
        
        ["0", "1"].forEach(dir => {
          const dirTrips = routeTrips.filter((t: any) => t.direction_id === dir);
          if (dirTrips.length > 0) {
            // Pick trip with highest stop count as representative
            let longestTrip = dirTrips[0];
            let maxStops = 0;
            
            // Speed optimization: cache stopTimes counts
            const tripCounts = new Map<string, number>();
            stopTimes.forEach((st: any) => {
              tripCounts.set(st.trip_id, (tripCounts.get(st.trip_id) || 0) + 1);
            });

            dirTrips.forEach((t: any) => {
              const count = tripCounts.get(t.trip_id) || 0;
              if (count > maxStops) {
                maxStops = count;
                longestTrip = t;
              }
            });

            const stopsForTrip = stopTimes
              .filter((st: any) => st.trip_id === longestTrip.trip_id)
              .sort((a: any, b: any) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
              .map((st: any) => st.stop_id);

            lineStops.get(line)![dir] = stopsForTrip;
          }
        });
      });

      // Convert lineStops map to object for caching/json compatibility
      const lineStopsObj: any = {};
      lineStops.forEach((val, key) => {
        lineStopsObj[key] = val;
      });

      // Also build list of unique stop names to serve as dropdown inputs
      const stopNames = Array.from(new Set(
        stops
          .filter((s: any) => s.stop_name && Array.from(stopMap.keys()).includes(s.stop_id))
          .map((s: any) => s.stop_name)
      )).sort();

      cachedRouteDb = { 
        stopMap: Object.fromEntries(stopMap), 
        lineStops: lineStopsObj,
        stopNames 
      };
      lastCacheTime = Date.now();
    } catch (e) {
      console.error("Failed to load route database:", e);
      return cachedRouteDb || { stopMap: {}, lineStops: {}, stopNames: [] };
    }
  }
  return cachedRouteDb;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  try {
    const db = await getRouteDb();
    
    // If start or end are missing, just return the list of unique stop names to populate selectors
    if (!start || !end) {
      return NextResponse.json({ stopNames: db.stopNames });
    }

    const { stopMap, lineStops } = db;
    const directRoutes: any[] = [];
    const transferRoutes: any[] = [];

    // 1. Direct check
    TARGET_LINES.forEach(line => {
      ["0", "1"].forEach(dir => {
        const stopIds = lineStops[line]?.[dir] || [];
        const stopNames = stopIds.map((id: string) => stopMap[id]?.stop_name).filter(Boolean);
        
        const startIndex = stopNames.indexOf(start);
        const endIndex = stopNames.indexOf(end);
        
        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
          const segmentStopNames = stopNames.slice(startIndex, endIndex + 1);
          directRoutes.push({
            type: "direct",
            line,
            direction: dir,
            stops: segmentStopNames,
            startName: start,
            endName: end,
            stopCount: segmentStopNames.length - 1
          });
        }
      });
    });

    // 2. Transfer check (1 transfer)
    const startLines: string[] = [];
    const endLines: string[] = [];

    TARGET_LINES.forEach(line => {
      ["0", "1"].forEach(dir => {
        const stopIds = lineStops[line]?.[dir] || [];
        const stopNames = stopIds.map((id: string) => stopMap[id]?.stop_name).filter(Boolean);
        if (stopNames.includes(start) && !startLines.includes(line)) {
          startLines.push(line);
        }
        if (stopNames.includes(end) && !endLines.includes(line)) {
          endLines.push(line);
        }
      });
    });

    startLines.forEach(l1 => {
      endLines.forEach(l2 => {
        if (l1 === l2) return; // already in direct search

        ["0", "1"].forEach(d1 => {
          const stopIds1 = lineStops[l1]?.[d1] || [];
          const l1Stops = stopIds1.map((id: string) => stopMap[id]?.stop_name).filter(Boolean);
          const startIndex = l1Stops.indexOf(start);
          if (startIndex === -1) return;

          ["0", "1"].forEach(d2 => {
            const stopIds2 = lineStops[l2]?.[d2] || [];
            const l2Stops = stopIds2.map((id: string) => stopMap[id]?.stop_name).filter(Boolean);
            const endIndex = l2Stops.indexOf(end);
            if (endIndex === -1) return;

            // Find intersections
            l1Stops.slice(startIndex + 1).forEach((intersectionStop: string) => {
              const intersectIndexL2 = l2Stops.indexOf(intersectionStop);
              if (intersectIndexL2 !== -1 && intersectIndexL2 < endIndex) {
                const segment1 = l1Stops.slice(startIndex, l1Stops.indexOf(intersectionStop) + 1);
                const segment2 = l2Stops.slice(intersectIndexL2, endIndex + 1);

                transferRoutes.push({
                  type: "transfer",
                  transferStop: intersectionStop,
                  line1: l1,
                  dir1: d1,
                  line2: l2,
                  dir2: d2,
                  segment1,
                  segment2,
                  stopCount: segment1.length + segment2.length - 2
                });
              }
            });
          });
        });
      });
    });

    // Merge and sort results: direct first (by stops count), then transfer (by total stops count)
    directRoutes.sort((a, b) => a.stopCount - b.stopCount);
    transferRoutes.sort((a, b) => a.stopCount - b.stopCount);

    const itineraries = [...directRoutes, ...transferRoutes];

    return NextResponse.json({ itineraries });
  } catch (error: any) {
    console.error("Route Planner API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
