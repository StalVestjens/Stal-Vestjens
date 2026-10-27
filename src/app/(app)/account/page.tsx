import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Field } from "@/components/ui";
import { changeOwnPassword, updateOwnProfile } from "./actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; fout?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Mijn account" subtitle={session.email} />
      {sp.ok === "wachtwoord" && <p className="card p-3 mb-4 text-sm">Je wachtwoord is gewijzigd. Gebruik voortaan het nieuwe wachtwoord.</p>}
      {sp.ok === "profiel" && <p className="card p-3 mb-4 text-sm">Je gegevens zijn opgeslagen.</p>}
      {sp.fout === "huidig" && <p className="card p-3 mb-4 text-sm text-[var(--danger)]">Het huidige wachtwoord klopt niet.</p>}
      {sp.fout === "herhaal" && <p className="card p-3 mb-4 text-sm text-[var(--danger)]">De twee nieuwe wachtwoorden zijn niet gelijk.</p>}
      {sp.fout === "kort" && <p className="card p-3 mb-4 text-sm text-[var(--danger)]">Kies een wachtwoord van minimaal 8 tekens.</p>}
      {sp.fout === "email" && <p className="card p-3 mb-4 text-sm text-[var(--danger)]">Dat e-mailadres is al in gebruik.</p>}

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Wachtwoord wijzigen">
          <form action={changeOwnPassword} className="space-y-3">
            <Field label="Huidig wachtwoord"><input name="current" type="password" className="input" required autoComplete="current-password" /></Field>
            <Field label="Nieuw wachtwoord (minimaal 8 tekens)"><input name="next" type="password" className="input" required minLength={8} autoComplete="new-password" /></Field>
            <Field label="Nieuw wachtwoord nogmaals"><input name="repeat" type="password" className="input" required minLength={8} autoComplete="new-password" /></Field>
            <button className="btn btn-primary">Wachtwoord opslaan</button>
          </form>
        </Card>
        <Card title="Mijn gegevens">
          <form action={updateOwnProfile} className="space-y-3">
            <Field label="Naam"><input name="name" className="input" required defaultValue={session.name} /></Field>
            <Field label="E-mail (inlognaam)"><input name="email" type="email" className="input" required defaultValue={session.email} /></Field>
            <button className="btn">Opslaan</button>
          </form>
          <p className="text-xs muted mt-3">Wachtwoord helemaal kwijt? De eigenaar kan het herstellen via Instellingen › Medewerkers, of (voor de eigenaar zelf) via de instelling SEED_OWNER_PASSWORD bij de hosting met SEED_OWNER_RESET=1.</p>
        </Card>
      </div>
    </>
  );
}
