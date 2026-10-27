import type { Customer, CustomField, Horse } from "@prisma/client";
import { Field } from "./ui";
import { CustomFieldsForm, extraOf } from "./CustomFields";
import Link from "next/link";

const d = (x?: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : "");

export function HorseForm({ horse, customers, fields, action }: { horse?: Horse; customers: Customer[]; fields: CustomField[]; action: (fd: FormData) => Promise<void> }) {
  const h = horse;
  return (
    <form action={action} className="space-y-6">
      <section className="card p-4">
        <h2 className="font-semibold mb-3">Identiteit</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Naam *"><input name="name" className="input" required defaultValue={h?.name} /></Field>
          <Field label="Roepnaam"><input name="nickname" className="input" defaultValue={h?.nickname ?? ""} /></Field>
          <Field label="Status">
            <select name="status" className="select" defaultValue={h?.status ?? "AANWEZIG"}>
              <option value="AANWEZIG">Aanwezig</option><option value="AFWEZIG">Afwezig</option><option value="VERKOCHT">Verkocht</option><option value="OVERLEDEN">Overleden</option>
            </select>
          </Field>
          <Field label="UELN (levensnummer)"><input name="ueln" className="input" defaultValue={h?.ueln ?? ""} placeholder="528003..." /></Field>
          <Field label="Chipnummer"><input name="chipNumber" className="input" defaultValue={h?.chipNumber ?? ""} /></Field>
          <Field label="Stamboek"><input name="studbook" className="input" defaultValue={h?.studbook ?? ""} placeholder="KWPN, BWP, ..." /></Field>
          <Field label="FEI-nummer"><input name="fei" className="input" defaultValue={h?.fei ?? ""} /></Field>
          <Field label="KNHS-nummer"><input name="knhsNumber" className="input" defaultValue={h?.knhsNumber ?? ""} /></Field>
          <Field label="Geslacht">
            <select name="sex" className="select" defaultValue={h?.sex ?? ""}>
              <option value="">–</option><option value="HENGST">Hengst</option><option value="MERRIE">Merrie</option><option value="RUIN">Ruin</option>
            </select>
          </Field>
          <Field label="Geboortedatum"><input name="birthDate" type="date" className="input" defaultValue={d(h?.birthDate)} /></Field>
          <Field label="Kleur"><input name="color" className="input" defaultValue={h?.color ?? ""} /></Field>
          <Field label="Stokmaat (cm)"><input name="heightCm" type="number" className="input" defaultValue={h?.heightCm ?? ""} /></Field>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Afstamming</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="Vader"><input name="sire" className="input" defaultValue={h?.sire ?? ""} /></Field>
          <Field label="Moeder"><input name="dam" className="input" defaultValue={h?.dam ?? ""} /></Field>
          <Field label="Moedersvader"><input name="damSire" className="input" defaultValue={h?.damSire ?? ""} /></Field>
          <Field label="Fokker"><input name="breeder" className="input" defaultValue={h?.breeder ?? ""} /></Field>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Stal & sport</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Eigenaar / klant">
            <select name="ownerId" className="select" defaultValue={h?.ownerId ?? ""}>
              <option value="">Eigen paard</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Stal / box"><input name="stall" className="input" defaultValue={h?.stall ?? ""} /></Field>
          <Field label="Ruiter"><input name="rider" className="input" defaultValue={h?.rider ?? ""} /></Field>
          <Field label="Discipline"><input name="discipline" className="input" defaultValue={h?.discipline ?? ""} placeholder="Springen, Dressuur, ..." /></Field>
          <Field label="Niveau / klasse"><input name="level" className="input" defaultValue={h?.level ?? ""} placeholder="Z, 1.30m, ..." /></Field>
        </div>
        <Field label="Notities" className="mt-3"><textarea name="notes" className="textarea" rows={3} defaultValue={h?.notes ?? ""} /></Field>
      </section>

      {fields.length > 0 && (
        <section className="card p-4">
          <h2 className="font-semibold mb-3">Eigen velden</h2>
          <div className="grid md:grid-cols-3 gap-3"><CustomFieldsForm fields={fields} values={extraOf(h?.extra)} /></div>
        </section>
      )}
      <p className="text-xs muted">Meer velden nodig? Voeg ze toe bij <Link href="/instellingen/velden" className="underline">Instellingen › Eigen velden</Link>.</p>

      <div className="flex gap-2">
        <button className="btn btn-primary" type="submit">Opslaan</button>
        <Link href={h ? `/paarden/${h.id}` : "/paarden"} className="btn">Annuleren</Link>
      </div>
    </form>
  );
}
