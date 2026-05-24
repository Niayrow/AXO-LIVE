import { NextRequest, NextResponse } from "next/server";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import AdmZip from "adm-zip";
import Papa from "papaparse";

const VEHICLE_POSITIONS_URL = "https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=AXO&dataFormat=gtfs-rt";
const TRIP_UPDATES_URL = "https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=AXO&dataFormat=gtfs-rt";
const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";

export const dynamic = 'force-dynamic';

let cachedTrips: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

async function getTrips() {
  if (!cachedTrips || Date.now() - lastCacheTime > CACHE_TTL) {
    try {
      const response = await fetch(GTFS_STATIC_URL);
      if (!response.ok) throw new Error("Failed to fetch static GTFS");
      const buffer = await response.arrayBuffer();
      const zip = new AdmZip(Buffer.from(buffer));
      const tripsFile = zip.getEntry("trips.txt")?.getData().toString("utf8") || "";
      cachedTrips = Papa.parse(tripsFile, { header: true }).data as any[];
      lastCacheTime = Date.now();
    } catch (e) {
      console.error("Failed to load static trips for realtime enrich:", e);
      return cachedTrips || [];
    }
  }
  return cachedTrips;
}

export async function GET(req: NextRequest) {
  try {
    // Fetch both feeds concurrently + load static trips
    const [vpResponse, tuResponse, staticTrips] = await Promise.all([
      fetch(VEHICLE_POSITIONS_URL, { cache: "no-store" }),
      fetch(TRIP_UPDATES_URL, { cache: "no-store" }),
      getTrips(),
    ]);

    if (!vpResponse.ok || !tuResponse.ok) {
      throw new Error("Failed to fetch GTFS-RT data");
    }

    const vpBuffer = await vpResponse.arrayBuffer();
    const tuBuffer = await tuResponse.arrayBuffer();

    // Decode Protobuf
    const vpFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(vpBuffer));
    const tuFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(tuBuffer));

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
      const tripInfo = staticTrips?.find((t: any) => t.trip_id === trip?.tripId);
      const headsign = tripInfo?.trip_headsign || "Inconnue";
      
      return {
        id: entity.id,
        vehicle_id: vehicle?.vehicle?.id,
        route_id: trip?.routeId,
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
        stop_time_updates: tripUpdate?.stopTimeUpdate?.map((stu: any) => ({
          stop_sequence: stu.stopSequence,
          stop_id: stu.stopId,
          arrival: stu.arrival ? {
            delay: stu.arrival.delay,
            time: stu.arrival.time?.low,
          } : null,
          departure: stu.departure ? {
            delay: stu.departure.delay,
            time: stu.departure.time?.low,
          } : null,
        })) || []
      };
    });

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
