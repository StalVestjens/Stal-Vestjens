import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Empty, Badge, Field } from "@/components/ui";
import { fmtDate, fmtMoney, INVOICE_LABELS, todayDate, localDateStr } from "@/lib/format";
import { invoiceTotals } from "@/lib/invoice";
import { bulkRemind, generateMonthly } from "./actions";
import type { InvoiceStatus } from "@prisma/client";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; herinnerd?: string; aangemaakt?: string; fout?: string }> }) {
  await requireSession("EIGENAAR");
  const sp = await searchParams;
  const status = sp.status && sp.status in INVOICE_LABELS ? (sp.status as InvoiceStatus) : undefined;
  const [invoices, products] = await Promise.all([
    db.invoice.findMany({ where: status ? { status } : {}, include: { customer: true, lines: true }, orderBy: { number: "desc" }, take: 300 }),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const today = todayDate();
  const open = invoices.filter((i) => ["VERZONDEN", "HERINNERD"].includes(i.status));
  const openTotal = open.reduce((s, i) => s + invoiceTotals(i.lines).total, 0);
  const overdue = open.filter((i) => i.dueDate < today).length;
  const month = localDateStr().slice(0, 7);

  return (
    <>
      <PageHeader title="Facturen" subtitle={`${fmtMoney(openTotal)} openstaand · ${overdue} vervallen`} actions={<Link href="/facturen/nieuw" className="btn btn-primary">+ Nieuwe factuur</Link>} />
      {sp.herinnerd && <p className="card p-3 mb-4 text-sm">{sp.herinnerd} facturen gemarkeerd als herinnerd.</p>}
      {sp.aangemaakt && <p className="card p-3 mb-4 text-sm">{sp.aangemaakt} conceptfacturen aangemaakt. Controleer en verzend ze.</p>}
      {sp.fout === "maand" && <p className="card p-3 mb-4 text-sm text-[var(--danger)]">Kies een geldige maand (jaar-maand).</p>}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card title="Maandfacturen aanmaken">
          <form action={generateMonthly} className="flex gap-2 items-end flex-wrap">
            <Field label="Dienst"><select name="productId" className="select">{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({fmtMoney(p.unitPrice)})</option>)}</select></Field>
            <Field label="Maand"><input type="month" name="month" className="input" defaultValue={month} required pattern="\d{4}-\d{2}" /></Field>
            <button className="btn">Concepten aanmaken</button>
          </form>
          <p className="text-xs muted mt-2">Maakt per klant één concept met één regel per aanwezig paard.</p>
        </Card>
        <Card title="Herinneringen">
          <form action={bulkRemind}><button className="btn" disabled={overdue === 0}>Alle vervallen facturen ({overdue}) markeren als herinnerd</button></form>
          <p className="text-xs muted mt-2">Open daarna elke factuur en gebruik "Mail klant" om de herinnering te versturen.</p>
        </Card>
      </div>

      <form className="flex gap-2 mb-3">
        <select name="status" className="select max-w-xs" defaultValue={status ?? ""}><option value="">Alle statussen</option>{Object.entries(INVOICE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn">Filter</button>
      </form>
      <Card>
        {invoices.length === 0 ? <Empty>Nog geen facturen.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Nummer</th><th>Klant</th><th>Datum</th><th>Vervalt</th><th className="text-right">Totaal</th><th>Status</th></tr></thead>
            <tbody>{invoices.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/facturen/${i.id}`} className="font-medium">{i.number}</Link></td>
                <td>{i.customer.name}</td><td>{fmtDate(i.date)}</td>
                <td className={["VERZONDEN", "HERINNERD"].includes(i.status) && i.dueDate < today ? "text-[var(--danger)] font-semibold" : ""}>{fmtDate(i.dueDate)}</td>
                <td className="text-right">{fmtMoney(invoiceTotals(i.lines).total)}</td>
                <td><Badge tone={i.status === "BETAALD" ? "ok" : ["HERINNERD", "VERVALLEN"].includes(i.status) ? "danger" : i.status === "CONCEPT" ? undefined : "warn"}>{INVOICE_LABELS[i.status]}</Badge></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
