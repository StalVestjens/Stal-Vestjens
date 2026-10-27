import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { Card, Field, Empty } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";
import { saveField, deleteField } from "../actions";

const ENT: Record<string, string> = { HORSE: "Paard", CUSTOMER: "Klant", VEHICLE: "Voertuig" };
const TYPES: Record<string, string> = { TEKST: "Tekst", GETAL: "Getal", DATUM: "Datum", KEUZE: "Keuzelijst", JANEE: "Ja/nee" };

export default async function FieldsSettings() {
  await requireSession("EIGENAAR");
  const fields = await db.customField.findMany({ orderBy: [{ entity: "asc" }, { sort: "asc" }] });
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card title="Eigen veld toevoegen">
        <p className="text-xs muted mb-3">Maatwerk zonder programmeren: voeg velden toe die op het formulier en de detailpagina verschijnen. Bijvoorbeeld "Zadelmaat", "Verzekeraar", "Voerschema" of "Hoefijzermaat".</p>
        <form action={saveField} className="space-y-3">
          <Field label="Voor"><select name="entity" className="select">{Object.entries(ENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Label"><input name="label" className="input" required placeholder="Zadelmaat" /></Field>
          <Field label="Type"><select name="type" className="select">{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Opties (bij keuzelijst, één per regel)"><textarea name="options" className="textarea" rows={3} /></Field>
          <Field label="Volgorde"><input name="sort" type="number" className="input" defaultValue={0} /></Field>
          <button className="btn btn-primary w-full justify-center">Toevoegen</button>
        </form>
      </Card>
      <Card title="Eigen velden" className="md:col-span-2">
        {fields.length === 0 ? <Empty>Nog geen eigen velden.</Empty> : (
          <table className="tbl"><thead><tr><th>Voor</th><th>Label</th><th>Type</th><th>Opties</th><th>Sleutel</th><th></th></tr></thead>
            <tbody>{fields.map((f) => <tr key={f.id}><td>{ENT[f.entity]}</td><td className="font-medium">{f.label}</td><td>{TYPES[f.type]}</td><td className="text-xs muted">{f.options.join(", ")}</td><td className="text-xs muted font-mono">{f.key}</td>
              <td><ConfirmForm action={deleteField} confirm="Veld verwijderen? Al ingevulde waarden blijven in de database maar worden niet meer getoond."><input type="hidden" name="id" value={f.id} /><button className="btn btn-sm btn-danger">✕</button></ConfirmForm></td></tr>)}</tbody>
          </table>
        )}
        <p className="text-xs muted mt-3">Een bestaand veld aanpassen: voeg het opnieuw toe met hetzelfde label (de sleutel blijft gelijk), dan worden type en opties overschreven.</p>
      </Card>
    </div>
  );
}
