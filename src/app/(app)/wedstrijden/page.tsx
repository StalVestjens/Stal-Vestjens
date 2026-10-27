import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Empty, Badge, Field } from "@/components/ui";
import { fmtDate, fmtMoney, localDateStr } from "@/lib/format";
import { runEquipeSync, uploadKnhsCsv } from "./actions";
import { getSetting } from "@/lib/settings";

export default async function CompetitionsPage({ searchParams }: { searchParams: Promise<{ jaar?: string; paard?: string }> }) {
  await requireSession();
  const sp = await searchParams;
  const thisYear = Number(localDateStr().slice(0, 4));
  const year = /^\d{4}$/.test(sp.jaar ?? "") ? Number(sp.jaar) : thisYear;
  const [results, horses, equipeToken, lastSync] = await Promise.all([
    db.competitionResult.findMany({
      where: { date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) }, ...(sp.paard ? { horseId: sp.paard } : {}) },
      include: { horse: true, files: true },
      orderBy: { date: "desc" },
    }),
    db.horse.findMany({ orderBy: { name: "asc" } }),
    getSetting("equipe_token", "EQUIPE_TOKEN"),
    db.syncLog.findFirst({ where: { integration: "equipe" }, orderBy: { createdAt: "desc" } }),
  ]);
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);
  const prize = results.reduce((s, r) => s + Number(r.prizeMoney ?? 0), 0);
  const podium = results.filter((r) => r.rank && r.rank <= 3).length;

  return (
    <>
      <PageHeader title="Wedstrijden" subtitle={`${results.length} resultaten in ${year} · ${podium} podiumplaatsen · ${fmtMoney(prize)} prijzengeld`}
        actions={<form action={runEquipeSync}><button className="btn" disabled={!equipeToken} title={equipeToken ? "" : "Stel eerst de Equipe-koppeling in bij Instellingen"}>↻ Equipe ophalen</button></form>} />

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <form className="flex gap-2">
          <select name="jaar" className="select" defaultValue={year}>{years.map((y) => <option key={y}>{y}</option>)}</select>
          <select name="paard" className="select" defaultValue={sp.paard ?? ""}><option value="">Alle paarden</option>{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
          <button className="btn">Toon</button>
        </form>
        <form action={uploadKnhsCsv} className="flex gap-2 items-end ml-auto">
          <Field label="KNHS / Equi Competitions export (CSV)"><input type="file" name="file" accept=".csv,text/csv" className="input" required /></Field>
          <button className="btn">Importeren</button>
        </form>
      </div>
      {lastSync && <p className="text-xs muted mb-3">Laatste Equipe-synchronisatie: {fmtDate(lastSync.createdAt)} · {lastSync.message}</p>}

      <Card>
        {results.length === 0 ? <Empty>Geen resultaten. Voeg ze toe bij een paard, importeer een CSV, of koppel Equipe.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Datum</th><th>Paard</th><th>Wedstrijd</th><th>Rubriek</th><th>Ruiter</th><th>Plaats</th><th>Score</th><th>Media</th><th>Bron</th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td><Link href={`/paarden/${r.horseId}?tab=wedstrijden`} className="font-medium">{r.horse.name}</Link></td>
                  <td>{r.showName}{r.location && <div className="text-xs muted">{r.location}</div>}</td>
                  <td>{[r.className, r.level].filter(Boolean).join(" · ")}</td>
                  <td>{r.rider ?? ""}</td>
                  <td className="font-semibold">{r.rank ? `${r.rank}e` : "–"}</td>
                  <td>{r.score ?? ""}{r.prizeMoney != null && <div className="text-xs muted">{fmtMoney(r.prizeMoney)}</div>}</td>
                  <td>{r.files.map((f) => <a key={f.id} href={`/api/bestand/${f.id}`} target="_blank" className="mr-1">{f.kind === "VIDEO" ? "🎬" : "📷"}</a>)}</td>
                  <td><Badge>{r.source}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
