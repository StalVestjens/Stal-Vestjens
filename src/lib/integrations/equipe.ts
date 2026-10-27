/**
 * Equipe-koppeling (wedstrijdresultaten).
 *
 * Equipe Online publiceert resultaten via https://online.equipe.com/api/v2/.
 *   GET /api/v2/results?offset=0   (Authorization: Bearer <token>, scope "read", 25 per pagina)
 * De resultaten zijn die van ruiters waar jouw Equipe-account toegang toe heeft (je eigen
 * profiel of gekoppelde ruiters). Een personal access token maak je aan in je account op
 * online.equipe.com (of vraag je aan via info@equipe.com als de optie niet zichtbaar is).
 *
 * Resultaatvelden: rank, result_preview, rider_name, horse_name, club_name, meeting_name,
 * meeting_class_name, meeting_class_start_at, venue_country, discipline (D/H/...), id (start id).
 */
import { db } from "../db";
import { getSetting, logSync } from "../settings";

const BASE = "https://online.equipe.com";

type EquipeResult = {
  id: number | string;
  rank?: number | null;
  result_preview?: string | null;
  rider_name?: string;
  horse_name?: string;
  club_name?: string;
  meeting_id?: number;
  meeting_name?: string;
  meeting_class_name?: string;
  meeting_class_start_at?: string;
  venue_country?: string;
  discipline?: string;
  horse_notification_identifier?: string;
};

const DISCIPLINES: Record<string, string> = { D: "Dressuur", H: "Springen", F: "Eventing", E: "Endurance", V: "Voltige", M: "Mennen", A: "Mennen", P: "Para" };

async function token() {
  return await getSetting("equipe_token", "EQUIPE_TOKEN");
}

async function fetchPage(tok: string, offset: number): Promise<EquipeResult[]> {
  const r = await fetch(`${BASE}/api/v2/results?offset=${offset}`, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } });
  if (r.status === 401) throw new Error("Equipe-token ongeldig (401).");
  if (r.status === 403) throw new Error("Equipe-token mist de 'read'-scope (403).");
  if (!r.ok) throw new Error(`Equipe antwoordde met ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : (j.results ?? j.data ?? []);
}

export async function testEquipe(): Promise<{ ok: boolean; message: string }> {
  try {
    const tok = await token();
    if (!tok) return { ok: false, message: "Geen Equipe-token ingevuld." };
    const page = await fetchPage(tok, 0);
    return { ok: true, message: `Verbonden. ${page.length} resultaten op de eerste pagina${page[0] ? ` (laatste: ${page[0].horse_name} – ${page[0].meeting_name})` : ""}.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Normaliseert paardnamen voor matching: "Dexter Z" ≈ "DEXTER Z" ≈ "Dexter-Z". */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Haalt alle resultaten op (max. 40 pagina's = 1000 resultaten per keer) en koppelt ze aan
 * paarden op naam. Niet-herkende paardnamen worden in het logboek gemeld, zodat je de naam
 * in het paardendossier gelijk kunt trekken (of een roepnaam kunt toevoegen).
 */
export async function syncEquipe(): Promise<{ ok: boolean; message: string }> {
  const tok = await token();
  if (!tok) return { ok: false, message: "Equipe niet ingesteld." };
  try {
    const horses = await db.horse.findMany({ select: { id: true, name: true, nickname: true, discipline: true } });
    const byName = new Map<string, string>();
    for (const h of horses) { byName.set(norm(h.name), h.id); if (h.nickname) byName.set(norm(h.nickname), h.id); }

    let added = 0, offset = 0, pages = 0;
    const unknown = new Set<string>();
    while (pages < 40) {
      const page = await fetchPage(tok, offset);
      if (page.length === 0) break;
      for (const r of page) {
        const horseId = r.horse_name ? byName.get(norm(r.horse_name)) : undefined;
        if (!horseId) { if (r.horse_name) unknown.add(r.horse_name); continue; }
        const externalId = String(r.id);
        const exists = await db.competitionResult.findUnique({ where: { source_externalId: { source: "EQUIPE", externalId } } });
        if (exists) continue;
        await db.competitionResult.create({
          data: {
            horseId, source: "EQUIPE", externalId,
            date: r.meeting_class_start_at ? new Date(r.meeting_class_start_at) : new Date(),
            showName: r.meeting_name ?? "Equipe",
            className: r.meeting_class_name ?? null,
            discipline: r.discipline ? (DISCIPLINES[r.discipline] ?? r.discipline) : null,
            rider: r.rider_name ?? null,
            rank: r.rank ?? null,
            score: r.result_preview ?? null,
            country: r.venue_country ?? null,
            notes: r.club_name ? `Club: ${r.club_name}` : null,
          },
        });
        added++;
      }
      offset += page.length;
      pages++;
      if (page.length < 25) break;
    }
    const message = `${added} nieuwe resultaten toegevoegd.${unknown.size ? ` Niet herkend (naam komt niet overeen met een paard): ${[...unknown].slice(0, 10).join(", ")}${unknown.size > 10 ? "…" : ""}` : ""}`;
    await logSync("equipe", true, message, added);
    return { ok: true, message };
  } catch (e) {
    const message = (e as Error).message;
    await logSync("equipe", false, message);
    return { ok: false, message };
  }
}
