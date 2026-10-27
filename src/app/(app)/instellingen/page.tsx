import { Card, Field } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getBranding, BRAND_DEFAULTS } from "@/lib/branding";
import { saveCompany, saveBranding, removeLogo } from "./actions";

export default async function CompanySettings({ searchParams }: { searchParams: Promise<{ ok?: string; fout?: string }> }) {
  await requireSession("EIGENAAR");
  const sp = await searchParams;
  const [s, b] = await Promise.all([
    getSettings(["bedrijfsnaam", "adres", "kvk", "btw", "iban", "factuur_prefix", "betaaltermijn_dagen", "factuur_voettekst", "kleur_accent", "kleur_zijbalk", "logo_key"]),
    getBranding(),
  ]);
  return (
    <div className="space-y-4">
      {sp.ok && <p className="card p-3 text-sm">Opgeslagen.</p>}
      {sp.fout === "logo" && <p className="card p-3 text-sm text-[var(--danger)]">Het logo moet een afbeelding zijn (PNG, JPG of SVG) van maximaal 5 MB.</p>}

      <Card title="Huisstijl">
        <form action={saveBranding} className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
          <div className="flex flex-col items-center gap-2">
            <img src={b.logoUrl} alt={b.naam} className="w-32 h-32 rounded-2xl object-cover shadow" />
            <span className="text-xs muted">{s.logo_key ? "Geüpload logo" : "Standaardlogo"}</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Bedrijfsnaam (in menu, inlogscherm en app-icoon)"><input name="bedrijfsnaam" className="input" defaultValue={s.bedrijfsnaam || BRAND_DEFAULTS.naam} /></Field>
            <Field label="Nieuw logo uploaden (PNG, JPG of SVG)"><input name="logo" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="input" /></Field>
            <Field label="Hoofdkleur (knoppen)"><input name="kleur_accent" type="color" className="input h-10" defaultValue={b.accent} /></Field>
            <Field label="Kleur zijbalk (menu)"><input name="kleur_zijbalk" type="color" className="input h-10" defaultValue={b.zijbalk} /></Field>
            <div className="md:col-span-2 flex gap-2 flex-wrap">
              <button className="btn btn-primary">Huisstijl opslaan</button>
              {s.logo_key && <button className="btn" formAction={removeLogo}>Terug naar standaardlogo</button>}
            </div>
            <p className="md:col-span-2 text-xs muted">Het app-icoon op de telefoon komt van het standaardlogo; wil je een ander icoon, zeg het dan, dan maak ik nieuwe icoonbestanden.</p>
          </div>
        </form>
      </Card>

      <Card title="Bedrijfsgegevens (op facturen)">
        <form action={saveCompany} className="grid md:grid-cols-2 gap-3">
          <Field label="IBAN"><input name="iban" className="input" defaultValue={s.iban} /></Field>
          <Field label="Betaaltermijn (dagen)"><input name="betaaltermijn_dagen" type="number" className="input" defaultValue={s.betaaltermijn_dagen || "14"} /></Field>
          <Field label="Adres (meerdere regels)" className="md:col-span-2"><textarea name="adres" className="textarea" rows={3} defaultValue={s.adres} /></Field>
          <Field label="KvK-nummer"><input name="kvk" className="input" defaultValue={s.kvk} /></Field>
          <Field label="BTW-nummer"><input name="btw" className="input" defaultValue={s.btw} /></Field>
          <Field label="Factuurnummer-voorvoegsel"><input name="factuur_prefix" className="input" defaultValue={s.factuur_prefix} placeholder="2026" /></Field>
          <Field label="Voettekst op factuur"><input name="factuur_voettekst" className="input" defaultValue={s.factuur_voettekst} placeholder="Op al onze diensten zijn onze algemene voorwaarden van toepassing." /></Field>
          <div className="md:col-span-2"><button className="btn btn-primary">Opslaan</button></div>
        </form>
      </Card>
    </div>
  );
}
