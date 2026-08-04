import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import Papa from "papaparse";
import { getOverriddenStopCoords } from "@/lib/stopCoordinateOverrides";

const GTFS_STATIC_URL =
  "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";
const TARGET_LINES = ["A", "B", "C1", "C2", "D"];
const TRANSFER_MARGIN_SEC = 3 * 60;
/** Quai opposé / même lieu : ~100 m max pour autoriser un transfert entre stop_id différents. */
const TRANSFER_CLUSTER_METERS = 100;
const MAX_ITINERARIES = 5;
const MAX_TOPO_CANDIDATES = 60;

let cachedRouteDb: RouteDb | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24;

interface RouteElement {
  line: string;
  dir: string;
  /** Séquence d'arrêts en stop_id (jamais seulement le nom). */
  stopIds: string[];
}

interface StopTimeEntry {
  stop_id: string;
  arrival_time: string;
  departure_time: string;
  stop_sequence: number;
}

interface TripInfo {
  trip_id: string;
  route_id: string;
  service_id: string;
  direction_id: string;
  trip_headsign: string;
  line: string;
}

interface StopCoord {
  lat: number;
  lon: number;
}

interface RouteDb {
  stopIdToName: Map<string, string>;
  stopCoords: Map<string, StopCoord>;
  nameToStopIds: Map<string, string[]>;
  /** stop_id → cluster d'IDs interchangeables (même lieu / quais opposés). */
  transferCluster: Map<string, string[]>;
  stopTimesByTrip: Map<string, StopTimeEntry[]>;
  tripsByLineDir: Map<string, TripInfo[]>;
  calendar: any[];
  calendarDates: any[];
  stopNames: string[];
  /** Index par stop_id (pas par nom). */
  stopIdToLinesMap: Map<string, RouteElement[]>;
}

interface TimedLeg {
  line: string;
  directionId: string;
  headsign: string;
  fromName: string;
  toName: string;
  fromStopId: string;
  toStopId: string;
  departureAt: string;
  arrivalAt: string;
  durationMin: number;
  stops: string[];
  tripId: string;
  departureSec: number;
  arrivalSec: number;
}

interface TopoCandidate {
  type: "direct" | "transfer";
  line?: string;
  direction?: string;
  line1?: string;
  dir1?: string;
  line2?: string;
  dir2?: string;
  transferStop?: string;
  transferStopId?: string;
  transferBoardStopId?: string;
  startName: string;
  endName: string;
  fromStopId: string;
  toStopId: string;
}

function gtfsTimeToSeconds(time: string): number {
  const [h = 0, m = 0, s = 0] = time.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function secondsToDisplay(totalSec: number): string {
  const normalized = ((totalSec % 86400) + 86400) % 86400;
  const h = Math.floor(normalized / 3600);
  const m = Math.floor((normalized % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getParisNowSeconds(): number {
  const time = new Date().toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return gtfsTimeToSeconds(time);
}

function getParisDateParts() {
  const now = new Date();
  const formatterDate = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: day }, , { value: month }, , { value: year }] =
    formatterDate.formatToParts(now);
  const yyyymmdd = `${year}${month}${day}`;
  const dayOfWeek = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    weekday: "long",
  })
    .format(now)
    .toLowerCase();
  return { yyyymmdd, dayOfWeek };
}

function parseDepartAt(departAt: string | null): number {
  if (!departAt) return getParisNowSeconds();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(departAt)) {
    return gtfsTimeToSeconds(
      departAt.length === 5 ? `${departAt}:00` : departAt
    );
  }
  return getParisNowSeconds();
}

