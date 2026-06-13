import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import Papa from "papaparse";

const GTFS_STATIC_URL = "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA";

let cachedData: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 heures

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

      // OPTIMISATION MAJEURE 1 : Indexer les routes par route_id
      const routeMap = new Map<string, string>();
      routes.forEach((r: any) => {
        if (r.route_id) routeMap.set(r.route_id, r.route_short_name);
      });

      // OPTIMISATION MAJEURE 2 : Indexer les trips par trip_id
      const tripMap = new Map<string, any>();
      trips.forEach((t: any) => {
        if (t.trip_id) tripMap.set(t.trip_id, t);
      });

      // OPTIMISATION MAJEURE 3 : Grouper stop_times par stop_id pour éviter le .filter() linéaire global
      const stopTimesByStopMap = new Map<string, any[]>();
      stopTimes.forEach((st: any) => {
        if (!st.stop_id) return;
        if (!stopTimesByStopMap.has(st.stop_id)) {
          stopTimesByStopMap.set(st.stop_id, []);
        }
        stopTimesByStopMap.get(st.stop_id)!.push(st);
      });

      cachedData = { routeMap, tripMap, stopTimesByStopMap, calendar, calendarDates };
      lastCacheTime = Date.now();
    }

    const { routeMap, tripMap, stopTimesByStopMap, calendar, calendarDates } = cachedData;

    // 1. Calcul des service_ids actifs (Heure de Paris)
    const dateParam = searchParams.get("date");
    let targetDate: Date;
    let yyyymmdd: string;
    let dayOfWeek: string;

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
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

    calendar.forEach((c: any) => {
      const start = c.start_date;
      const end = c.end_date;
      if (yyyymmdd >= start && yyyymmdd <= end) {
        if (c[dayOfWeek] === "1") {
          activeServiceIds.add(c.service_id);
        }
      }
    });

    calendarDates.forEach((cd: any) => {
      if (cd.date === yyyymmdd) {
        if (cd.exception_type === "1") {
          activeServiceIds.add(cd.service_id);
        } else if (cd.exception_type === "2") {
          activeServiceIds.delete(cd.service_id);
        }
      }
    });

    // 2. Récupérer uniquement les stop_times des arrêts demandés via notre Map indexée
    const targetedStopTimes: any[] = [];
    stopIds.forEach((id: string) => {
      const list = stopTimesByStopMap.get(id) || [];
      targetedStopTimes.push(...list);
    });

    const rawSchedules = targetedStopTimes
      .map((st: any) => {
        // Accès instantané O(1) au lieu de .find() linéaire
        const trip = tripMap.get(st.trip_id);
        if (!trip || !activeServiceIds.has(trip.service_id)) return null;

        const routeShortName = routeMap.get(trip.route_id);
        return {
          route_id: routeShortName || "Unknown",
          trip_id: st.trip_id,
          departure_time: st.departure_time,
          stop_sequence: parseInt(st.stop_sequence),
          trip_headsign: trip.trip_headsign || "Inconnue"
        };
      })
      .filter((s: any) => s !== null && ["A", "B", "C1", "C2", "D"].includes(s.route_id));

    // 3. Déduplication visuelle des horaires redondants
    const uniqueSchedulesMap = new Map<string, any>();
    rawSchedules.forEach((s: any) => {
      const timeKey = s.departure_time.slice(0, 5); // "14:45"
      const key = `${s.route_id}-${timeKey}-${s.trip_headsign}`;
      if (!uniqueSchedulesMap.has(key)) {
        uniqueSchedulesMap.set(key, s);
      }
    });

    const schedules = Array.from(uniqueSchedulesMap.values());
    schedules.sort((a: any, b: any) => a.departure_time.localeCompare(b.departure_time));

    return NextResponse.json({ schedules });
  } catch (error: any) {
    console.error("Stop Schedule API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}