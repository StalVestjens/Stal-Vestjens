import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Empty, Badge } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";
import { CustomFieldsView, extraOf } from "@/components/CustomFields";
import { fmtDate, fmtMoney, INVOICE_LABELS } from "@/lib/format";
import { invoiceTotals } from "@/lib/invoice";
import { deleteCustomer } from "../actions";

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fout?: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const { fout } = await searchParams;
  const c = await db.customer.findUnique({ where: { id }, include: { horses: { orderBy: { name: "asc" } }, invoices: { include: { lines: true }, orderBy: { date: "desc" } }, transports: { orderBy: { date: "desc" }, take: 10 } } });
  if (!c) notFound();
  const fields = await db.customField.findMany({ where: { entity: "CUSTOMER" }, orderBy: { sort: "asc" } });
  const openAmount = c.invoices.filter((i) => ["VERZONDEN", "HERINNERD"].includes(i.status)).reduce((s, i) => s + invoiceTotals(i.lines).total, 0);

  return (
    <>
      <PageHeader title={c.name} subtitle={[c.company, c.city].filter(Boolean).join(" · ")} actions={<>
        {session.role === "EIGENAAR" && <Link href={`/facturen/nieuw?klant=${id}`} className="btn btn-primary">+ Factuur</Link>}
        <Link href={`/klanten/${id}/bewerken`} className="btn">Bewerken</Link>
        {session.role === "EIGENAAR" && <ConfirmForm action={deleteCustomer} confirm="Klant verwijderen?"><input type="hidden" name="id" value={id} /><button className="btn btn-danger">Verwijderen</button></ConfirmForm>}
      </>} />
      {fout === "facturen" && <p className="card p-3 mb-4 text-sm text-[var(--danger)]">Deze klant heeft facturen en kan daarom niet verwijderd worden.</p>}

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Gegevens">
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="muted">E-mail</dt><dd>{c.email ? <a href={`mailto:${c.email}`} className="underline">{c.email}</a> : "–"}</dd>
            <dt className="muted">Telefoon</dt><dd>{c.phone ? <a href={`tel:${c.phone}`} className="underline">{c.phone}</a> : "–"}</dd>
            <dt className="muted">Adres</dt><dd>{[c.address, `${c.postalCode ?? ""} ${c.city ?? ""}`.trim(), c.country].filter(Boolean).join(", ") || "–"}</dd>
            <dt className="muted">BTW</dt><dd>{c.vatNumber ?? "–"}</dd>
          </dl>
          <div className="mt-3"><CustomFieldsView fields={fields} values={extraOf(c.extra)} /></div>
          {c.notes && <p className="text-sm mt-3 whitespace-pre-wrap">{c.notes}</p>}
          {openAmount > 0 && <p className="mt-3 text-sm">Openstaand: <strong>{fmtMoney(openAmount)}</strong></p>}
        </Card>
        <Card title={`Paarden (${c.horses.length})`}>
          {c.horses.length === 0 ? <Empty>Geen paarden gekoppeld.</Empty> : <ul className="text-sm space-y-1">{c.horses.map((h) => <li key={h.id}><Link href={`/paarden/${h.id}`} className="font-medium">{h.name}</Link> <span className="muted">{h.stall ? `· ${h.stall}` : ""}</span></li>)}</ul>}
        </Card>
        <Card title="Transporten">
          {c.transports.length === 0 ? <Empty>Geen transporten.</Empty> : <ul className="text-sm space-y-1">{c.transports.map((t) => <li key={t.id}>{fmtDate(t.date)} · {t.fromAddress} → {t.toAddress} {t.price != null && <span className="muted">{fmtMoney(t.price)}</span>}</li>)}</ul>}
        </Card>
        {session.role === "EIGENAAR" && (
          <Card title="Facturen" className="md:col-span-3">
            {c.invoices.length === 0 ? <Empty>Nog geen facturen.</Empty> : (
              <table className="tbl"><thead><tr><th>Nummer</th><th>Datum</th><th>Vervalt</th><th>Bedrag</th><th>Status</th></tr></thead>
                <tbody>{c.invoices.map((i) => <tr key={i.id}><td><Link href={`/facturen/${i.id}`} className="font-medium">{i.number}</Link></td><td>{fmtDate(i.date)}</td><td>{fmtDate(i.dueDate)}</td><td>{fmtMoney(invoiceTotals(i.lines).total)}</td><td><Badge tone={i.status === "BETAALD" ? "ok" : i.status === "HERINNERD" || i.status === "VERVALLEN" ? "danger" : undefined}>{INVOICE_LABELS[i.status]}</Badge></td></tr>)}</tbody>
              </table>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