function haversineMeters(
  a: StopCoord,
  b: StopCoord
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function getActiveServiceIds(db: RouteDb): Set<string> {
  const { yyyymmdd, dayOfWeek } = getParisDateParts();
  const active = new Set<string>();

  db.calendar.forEach((c: any) => {
    if (!c.service_id) return;
    if (yyyymmdd >= c.start_date && yyyymmdd <= c.end_date) {
      if (c[dayOfWeek] === "1") active.add(c.service_id);
    }
  });

  db.calendarDates.forEach((cd: any) => {
    if (cd.date !== yyyymmdd) return;
    if (cd.exception_type === "1") active.add(cd.service_id);
    else if (cd.exception_type === "2") active.delete(cd.service_id);
  });

  return active;
}

function lineDirKey(line: string, dir: string) {
  return `${line}|${dir}`;
}

/** Construit des clusters : même nom + distance < seuil (quais opposés). */
function buildTransferClusters(
  nameToStopIds: Map<string, string[]>,
  stopCoords: Map<string, StopCoord>
): Map<string, string[]> {
  const clusterOf = new Map<string, string[]>();

  nameToStopIds.forEach((ids) => {
    const unused = new Set(ids);
    while (unused.size > 0) {
      const seed = unused.values().next().value as string;
      unused.delete(seed);
      const cluster = [seed];
      const seedCoord = stopCoords.get(seed);
      if (seedCoord) {
        Array.from(unused).forEach((other) => {
          const oc = stopCoords.get(other);
          if (!oc) return;
          if (haversineMeters(seedCoord, oc) <= TRANSFER_CLUSTER_METERS) {
            cluster.push(other);
            unused.delete(other);
          }
        });
      }
      cluster.forEach((id) => clusterOf.set(id, cluster));
    }
  });

  return clusterOf;
}

function findStopPairOnTripByIds(
  stopTimes: StopTimeEntry[],
  stopIdToName: Map<string, string>,
  fromIds: Set<string>,
  toIds: Set<string>
): {
  from: StopTimeEntry;
  to: StopTimeEntry;
  stops: string[];
  fromStopId: string;
  toStopId: string;
} | null {
  const fromIndices: number[] = [];
  const toIndices: number[] = [];
  for (let i = 0; i < stopTimes.length; i++) {
    const id = stopTimes[i].stop_id;
    if (fromIds.has(id)) fromIndices.push(i);
    if (toIds.has(id)) toIndices.push(i);
  }

  let best: { fromIdx: number; toIdx: number; span: number } | null = null;
  for (const fromIdx of fromIndices) {
    for (const toIdx of toIndices) {
      if (toIdx <= fromIdx) continue;
      const span = toIdx - fromIdx;
      if (!best || span < best.span) best = { fromIdx, toIdx, span };
    }
  }
  if (!best) return null;

  const stops: string[] = [];
  for (let j = best.fromIdx; j <= best.toIdx; j++) {
    const n = stopIdToName.get(stopTimes[j].stop_id);
    if (n) stops.push(n);
  }

  return {
    from: stopTimes[best.fromIdx],
    to: stopTimes[best.toIdx],
    stops,
    fromStopId: stopTimes[best.fromIdx].stop_id,
    toStopId: stopTimes[best.toIdx].stop_id,
  };
}

function clusterIdSet(db: RouteDb, stopId: string): Set<string> {
  const cluster = db.transferCluster.get(stopId) || [stopId];
  return new Set(cluster);
}

function findNextLeg(
  db: RouteDb,
  line: string,
  dir: string,
  fromStopId: string,
  toStopId: string,
  departAfterSec: number,
  activeServiceIds: Set<string>
): TimedLeg | null {
  const fromIds = clusterIdSet(db, fromStopId);
  const toIds = clusterIdSet(db, toStopId);
  const trips = db.tripsByLineDir.get(lineDirKey(line, dir)) || [];
  let best: TimedLeg | null = null;

  for (const trip of trips) {
    if (!activeServiceIds.has(trip.service_id)) continue;
    const stopTimes = db.stopTimesByTrip.get(trip.trip_id);
    if (!stopTimes?.length) continue;

    const pair = findStopPairOnTripByIds(
      stopTimes,
      db.stopIdToName,
      fromIds,
      toIds
    );
    if (!pair) continue;

    const depSec = gtfsTimeToSeconds(pair.from.departure_time);
    if (depSec < departAfterSec) continue;

    const arrSec = gtfsTimeToSeconds(
      pair.to.arrival_time || pair.to.departure_time
    );
    if (arrSec < depSec) continue;
    if (best && depSec >= best.departureSec) continue;

    const fromName = db.stopIdToName.get(pair.fromStopId) || "";
    const toName = db.stopIdToName.get(pair.toStopId) || "";

    best = {
      line,
      directionId: dir,
      headsign: trip.trip_headsign || "Direction inconnue",
      fromName,
      toName,
      fromStopId: pair.fromStopId,
      toStopId: pair.toStopId,
      departureAt: secondsToDisplay(depSec),
      arrivalAt: secondsToDisplay(arrSec),
      durationMin: Math.max(1, Math.round((arrSec - depSec) / 60)),
      stops:
        pair.stops.length > 0 ? pair.stops : [fromName, toName].filter(Boolean),
      tripId: trip.trip_id,
      departureSec: depSec,
      arrivalSec: arrSec,
    };
  }

  return best;
}

async function getRouteDb(): Promise<RouteDb> {
  if (cachedRouteDb && Date.now() - lastCacheTime < CACHE_TTL) {
    return cachedRouteDb;
  }

  const response = await fetch(GTFS_STATIC_URL);
  if (!response.ok) throw new Error("Failed to fetch static GTFS");
  const buffer = await response.arrayBuffer();
  const zip = new AdmZip(Buffer.from(buffer));

  const routesFile =
    zip.getEntry("routes.txt")?.getData().toString("utf8") || "";
  const tripsFile =
    zip.getEntry("trips.txt")?.getData().toString("utf8") || "";
  const stopsFile =
    zip.getEntry("stops.txt")?.getData().toString("utf8") || "";
  const stopTimesFile =
    zip.getEntry("stop_times.txt")?.getData().toString("utf8") || "";
  const calendarFile =
    zip.getEntry("calendar.txt")?.getData().toString("utf8") || "";
  const calendarDatesFile =
    zip.getEntry("calendar_dates.txt")?.getData().toString("utf8") || "";

  const routes = Papa.parse(routesFile, { header: true }).data as any[];
  const trips = Papa.parse(tripsFile, { header: true }).data as any[];
  const stops = Papa.parse(stopsFile, { header: true }).data as any[];
  const stopTimes = Papa.parse(stopTimesFile, { header: true }).data as any[];
  const calendar = Papa.parse(calendarFile, { header: true }).data as any[];
  const calendarDates = Papa.parse(calendarDatesFile, {
    header: true,
  }).data as any[];

  const stopIdToName = new Map<string, string>();
  const stopCoords = new Map<string, StopCoord>();
  const nameToStopIds = new Map<string, string[]>();

  stops.forEach((s: any) => {
    if (!s.stop_id || !s.stop_name) return;
    stopIdToName.set(s.stop_id, s.stop_name);
    const lat = parseFloat(s.stop_lat);
    const lon = parseFloat(s.stop_lon);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      stopCoords.set(s.stop_id, getOverriddenStopCoords(s.stop_id, lat, lon));
    }
  });

  const routeIdToLine = new Map<string, string>();
  routes.forEach((r: any) => {
    if (r.route_id && TARGET_LINES.includes(r.route_short_name)) {
      routeIdToLine.set(r.route_id, r.route_short_name);
    }
  });

  const stopTimesByTrip = new Map<string, StopTimeEntry[]>();
  stopTimes.forEach((st: any) => {
    if (!st.trip_id || !st.stop_id) return;
    if (!stopTimesByTrip.has(st.trip_id)) {
      stopTimesByTrip.set(st.trip_id, []);
    }
    stopTimesByTrip.get(st.trip_id)!.push({
      stop_id: st.stop_id,
      arrival_time: st.arrival_time || st.departure_time,
      departure_time: st.departure_time || st.arrival_time,
      stop_sequence: parseInt(st.stop_sequence || "0", 10),
    });
  });

  stopTimesByTrip.forEach((list, tripId) => {
    list.sort((a, b) => a.stop_sequence - b.stop_sequence);
    stopTimesByTrip.set(tripId, list);
  });

  const tripsByLineDir = new Map<string, TripInfo[]>();
  const lineStopsObj: Record<string, Record<string, string[]>> = {};
  TARGET_LINES.forEach((line) => {
    lineStopsObj[line] = { "0": [], "1": [] };
  });

  trips.forEach((t: any) => {
    if (!t.trip_id || !t.route_id) return;
    const line = routeIdToLine.get(t.route_id);
    if (!line) return;
    const dir = t.direction_id === "1" ? "1" : "0";
    const info: TripInfo = {
      trip_id: t.trip_id,
      route_id: t.route_id,
      service_id: t.service_id,
      direction_id: dir,
      trip_headsign: t.trip_headsign || "",
      line,
    };
    const key = lineDirKey(line, dir);
    if (!tripsByLineDir.has(key)) tripsByLineDir.set(key, []);
    tripsByLineDir.get(key)!.push(info);
  });

  TARGET_LINES.forEach((line) => {
    ["0", "1"].forEach((dir) => {
      const dirTrips = tripsByLineDir.get(lineDirKey(line, dir)) || [];
      let longestTripId: string | null = null;
      let maxStops = 0;
      for (let i = 0; i < dirTrips.length; i++) {
        const t = dirTrips[i];
        const count = stopTimesByTrip.get(t.trip_id)?.length || 0;
        if (count > maxStops) {
          maxStops = count;
          longestTripId = t.trip_id;
        }
      }
      if (longestTripId) {
        lineStopsObj[line][dir] = (
          stopTimesByTrip.get(longestTripId) || []
        ).map((st) => st.stop_id);
      }
    });
  });

  const stopIdToLinesMap = new Map<string, RouteElement[]>();
  const graphStopIds = new Set<string>();

  TARGET_LINES.forEach((line) => {
    ["0", "1"].forEach((dir) => {
      const stopIds = lineStopsObj[line]?.[dir] || [];
      if (stopIds.length === 0) return;
      const element: RouteElement = { line, dir, stopIds };

      stopIds.forEach((id) => {
        graphStopIds.add(id);
        if (!stopIdToLinesMap.has(id)) stopIdToLinesMap.set(id, []);
        const already = stopIdToLinesMap
          .get(id)!
          .some((e) => e.line === line && e.dir === dir);
        if (!already) stopIdToLinesMap.get(id)!.push(element);
      });
    });
  });

  // name → stop_ids du graphe uniquement
  graphStopIds.forEach((id) => {
    const name = stopIdToName.get(id);
    if (!name) return;
    if (!nameToStopIds.has(name)) nameToStopIds.set(name, []);
    if (!nameToStopIds.get(name)!.includes(id)) {
      nameToStopIds.get(name)!.push(id);
    }
  });

  const transferCluster = buildTransferClusters(nameToStopIds, stopCoords);

  cachedRouteDb = {
    stopIdToName,
    stopCoords,
    nameToStopIds,
    transferCluster,
    stopTimesByTrip,
    tripsByLineDir,
    calendar,
    calendarDates,
    stopNames: Array.from(nameToStopIds.keys()).sort((a, b) =>
      a.localeCompare(b, "fr")
    ),
    stopIdToLinesMap,
  };
  lastCacheTime = Date.now();
  return cachedRouteDb;
}

