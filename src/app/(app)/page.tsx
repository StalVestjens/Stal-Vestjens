import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Stat, Empty, Badge } from "@/components/ui";
import { fmtDate, fmtDay, addDays, todayDate, HEALTH_LABELS } from "@/lib/format";
import { toggleTask } from "./planning/actions";

export default async function Dashboard() {
  const session = await requireSession();
  const today = todayDate();
  const in30 = addDays(today, 30);

  const [tasks, dueHealth, openInvoices, horses, rvoOpen, transports, tachoVehicles] = await Promise.all([
    db.task.findMany({ where: { date: today }, include: { horse: true, assignee: true }, orderBy: [{ startTime: "asc" }, { title: "asc" }] }),
    db.healthRecord.findMany({ where: { nextDueDate: { lte: in30 }, horse: { status: "AANWEZIG" } }, include: { horse: true }, orderBy: { nextDueDate: "asc" }, take: 15 }),
    session.role === "EIGENAAR" ? db.invoice.findMany({ where: { status: { in: ["VERZONDEN", "HERINNERD"] } }, include: { customer: true }, orderBy: { dueDate: "asc" }, take: 8 }) : Promise.resolve([]),
    db.horse.count({ where: { status: "AANWEZIG" } }),
    db.rvoNotification.count({ where: { status: "TE_MELDEN" } }),
    db.transport.findMany({ where: { date: { gte: today, lt: addDays(today, 7) }, status: { not: "GEANNULEERD" } }, include: { horses: { include: { horse: true } }, vehicle: true }, orderBy: { date: "asc" } }),
    db.vehicle.findMany({ where: { OR: [{ lastTachoDownload: { lt: addDays(today, -80) } }, { lastCardDownload: { lt: addDays(today, -21) } }] } }),
  ]);

  // Laatste 'nextDueDate' per paard+type telt (anders staat een oude vaccinatie altijd op 'verlopen')
  const latestDue = new Map<string, typeof dueHealth[number]>();
  for (const h of dueHealth) {
    const k = `${h.horseId}:${h.type}`;
    const newer = await db.healthRecord.findFirst({ where: { horseId: h.horseId, type: h.type, date: { gt: h.date } } });
    if (!newer && !latestDue.has(k)) latestDue.set(k, h);
  }
  const due = [...latestDue.values()];
  const overdue = due.filter((h) => h.nextDueDate! < today);
  const mine = tasks.filter((t) => t.assigneeId === session.id);
  const open = tasks.filter((t) => t.status !== "KLAAR");

  return (
    <>
      <PageHeader title={`Vandaag, ${fmtDay(today, { weekday: "long", day: "numeric", month: "long" })}`} subtitle={`Welkom ${session.name}`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Paarden aanwezig" value={horses} href="/paarden" />
        <Stat label="Taken open vandaag" value={`${open.length} / ${tasks.length}`} href="/planning" />
        <Stat label="Gezondheid verlopen" value={overdue.length} href="/gezondheid" tone={overdue.length ? "danger" : undefined} />
        <Stat label="RVO te melden" value={rvoOpen} href="/rvo" tone={rvoOpen ? "warn" : undefined} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Dagplanning" actions={<Link className="btn btn-sm" href="/planning">Hele planning</Link>}>
          {tasks.length === 0 ? <Empty>Geen taken voor vandaag. <Link href="/planning" className="underline">Taken toevoegen</Link></Empty> : (
            <ul className="divide-y divide-[var(--line)]">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <form action={toggleTask.bind(null, t.id)}>
                    <button type="submit" className={`w-5 h-5 rounded border ${t.status === "KLAAR" ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-gray-400"}`} aria-label="Afvinken">{t.status === "KLAAR" ? "✓" : ""}</button>
                  </form>
                  <div className={`flex-1 ${t.status === "KLAAR" ? "line-through muted" : ""}`}>
                    <div className="text-sm font-medium">{t.startTime && <span className="muted mr-2">{t.startTime}</span>}{t.title}</div>
                    <div className="text-xs muted">{[t.horse?.name, t.assignee?.name, t.category].filter(Boolean).join(" · ")}</div>
                  </div>
                  {t.assigneeId === session.id && <Badge tone="ok">Mijn taak</Badge>}
                </li>
              ))}
            </ul>
          )}
          {mine.length > 0 && <p className="text-xs muted mt-2">{mine.filter((t) => t.status !== "KLAAR").length} van je eigen taken nog open.</p>}
        </Card>

        <Card title="Gezondheid: binnenkort / verlopen" actions={<Link className="btn btn-sm" href="/gezondheid">Overzicht</Link>}>
          {due.length === 0 ? <Empty>Niets in de komende 30 dagen.</Empty> : (
            <table className="tbl">
              <tbody>
                {due.map((h) => (
                  <tr key={h.id}>
                    <td><Link href={`/paarden/${h.horseId}`} className="font-medium">{h.horse.name}</Link></td>
                    <td>{HEALTH_LABELS[h.type]}{h.title ? ` · ${h.title}` : ""}</td>
                    <td className="text-right"><Badge tone={h.nextDueDate! < today ? "danger" : "warn"}>{fmtDate(h.nextDueDate)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Transport komende 7 dagen" actions={<Link className="btn btn-sm" href="/transport">Transport</Link>}>
          {transports.length === 0 ? <Empty>Geen ritten gepland.</Empty> : (
            <ul className="text-sm space-y-2">
              {transports.map((t) => (
                <li key={t.id}>
                  <div className="font-medium">{fmtDate(t.date)} · {t.fromAddress} → {t.toAddress}</div>
                  <div className="muted text-xs">{t.horses.map((h) => h.horse.name).join(", ") || "Geen paarden gekoppeld"}{t.vehicle ? ` · ${t.vehicle.name}` : ""}</div>
                </li>
              ))}
            </ul>
          )}
          {tachoVehicles.length > 0 && (
            <p className="text-xs mt-3 text-[var(--warn)]">⚠ Tachograaf-download nadert de wettelijke termijn voor: {tachoVehicles.map((v) => v.name).join(", ")}</p>
          )}
        </Card>

        {session.role === "EIGENAAR" && (
          <Card title="Openstaande facturen" actions={<Link className="btn btn-sm" href="/facturen">Facturen</Link>}>
            {openInvoices.length === 0 ? <Empty>Alles betaald.</Empty> : (
              <table className="tbl">
                <tbody>
                  {openInvoices.map((i) => (
                    <tr key={i.id}>
                      <td><Link href={`/facturen/${i.id}`} className="font-medium">{i.number}</Link></td>
                      <td>{i.customer.name}</td>
                      <td className="text-right"><Badge tone={i.dueDate < today ? "danger" : undefined}>vervalt {fmtDate(i.dueDate)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
