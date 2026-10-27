import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Empty } from "@/components/ui";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSession();
  const { q } = await searchParams;
  const customers = await db.customer.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] } : {},
    include: { _count: { select: { horses: true, invoices: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader title="Klanten" subtitle={`${customers.length} klanten / eigenaren`} actions={<Link href="/klanten/nieuw" className="btn btn-primary">+ Nieuwe klant</Link>} />
      <form className="flex gap-2 mb-4"><input name="q" defaultValue={q} className="input max-w-sm" placeholder="Zoek op naam, bedrijf of plaats" /><button className="btn">Zoeken</button></form>
      <Card>
        {customers.length === 0 ? <Empty>Nog geen klanten.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Naam</th><th>Bedrijf</th><th>Plaats</th><th>E-mail</th><th>Telefoon</th><th>Paarden</th><th>Facturen</th></tr></thead>
            <tbody>{customers.map((c) => <tr key={c.id}><td><Link href={`/klanten/${c.id}`} className="font-medium">{c.name}</Link></td><td>{c.company ?? ""}</td><td>{c.city ?? ""}</td><td>{c.email ?? ""}</td><td>{c.phone ?? ""}</td><td>{c._count.horses}</td><td>{c._count.invoices}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
