import { NextRequest, NextResponse } from "next/server";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import AdmZip from "adm-zip";
import Papa from "papaparse";

const VEHICLE_POSITIONS_URL = "https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=AXO&dataFormat=gtfs-rt";
const TRIP_UPDATES_URL = "https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=AXO&dataFormat=gtfs-rt";
const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";

export const revalidate = 60; // Cache Edge d'une minute

interface BusLogEntry {
  log_time: number;
  timestamp: number;
  vehicle_id: string;
  route_id: string;
  trip_headsign: string;
  delay: number;
  current_status: number;
  stop_id?: string;
  position: {
    lat?: number;
    lon?: number;
    bearing?: number;
    speed?: number;
  };
}

interface StaticCache {
  tripMap: Map<string, { trip_headsign: string; route_id: string }>;
  routeMap: Map<string, { route_short_name: string }>;
}

// Persistance de l'historique en mémoire globale (évite les pertes au hot-reload en dév)
const globalForHistory = global as unknown as {
  busHistoryLog?: BusLogEntry[];
  intervalStarted?: boolean;
  lastBusStatus?: Map<string, { timestamp: number; status: number; delay: number }>;
};

if (!globalForHistory.busHistoryLog) globalForHistory.busHistoryLog = [];
if (!globalForHistory.lastBusStatus) globalForHistory.lastBusStatus = new Map();

const busHistoryLog = globalForHistory.busHistoryLog;
const lastBusStatus = globalForHistory.lastBusStatus;

// Utilitaire pour normaliser les nombres Protobuf 64-bits (gère le format de transit_realtime)
function normalizeLong(val: any): number {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (val.low !== undefined) return val.low;
  return Number(val);
}

async function runBackgroundPoller() {
  try {
    const [vpResponse, tuResponse, staticData] = await Promise.all([
      fetch(VEHICLE_POSITIONS_URL, { cache: "no-store" }),
      fetch(TRIP_UPDATES_URL, { cache: "no-store" }),
      getStaticData(),
    ]);

    const vpBuffer = vpResponse.ok && vpResponse.status !== 204 ? await vpResponse.arrayBuffer() : null;
    const tuBuffer = tuResponse.ok && tuResponse.status !== 204 ? await tuResponse.arrayBuffer() : null;

    if (!vpBuffer || vpBuffer.byteLength === 0) return;

    const vpFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(vpBuffer));
    const tuFeed = tuBuffer && tuBuffer.byteLength > 0
      ? GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(tuBuffer))
      : { entity: [] };

    // Indexation rapide des Trip Updates pour éviter le .find() dans la boucle
    const tuMap = new Map<string, any>();
    tuFeed.entity.forEach((entity: any) => {
      if (entity.tripUpdate?.trip?.tripId) {
        tuMap.set(entity.tripUpdate.trip.tripId, entity.tripUpdate);
      }
    });

    vpFeed.entity.forEach((entity: any) => {
      const vehicle = entity.vehicle;
      const trip = vehicle?.trip;
      const position = vehicle?.position;
      const v_id = vehicle?.vehicle?.id;
      if (!v_id) return;

      const tripId = trip?.tripId;
      const tripUpdate = tuMap.get(tripId);

      // Récupération instantanée O(1) via nos Maps indexées
      const tripInfo = staticData.tripMap.get(tripId);
      const headsign = tripInfo?.trip_headsign || "Inconnue";
      const rawRouteId = tripInfo?.route_id || trip?.routeId;

      const routeInfo = staticData.routeMap.get(rawRouteId);
      const routeShortName = routeInfo?.route_short_name || rawRouteId || "B";

      const delay = normalizeLong(tripUpdate?.stopTimeUpdate?.[0]?.departure?.delay || tripUpdate?.stopTimeUpdate?.[0]?.arrival?.delay || 0);
      const timestamp = normalizeLong(vehicle.timestamp || Math.floor(Date.now() / 1000));
      const currentStatus = vehicle.currentStatus || 0;

      // Vérification ultra-rapide via le cache d'état au lieu de parcourir tout l'historique
      const lastState = lastBusStatus.get(v_id);

      if (!lastState || lastState.timestamp !== timestamp || lastState.status !== currentStatus || lastState.delay !== delay) {
        const newLog: BusLogEntry = {
          log_time: Date.now(),
          timestamp,
          vehicle_id: v_id,
          route_id: routeShortName,
          trip_headsign: headsign,
          delay,
          current_status: currentStatus,
          stop_id: vehicle.stopId || undefined,
          position: {
            lat: position?.latitude,
            lon: position?.longitude,
            bearing: position?.bearing,
            speed: position?.speed,
          }
        };

        busHistoryLog.push(newLog);
        lastBusStatus.set(v_id, { timestamp, status: currentStatus, delay });
      }
    });

    pruneLogs();
  } catch (e) {
    // Échec silencieux en arrière-plan
  }
}

