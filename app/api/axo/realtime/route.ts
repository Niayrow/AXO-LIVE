import { NextRequest, NextResponse } from "next/server";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import AdmZip from "adm-zip";
import Papa from "papaparse";

const VEHICLE_POSITIONS_URL = "https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=AXO&dataFormat=gtfs-rt";
const TRIP_UPDATES_URL = "https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=AXO&dataFormat=gtfs-rt";
const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";

export const revalidate = 60; // Cache at the Edge for 1 minute

// Persist the daily log history in global memory to support hot-reloads
const globalForHistory = global as unknown as { busHistoryLog?: any[]; intervalStarted?: boolean };
if (!globalForHistory.busHistoryLog) {
  globalForHistory.busHistoryLog = [];
}
const busHistoryLog = globalForHistory.busHistoryLog;

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

    vpFeed.entity.forEach((entity: any) => {
      const vehicle = entity.vehicle;
      const trip = vehicle?.trip;
      const position = vehicle?.position;
      if (!vehicle?.vehicle?.id) return;
      
      const tuEntity = tuFeed.entity.find((tu: any) => tu.tripUpdate?.trip?.tripId === trip?.tripId);
      const tripUpdate = tuEntity?.tripUpdate;
      
      const tripInfo = staticData.trips?.find((t: any) => t.trip_id === trip?.tripId);
      const headsign = tripInfo?.trip_headsign || "Inconnue";
      
      const rawRouteId = tripInfo?.route_id || trip?.routeId;
      const routeInfo = staticData.routes?.find((r: any) => r.route_id === rawRouteId);
      const routeShortName = routeInfo?.route_short_name || rawRouteId || "B";
      
      const delay = tripUpdate?.stopTimeUpdate?.[0]?.departure?.delay || tripUpdate?.stopTimeUpdate?.[0]?.arrival?.delay || 0;
      const v_id = vehicle.vehicle.id;
      const timestamp = vehicle.timestamp?.low ? Number(vehicle.timestamp.low) : Number(vehicle.timestamp);
      
      // Find the last recorded log entry for this bus
      let lastEntry = null;
      for (let i = busHistoryLog.length - 1; i >= 0; i--) {
        if (busHistoryLog[i].vehicle_id === v_id) {
          lastEntry = busHistoryLog[i];
          break;
        }
      }

      if (!lastEntry || lastEntry.timestamp !== timestamp || lastEntry.current_status !== vehicle.currentStatus || lastEntry.delay !== delay) {
        busHistoryLog.push({
          log_time: Date.now(),
          timestamp: timestamp || Math.floor(Date.now() / 1000),
          vehicle_id: v_id,
          route_id: routeShortName,
          trip_headsign: headsign,
          delay: delay,
          current_status: vehicle.currentStatus || 0,
          stop_id: vehicle.stopId,
          position: {
            lat: position?.latitude,
            lon: position?.longitude,
            bearing: position?.bearing,
            speed: position?.speed,
          }
        });
      }
    });

    // Prune daily logs
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTimestamp = startOfToday.getTime();
    while (busHistoryLog.length > 0 && busHistoryLog[0].log_time < todayTimestamp) {
      busHistoryLog.shift();
    }
    if (busHistoryLog.length > 10000) {
      busHistoryLog.splice(0, busHistoryLog.length - 10000);
    }
  } catch (e) {
    // Fail silently in background poller
  }
}

if (typeof window === "undefined" && !globalForHistory.intervalStarted) {
  globalForHistory.intervalStarted = true;
  // Poll in background
  setInterval(runBackgroundPoller, 45000);
}

let cachedStaticData: { trips: any[]; routes: any[] } | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

