import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import Papa from "papaparse";

const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";

const TARGET_LINES = ["A", "B", "C1", "C2", "D", "E", "EXAL", "F", "S1", "S2", "S3", "S5", "S6", "S7"];

// Cache to hold the downloaded and parsed GTFS data in memory
let cachedShapesData: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

export async function GET(req: NextRequest) {
  try {
    const hasNewLines = cachedShapesData?.some((s: any) => s.route_id === "E");
    if (!cachedShapesData || !hasNewLines || Date.now() - lastCacheTime > CACHE_TTL) {
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
      const shapesFile = zip.getEntry("shapes.txt")?.getData().toString("utf8") || "";

      // 3. Parse CSV files
      const routes = Papa.parse(routesFile, { header: true }).data as any[];
      const trips = Papa.parse(tripsFile, { header: true }).data as any[];
      const shapes = Papa.parse(shapesFile, { header: true }).data as any[];

      const linesShapes: any[] = [];

      // 4. Find shapes for target lines
      for (const lineId of TARGET_LINES) {
        // Find route
        const route = routes.find((r: any) => r.route_short_name === lineId || r.route_id === lineId);
        if (!route) continue;

        // Find ALL unique shape_ids for this route
        const routeTrips = trips.filter((t: any) => t.route_id === route.route_id && t.shape_id);
        const uniqueShapeIds = Array.from(new Set(routeTrips.map((t: any) => t.shape_id)));

        for (const shapeId of uniqueShapeIds) {
          // Extract shape points
          const shapePoints = shapes
            .filter((s: any) => s.shape_id === shapeId)
            .sort((a: any, b: any) => parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence))
            .map((s: any) => [parseFloat(s.shape_pt_lat), parseFloat(s.shape_pt_lon)]);

          if (shapePoints.length > 0) {
            linesShapes.push({
              route_id: lineId,
              shape_id: shapeId,
              coordinates: shapePoints
            });
          }
        }
      }

      cachedShapesData = linesShapes;
      lastCacheTime = Date.now();
    }

    return NextResponse.json({ shapes: cachedShapesData });
  } catch (error: any) {
    console.error("GTFS Shapes API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
