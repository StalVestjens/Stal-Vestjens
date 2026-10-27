import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Empty, Badge } from "@/components/ui";
import { fmtDate, HEALTH_LABELS, addDays, todayDate } from "@/lib/format";

/** Overzicht per paard: laatste registratie en volgende datum per type (vaccinatie, ontworming, smid, ...). */
export default async function HealthPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireSession();
  const { type } = await searchParams;
  const horses = await db.horse.findMany({
    where: { status: "AANWEZIG" },
    include: { healthRecords: { orderBy: { date: "desc" } } },
    orderBy: { name: "asc" },
  });
  const today = todayDate();
  const soon = addDays(today, 30);
  const types = type ? [type] : ["VACCINATIE", "ONTWORMING", "SMID", "TANDARTS"];

  const rows = horses.map((h) => ({
    horse: h,
    cells: types.map((t) => {
      const last = h.healthRecords.find((r) => r.type === t);
      return { type: t, last, due: last?.nextDueDate ?? null };
    }),
  }));
  const overdue = rows.flatMap((r) => r.cells.filter((c) => c.due && c.due < today).map((c) => ({ horse: r.horse, ...c })));

  return (
    <>
      <PageHeader title="Gezondheid" subtitle="Vaccinaties, ontwormingen, smid en tandarts per paard" />
      <form className="flex gap-2 mb-4">
        <select name="type" className="select max-w-xs" defaultValue={type ?? ""}>
          <option value="">Standaard (vaccinatie, ontworming, smid, tandarts)</option>
          {Object.entries(HEALTH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn">Toon</button>
      </form>

      {overdue.length > 0 && (
        <Card title={`Verlopen (${overdue.length})`} className="mb-4 border-[var(--danger)]">
          <ul className="text-sm grid md:grid-cols-2 gap-1">
            {overdue.map((o, i) => <li key={i}><Link href={`/paarden/${o.horse.id}?tab=gezondheid`} className="font-medium">{o.horse.name}</Link> · {HEALTH_LABELS[o.type]} was gepland op {fmtDate(o.due)}</li>)}
          </ul>
        </Card>
      )}

      <Card>
        {rows.length === 0 ? <Empty>Geen aanwezige paarden.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Paard</th>{types.map((t) => <th key={t}>{HEALTH_LABELS[t]}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.horse.id}>
                    <td><Link href={`/paarden/${r.horse.id}?tab=gezondheid`} className="font-medium">{r.horse.name}</Link></td>
                    {r.cells.map((c) => (
                      <td key={c.type}>
                        {c.last ? (
                          <>
                            <div className="text-xs muted">laatst {fmtDate(c.last.date)}{c.last.product ? ` · ${c.last.product}` : ""}</div>
                            {c.due ? <Badge tone={c.due < today ? "danger" : c.due < soon ? "warn" : "ok"}>volgende {fmtDate(c.due)}</Badge> : <span className="text-xs muted">geen volgende datum</span>}
                          </>
                        ) : <span className="text-xs muted">–</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
