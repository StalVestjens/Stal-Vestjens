import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Empty } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";
import { fmtDate } from "@/lib/format";
import { assignInboxFile, deleteInboxFile } from "./actions";

/** Postvak: media uit WhatsApp of 'delen' die nog aan geen paard gekoppeld zijn. */
export default async function InboxPage() {
  await requireSession();
  const [files, horses] = await Promise.all([
    db.mediaFile.findMany({ where: { horseId: null }, orderBy: { createdAt: "desc" } }),
    db.horse.findMany({ where: { status: { in: ["AANWEZIG", "AFWEZIG"] } }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Postvak" subtitle="Foto's en filmpjes die nog aan een paard gekoppeld moeten worden" />
      {files.length === 0 ? <Card><Empty>Leeg. Alles wat via WhatsApp of 'Delen' binnenkomt zonder herkenbare paardnaam verschijnt hier.</Empty></Card> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {files.map((f) => (
            <div key={f.id} className="card overflow-hidden">
              <a href={`/api/bestand/${f.id}`} target="_blank" className="block aspect-video bg-black/5">
                {f.mimeType.startsWith("image/") ? <img src={`/api/bestand/${f.id}`} alt="" className="w-full h-full object-cover" /> : f.mimeType.startsWith("video/") ? <video src={`/api/bestand/${f.id}`} className="w-full h-full object-cover" controls preload="metadata" /> : <div className="w-full h-full flex items-center justify-center text-4xl">📄</div>}
              </a>
              <div className="p-3 text-sm space-y-2">
                <div className="font-medium">{f.title || f.fileName}</div>
                <div className="text-xs muted">{fmtDate(f.takenAt ?? f.createdAt)} · {f.source === "WHATSAPP" ? "WhatsApp" : f.source === "DELEN" ? "Gedeeld" : "Upload"}{f.notes ? ` · ${f.notes}` : ""}</div>
                <form action={assignInboxFile} className="flex gap-2">
                  <input type="hidden" name="id" value={f.id} />
                  <select name="horseId" className="select" required><option value="">Kies paard…</option>{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
                  <select name="kind" className="select w-32" defaultValue={f.kind}><option value="FOTO">Foto</option><option value="VIDEO">Video</option><option value="ROENTGEN">Röntgen</option><option value="DOCUMENT">Document</option></select>
                  <button className="btn btn-primary btn-sm">Koppel</button>
                </form>
                <ConfirmForm action={deleteInboxFile} confirm="Bestand verwijderen?"><input type="hidden" name="id" value={f.id} /><button className="btn btn-sm btn-danger">Verwijderen</button></ConfirmForm>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
