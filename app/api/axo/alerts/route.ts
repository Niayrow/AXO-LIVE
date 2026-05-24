import { NextRequest, NextResponse } from "next/server";

const ALERTS_URL = "https://api.oisemob.cityway.fr/disrupt/api/v1/fr/disruptions?networkIds=51&mediaType=Web";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(ALERTS_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch alerts: ${response.statusText}`);
    }

    const data = await response.json();

    // Map to a simpler format for the frontend
    const alerts = data.map((alert: any) => ({
      id: alert.id,
      title: alert.title,
      description: alert.description,
      severity: alert.severity, // e.g. "Normal", "Warning", "Critical"
      startTime: alert.applicationPeriod?.begin,
      endTime: alert.applicationPeriod?.end,
      impactedLines: alert.impactedObjects
        ?.filter((obj: any) => obj.type === "Line")
        .map((obj: any) => obj.name),
    }));

    return NextResponse.json({ alerts });
  } catch (error: any) {
    console.error("Alerts API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
