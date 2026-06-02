import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import Papa from "papaparse";

const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";

let cachedData: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stopIdsStr = searchParams.get("stop_ids");
  if (!stopIdsStr) {
    return NextResponse.json({ error: "Missing stop_ids" }, { status: 400 });
  }
  const stopIds = stopIdsStr.split(",");

  try {
    if (!cachedData || Date.now() - lastCacheTime > CACHE_TTL) {
      const response = await fetch(GTFS_STATIC_URL);
      if (!response.ok) throw new Error("Failed to fetch GTFS");
      const buffer = await response.arrayBuffer();
      const zip = new AdmZip(Buffer.from(buffer));

      const routesFile = zip.getEntry("routes.txt")?.getData().toString("utf8") || "";
      const tripsFile = zip.getEntry("trips.txt")?.getData().toString("utf8") || "";
      const stopTimesFile = zip.getEntry("stop_times.txt")?.getData().toString("utf8") || "";
      const calendarFile = zip.getEntry("calendar.txt")?.getData().toString("utf8") || "";
      const calendarDatesFile = zip.getEntry("calendar_dates.txt")?.getData().toString("utf8") || "";

      const routes = Papa.parse(routesFile, { header: true }).data as any[];
      const trips = Papa.parse(tripsFile, { header: true }).data as any[];
      const stopTimes = Papa.parse(stopTimesFile, { header: true }).data as any[];
      const calendar = Papa.parse(calendarFile, { header: true }).data as any[];
      const calendarDates = Papa.parse(calendarDatesFile, { header: true }).data as any[];

      cachedData = { routes, trips, stopTimes, calendar, calendarDates };
      lastCacheTime = Date.now();
    }

    const { routes, trips, stopTimes, calendar, calendarDates } = cachedData;

    // 1. Calculate active service_ids for the requested date (or TODAY) in Paris Timezone
    const dateParam = searchParams.get("date"); // Optional: YYYY-MM-DD format
    let targetDate: Date;
    let yyyymmdd: string;
    let dayOfWeek: string;

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      // Parse the provided date in Paris timezone
      targetDate = new Date(dateParam + "T12:00:00+02:00");
      const [y, m, d] = dateParam.split("-");
      yyyymmdd = `${y}${m}${d}`;
      const dayFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Paris",
        weekday: "long"
      });
      dayOfWeek = dayFormatter.format(targetDate).toLowerCase();
    } else {
      targetDate = new Date();
      const formatterDate = new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      const [{ value: day }, , { value: month }, , { value: year }] = formatterDate.formatToParts(targetDate);
      yyyymmdd = `${year}${month}${day}`;
      const formatterDayOfWeek = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Paris",
        weekday: "long"
      });
      dayOfWeek = formatterDayOfWeek.format(targetDate).toLowerCase();
    }

    const activeServiceIds = new Set<string>();

    // Scan calendar.txt
    calendar.forEach((c: any) => {
      const start = c.start_date;
      const end = c.end_date;
      if (yyyymmdd >= start && yyyymmdd <= end) {
        if (c[dayOfWeek] === "1") {
          activeServiceIds.add(c.service_id);
        }
      }
    });

    // Scan calendar_dates.txt for exceptions
    calendarDates.forEach((cd: any) => {
      if (cd.date === yyyymmdd) {
        if (cd.exception_type === "1") {
          activeServiceIds.add(cd.service_id);
        } else if (cd.exception_type === "2") {
          activeServiceIds.delete(cd.service_id);
        }
      }
    });

    // 2. Find and filter stop times for the requested stop ids on active services
    const rawSchedules = stopTimes
      .filter((st: any) => stopIds.includes(st.stop_id))
      .map((st: any) => {
        const trip = trips.find((t: any) => t.trip_id === st.trip_id);
        if (!trip || !activeServiceIds.has(trip.service_id)) return null;
        
        const route = routes.find((r: any) => r.route_id === trip.route_id);
        return {
          route_id: route?.route_short_name || "Unknown",
          trip_id: st.trip_id,
          departure_time: st.departure_time, // e.g. "14:45:00"
          stop_sequence: parseInt(st.stop_sequence),
          trip_headsign: trip.trip_headsign || "Inconnue"
        };
      })
      .filter((s: any) => s !== null && ["A", "B", "C1", "C2", "D"].includes(s.route_id));

    // 3. Deduplicate visually redundant times per direction
    const uniqueSchedulesMap = new Map<string, any>();
    rawSchedules.forEach((s: any) => {
      const timeKey = s.departure_time.slice(0, 5); // "14:45"
      const key = `${s.route_id}-${timeKey}-${s.trip_headsign}`;
      if (!uniqueSchedulesMap.has(key)) {
        uniqueSchedulesMap.set(key, s);
      }
    });

    const schedules = Array.from(uniqueSchedulesMap.values());

    // Sort by departure time
    schedules.sort((a: any, b: any) => a.departure_time.localeCompare(b.departure_time));

    return NextResponse.json({ schedules });
  } catch (error: any) {
    console.error("Stop Schedule API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
