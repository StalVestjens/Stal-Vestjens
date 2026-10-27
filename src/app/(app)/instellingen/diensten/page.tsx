import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { Card, Field, Badge } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";
import { fmtMoney } from "@/lib/format";
import { saveProduct, deleteProduct } from "../actions";

export default async function ProductsSettings({ searchParams }: { searchParams: Promise<{ bewerk?: string }> }) {
  await requireSession("EIGENAAR");
  const { bewerk } = await searchParams;
  const products = await db.product.findMany({ orderBy: { name: "asc" } });
  const p = products.find((x) => x.id === bewerk);
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card title={p ? "Dienst bewerken" : "Dienst toevoegen"}>
        <form action={saveProduct} className="space-y-3">
          {p && <input type="hidden" name="id" value={p.id} />}
          <Field label="Naam"><input name="name" className="input" required defaultValue={p?.name ?? ""} /></Field>
          <Field label="Prijs excl. btw (€)"><input name="unitPrice" type="number" step="0.01" className="input" required defaultValue={p ? String(p.unitPrice) : ""} /></Field>
          <Field label="BTW %"><select name="vatRate" className="select" defaultValue={p ? String(Number(p.vatRate)) : "21"}><option>21</option><option>9</option><option>0</option></select></Field>
          <Field label="Eenheid"><input name="unit" className="input" defaultValue={p?.unit ?? ""} placeholder="maand, les, km, dag" /></Field>
          <Field label="Status"><select name="active" className="select" defaultValue={p && !p.active ? "off" : "on"}><option value="on">Actief</option><option value="off">Inactief</option></select></Field>
          <div className="flex gap-2"><button className="btn btn-primary">Opslaan</button>{p && <Link href="/instellingen/diensten" className="btn">Annuleren</Link>}</div>
        </form>
      </Card>
      <Card title="Diensten & tarieven" className="md:col-span-2">
        <table className="tbl"><thead><tr><th>Naam</th><th className="text-right">Prijs</th><th>BTW</th><th>Eenheid</th><th></th><th></th></tr></thead>
          <tbody>{products.map((x) => <tr key={x.id}><td className="font-medium">{x.name}</td><td className="text-right">{fmtMoney(x.unitPrice)}</td><td>{String(Number(x.vatRate))}%</td><td>{x.unit ?? ""}</td><td>{!x.active && <Badge>inactief</Badge>}</td>
            <td className="whitespace-nowrap"><Link href={`/instellingen/diensten?bewerk=${x.id}`} className="btn btn-sm">✎</Link> <ConfirmForm action={deleteProduct} confirm="Dienst verwijderen?" className="inline"><input type="hidden" name="id" value={x.id} /><button className="btn btn-sm btn-danger">✕</button></ConfirmForm></td></tr>)}</tbody>
        </table>
      </Card>
    </div>
  );
}
