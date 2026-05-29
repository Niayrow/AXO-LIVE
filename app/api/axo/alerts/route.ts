import { NextRequest, NextResponse } from "next/server";

const ALERTS_URL = "https://api.oisemob.cityway.fr/disrupt/api/v1/fr/disruptions?networkIds=51&mediaType=Web";

export const dynamic = 'force-dynamic';

const decodeHtmlEntities = (text: string): string => {
    return text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&eacute;/gi, 'é')
        .replace(/&egrave;/gi, 'è')
        .replace(/&ecirc;/gi, 'ê')
        .replace(/&agrave;/gi, 'à')
        .replace(/&acirc;/gi, 'â')
        .replace(/&ocirc;/gi, 'ô')
        .replace(/&ucirc;/gi, 'û')
        .replace(/&iuml;/gi, 'ï')
        .replace(/&ccedil;/gi, 'ç')
        .replace(/&laquo;/gi, '«')
        .replace(/&raquo;/gi, '»')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
};

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(ALERTS_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch alerts: ${response.statusText}`);
    }

    const json = await response.json();
    const now = new Date();

    const axoAlerts = json.data?.filter((disruption: any) => {
        // A. FILTRE DATE (SÉCURITÉ)
        if (disruption.effectiveEndDate) {
            const endDate = new Date(disruption.effectiveEndDate);
            if (endDate < now) return false;
        }

        // B. FILTRE RÉSEAU AXO
        const isAxoLine = disruption.affectedLines?.some((line: any) =>
            line.networkId === 51 || (line.networkName && line.networkName.toLowerCase().includes('axo'))
        );
        const isAxoNetwork = disruption.affectedNetworks?.some((net: any) =>
            net.id === 51 || (net.name && net.name.toLowerCase().includes('axo'))
        );
        const isAxoOperator = disruption.affectedOperators?.some((op: any) => op.code === 'AXO');
        const titleMatch = disruption.title?.toUpperCase().includes('AXO');

        return isAxoLine || isAxoNetwork || isAxoOperator || titleMatch;
    }) || [];

    // Map to a simpler format for the frontend
    const alerts = axoAlerts.map((disruption: any) => {
        const isSevere = disruption.effect?.code === 'RemovedStop' ||
            disruption.effect?.code === 'NoService' ||
            (disruption.title ?? '').toLowerCase().includes('panne');

        return {
            id: String(disruption.internalId),
            title: decodeHtmlEntities(disruption.title || "Info Trafic"),
            description: decodeHtmlEntities(disruption.description?.replace(/<[^>]*>?/gm, '') || ""),
            severity: isSevere ? 'danger' : 'warning',
            startTime: disruption.effectiveStartDate,
            endTime: disruption.effectiveEndDate,
            impactedLines: disruption.affectedLines?.map((line: any) => line.code) || []
        };
    });

    return NextResponse.json({ alerts });
  } catch (error: any) {
    console.error("Alerts API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
