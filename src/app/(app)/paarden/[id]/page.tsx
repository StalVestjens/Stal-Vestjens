import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Field, Empty, Badge } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";
import { CustomFieldsView, extraOf } from "@/components/CustomFields";
import { fmtDate, fmtMoney, HEALTH_LABELS, isoDate, todayDate, addDays } from "@/lib/format";
import { addHealthRecord, deleteHealthRecord, uploadMedia, deleteMedia, deleteHorse, setHorsePhoto } from "../actions";
import { addResult, deleteResult } from "../../wedstrijden/actions";
import { addRvoNotification } from "../../rvo/actions";

export default async function HorsePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const { tab = "overzicht" } = await searchParams;
  const horse = await db.horse.findUnique({
    where: { id },
    include: {
      owner: true,
      healthRecords: { orderBy: { date: "desc" }, include: { files: true } },
      files: { orderBy: { createdAt: "desc" } },
      results: { orderBy: { date: "desc" } },
      tasks: { orderBy: { date: "desc" }, take: 30, include: { assignee: true } },
      rvoNotifications: { orderBy: { eventDate: "desc" } },
      transportHorses: { include: { transport: { include: { vehicle: true } } }, orderBy: { transport: { date: "desc" } } },
    },
  });
  if (!horse) notFound();
  const fields = await db.customField.findMany({ where: { entity: "HORSE" }, orderBy: { sort: "asc" } });
  const photo = horse.photoFileId ? horse.files.find((f) => f.id === horse.photoFileId) : horse.files.find((f) => f.kind === "FOTO");
  const age = horse.birthDate ? Math.floor((Date.now() - new Date(horse.birthDate).getTime()) / (365.25 * 864e5)) : null;

  const tabs = [
    ["overzicht", "Overzicht"], ["gezondheid", `Gezondheid (${horse.healthRecords.length})`], ["media", `Foto's & video (${horse.files.filter((f) => f.kind !== "ROENTGEN" && f.kind !== "DOCUMENT").length})`],
    ["rontgen", `Röntgen (${horse.files.filter((f) => f.kind === "ROENTGEN").length})`], ["documenten", `Documenten (${horse.files.filter((f) => f.kind === "DOCUMENT").length})`],
    ["wedstrijden", `Wedstrijden (${horse.results.length})`], ["planning", "Planning"], ["rvo", "RVO"],
  ];

  // Per gezondheidstype de laatste 'volgende datum'
  const nextByType = new Map<string, Date>();
  for (const r of [...horse.healthRecords].sort((a, b) => +a.date - +b.date)) if (r.nextDueDate) nextByType.set(r.type, r.nextDueDate);
  const today = todayDate();

  return (
    <>
      <PageHeader
        title={horse.name}
        subtitle={[horse.sex && { HENGST: "Hengst", MERRIE: "Merrie", RUIN: "Ruin" }[horse.sex], age != null && `${age} jaar`, horse.studbook, horse.owner?.name ?? "Eigen paard"].filter(Boolean).join(" · ")}
        actions={<>
          <Link href={`/paarden/${id}/bewerken`} className="btn">Bewerken</Link>
          {session.role === "EIGENAAR" && <ConfirmForm action={deleteHorse} confirm={`${horse.name} en alle bijbehorende gegevens verwijderen?`}><input type="hidden" name="id" value={id} /><button className="btn btn-danger">Verwijderen</button></ConfirmForm>}
        </>}
      />

      <div className="flex gap-1 flex-wrap mb-4 border-b border-[var(--line)]">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/paarden/${id}?tab=${k}`} className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === k ? "border-[var(--accent)] font-semibold" : "border-transparent muted"}`}>{l}</Link>
        ))}
      </div>

      {tab === "overzicht" && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-1">
            {photo ? <img src={`/api/bestand/${photo.id}`} alt={horse.name} className="w-full rounded-lg object-cover aspect-square mb-3" /> : <div className="w-full aspect-square rounded-lg bg-[#ece9e0] flex items-center justify-center text-5xl mb-3">🐴</div>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="muted">UELN</dt><dd>{horse.ueln ?? "–"}</dd>
              <dt className="muted">Chip</dt><dd>{horse.chipNumber ?? "–"}</dd>
              <dt className="muted">Geboren</dt><dd>{fmtDate(horse.birthDate)}</dd>
              <dt className="muted">Kleur</dt><dd>{horse.color ?? "–"}</dd>
              <dt className="muted">Stokmaat</dt><dd>{horse.heightCm ? `${horse.heightCm} cm` : "–"}</dd>
              <dt className="muted">Afstamming</dt><dd>{[horse.sire, horse.dam, horse.damSire].filter(Boolean).join(" × ") || "–"}</dd>
              <dt className="muted">Fokker</dt><dd>{horse.breeder ?? "–"}</dd>
              <dt className="muted">FEI / KNHS</dt><dd>{[horse.fei, horse.knhsNumber].filter(Boolean).join(" / ") || "–"}</dd>
              <dt className="muted">Stal</dt><dd>{horse.stall ?? "–"}</dd>
              <dt className="muted">Ruiter</dt><dd>{horse.rider ?? "–"}</dd>
              <dt className="muted">Discipline</dt><dd>{[horse.discipline, horse.level].filter(Boolean).join(" ") || "–"}</dd>
            </dl>
            <div className="mt-3"><CustomFieldsView fields={fields} values={extraOf(horse.extra)} /></div>
            {horse.notes && <p className="text-sm mt-3 whitespace-pre-wrap">{horse.notes}</p>}
          </Card>
          <div className="md:col-span-2 space-y-4">
            <Card title="Volgende data">
              {nextByType.size === 0 ? <Empty>Nog geen vaccinaties, ontwormingen of smidbezoeken geregistreerd.</Empty> : (
                <div className="flex flex-wrap gap-2">
                  {[...nextByType.entries()].map(([t, d]) => <Badge key={t} tone={d < today ? "danger" : d < addDays(today, 30) ? "warn" : "ok"}>{HEALTH_LABELS[t]}: {fmtDate(d)}</Badge>)}
                </div>
              )}
            </Card>
            <Card title="Laatste wedstrijdresultaten">
              {horse.results.length === 0 ? <Empty>Nog geen resultaten.</Empty> : (
                <table className="tbl"><tbody>{horse.results.slice(0, 5).map((r) => <tr key={r.id}><td>{fmtDate(r.date)}</td><td>{r.showName}{r.className ? ` · ${r.className}` : ""}</td><td className="text-right font-semibold">{r.rank ? `${r.rank}e` : ""} {r.score ?? ""}</td></tr>)}</tbody></table>
              )}
            </Card>
            <Card title="Laatste taken">
              {horse.tasks.length === 0 ? <Empty>Nog geen taken.</Empty> : (
                <table className="tbl"><tbody>{horse.tasks.slice(0, 8).map((t) => <tr key={t.id}><td>{fmtDate(t.date)}</td><td>{t.title}</td><td>{t.assignee?.name ?? ""}</td><td className="text-right"><Badge tone={t.status === "KLAAR" ? "ok" : undefined}>{t.status}</Badge></td></tr>)}</tbody></table>
              )}
            </Card>
            <Card title="Transporten">
              {horse.transportHorses.length === 0 ? <Empty>Nog geen transporten.</Empty> : (
                <table className="tbl"><tbody>{horse.transportHorses.slice(0, 5).map((th) => <tr key={th.transportId}><td>{fmtDate(th.transport.date)}</td><td>{th.transport.fromAddress} → {th.transport.toAddress}</td><td>{th.transport.vehicle?.name ?? ""}</td></tr>)}</tbody></table>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "gezondheid" && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card title="Registratie toevoegen" className="md:col-span-1">
            <form action={addHealthRecord} className="space-y-3">
              <input type="hidden" name="horseId" value={id} />
              <Field label="Type"><select name="type" className="select">{Object.entries(HEALTH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Datum"><input name="date" type="date" className="input" defaultValue={isoDate()} required /></Field>
              <Field label="Omschrijving"><input name="title" className="input" placeholder="Influenza/tetanus, bekappen, ..." required /></Field>
              <Field label="Product / middel"><input name="product" className="input" /></Field>
              <Field label="Batchnummer"><input name="batchNumber" className="input" /></Field>
              <Field label="Uitgevoerd door"><input name="provider" className="input" placeholder="Dierenarts, smid, ..." /></Field>
              <Field label="Kosten (€)"><input name="cost" type="number" step="0.01" className="input" /></Field>
              <Field label="Volgende keer"><input name="nextDueDate" type="date" className="input" /></Field>
              <Field label="Bijlage (verslag, röntgenfoto, ...)"><input name="file" type="file" className="input" /></Field>
              <Field label="Notities"><textarea name="notes" className="textarea" rows={2} /></Field>
              <button className="btn btn-primary w-full justify-center">Toevoegen</button>
            </form>
          </Card>
          <Card title="Historie" className="md:col-span-2">
            {horse.healthRecords.length === 0 ? <Empty>Nog geen registraties.</Empty> : (
              <table className="tbl">
                <thead><tr><th>Datum</th><th>Type</th><th>Omschrijving</th><th>Door</th><th>Volgende</th><th></th></tr></thead>
                <tbody>
                  {horse.healthRecords.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.date)}</td>
                      <td><Badge>{HEALTH_LABELS[r.type]}</Badge></td>
                      <td>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs muted">{[r.product, r.batchNumber && `batch ${r.batchNumber}`, r.cost && fmtMoney(r.cost), r.notes].filter(Boolean).join(" · ")}</div>
                        {r.files.map((f) => <a key={f.id} href={`/api/bestand/${f.id}`} target="_blank" className="text-xs underline mr-2">📎 {f.fileName}</a>)}
                      </td>
                      <td>{r.provider ?? ""}</td>
                      <td>{fmtDate(r.nextDueDate)}</td>
                      <td><ConfirmForm action={deleteHealthRecord} confirm="Registratie verwijderen?"><input type="hidden" name="id" value={r.id} /><button className="btn btn-sm btn-danger">✕</button></ConfirmForm></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {(tab === "media" || tab === "rontgen" || tab === "documenten") && (() => {
        const kinds = tab === "media" ? ["FOTO", "VIDEO"] : tab === "rontgen" ? ["ROENTGEN"] : ["DOCUMENT"];
        const files = horse.files.filter((f) => kinds.includes(f.kind));
        const defaultKind = tab === "rontgen" ? "ROENTGEN" : tab === "documenten" ? "DOCUMENT" : "";
        return (
          <div className="space-y-4">
            <Card title={tab === "media" ? "Foto of video toevoegen" : tab === "rontgen" ? "Röntgenbeelden toevoegen" : "Document toevoegen"}>
              <form action={uploadMedia} className="grid md:grid-cols-4 gap-3 items-end">
                <input type="hidden" name="horseId" value={id} />
                <input type="hidden" name="kind" value={defaultKind} />
                <Field label="Bestand(en)" className="md:col-span-2"><input name="files" type="file" multiple className="input" accept={tab === "media" ? "image/*,video/*" : tab === "rontgen" ? "image/*,.dcm,.pdf" : "*/*"} required /></Field>
                <Field label="Titel"><input name="title" className="input" placeholder={tab === "rontgen" ? "Linker voorbeen, lateraal" : "Omschrijving"} /></Field>
                <Field label="Datum opname"><input name="takenAt" type="date" className="input" /></Field>
                <button className="btn btn-primary md:col-span-4 md:w-auto">Uploaden</button>
              </form>
              {tab === "media" && <p className="text-xs muted mt-2">Tip: via WhatsApp? Stuur het filmpje naar het stalnummer met de naam van het paard erbij (zie Instellingen › Koppelingen › WhatsApp), of deel het vanuit WhatsApp naar deze app.</p>}
            </Card>
            {files.length === 0 ? <Card><Empty>Nog niets geüpload.</Empty></Card> : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {files.map((f) => (
                  <div key={f.id} className="card overflow-hidden">
                    <a href={`/api/bestand/${f.id}`} target="_blank" className="block aspect-square bg-black/5">
                      {f.mimeType.startsWith("image/") ? <img src={`/api/bestand/${f.id}`} alt={f.title ?? f.fileName} className="w-full h-full object-cover" loading="lazy" />
                        : f.mimeType.startsWith("video/") ? <video src={`/api/bestand/${f.id}`} className="w-full h-full object-cover" preload="metadata" muted />
                        : <div className="w-full h-full flex items-center justify-center text-4xl">📄</div>}
                    </a>
                    <div className="p-2 text-xs">
                      <div className="font-medium truncate" title={f.fileName}>{f.title ?? f.fileName}</div>
                      <div className="muted">{fmtDate(f.takenAt ?? f.createdAt)}{f.source !== "UPLOAD" && ` · ${f.source === "WHATSAPP" ? "WhatsApp" : "Gedeeld"}`} · {(f.size / 1e6).toFixed(1)} MB</div>
                      <div className="flex gap-1 mt-1">
                        {f.kind === "FOTO" && <form action={setHorsePhoto}><input type="hidden" name="horseId" value={id} /><input type="hidden" name="fileId" value={f.id} /><button className="btn btn-sm" title="Als profielfoto">★</button></form>}
                        <ConfirmForm action={deleteMedia} confirm="Bestand verwijderen?"><input type="hidden" name="id" value={f.id} /><button className="btn btn-sm btn-danger">✕</button></ConfirmForm>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {tab === "wedstrijden" && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card title="Resultaat toevoegen">
            <form action={addResult} className="space-y-3">
              <input type="hidden" name="horseId" value={id} />
              <Field label="Datum"><input name="date" type="date" className="input" defaultValue={isoDate()} required /></Field>
              <Field label="Wedstrijd"><input name="showName" className="input" required /></Field>
              <Field label="Rubriek / proef"><input name="className" className="input" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Discipline"><input name="discipline" className="input" defaultValue={horse.discipline ?? ""} /></Field>
                <Field label="Klasse"><input name="level" className="input" defaultValue={horse.level ?? ""} /></Field>
              </div>
              <Field label="Ruiter"><input name="rider" className="input" defaultValue={horse.rider ?? ""} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Plaats"><input name="rank" type="number" className="input" /></Field>
                <Field label="Score / fouten / tijd"><input name="score" className="input" placeholder="0/0 71.23 · 68,5%" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Winstpunten"><input name="points" type="number" step="0.5" className="input" /></Field>
                <Field label="Prijzengeld (€)"><input name="prizeMoney" type="number" step="0.01" className="input" /></Field>
              </div>
              <Field label="Locatie"><input name="location" className="input" /></Field>
              <Field label="Filmpje / foto"><input name="file" type="file" className="input" accept="image/*,video/*" /></Field>
              <button className="btn btn-primary w-full justify-center">Toevoegen</button>
            </form>
          </Card>
          <Card title="Resultaten" className="md:col-span-2">
            {horse.results.length === 0 ? <Empty>Nog geen resultaten. Koppel Equipe bij Instellingen om ze automatisch op te halen.</Empty> : (
              <table className="tbl">
                <thead><tr><th>Datum</th><th>Wedstrijd</th><th>Rubriek</th><th>Ruiter</th><th>Plaats</th><th>Score</th><th>Bron</th><th></th></tr></thead>
                <tbody>
                  {horse.results.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.date)}</td>
                      <td>{r.showName}{r.location && <div className="text-xs muted">{r.location}</div>}</td>
                      <td>{[r.className, r.level].filter(Boolean).join(" · ")}</td>
                      <td>{r.rider ?? ""}</td>
                      <td className="font-semibold">{r.rank ? `${r.rank}e` : "–"}</td>
                      <td>{r.score ?? ""}{r.points != null && <div className="text-xs muted">{String(r.points)} wp</div>}{r.prizeMoney != null && <div className="text-xs muted">{fmtMoney(r.prizeMoney)}</div>}</td>
                      <td><Badge>{r.source}</Badge></td>
                      <td><ConfirmForm action={deleteResult} confirm="Resultaat verwijderen?"><input type="hidden" name="id" value={r.id} /><button className="btn btn-sm btn-danger">✕</button></ConfirmForm></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === "planning" && (
        <Card title="Taken voor dit paard" actions={<Link href={`/planning?paard=${id}`} className="btn btn-sm btn-primary">+ Taak inplannen</Link>}>
          {horse.tasks.length === 0 ? <Empty>Nog geen taken.</Empty> : (
            <table className="tbl">
              <thead><tr><th>Datum</th><th>Tijd</th><th>Taak</th><th>Categorie</th><th>Wie</th><th>Status</th></tr></thead>
              <tbody>{horse.tasks.map((t) => <tr key={t.id}><td>{fmtDate(t.date)}</td><td>{t.startTime ?? ""}</td><td>{t.title}{t.notes && <div className="text-xs muted">{t.notes}</div>}</td><td>{t.category ?? ""}</td><td>{t.assignee?.name ?? "–"}</td><td><Badge tone={t.status === "KLAAR" ? "ok" : t.status === "BEZIG" ? "warn" : undefined}>{t.status}</Badge></td></tr>)}</tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "rvo" && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card title="Melding registreren">
            <p className="text-xs muted mb-3">Meldingen aan RVO (I&R paardachtigen) moeten binnen 7 dagen. Zonder actieve RVO-koppeling meld je zelf via Mijn RVO en zet je de melding hier op 'Gemeld'.</p>
            <form action={addRvoNotification} className="space-y-3">
              <input type="hidden" name="horseId" value={id} />
              <Field label="Soort melding"><select name="type" className="select"><option value="AANVOER">Aanvoer (op mijn UBN)</option><option value="AFVOER">Afvoer (van mijn UBN)</option><option value="GEBOORTE">Geboorte</option><option value="DOOD">Dood</option><option value="IMPORT">Import</option><option value="EXPORT">Export</option></select></Field>
              <Field label="Datum gebeurtenis"><input name="eventDate" type="date" className="input" defaultValue={isoDate()} required /></Field>
              <Field label="UBN tegenpartij"><input name="ubnOther" className="input" placeholder="Herkomst / bestemming" /></Field>
              <button className="btn btn-primary w-full justify-center">Registreren</button>
            </form>
          </Card>
          <Card title="Meldingen" className="md:col-span-2">
            <p className="text-sm mb-3">UELN: <strong>{horse.ueln ?? "ontbreekt"}</strong> · Chip: <strong>{horse.chipNumber ?? "ontbreekt"}</strong></p>
            {horse.rvoNotifications.length === 0 ? <Empty>Geen meldingen.</Empty> : (
              <table className="tbl"><thead><tr><th>Datum</th><th>Soort</th><th>UBN</th><th>Status</th><th>Gemeld op</th></tr></thead>
                <tbody>{horse.rvoNotifications.map((n) => <tr key={n.id}><td>{fmtDate(n.eventDate)}</td><td>{n.type}</td><td>{n.ubnOther ?? ""}</td><td><Badge tone={n.status === "GEMELD" ? "ok" : n.status === "FOUT" ? "danger" : "warn"}>{n.status.replace("_", " ")}</Badge>{n.error && <div className="text-xs text-[var(--danger)]">{n.error}</div>}</td><td>{fmtDate(n.reportedAt)}</td></tr>)}</tbody>
              </table>
            )}
            <Link href="/rvo" className="btn btn-sm mt-3">Naar RVO-overzicht</Link>
          </Card>
        </div>
      )}
    </>
  );
}
