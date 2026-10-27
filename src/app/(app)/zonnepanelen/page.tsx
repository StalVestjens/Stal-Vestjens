import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Field, Empty, Stat } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";
import { fmtDate, fmtNum, fmtMoney, isoDate, localDateStr } from "@/lib/format";
import { saveInstallation, deleteInstallation, addReading, importReadingsCsv, deleteReading } from "./actions";

const d = (x?: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : "");

export default async function SolarPage({ searchParams }: { searchParams: Promise<{ inst?: string; bewerk?: string; jaar?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const thisYear = Number(localDateStr().slice(0, 4));
  const year = /^\d{4}$/.test(sp.jaar ?? "") ? Number(sp.jaar) : thisYear;
  const installations = await db.solarInstallation.findMany({ orderBy: { name: "asc" } });
  const current = installations.find((i) => i.id === sp.inst) ?? installations[0];
  const editing = sp.bewerk ? installations.find((i) => i.id === sp.bewerk) : undefined;
  const readings = current ? await db.solarReading.findMany({ where: { installationId: current.id, date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } }, orderBy: { date: "desc" } }) : [];
  const total = readings.reduce((s, r) => s + Number(r.producedKwh), 0);
  const feed = readings.reduce((s, r) => s + Number(r.feedInKwh ?? 0), 0);
  const perMonth = Array.from({ length: 12 }, (_, m) => readings.filter((r) => new Date(r.date).getUTCMonth() === m).reduce((s, r) => s + Number(r.producedKwh), 0));
  const max = Math.max(1, ...perMonth);
  const months = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

  return (
    <>
      <PageHeader title="Zonnepanelen" subtitle={current ? `${current.name}${current.peakPowerKwp ? ` · ${current.peakPowerKwp} kWp` : ""}${current.panels ? ` · ${current.panels} panelen` : ""}` : "Nog geen installatie"} />

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {installations.map((i) => <Link key={i.id} href={`/zonnepanelen?inst=${i.id}&jaar=${year}`} className={`btn btn-sm ${current?.id === i.id ? "btn-primary" : ""}`}>{i.name}</Link>)}
        <Link href="/zonnepanelen?bewerk=nieuw" className="btn btn-sm">+ Installatie</Link>
        <form className="ml-auto flex gap-2"><input type="hidden" name="inst" value={current?.id ?? ""} /><select name="jaar" className="select" defaultValue={year}>{Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => <option key={y}>{y}</option>)}</select><button className="btn btn-sm">Toon</button></form>
      </div>

      {(sp.bewerk === "nieuw" || editing) && (
        <Card title={editing ? "Installatie bewerken" : "Nieuwe installatie"} className="mb-4">
          <form action={saveInstallation} className="grid md:grid-cols-4 gap-3">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <Field label="Naam"><input name="name" className="input" required defaultValue={editing?.name ?? ""} placeholder="Dak stal, loods, ..." /></Field>
            <Field label="Locatie"><input name="location" className="input" defaultValue={editing?.location ?? ""} /></Field>
            <Field label="Aantal panelen"><input name="panels" type="number" className="input" defaultValue={editing?.panels ?? ""} /></Field>
            <Field label="Vermogen (kWp)"><input name="peakPowerKwp" type="number" step="0.01" className="input" defaultValue={editing?.peakPowerKwp ? String(editing.peakPowerKwp) : ""} /></Field>
            <Field label="Omvormer"><input name="inverter" className="input" defaultValue={editing?.inverter ?? ""} placeholder="SolarEdge, Enphase, ..." /></Field>
            <Field label="Geïnstalleerd op"><input name="installedAt" type="date" className="input" defaultValue={d(editing?.installedAt)} /></Field>
            <Field label="Terugleververgoeding (€/kWh)"><input name="feedInRate" type="number" step="0.0001" className="input" defaultValue={editing?.feedInRate ? String(editing.feedInRate) : ""} /></Field>
            <Field label="Notities"><input name="notes" className="input" defaultValue={editing?.notes ?? ""} /></Field>
            <div className="md:col-span-4 flex gap-2"><button className="btn btn-primary">Opslaan</button><Link href="/zonnepanelen" className="btn">Annuleren</Link></div>
          </form>
          {editing && session.role === "EIGENAAR" && <ConfirmForm action={deleteInstallation} confirm="Installatie en alle metingen verwijderen?" className="mt-3"><input type="hidden" name="id" value={editing.id} /><button className="btn btn-danger">Installatie verwijderen</button></ConfirmForm>}
        </Card>
      )}

      {current && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label={`Opbrengst ${year}`} value={`${fmtNum(total)} kWh`} />
            <Stat label="Teruggeleverd" value={`${fmtNum(feed)} kWh`} />
            <Stat label="Eigen verbruik" value={`${fmtNum(total - feed)} kWh`} />
            <Stat label="Waarde teruglevering" value={current.feedInRate ? fmtMoney(feed * Number(current.feedInRate)) : "–"} />
          </div>
          <Card title={`Opbrengst per maand ${year}`} className="mb-4" actions={<Link href={`/zonnepanelen?inst=${current.id}&bewerk=${current.id}`} className="btn btn-sm">Installatie bewerken</Link>}>
            <div className="flex items-end gap-1 h-40">
              {perMonth.map((v, m) => <div key={m} className="flex-1 flex flex-col items-center justify-end h-full"><div className="text-[10px] muted">{v ? fmtNum(v) : ""}</div><div className="w-full bg-[var(--accent)] rounded-t" style={{ height: `${(v / max) * 100}%` }} /><div className="text-[10px] muted mt-1">{months[m]}</div></div>)}
            </div>
          </Card>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-4">
              <Card title="Meting invoeren">
                <form action={addReading} className="space-y-3">
                  <input type="hidden" name="installationId" value={current.id} />
                  <Field label="Datum"><input name="date" type="date" className="input" defaultValue={isoDate()} required /></Field>
                  <Field label="Opbrengst (kWh)"><input name="producedKwh" type="number" step="0.01" className="input" required /></Field>
                  <Field label="Teruggeleverd (kWh)"><input name="feedInKwh" type="number" step="0.01" className="input" /></Field>
                  <Field label="Notitie"><input name="notes" className="input" placeholder="storing, schoongemaakt, ..." /></Field>
                  <button className="btn btn-primary w-full justify-center">Opslaan</button>
                </form>
              </Card>
              <Card title="CSV importeren">
                <form action={importReadingsCsv} className="space-y-2">
                  <input type="hidden" name="installationId" value={current.id} />
                  <input type="file" name="file" accept=".csv" className="input" required />
                  <button className="btn w-full justify-center">Importeren</button>
                  <p className="text-xs muted">Formaat: <code>datum;kWh;teruglevering</code> per regel (export uit de app van je omvormer). Een directe koppeling met je omvormer (SolarEdge/Enphase/Growatt-API) kan als uitbreiding worden ingebouwd.</p>
                </form>
              </Card>
            </div>
            <Card title="Metingen" className="md:col-span-2">
              {readings.length === 0 ? <Empty>Nog geen metingen in {year}.</Empty> : (
                <div className="max-h-[32rem] overflow-y-auto"><table className="tbl"><thead><tr><th>Datum</th><th className="text-right">kWh</th><th className="text-right">Terug</th><th>Notitie</th><th></th></tr></thead>
                  <tbody>{readings.map((r) => <tr key={r.id}><td>{fmtDate(r.date)}</td><td className="text-right">{fmtNum(r.producedKwh, 1)}</td><td className="text-right">{r.feedInKwh != null ? fmtNum(r.feedInKwh, 1) : ""}</td><td className="text-xs muted">{r.notes ?? ""}</td><td><ConfirmForm action={deleteReading} confirm="Meting verwijderen?"><input type="hidden" name="id" value={r.id} /><button className="btn btn-sm btn-danger">✕</button></ConfirmForm></td></tr>)}</tbody></table></div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
