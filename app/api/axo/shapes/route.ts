import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import Papa from "papaparse";

const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";

const TARGET_LINES = ["A", "B", "C1", "C2", "D", "E", "EXAL", "F", "S1", "S2", "S3", "S5", "S6", "S7"];

export const revalidate = 86400; // Cache at the Edge for 24 hours to eliminate Serverless Function invocations

let cachedShapesData: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

export async function GET(req: NextRequest) {
  try {
    const hasNewLines = cachedShapesData?.some((s: any) => s.route_id === "E");
    if (!cachedShapesData || !hasNewLines || Date.now() - lastCacheTime > CACHE_TTL) {
      const response = await fetch(GTFS_STATIC_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch GTFS static: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const zip = new AdmZip(Buffer.from(buffer));

      const routesFile = zip.getEntry("routes.txt")?.getData().toString("utf8") || "";
      const tripsFile = zip.getEntry("trips.txt")?.getData().toString("utf8") || "";
      const shapesFile = zip.getEntry("shapes.txt")?.getData().toString("utf8") || "";

      const routes = Papa.parse(routesFile, { header: true }).data as any[];
      const trips = Papa.parse(tripsFile, { header: true }).data as any[];
      const shapes = Papa.parse(shapesFile, { header: true }).data as any[];

      // 1. OPTIMISATION MAJEURE : Indexer shapes par shape_id en UNE SEULE PASSE (Group By)
      // On évite de scanner le tableau géant des millions de fois
      const shapesByIdMap = new Map<string, any[]>();
      shapes.forEach((s: any) => {
        if (!s.shape_id) return;
        if (!shapesByIdMap.has(s.shape_id)) {
          shapesByIdMap.set(s.shape_id, []);
        }
        shapesByIdMap.get(s.shape_id)!.push(s);
      });

      // 2. Indexer les routes cibles pour un accès O(1)
      const routeMap = new Map<string, string>();
      routes.forEach((r: any) => {
        if (r.route_id && (TARGET_LINES.includes(r.route_short_name) || TARGET_LINES.includes(r.route_id))) {
          routeMap.set(r.route_id, r.route_short_name);
        }
      });

      // 3. Associer les unique shape_ids directement aux noms courts des lignes (ex: "A", "B")
      const routeShortNameToShapes = new Map<string, Set<string>>();
      TARGET_LINES.forEach(lineId => routeShortNameToShapes.set(lineId, new Set<string>()));

      trips.forEach((t: any) => {
        if (!t.shape_id || !t.route_id) return;
        const shortName = routeMap.get(t.route_id);
        if (shortName && routeShortNameToShapes.has(shortName)) {
          routeShortNameToShapes.get(shortName)!.add(t.shape_id);
        }
      });

      const linesShapes: any[] = [];

      // 4. Construire les coordonnées à partir de notre index Map à très haute vitesse
      TARGET_LINES.forEach((lineId: string) => {
        const uniqueShapeIds = Array.from(routeShortNameToShapes.get(lineId) || []);

        uniqueShapeIds.forEach((shapeId: string) => {
          // Accès instantané O(1) grâce à la Map !
          const rawPoints = shapesByIdMap.get(shapeId) || [];

          const shapePoints = rawPoints
            .sort((a: any, b: any) => parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence))
            .map((s: any) => [parseFloat(s.shape_pt_lat), parseFloat(s.shape_pt_lon)]);

          if (shapePoints.length > 0) {
            linesShapes.push({
              route_id: lineId,
              shape_id: shapeId,
              coordinates: shapePoints
            });
          }
        });
      });

      cachedShapesData = linesShapes;
      lastCacheTime = Date.now();
    }

    return NextResponse.json({ shapes: cachedShapesData });
  } catch (error: any) {
    console.error("GTFS Shapes API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}