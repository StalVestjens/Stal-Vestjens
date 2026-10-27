import { NextResponse } from "next/server";
import { syncEquipe } from "@/lib/integrations/equipe";
import { syncFleetGo } from "@/lib/integrations/fleetgo";

/**
 * Dagelijkse synchronisatie (Equipe-resultaten + FleetGo-ritten).
 * Aanroepen met een planner, bv. Vercel Cron (zie vercel.json) of een cronjob:
 *   curl -H "Authorization: Bearer $SYNC_SECRET" https://<domein>/api/sync
 */
export async function GET(req: Request) {
  // Vercel Cron stuurt automatisch "Bearer <CRON_SECRET>"; elders gebruik je SYNC_SECRET.
  const secrets = [process.env.CRON_SECRET, process.env.SYNC_SECRET, process.env.AUTH_SECRET].filter(Boolean);
  const auth = req.headers.get("authorization") ?? "";
  if (secrets.length === 0 || !secrets.some((s) => auth === `Bearer ${s}`)) return new NextResponse("Niet toegestaan", { status: 401 });
  const [equipe, fleetgo] = await Promise.all([syncEquipe(), syncFleetGo()]);
  return NextResponse.json({ equipe, fleetgo });
}
