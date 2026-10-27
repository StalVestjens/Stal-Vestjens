import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Field, Empty, Badge } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";
import { CustomFieldsForm, extraOf } from "@/components/CustomFields";
import { fmtDate, fmtDateTime, fmtMoney, isoDate, addDays, toLocalInput, todayDate } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { saveVehicle, deleteVehicle, saveTransport, deleteTransport, invoiceTransport, runFleetGoSync } from "./actions";

const d = (x?: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : "");
const STATUS: Record<string, { l: string; t?: "ok" | "warn" | "danger" }> = { GEPLAND: { l: "Gepland" }, ONDERWEG: { l: "Onderweg", t: "warn" }, AFGEROND: { l: "Afgerond", t: "ok" }, GEANNULEERD: { l: "Geannuleerd", t: "danger" } };

export default async function TransportPage({ searchParams }: { searchParams: Promise<{ bewerk?: string; voertuig?: string; tab?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const tab = sp.tab ?? (sp.voertuig ? "voertuigen" : "ritten");
  const [transports, vehicles, horses, customers, fields, fleetgo, lastSync] = await Promise.all([
    db.transport.findMany({ include: { vehicle: true, customer: true, horses: { include: { horse: true } } }, orderBy: { date: "desc" }, take: 200 }),
    db.vehicle.findMany({ orderBy: { name: "asc" } }),
    db.horse.findMany({ where: { status: { in: ["AANWEZIG", "AFWEZIG"] } }, orderBy: { name: "asc" } }),
    db.customer.findMany({ orderBy: { name: "asc" } }),
    db.customField.findMany({ where: { entity: "VEHICLE" }, orderBy: { sort: "asc" } }),
    getSetting("fleetgo_client_id", "FLEETGO_CLIENT_ID"),
    db.syncLog.findFirst({ where: { integration: "fleetgo" }, orderBy: { createdAt: "desc" } }),
  ]);
  const editing = sp.bewerk ? transports.find((t) => t.id === sp.bewerk) : undefined;
  const editingVehicle = sp.voertuig ? vehicles.find((v) => v.id === sp.voertuig) : undefined;
  const today = todayDate();
  const tachoDue = (v: typeof vehicles[number]) => ({
    vehicle: v.lastTachoDownload ? addDays(v.lastTachoDownload, 90) : null,
    card: v.lastCardDownload ? addDays(v.lastCardDownload, 28) : null,
  });

  return (
    <>
      <PageHeader title="Transport" subtitle="Ritten, voertuigen en tachograaf"
        actions={<form action={runFleetGoSync}><button className="btn" disabled={!fleetgo} title={fleetgo ? "Ritten en tachograafstatus ophalen uit FleetGo" : "Stel eerst de FleetGo-koppeling in bij Instellingen"}>↻ FleetGo ophalen</button></form>} />
      {lastSync && <p className="text-xs muted mb-3">Laatste FleetGo-synchronisatie: {fmtDate(lastSync.createdAt)} · {lastSync.message}</p>}

      <div className="flex gap-1 mb-4 border-b border-[var(--line)]">
        {[["ritten", "Ritten"], ["voertuigen", "Voertuigen & tachograaf"]].map(([k, l]) => <Link key={k} href={`/transport?tab=${k}`} className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === k ? "border-[var(--accent)] font-semibold" : "border-transparent muted"}`}>{l}</Link>)}
      </div>

      {tab === "ritten" && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card title={editing ? "Rit bewerken" : "Rit plannen"}>
            <form action={saveTransport} className="space-y-3">
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field label="Datum & tijd"><input name="date" type="datetime-local" className="input" defaultValue={editing ? toLocalInput(editing.date) : `${isoDate()}T08:00`} required /></Field>
              <Field label="Van"><input name="fromAddress" className="input" required defaultValue={editing?.fromAddress ?? ""} /></Field>
              <Field label="Naar"><input name="toAddress" className="input" required defaultValue={editing?.toAddress ?? ""} /></Field>
              <Field label="Paarden"><select name="horseIds" multiple className="select h-28" defaultValue={editing?.horses.map((h) => h.horseId) ?? []}>{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Voertuig"><select name="vehicleId" className="select" defaultValue={editing?.vehicleId ?? ""}><option value="">–</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
                <Field label="Chauffeur"><input name="driver" className="input" defaultValue={editing?.driver ?? session.name} /></Field>
              </div>
              <Field label="Klant (voor facturatie)"><select name="customerId" className="select" defaultValue={editing?.customerId ?? ""}><option value="">Eigen rit</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Afstand (km)"><input name="distanceKm" type="number" step="0.1" className="input" defaultValue={editing?.distanceKm ? String(editing.distanceKm) : ""} /></Field>
                <Field label="Prijs (€, leeg = per km)"><input name="price" type="number" step="0.01" className="input" defaultValue={editing?.price ? String(editing.price) : ""} /></Field>
              </div>
              <Field label="Status"><select name="status" className="select" defaultValue={editing?.status ?? "GEPLAND"}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select></Field>
              <Field label="Notities"><textarea name="notes" className="textarea" rows={2} defaultValue={editing?.notes ?? ""} /></Field>
              <div className="flex gap-2"><button className="btn btn-primary flex-1 justify-center">{editing ? "Opslaan" : "Plannen"}</button>{editing && <Link href="/transport" className="btn">Annuleren</Link>}</div>
            </form>
          </Card>
          <Card title="Ritten" className="md:col-span-2">
            {transports.length === 0 ? <Empty>Nog geen ritten.</Empty> : (
              <table className="tbl">
                <thead><tr><th>Datum</th><th>Route</th><th>Paarden</th><th>Voertuig</th><th>Klant</th><th>Status</th><th></th></tr></thead>
                <tbody>{transports.map((t) => (
                  <tr key={t.id}>
                    <td>{fmtDateTime(t.date)}</td>
                    <td>{t.fromAddress} → {t.toAddress}<div className="text-xs muted">{[t.distanceKm && `${t.distanceKm} km`, t.price != null && fmtMoney(t.price), t.driver].filter(Boolean).join(" · ")} {t.externalTripId && <span title="Uit FleetGo">📡</span>}</div>
                      <a className="text-xs underline" target="_blank" href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(t.fromAddress)}&destination=${encodeURIComponent(t.toAddress)}`}>Route in Google Maps</a></td>
                    <td>{t.horses.map((h) => <Link key={h.horseId} href={`/paarden/${h.horseId}`} className="block">{h.horse.name}</Link>)}</td>
                    <td>{t.vehicle?.name ?? ""}</td>
                    <td>{t.customer?.name ?? <span className="muted">eigen</span>}{t.invoiced && <Badge tone="ok">gefactureerd</Badge>}</td>
                    <td><Badge tone={STATUS[t.status].t}>{STATUS[t.status].l}</Badge></td>
                    <td className="whitespace-nowrap">
                      <Link href={`/transport?bewerk=${t.id}`} className="btn btn-sm">✎</Link>{" "}
                      {session.role === "EIGENAAR" && t.customerId && !t.invoiced && t.status === "AFGEROND" && <ConfirmForm action={invoiceTransport} confirm="Conceptfactuur aanmaken voor deze rit?" className="inline"><input type="hidden" name="id" value={t.id} /><button className="btn btn-sm">🧾</button></ConfirmForm>}{" "}
                      <ConfirmForm action={deleteTransport} confirm="Rit verwijderen?" className="inline"><input type="hidden" name="id" value={t.id} /><button className="btn btn-sm btn-danger">✕</button></ConfirmForm>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === "voertuigen" && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card title={editingVehicle ? "Voertuig bewerken" : "Voertuig toevoegen"}>
            <form action={saveVehicle} className="space-y-3">
              {editingVehicle && <input type="hidden" name="id" value={editingVehicle.id} />}
              <Field label="Naam"><input name="name" className="input" required defaultValue={editingVehicle?.name ?? ""} placeholder="Vrachtwagen, trailer 2, ..." /></Field>
              <Field label="Kenteken"><input name="licensePlate" className="input" required defaultValue={editingVehicle?.licensePlate ?? ""} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Type"><input name="type" className="input" defaultValue={editingVehicle?.type ?? ""} placeholder="Vrachtwagen / trailer" /></Field>
                <Field label="Capaciteit (paarden)"><input name="capacityHorses" type="number" className="input" defaultValue={editingVehicle?.capacityHorses ?? ""} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Kilometerstand"><input name="odometerKm" type="number" className="input" defaultValue={editingVehicle?.odometerKm ?? ""} /></Field>
                <Field label="APK tot"><input name="apkDate" type="date" className="input" defaultValue={d(editingVehicle?.apkDate)} /></Field>
              </div>
              <Field label="Tachograaf-ijking"><input name="tachoCalibration" type="date" className="input" defaultValue={d(editingVehicle?.tachoCalibration)} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Laatste download voertuig"><input name="lastTachoDownload" type="date" className="input" defaultValue={d(editingVehicle?.lastTachoDownload)} /></Field>
                <Field label="Laatste download chauffeurskaart"><input name="lastCardDownload" type="date" className="input" defaultValue={d(editingVehicle?.lastCardDownload)} /></Field>
              </div>
              <CustomFieldsForm fields={fields} values={extraOf(editingVehicle?.extra)} />
              <Field label="Notities"><textarea name="notes" className="textarea" rows={2} defaultValue={editingVehicle?.notes ?? ""} /></Field>
              <div className="flex gap-2"><button className="btn btn-primary flex-1 justify-center">Opslaan</button>{editingVehicle && <Link href="/transport?tab=voertuigen" className="btn">Annuleren</Link>}</div>
            </form>
          </Card>
          <Card title="Voertuigen & tachograaftermijnen" className="md:col-span-2">
            <p className="text-xs muted mb-3">Wettelijk: voertuigunit minimaal elke 90 dagen downloaden, chauffeurskaart elke 28 dagen. Met de FleetGo-koppeling worden deze data automatisch bijgewerkt.</p>
            {vehicles.length === 0 ? <Empty>Nog geen voertuigen.</Empty> : (
              <table className="tbl">
                <thead><tr><th>Voertuig</th><th>Kenteken</th><th>APK</th><th>Ijking</th><th>Download voertuig</th><th>Download kaart</th><th></th></tr></thead>
                <tbody>{vehicles.map((v) => { const due = tachoDue(v); const tone = (x: Date | null) => !x ? undefined : x < today ? "danger" : x < addDays(today, 7) ? "warn" : "ok"; return (
                  <tr key={v.id}>
                    <td className="font-medium">{v.name}{v.fleetgoId && <span title="Gekoppeld aan FleetGo"> 📡</span>}<div className="text-xs muted">{v.type}{v.capacityHorses ? ` · ${v.capacityHorses} paarden` : ""}{v.odometerKm ? ` · ${v.odometerKm.toLocaleString("nl-NL")} km` : ""}</div></td>
                    <td>{v.licensePlate}</td>
                    <td><Badge tone={v.apkDate ? (v.apkDate < today ? "danger" : v.apkDate < addDays(today, 30) ? "warn" : "ok") : undefined}>{fmtDate(v.apkDate)}</Badge></td>
                    <td>{fmtDate(v.tachoCalibration)}</td>
                    <td>{fmtDate(v.lastTachoDownload)}<br /><Badge tone={tone(due.vehicle)}>{due.vehicle ? `uiterlijk ${fmtDate(due.vehicle)}` : "onbekend"}</Badge></td>
                    <td>{fmtDate(v.lastCardDownload)}<br /><Badge tone={tone(due.card)}>{due.card ? `uiterlijk ${fmtDate(due.card)}` : "onbekend"}</Badge></td>
                    <td className="whitespace-nowrap"><Link href={`/transport?voertuig=${v.id}`} className="btn btn-sm">✎</Link> {session.role === "EIGENAAR" && <ConfirmForm action={deleteVehicle} confirm="Voertuig verwijderen?" className="inline"><input type="hidden" name="id" value={v.id} /><button className="btn btn-sm btn-danger">✕</button></ConfirmForm>}</td>
                  </tr>); })}</tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