async function getStaticData() {
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
      
      cachedStaticData = { trips, routes };
      lastCacheTime = Date.now();
    } catch (e) {
      console.error("Failed to load static GTFS for realtime enrich:", e);
      return cachedStaticData || { trips: [], routes: [] };
    }
  }
  return cachedStaticData;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const getHistory = searchParams.get("history") === "true";
    
    if (getHistory) {
      return NextResponse.json({
        history: busHistoryLog
      });
    }

    // Fetch both feeds concurrently + load static trips & routes
    const [vpResponse, tuResponse, staticData] = await Promise.all([
      fetch(VEHICLE_POSITIONS_URL, { cache: "no-store" }),
      fetch(TRIP_UPDATES_URL, { cache: "no-store" }),
      getStaticData(),
    ]);

    // Handle 204 No Content or non-OK responses (API returns 204 when no vehicles are active, e.g. outside service hours)
    const vpBuffer = vpResponse.ok && vpResponse.status !== 204 ? await vpResponse.arrayBuffer() : null;
    const tuBuffer = tuResponse.ok && tuResponse.status !== 204 ? await tuResponse.arrayBuffer() : null;

    // If vehicle positions feed is empty, return early with no vehicles
    if (!vpBuffer || vpBuffer.byteLength === 0) {
      return NextResponse.json({
        timestamp: Date.now(),
        vehicles: [],
      });
    }

    // Decode Protobuf
    const vpFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(vpBuffer));
    const tuFeed = tuBuffer && tuBuffer.byteLength > 0
      ? GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(tuBuffer))
      : { entity: [] };

    // Combine and structure the data for mobile client
    const vehicles = vpFeed.entity.map((entity: any) => {
      const vehicle = entity.vehicle;
      const trip = vehicle?.trip;
      const position = vehicle?.position;
      
      // Find matching trip update
      const tuEntity = tuFeed.entity.find((tu: any) => tu.tripUpdate?.trip?.tripId === trip?.tripId);
      const tripUpdate = tuEntity?.tripUpdate;

      // Extract current stop status (in transit, incoming, stopped)
      const currentStopStatus = vehicle?.currentStatus || 0;

      // Enrich with static trip headsign (direction/destination name)
      const tripInfo = staticData.trips?.find((t: any) => t.trip_id === trip?.tripId);
      const headsign = tripInfo?.trip_headsign || "Inconnue";
      
      // Resolve route_short_name from routes.txt
      const rawRouteId = tripInfo?.route_id || trip?.routeId;
      const routeInfo = staticData.routes?.find((r: any) => r.route_id === rawRouteId);
      const routeShortName = routeInfo?.route_short_name || rawRouteId || "B";
      
      return {
        id: entity.id,
        vehicle_id: vehicle?.vehicle?.id,
        route_id: routeShortName, // Resolved route name (A, B, C1, C2, D)
        trip_id: trip?.tripId,
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
        timestamp: vehicle?.timestamp?.low,
        // Delay information from trip updates (first stop time update delay)
        delay: tripUpdate?.stopTimeUpdate?.[0]?.departure?.delay || tripUpdate?.stopTimeUpdate?.[0]?.arrival?.delay || 0,
        stop_time_updates: tripUpdate?.stopTimeUpdate
          ? (tripUpdate.stopTimeUpdate as any[])
              .filter((stu: any) => !vehicle?.currentStopSequence || stu.stopSequence >= vehicle.currentStopSequence)
              .map((stu: any) => ({
                stop_sequence: stu.stopSequence,
                stop_id: stu.stopId,
                arrival: stu.arrival?.time?.low || stu.arrival?.time
                  ? { 
                      time: Number(stu.arrival.time?.low || stu.arrival.time),
                      delay: stu.arrival.delay !== undefined && stu.arrival.delay !== null
                        ? Number(stu.arrival.delay?.low || stu.arrival.delay)
                        : undefined
                    }
                  : null,
                departure: stu.departure?.time?.low || stu.departure?.time
                  ? { 
                      time: Number(stu.departure.time?.low || stu.departure.time),
                      delay: stu.departure.delay !== undefined && stu.departure.delay !== null
                        ? Number(stu.departure.delay?.low || stu.departure.delay)
                        : undefined
                    }
                  : null,
              }))
          : []
      };
    });

    // Record log history dynamically
    vehicles.forEach((v: any) => {
      if (!v.vehicle_id) return;
      
      // Find the last recorded log entry for this bus
      let lastEntry = null;
      for (let i = busHistoryLog.length - 1; i >= 0; i--) {
        if (busHistoryLog[i].vehicle_id === v.vehicle_id) {
          lastEntry = busHistoryLog[i];
          break;
        }
      }

      // If no entry exists, or if it has a new timestamp/status/delay
      if (!lastEntry || lastEntry.timestamp !== v.timestamp || lastEntry.current_status !== v.current_status || lastEntry.delay !== v.delay) {
        busHistoryLog.push({
          log_time: Date.now(),
          timestamp: v.timestamp || Math.floor(Date.now() / 1000),
          vehicle_id: v.vehicle_id,
          route_id: v.route_id,
          trip_headsign: v.trip_headsign,
          delay: v.delay,
          current_status: v.current_status,
          stop_id: v.stop_id,
          position: v.position
        });
      }
    });

    // Keep only today's log entries
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTimestamp = startOfToday.getTime();

    // Clean up older items
    while (busHistoryLog.length > 0 && busHistoryLog[0].log_time < todayTimestamp) {
      busHistoryLog.shift();
    }

    // Cap at 10000 items to protect memory
    if (busHistoryLog.length > 10000) {
      busHistoryLog.splice(0, busHistoryLog.length - 10000);
    }

    // Extract actual feed generation timestamp from GTFS-RT headers (in milliseconds)
    const feedTimestamp = vpFeed.header?.timestamp 
      ? (typeof vpFeed.header.timestamp === "number" 
          ? vpFeed.header.timestamp 
          : (vpFeed.header.timestamp.low || Number(vpFeed.header.timestamp))) * 1000 
      : Date.now();

    return NextResponse.json({
      timestamp: feedTimestamp,
      vehicles,
    });
  } catch (error: any) {
    console.error("GTFS-RT API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
