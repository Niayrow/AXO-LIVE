import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import Papa from "papaparse";

const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";

// Cache to hold the downloaded and parsed GTFS data in memory (for demonstration/light use)
let cachedStops: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineNumber = searchParams.get("line") || "68"; // Default to Line 68 if not provided
  const directionId = searchParams.get("directionId") || "0";
  const tripId = searchParams.get("trip_id");

  try {
    if (!cachedStops || Date.now() - lastCacheTime > CACHE_TTL) {
      // 1. Download GTFS ZIP
      const response = await fetch(GTFS_STATIC_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch GTFS static: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const zip = new AdmZip(Buffer.from(buffer));

      // 2. Extract specific files
      const routesFile = zip.getEntry("routes.txt")?.getData().toString("utf8") || "";
      const tripsFile = zip.getEntry("trips.txt")?.getData().toString("utf8") || "";
      const stopsFile = zip.getEntry("stops.txt")?.getData().toString("utf8") || "";
      const stopTimesFile = zip.getEntry("stop_times.txt")?.getData().toString("utf8") || "";

      // 3. Parse CSV files
      const routes = Papa.parse(routesFile, { header: true }).data as any[];
      const trips = Papa.parse(tripsFile, { header: true }).data as any[];
      const stops = Papa.parse(stopsFile, { header: true }).data as any[];
      const stopTimes = Papa.parse(stopTimesFile, { header: true }).data as any[];

      cachedStops = { routes, trips, stops, stopTimes } as any;
      lastCacheTime = Date.now();
    }

    const { routes, trips, stops, stopTimes } = cachedStops as any;

    let trip;
    let finalRouteId = null;

    if (tripId) {
      trip = trips.find((t: any) => t.trip_id === tripId);
      if (!trip) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      }
      finalRouteId = trip.route_id;
    } else {
      // 4. Find the route by short name or route_id
      const route = routes.find((r: any) => r.route_short_name === lineNumber || r.route_id === lineNumber);
      if (!route) {
        return NextResponse.json({ error: "Route not found" }, { status: 404 });
      }
      finalRouteId = route.route_id;

      // 5. Find a representative trip for this route and direction
      trip = trips.find((t: any) => t.route_id === route.route_id && t.direction_id === directionId);
      if (!trip) {
        // Fallback if no direction matches
        trip = trips.find((t: any) => t.route_id === route.route_id);
      }
      if (!trip) {
        return NextResponse.json({ error: "Trip not found for this route/direction" }, { status: 404 });
      }
    }

    // 6. Get sequential stops for this trip
    const tripStops = stopTimes
      .filter((st: any) => st.trip_id === trip.trip_id)
      .sort((a: any, b: any) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
      .map((st: any) => {
        const stop = stops.find((s: any) => s.stop_id === st.stop_id);
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
