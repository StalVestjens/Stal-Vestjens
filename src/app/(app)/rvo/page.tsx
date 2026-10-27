import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Empty, Badge } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";
import { fmtDate, addDays, todayDate } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { markRvoReported, sendRvoNotification, deleteRvoNotification } from "./actions";

const TYPES: Record<string, string> = { AANVOER: "Aanvoer", AFVOER: "Afvoer", GEBOORTE: "Geboorte", DOOD: "Dood", IMPORT: "Import", EXPORT: "Export" };

export default async function RvoPage() {
  const session = await requireSession();
  const [open, done, ubn, endpoint, missing] = await Promise.all([
    db.rvoNotification.findMany({ where: { status: { in: ["TE_MELDEN", "FOUT"] } }, include: { horse: true }, orderBy: { eventDate: "asc" } }),
    db.rvoNotification.findMany({ where: { status: "GEMELD" }, include: { horse: true }, orderBy: { reportedAt: "desc" }, take: 50 }),
    getSetting("rvo_ubn", "RVO_UBN"),
    getSetting("rvo_endpoint", "RVO_ENDPOINT"),
    db.horse.findMany({ where: { status: "AANWEZIG", OR: [{ ueln: null }, { chipNumber: null }] }, orderBy: { name: "asc" } }),
  ]);
  const today = todayDate();
  const linked = !!endpoint;

  return (
    <>
      <PageHeader title="RVO · I&R paardachtigen" subtitle={ubn ? `UBN ${ubn}` : "Vul je UBN in bij Instellingen › Koppelingen"} />

      {!linked && <p className="text-sm mb-4 card p-3 bg-[#f8ead1]">De directe RVO-koppeling is nog niet actief (certificaat/aanmelding bij RVO nodig). Meld intussen via <a className="underline" href="https://mijn.rvo.nl" target="_blank">Mijn RVO</a> en vink de melding hier af.</p>}

      {missing.length > 0 && (
        <Card title="Paarden zonder UELN of chipnummer" className="mb-4">
          <p className="text-xs muted mb-2">Voor I&R is minimaal een UELN of chipnummer nodig.</p>
          <div className="flex flex-wrap gap-2">{missing.map((h) => <Link key={h.id} href={`/paarden/${h.id}/bewerken`} className="badge badge-warn">{h.name}</Link>)}</div>
        </Card>
      )}

      <Card title={`Te melden (${open.length})`} className="mb-4">
        {open.length === 0 ? <Empty>Niets open.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Gebeurtenis</th><th>Paard</th><th>Soort</th><th>UBN tegenpartij</th><th>Termijn</th><th>Referentie</th><th></th></tr></thead>
            <tbody>
              {open.map((n) => {
                const deadline = addDays(n.eventDate, 7);
                return (
                  <tr key={n.id}>
                    <td>{fmtDate(n.eventDate)}</td>
                    <td><Link href={`/paarden/${n.horseId}?tab=rvo`} className="font-medium">{n.horse.name}</Link><div className="text-xs muted">{n.horse.ueln ?? n.horse.chipNumber ?? "geen nummer!"}</div></td>
                    <td>{TYPES[n.type]}</td>
                    <td>{n.ubnOther ?? ""}</td>
                    <td><Badge tone={deadline < today ? "danger" : "warn"}>uiterlijk {fmtDate(deadline)}</Badge>{n.error && <div className="text-xs text-[var(--danger)]">{n.error}</div>}</td>
                    <td>
                      <form action={markRvoReported} className="flex gap-1" id={`m-${n.id}`}>
                        <input type="hidden" name="id" value={n.id} />
                        <input name="rvoRef" className="input w-32" placeholder="Meldingsnr." />
                        <button className="btn btn-sm">Gemeld ✓</button>
                      </form>
                    </td>
                    <td className="whitespace-nowrap">
                      {linked && session.role === "EIGENAAR" && <form action={sendRvoNotification} className="inline"><input type="hidden" name="id" value={n.id} /><button className="btn btn-sm btn-primary mr-1">Verstuur naar RVO</button></form>}
                      <ConfirmForm action={deleteRvoNotification} confirm="Melding verwijderen?" className="inline"><input type="hidden" name="id" value={n.id} /><button className="btn btn-sm btn-danger">✕</button></ConfirmForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Gemeld">
        {done.length === 0 ? <Empty>Nog geen gemelde meldingen.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Gebeurtenis</th><th>Paard</th><th>Soort</th><th>Gemeld op</th><th>Referentie</th></tr></thead>
            <tbody>{done.map((n) => <tr key={n.id}><td>{fmtDate(n.eventDate)}</td><td>{n.horse.name}</td><td>{TYPES[n.type]}</td><td>{fmtDate(n.reportedAt)}</td><td>{n.rvoRef ?? ""}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