function sameTransferPlace(db: RouteDb, a: string, b: string): boolean {
  if (a === b) return true;
  const cluster = db.transferCluster.get(a);
  return cluster ? cluster.includes(b) : false;
}

function collectTopoCandidates(
  db: RouteDb,
  startName: string,
  endName: string
): TopoCandidate[] {
  const startIds = db.nameToStopIds.get(startName) || [];
  const endIds = db.nameToStopIds.get(endName) || [];
  if (startIds.length === 0 || endIds.length === 0) return [];

  const candidates: TopoCandidate[] = [];
  const seen = new Set<string>();

  const pushUnique = (key: string, candidate: TopoCandidate) => {
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  // —— Direct : même ligne/dir, startId avant endId sur le pattern stop_id ——
  for (const fromStopId of startIds) {
    const routes = db.stopIdToLinesMap.get(fromStopId) || [];
    for (const route of routes) {
      const startIndex = route.stopIds.indexOf(fromStopId);
      if (startIndex === -1) continue;

      for (const toStopId of endIds) {
        const endIndex = route.stopIds.indexOf(toStopId);
        if (endIndex === -1 || endIndex <= startIndex) continue;

        pushUnique(
          `direct|${route.line}|${route.dir}|${fromStopId}|${toStopId}`,
          {
            type: "direct",
            line: route.line,
            direction: route.dir,
            startName,
            endName,
            fromStopId,
            toStopId,
          }
        );
      }
    }
  }

  // —— Transfert : intersection par stop_id / cluster (jamais par nom seul) ——
  for (const fromStopId of startIds) {
    const routes1 = db.stopIdToLinesMap.get(fromStopId) || [];
    for (const r1 of routes1) {
      const startIndex = r1.stopIds.indexOf(fromStopId);
      if (startIndex === -1) continue;

      for (const toStopId of endIds) {
        const routes2 = db.stopIdToLinesMap.get(toStopId) || [];
        for (const r2 of routes2) {
          if (r1.line === r2.line) continue;
          const endIndex = r2.stopIds.indexOf(toStopId);
          if (endIndex === -1) continue;

          const afterStart = r1.stopIds.slice(startIndex + 1);
          for (let i = 0; i < afterStart.length; i++) {
            const transferId1 = afterStart[i];
            // Ne pas transférer sur la destination elle-même via un faux match
            if (sameTransferPlace(db, transferId1, toStopId)) continue;

            for (let j = 0; j < endIndex; j++) {
              const transferId2 = r2.stopIds[j];
              if (!sameTransferPlace(db, transferId1, transferId2)) continue;

              const transferName =
                db.stopIdToName.get(transferId1) ||
                db.stopIdToName.get(transferId2) ||
                "Correspondance";

              pushUnique(
                `transfer|${r1.line}|${r1.dir}|${r2.line}|${r2.dir}|${transferId1}|${transferId2}|${fromStopId}|${toStopId}`,
                {
                  type: "transfer",
                  transferStop: transferName,
                  transferStopId: transferId1,
                  transferBoardStopId: transferId2,
                  line1: r1.line,
                  dir1: r1.dir,
                  line2: r2.line,
                  dir2: r2.dir,
                  startName,
                  endName,
                  fromStopId,
                  toStopId,
                }
              );
            }
          }
        }
      }
    }
  }

  // Prioriser les directs et les transferts courts (peu d'indices), puis plafonner
  candidates.sort((a, b) => {
    if (a.type !== b.type) return a.type === "direct" ? -1 : 1;
    return 0;
  });

  return candidates.slice(0, MAX_TOPO_CANDIDATES);
}

function scoreCandidate(
  db: RouteDb,
  candidate: TopoCandidate,
  departAfterSec: number,
  activeServiceIds: Set<string>
) {
  if (candidate.type === "direct") {
    const leg = findNextLeg(
      db,
      candidate.line!,
      candidate.direction!,
      candidate.fromStopId,
      candidate.toStopId,
      departAfterSec,
      activeServiceIds
    );
    if (!leg) return null;

    return {
      type: "direct" as const,
      departureAt: leg.departureAt,
      arrivalAt: leg.arrivalAt,
      durationMin: leg.durationMin,
      transfers: 0 as const,
      legs: [
        {
          line: leg.line,
          directionId: leg.directionId,
          headsign: leg.headsign,
          fromName: leg.fromName,
          toName: leg.toName,
          fromStopId: leg.fromStopId,
          toStopId: leg.toStopId,
          departureAt: leg.departureAt,
          arrivalAt: leg.arrivalAt,
          durationMin: leg.durationMin,
          stops: leg.stops,
          tripId: leg.tripId,
        },
      ],
      line: leg.line,
      direction: leg.directionId,
      stops: leg.stops,
      startName: leg.fromName,
      endName: leg.toName,
      stopCount: Math.max(0, leg.stops.length - 1),
      _sortArrival: leg.arrivalSec,
      _sortDuration: leg.durationMin,
    };
  }

  const alightId = candidate.transferStopId!;
  const boardId = candidate.transferBoardStopId || alightId;

  const leg1 = findNextLeg(
    db,
    candidate.line1!,
    candidate.dir1!,
    candidate.fromStopId,
    alightId,
    departAfterSec,
    activeServiceIds
  );
  if (!leg1) return null;

  const leg2 = findNextLeg(
    db,
    candidate.line2!,
    candidate.dir2!,
    boardId,
    candidate.toStopId,
    leg1.arrivalSec + TRANSFER_MARGIN_SEC,
    activeServiceIds
  );
  if (!leg2) return null;

  const durationMin = Math.max(
    1,
    Math.round((leg2.arrivalSec - leg1.departureSec) / 60)
  );
  const waitMin = Math.max(
    0,
    Math.round((leg2.departureSec - leg1.arrivalSec) / 60)
  );

  return {
    type: "transfer" as const,
    departureAt: leg1.departureAt,
    arrivalAt: leg2.arrivalAt,
    durationMin,
    transfers: 1 as const,
    transferStop: candidate.transferStop,
    transferWaitMin: waitMin,
    legs: [
      {
        line: leg1.line,
        directionId: leg1.directionId,
        headsign: leg1.headsign,
        fromName: leg1.fromName,
        toName: leg1.toName,
        fromStopId: leg1.fromStopId,
        toStopId: leg1.toStopId,
        departureAt: leg1.departureAt,
        arrivalAt: leg1.arrivalAt,
        durationMin: leg1.durationMin,
        stops: leg1.stops,
        tripId: leg1.tripId,
      },
      {
        line: leg2.line,
        directionId: leg2.directionId,
        headsign: leg2.headsign,
        fromName: leg2.fromName,
        toName: leg2.toName,
        fromStopId: leg2.fromStopId,
        toStopId: leg2.toStopId,
        departureAt: leg2.departureAt,
        arrivalAt: leg2.arrivalAt,
        durationMin: leg2.durationMin,
        stops: leg2.stops,
        tripId: leg2.tripId,
      },
    ],
    line1: leg1.line,
    dir1: leg1.directionId,
    line2: leg2.line,
    dir2: leg2.directionId,
    segment1: leg1.stops,
    segment2: leg2.stops,
    stopCount:
      Math.max(0, leg1.stops.length - 1) + Math.max(0, leg2.stops.length - 1),
    _sortArrival: leg2.arrivalSec,
    _sortDuration: durationMin,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const departAt = searchParams.get("depart_at");

  try {
    const db = await getRouteDb();

    if (!start || !end) {
      return NextResponse.json({ stopNames: db.stopNames });
    }

    if (start === end) {
      return NextResponse.json({ itineraries: [] });
    }

    const departAfterSec = parseDepartAt(departAt);
    const activeServiceIds = getActiveServiceIds(db);
    const topo = collectTopoCandidates(db, start, end);

    const timedRaw = topo
      .map((c) => scoreCandidate(db, c, departAfterSec, activeServiceIds))
      .filter(Boolean) as any[];

    const seenTimed = new Set<string>();
    const timed = timedRaw.filter((itin) => {
      const legSig = (itin.legs || [])
        .map(
          (l: any) =>
            `${l.line}@${l.fromStopId || l.fromName}->${l.toStopId || l.toName}@${l.departureAt}`
        )
        .join("|");
      const key = `${itin.type}|${itin.transferStop || ""}|${legSig}`;
      if (seenTimed.has(key)) return false;
      seenTimed.add(key);
      return true;
    });

    timed.sort((a, b) => {
      if (a._sortArrival !== b._sortArrival) {
        return a._sortArrival - b._sortArrival;
      }
      return a._sortDuration - b._sortDuration;
    });

    const itineraries = timed.slice(0, MAX_ITINERARIES).map((itin) => {
      const { _sortArrival, _sortDuration, ...rest } = itin;
      return rest;
    });

    return NextResponse.json({
      itineraries,
      meta: {
        departAt: secondsToDisplay(departAfterSec),
        topoCandidates: topo.length,
        timedCandidates: timed.length,
      },
    });
  } catch (error: any) {
    console.error("Route Planner API Error:", error);
    if (cachedRouteDb && (!start || !end)) {
      return NextResponse.json({ stopNames: cachedRouteDb.stopNames });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
