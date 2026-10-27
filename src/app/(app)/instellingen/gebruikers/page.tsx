import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { Card, Field, Badge } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";
import { saveUser, deleteUser } from "../actions";

export default async function UsersSettings({ searchParams }: { searchParams: Promise<{ bewerk?: string }> }) {
  const me = await requireSession("EIGENAAR");
  const { bewerk } = await searchParams;
  const users = await db.user.findMany({ orderBy: { name: "asc" } });
  const u = users.find((x) => x.id === bewerk);
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card title={u ? "Medewerker bewerken" : "Medewerker toevoegen"}>
        <form action={saveUser} className="space-y-3">
          {u && <input type="hidden" name="id" value={u.id} />}
          <Field label="Naam"><input name="name" className="input" required defaultValue={u?.name ?? ""} /></Field>
          <Field label="E-mail (inlognaam)"><input name="email" type="email" className="input" required defaultValue={u?.email ?? ""} /></Field>
          <Field label="Telefoon"><input name="phone" className="input" defaultValue={u?.phone ?? ""} /></Field>
          <Field label="Rol"><select name="role" className="select" defaultValue={u?.role ?? "MEDEWERKER"}><option value="MEDEWERKER">Medewerker (planning, paarden, gezondheid)</option><option value="EIGENAAR">Eigenaar (alles, incl. facturen en instellingen)</option></select></Field>
          <Field label={u ? "Nieuw wachtwoord (leeg = ongewijzigd)" : "Wachtwoord"}><input name="password" type="text" className="input" placeholder={u ? "" : "welkom123"} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={u?.active ?? true} /> Actief (kan inloggen)</label>
          <div className="flex gap-2"><button className="btn btn-primary">Opslaan</button>{u && <Link href="/instellingen/gebruikers" className="btn">Annuleren</Link>}</div>
        </form>
      </Card>
      <Card title="Medewerkers" className="md:col-span-2">
        <table className="tbl"><thead><tr><th>Naam</th><th>E-mail</th><th>Rol</th><th>Status</th><th></th></tr></thead>
          <tbody>{users.map((x) => <tr key={x.id}><td className="font-medium">{x.name}</td><td>{x.email}</td><td>{x.role === "EIGENAAR" ? "Eigenaar" : "Medewerker"}</td><td><Badge tone={x.active ? "ok" : undefined}>{x.active ? "Actief" : "Inactief"}</Badge></td>
            <td className="whitespace-nowrap"><Link href={`/instellingen/gebruikers?bewerk=${x.id}`} className="btn btn-sm">✎</Link> {x.id !== me.id && <ConfirmForm action={deleteUser} confirm={`${x.name} verwijderen? Taken blijven bestaan zonder toewijzing.`} className="inline"><input type="hidden" name="id" value={x.id} /><button className="btn btn-sm btn-danger">✕</button></ConfirmForm>}</td></tr>)}</tbody>
        </table>
      </Card>
    </div>
  );
}
