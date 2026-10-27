/**
 * Import van wedstrijdresultaten uit een CSV-export (Mijn KNHS, Equi Competitions, Equipe-export, Excel).
 *
 * De KNHS en Equi Competitions bieden (voor zover bekend) geen openbare API voor stallen; vraag bij
 * KNHS (ict@knhs.nl) of Equi Competitions naar een koppeling. Tot die tijd: exporteer je resultaten
 * als CSV en importeer ze hier. Kolomnamen worden flexibel herkend (NL/EN, hoofdletterongevoelig).
 */
import { db } from "../db";
import { logSync } from "../settings";

const ALIASES: Record<string, string[]> = {
  date: ["datum", "date", "wedstrijddatum", "start"],
  horse: ["paard", "horse", "paardnaam", "horse_name"],
  show: ["wedstrijd", "show", "concours", "evenement", "meeting", "meeting_name", "organisatie"],
  className: ["rubriek", "proef", "class", "klasse/rubriek", "meeting_class_name", "parcours"],
  discipline: ["discipline", "sport"],
  level: ["klasse", "level", "niveau", "categorie"],
  rider: ["ruiter", "rider", "combinatie", "rider_name", "amazone"],
  rank: ["plaats", "rank", "plaatsing", "positie", "uitslag", "klassering"],
  score: ["score", "punten", "percentage", "resultaat", "result", "result_preview", "fouten/tijd", "tijd"],
  points: ["winstpunten", "wp", "points"],
  prize: ["prijzengeld", "prize", "prize_money", "geld"],
  location: ["plaats_wedstrijd", "locatie", "location", "venue", "accommodatie"],
};

function parseCsv(text: string): string[][] {
  const sep = (text.match(/;/g)?.length ?? 0) > (text.match(/,/g)?.length ?? 0) ? ";" : (text.includes("\t") ? "\t" : ",");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function parseDate(s: string): Date | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}`);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); if (m) return new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  const d = new Date(t); return isNaN(+d) ? null : d;
}
const numOrNull = (s?: string) => { const n = Number((s ?? "").replace(/[^\d,.-]/g, "").replace(",", ".")); return s && isFinite(n) && s.trim() !== "" ? n : null; };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function importKnhsCsv(text: string): Promise<{ ok: boolean; message: string }> {
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, message: "CSV bevat geen gegevens." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col: Record<string, number> = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) col[key] = i;
  }
  if (col.horse == null || col.date == null) return { ok: false, message: `Kolommen 'paard' en 'datum' zijn verplicht. Gevonden kolommen: ${header.join(", ")}` };

  const horses = await db.horse.findMany({ select: { id: true, name: true, nickname: true } });
  const byName = new Map<string, string>();
  for (const h of horses) { byName.set(norm(h.name), h.id); if (h.nickname) byName.set(norm(h.nickname), h.id); }

  let added = 0, skipped = 0;
  const unknown = new Set<string>();
  for (const r of rows.slice(1)) {
    const get = (k: string) => (col[k] != null ? r[col[k]] ?? "" : "");
    const horseId = byName.get(norm(get("horse")));
    const date = parseDate(get("date"));
    if (!horseId) { unknown.add(get("horse")); skipped++; continue; }
    if (!date) { skipped++; continue; }
    const showName = get("show").trim() || "Import";
    const className = get("className").trim() || null;
    // Dubbel voorkomen: zelfde paard + datum + wedstrijd + rubriek
    const dup = await db.competitionResult.findFirst({ where: { horseId, date, showName, className } });
    if (dup) { skipped++; continue; }
    const rank = numOrNull(get("rank"));
    await db.competitionResult.create({
      data: {
        horseId, date, showName, className, source: "KNHS",
        discipline: get("discipline").trim() || null, level: get("level").trim() || null, rider: get("rider").trim() || null,
        rank: rank != null ? Math.round(rank) : null, score: get("score").trim() || null,
        points: numOrNull(get("points")), prizeMoney: numOrNull(get("prize")), location: get("location").trim() || null,
      },
    });
    added++;
  }
  const message = `${added} resultaten geïmporteerd, ${skipped} overgeslagen (dubbel of onbekend).${unknown.size ? ` Onbekende paarden: ${[...unknown].slice(0, 10).join(", ")}` : ""}`;
  await logSync("knhs-import", true, message, added);
  return { ok: true, message };
}
