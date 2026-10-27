import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Badge } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";
import { fmtDate, fmtMoney, INVOICE_LABELS } from "@/lib/format";
import { invoiceTotals } from "@/lib/invoice";
import { getSettings } from "@/lib/settings";
import { getBranding } from "@/lib/branding";
import { setInvoiceStatus, deleteInvoice, createCreditNote } from "../actions";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession("EIGENAAR");
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { customer: true, lines: { orderBy: { sort: "asc" } }, creditOf: true, credits: true } });
  if (!inv) notFound();
  const [s, b] = await Promise.all([getSettings(["bedrijfsnaam", "bedrijfsnaam_juridisch", "adres", "email", "kvk", "btw", "iban", "factuur_voettekst"]), getBranding()]);
  const t = invoiceTotals(inv.lines);
  const isCredit = inv.status === "CREDIT";
  const subject = encodeURIComponent(`${isCredit ? "Creditnota" : inv.status === "HERINNERD" ? "Herinnering factuur" : "Factuur"} ${inv.number} – ${b.naam}`);
  const body = encodeURIComponent(`Beste ${inv.customer.name},\n\n${inv.status === "HERINNERD" ? `Volgens onze administratie is factuur ${inv.number} van ${fmtDate(inv.date)} (${fmtMoney(t.total)}) nog niet voldaan. De vervaldatum was ${fmtDate(inv.dueDate)}. Wilt u het bedrag alsnog overmaken?` : `Hierbij ${isCredit ? "de creditnota" : "de factuur"} ${inv.number} van ${fmtMoney(t.total)}${isCredit ? "" : `, te voldoen voor ${fmtDate(inv.dueDate)}`}.`}\n\nIBAN: ${s.iban}\nOnder vermelding van: ${inv.number}\n\nMet vriendelijke groet,\n${s.bedrijfsnaam_juridisch || b.naam}`);

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={`${isCredit ? "Creditnota" : "Factuur"} ${inv.number}`} subtitle={inv.customer.name}
          actions={<>
            <Badge tone={inv.status === "BETAALD" ? "ok" : ["HERINNERD", "VERVALLEN"].includes(inv.status) ? "danger" : undefined}>{INVOICE_LABELS[inv.status]}</Badge>
            <a className="btn" href={`/print/factuur/${id}`} target="_blank">🖨 PDF / afdrukken</a>
            {inv.customer.email && <a className="btn" href={`mailto:${inv.customer.email}?subject=${subject}&body=${body}`}>✉ Mail klant</a>}
            {inv.status === "CONCEPT" && <><Link className="btn" href={`/facturen/${id}/bewerken`}>Bewerken</Link>
              <form action={setInvoiceStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="VERZONDEN" /><button className="btn btn-primary">Markeer verzonden</button></form>
              <ConfirmForm action={deleteInvoice} confirm="Concept verwijderen?"><input type="hidden" name="id" value={id} /><button className="btn btn-danger">Verwijderen</button></ConfirmForm></>}
            {["VERZONDEN", "HERINNERD"].includes(inv.status) && <>
              <form action={setInvoiceStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="BETAALD" /><button className="btn btn-primary">Betaald ✓</button></form>
              {inv.status === "VERZONDEN" && <form action={setInvoiceStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="HERINNERD" /><button className="btn">Herinnerd</button></form>}
            </>}
            {!isCredit && inv.status !== "CONCEPT" && inv.status !== "GECREDITEERD" && inv.credits.length === 0 && <ConfirmForm action={createCreditNote} confirm="Creditnota aanmaken voor deze factuur? De factuur geldt daarna als gecrediteerd."><input type="hidden" name="id" value={id} /><button className="btn">Creditnota</button></ConfirmForm>}
          </>} />
        {inv.creditOf && <p className="text-sm mb-3">Creditnota voor <Link href={`/facturen/${inv.creditOf.id}`} className="underline">{inv.creditOf.number}</Link></p>}
        {inv.credits.length > 0 && <p className="text-sm mb-3">Gecrediteerd door {inv.credits.map((c) => <Link key={c.id} href={`/facturen/${c.id}`} className="underline mr-1">{c.number}</Link>)}</p>}
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div className="flex items-start gap-4"><img src={b.logoUrl} alt="" className="logo-print" /><div><div className="font-bold text-lg">{s.bedrijfsnaam_juridisch || b.naam}</div><div className="whitespace-pre-line muted">{s.adres}</div>{s.email && <div className="muted">{s.email}</div>}<div className="muted">KvK {s.kvk} · BTW {s.btw}</div></div></div>
          <div className="text-right"><div className="font-bold">{inv.customer.company ?? inv.customer.name}</div>{inv.customer.company && <div>{inv.customer.name}</div>}<div className="muted">{inv.customer.address}<br />{inv.customer.postalCode} {inv.customer.city}</div>{inv.customer.vatNumber && <div className="muted">BTW {inv.customer.vatNumber}</div>}</div>
        </div>
        <div className="flex gap-8 text-sm mb-4"><div><span className="muted">Nummer</span><br /><strong>{inv.number}</strong></div><div><span className="muted">Datum</span><br />{fmtDate(inv.date)}</div>{!isCredit && <div><span className="muted">Vervaldatum</span><br />{fmtDate(inv.dueDate)}</div>}</div>
        <table className="tbl">
          <thead><tr><th>Omschrijving</th><th>Paard</th><th className="text-right">Aantal</th><th className="text-right">Prijs</th><th className="text-right">BTW</th><th className="text-right">Bedrag</th></tr></thead>
          <tbody>{inv.lines.map((l) => <tr key={l.id}><td>{l.description}</td><td>{l.horseName ?? ""}</td><td className="text-right">{String(Number(l.quantity))}</td><td className="text-right">{fmtMoney(l.unitPrice)}</td><td className="text-right">{String(Number(l.vatRate))}%</td><td className="text-right">{fmtMoney(Number(l.quantity) * Number(l.unitPrice))}</td></tr>)}</tbody>
        </table>
        <div className="flex justify-end mt-4 text-sm"><div className="text-right space-y-1">
          <div>Netto <span className="inline-block w-32">{fmtMoney(t.net)}</span></div>
          {Object.entries(t.vat).map(([r, v]) => <div key={r}>BTW {r}% <span className="inline-block w-32">{fmtMoney(v)}</span></div>)}
          <div className="text-lg font-bold">Totaal <span className="inline-block w-32">{fmtMoney(t.total)}</span></div>
        </div></div>
        {inv.notes && <p className="text-sm mt-4">{inv.notes}</p>}
        <p className="text-xs muted mt-6">{isCredit ? "Dit bedrag wordt verrekend of teruggestort." : `Gelieve te betalen voor ${fmtDate(inv.dueDate)} op ${s.iban} o.v.v. ${inv.number}.`} {s.factuur_voettekst}</p>
      </Card>
    </>
  );
}
