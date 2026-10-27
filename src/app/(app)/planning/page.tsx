import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Field, Empty, Badge } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";
import { addDays, isoDate, fmtDay, todayDate, TASK_CATEGORIES } from "@/lib/format";
import { createTask, toggleTask, deleteTask, copyDay, setTaskStatus } from "./actions";

const DAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ datum?: string; wie?: string; paard?: string; weergave?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const day = new Date(/^\d{4}-\d{2}-\d{2}$/.test(sp.datum ?? "") ? sp.datum! : isoDate());
  const week = sp.weergave === "week";
  const monday = addDays(day, -((day.getUTCDay() + 6) % 7));
  const rangeStart = week ? monday : day;
  const rangeEnd = week ? addDays(monday, 7) : addDays(day, 1);

  const [tasks, users, horses] = await Promise.all([
    db.task.findMany({
      where: { date: { gte: rangeStart, lt: rangeEnd }, ...(sp.wie ? { assigneeId: sp.wie } : {}) },
      include: { horse: true, assignee: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }, { title: "asc" }],
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.horse.findMany({ where: { status: "AANWEZIG" }, orderBy: { name: "asc" } }),
  ]);

  const nav = (d: Date, extra: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams({ datum: isoDate(d), ...(sp.wie ? { wie: sp.wie } : {}), ...(week ? { weergave: "week" } : {}), ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined) as [string, string][]) });
    return `/planning?${q}`;
  };
  const dayLabel = (d: Date) => fmtDay(d, { weekday: "short", day: "numeric", month: "short" });

  return (
    <>
      <PageHeader title="Planning" subtitle={week ? `Week van ${dayLabel(monday)}` : fmtDay(day)}
        actions={<>
          <Link className="btn" href={nav(addDays(day, week ? -7 : -1))}>‹</Link>
          <Link className="btn" href={nav(todayDate())}>Vandaag</Link>
          <Link className="btn" href={nav(addDays(day, week ? 7 : 1))}>›</Link>
          <Link className="btn" href={`/planning?datum=${isoDate(day)}${week ? "" : "&weergave=week"}${sp.wie ? `&wie=${sp.wie}` : ""}`}>{week ? "Dag" : "Week"}</Link>
        </>} />

      <form className="flex flex-wrap gap-2 mb-4 items-center">
        <input type="hidden" name="datum" value={isoDate(day)} />
        {week && <input type="hidden" name="weergave" value="week" />}
        <select name="wie" className="select max-w-xs" defaultValue={sp.wie ?? ""}>
          <option value="">Iedereen</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button className="btn">Filter</button>
      </form>
      {!week && (
        <form action={copyDay} className="flex gap-2 items-center mb-4">
          <input type="hidden" name="from" value={isoDate(day)} />
          <span className="text-sm muted">Dag kopiëren naar</span>
          <input type="date" name="to" className="input w-auto" defaultValue={isoDate(addDays(day, 1))} />
          <button className="btn btn-sm">Kopieer</button>
        </form>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Taak inplannen">
          <form action={createTask} className="space-y-3">
            <Field label="Taak"><input name="title" className="input" required placeholder="Longeren, paddock, smid, ..." /></Field>
            <Field label="Categorie"><select name="category" className="select"><option value="">–</option>{TASK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Datum"><input name="date" type="date" className="input" defaultValue={isoDate(day)} required /></Field>
              <Field label="Tijd"><input name="startTime" type="time" className="input" /></Field>
            </div>
            <Field label="Duur (min)"><input name="durationMin" type="number" className="input" /></Field>
            <Field label="Paard(en)">
              <select name="horseIds" multiple className="select h-32" defaultValue={sp.paard ? [sp.paard] : []}>
                {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <span className="text-xs muted">Meerdere selecteren = één taak per paard</span>
            </Field>
            <Field label="Medewerker"><select name="assigneeId" className="select" defaultValue={session.id}><option value="">Niet toegewezen</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <Field label="Herhalen">
              <select name="repeat" className="select"><option value="geen">Niet</option><option value="dagelijks">Dagelijks</option><option value="wekelijks">Wekelijks op...</option></select>
              <div className="flex gap-2 mt-1 text-sm">{[1, 2, 3, 4, 5, 6, 0].map((d) => <label key={d} className="flex items-center gap-1"><input type="checkbox" name="weekdays" value={d} />{DAYS[d]}</label>)}</div>
            </Field>
            <Field label="Herhalen tot"><input name="until" type="date" className="input" /></Field>
            <Field label="Notities"><textarea name="notes" className="textarea" rows={2} /></Field>
            <button className="btn btn-primary w-full justify-center">Inplannen</button>
          </form>
        </Card>

        <div className="md:col-span-2 space-y-4">
          {(week ? Array.from({ length: 7 }, (_, i) => addDays(monday, i)) : [day]).map((d) => {
            const list = tasks.filter((t) => isoDate(new Date(t.date)) === isoDate(d));
            return (
              <Card key={+d} title={week ? `${dayLabel(d)} (${list.filter((t) => t.status !== "KLAAR").length} open)` : `${list.filter((t) => t.status === "KLAAR").length} van ${list.length} klaar`}
                actions={week ? <Link href={nav(d, { weergave: undefined })} className="btn btn-sm">Open dag</Link> : undefined}>
                {list.length === 0 ? <Empty>Geen taken.</Empty> : (
                  <ul className="divide-y divide-[var(--line)]">
                    {list.map((t) => (
                      <li key={t.id} className="flex items-start gap-3 py-2">
                        <form action={toggleTask.bind(null, t.id)} className="pt-0.5">
                          <button type="submit" className={`w-5 h-5 rounded border text-xs ${t.status === "KLAAR" ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-gray-400"}`}>{t.status === "KLAAR" ? "✓" : ""}</button>
                        </form>
                        <div className={`flex-1 min-w-0 ${t.status === "KLAAR" ? "line-through muted" : ""}`}>
                          <div className="text-sm font-medium">{t.startTime && <span className="muted mr-2 tabular-nums">{t.startTime}</span>}{t.title}{t.durationMin ? <span className="muted text-xs"> · {t.durationMin} min</span> : null}</div>
                          <div className="text-xs muted">{[t.horse && <Link key="h" href={`/paarden/${t.horse.id}`} className="underline">{t.horse.name}</Link>, t.assignee?.name, t.category, t.notes].filter(Boolean).map((x, i) => <span key={i}>{i > 0 && " · "}{x}</span>)}</div>
                        </div>
                        {t.status === "BEZIG" && <Badge tone="warn">Bezig</Badge>}
                        {t.status === "OPEN" && <form action={setTaskStatus}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value="BEZIG" /><button className="btn btn-sm" title="Markeer als bezig">▶</button></form>}
                        <ConfirmForm action={deleteTask} confirm={t.seriesId ? "Verwijderen? (OK = alleen deze; voor de hele reeks: gebruik de knop ⟲)" : "Taak verwijderen?"}><input type="hidden" name="id" value={t.id} /><button className="btn btn-sm btn-danger">✕</button></ConfirmForm>
                        {t.seriesId && <ConfirmForm action={deleteTask} confirm="Deze en alle volgende taken van de reeks verwijderen?"><input type="hidden" name="id" value={t.id} /><input type="hidden" name="scope" value="reeks" /><button className="btn btn-sm btn-danger" title="Hele reeks verwijderen">⟲</button></ConfirmForm>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