function pruneLogs() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayTimestamp = startOfToday.getTime();

  while (busHistoryLog.length > 0 && busHistoryLog[0].log_time < todayTimestamp) {
    busHistoryLog.shift();
  }
  if (busHistoryLog.length > 10000) {
    busHistoryLog.splice(0, busHistoryLog.length - 10000);
  }
}

if (typeof window === "undefined" && !globalForHistory.intervalStarted) {
  globalForHistory.intervalStarted = true;
  setInterval(runBackgroundPoller, 45000);
}

let cachedStaticData: StaticCache | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 heures

async function getStaticData(): Promise<StaticCache> {
  if (!cachedStaticData || Date.now() - lastCacheTime > CACHE_TTL) {
    try {
      const response = await fetch(GTFS_STATIC_URL);
      if (!response.ok) throw new Error("Failed to fetch static GTFS");
      const buffer = await response.arrayBuffer();
      const zip = new AdmZip(Buffer.from(buffer));

      const tripsFile = zip.getEntry("trips.txt")?.getData().toString("utf8") || "";
      const routesFile = zip.getEntry("routes.txt")?.getData().toString("utf8") || "";

      const trips = Papa.parse(tripsFile, { header: true }).data as any[];
      const routes = Papa.parse(routesFile, { header: true }).data as any[];

      // Indexation des données statiques sous forme de Maps pour des requêtes en temps constant
      const tripMap = new Map<string, { trip_headsign: string; route_id: string }>();
      trips.forEach((t: any) => {
        if (t.trip_id) tripMap.set(t.trip_id, { trip_headsign: t.trip_headsign, route_id: t.route_id });
      });

      const routeMap = new Map<string, { route_short_name: string }>();
      routes.forEach((r: any) => {
        if (r.route_id) routeMap.set(r.route_id, { route_short_name: r.route_short_name });
      });

      cachedStaticData = { tripMap, routeMap };
      lastCacheTime = Date.now();
    } catch (e) {
      console.error("Failed to load static GTFS for realtime enrich:", e);
      return cachedStaticData || { tripMap: new Map(), routeMap: new Map() };
    }
  }
  return cachedStaticData;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const getHistory = searchParams.get("history") === "true";

    if (getHistory) {
      return NextResponse.json({ history: busHistoryLog });
    }

    const [vpResponse, tuResponse, staticData] = await Promise.all([
      fetch(VEHICLE_POSITIONS_URL, { cache: "no-store" }),
      fetch(TRIP_UPDATES_URL, { cache: "no-store" }),
      getStaticData(),
    ]);

    const vpBuffer = vpResponse.ok && vpResponse.status !== 204 ? await vpResponse.arrayBuffer() : null;
    const tuBuffer = tuResponse.ok && tuResponse.status !== 204 ? await tuResponse.arrayBuffer() : null;

    if (!vpBuffer || vpBuffer.byteLength === 0) {
      return NextResponse.json({
        timestamp: Date.now(),
        vehicles: [],
      });
    }

    const vpFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(vpBuffer));
    const tuFeed = tuBuffer && tuBuffer.byteLength > 0
      ? GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(tuBuffer))
      : { entity: [] };

    const tuMap = new Map<string, any>();
    tuFeed.entity.forEach((entity: any) => {
      if (entity.tripUpdate?.trip?.tripId) {
        tuMap.set(entity.tripUpdate.trip.tripId, entity.tripUpdate);
      }
    });

    const vehicles = vpFeed.entity.map((entity: any) => {
      const vehicle = entity.vehicle;
      const trip = vehicle?.trip;
      const position = vehicle?.position;
      const tripId = trip?.tripId;

      const tripUpdate = tuMap.get(tripId);
      const currentStopStatus = vehicle?.currentStatus || 0;

      const tripInfo = staticData.tripMap.get(tripId);
      const headsign = tripInfo?.trip_headsign || "Inconnue";

      const rawRouteId = tripInfo?.route_id || trip?.routeId;
      const routeInfo = staticData.routeMap.get(rawRouteId);
      const routeShortName = routeInfo?.route_short_name || rawRouteId || "B";

      const v_id = vehicle?.vehicle?.id;
      const delay = normalizeLong(tripUpdate?.stopTimeUpdate?.[0]?.departure?.delay || tripUpdate?.stopTimeUpdate?.[0]?.arrival?.delay || 0);
      const timestamp = normalizeLong(vehicle?.timestamp || Math.floor(Date.now() / 1000));

      // Enregistrement dynamique à la volée
      if (v_id) {
        const lastState = lastBusStatus.get(v_id);
        if (!lastState || lastState.timestamp !== timestamp || lastState.status !== currentStopStatus || lastState.delay !== delay) {
          busHistoryLog.push({
            log_time: Date.now(),
            timestamp,
            vehicle_id: v_id,
            route_id: routeShortName,
            trip_headsign: headsign,
            delay,
            current_status: currentStopStatus,
            stop_id: vehicle?.stopId || undefined,
            position: {
              lat: position?.latitude,
              lon: position?.longitude,
              bearing: position?.bearing,
              speed: position?.speed,
            }
          });
          lastBusStatus.set(v_id, { timestamp, status: currentStopStatus, delay });
        }
      }

      return {
        id: entity.id,
        vehicle_id: v_id,
        route_id: routeShortName,
        trip_id: tripId,
        direction_id: trip?.directionId,
        trip_headsign: headsign,
        start_time: trip?.startTime,
        start_date: trip?.startDate,
        position: {
          lat: position?.latitude,
          lon: position?.longitude,
          bearing: position?.bearing,
          speed: position?.speed,
        },
        current_stop_sequence: vehicle?.currentStopSequence,
        stop_id: vehicle?.stopId,
        current_status: currentStopStatus,
        timestamp,
        delay,
        stop_time_updates: tripUpdate?.stopTimeUpdate
          ? (tripUpdate.stopTimeUpdate as any[])
            // Garder l'arrêt courant + le précédent (pour estimer la progression entre 2 arrêts)
            .filter((stu: any) => {
              if (!vehicle?.currentStopSequence) return true;
              return stu.stopSequence >= vehicle.currentStopSequence - 1;
            })
            .map((stu: any) => ({
              stop_sequence: stu.stopSequence,
              stop_id: stu.stopId,
              arrival: stu.arrival?.time ? {
                time: normalizeLong(stu.arrival.time),
                delay: stu.arrival.delay !== undefined && stu.arrival.delay !== null ? normalizeLong(stu.arrival.delay) : undefined
              } : null,
              departure: stu.departure?.time ? {
                time: normalizeLong(stu.departure.time),
                delay: stu.departure.delay !== undefined && stu.departure.delay !== null ? normalizeLong(stu.departure.delay) : undefined
              } : null,
            }))
          : []
      };
    });

    pruneLogs();

    const feedTimestamp = vpFeed.header?.timestamp ? normalizeLong(vpFeed.header.timestamp) * 1000 : Date.now();

    return NextResponse.json({
      timestamp: feedTimestamp,
      vehicles,
    });
  } catch (error: any) {
    console.error("GTFS-RT API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}