import { Card, Field } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { saveCompany } from "./actions";

export default async function CompanySettings() {
  await requireSession("EIGENAAR");
  const s = await getSettings(["bedrijfsnaam", "adres", "kvk", "btw", "iban", "factuur_prefix", "betaaltermijn_dagen", "factuur_voettekst"]);
  return (
    <Card title="Bedrijfsgegevens (op facturen)">
      <form action={saveCompany} className="grid md:grid-cols-2 gap-3">
        <Field label="Bedrijfsnaam"><input name="bedrijfsnaam" className="input" defaultValue={s.bedrijfsnaam} /></Field>
        <Field label="IBAN"><input name="iban" className="input" defaultValue={s.iban} /></Field>
        <Field label="Adres (meerdere regels)" className="md:col-span-2"><textarea name="adres" className="textarea" rows={3} defaultValue={s.adres} /></Field>
        <Field label="KvK-nummer"><input name="kvk" className="input" defaultValue={s.kvk} /></Field>
        <Field label="BTW-nummer"><input name="btw" className="input" defaultValue={s.btw} /></Field>
        <Field label="Factuurnummer-voorvoegsel"><input name="factuur_prefix" className="input" defaultValue={s.factuur_prefix} placeholder="2026" /></Field>
        <Field label="Betaaltermijn (dagen)"><input name="betaaltermijn_dagen" type="number" className="input" defaultValue={s.betaaltermijn_dagen || "14"} /></Field>
        <Field label="Voettekst op factuur" className="md:col-span-2"><input name="factuur_voettekst" className="input" defaultValue={s.factuur_voettekst} placeholder="Op al onze diensten zijn onze algemene voorwaarden van toepassing." /></Field>
        <div className="md:col-span-2"><button className="btn btn-primary">Opslaan</button></div>
      </form>
    </Card>
  );
}
