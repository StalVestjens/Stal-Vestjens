import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fmtDate, fmtMoney } from "@/lib/format";
import { invoiceTotals } from "@/lib/invoice";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";

/** Kale afdrukweergave: via "Opslaan als PDF" in de browser ontstaat de PDF-factuur. */
export default async function InvoicePrint({ params }: { params: Promise<{ id: string }> }) {
  await requireSession("EIGENAAR");
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { customer: true, lines: { orderBy: { sort: "asc" } } } });
  if (!inv) notFound();
  const s = await getSettings(["bedrijfsnaam", "adres", "kvk", "btw", "iban", "factuur_voettekst"]);
  const t = invoiceTotals(inv.lines);
  const isCredit = inv.status === "CREDIT";
  return (
    <div className="bg-white text-black p-10 max-w-3xl mx-auto text-sm" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      <PrintButton />
      <div className="flex justify-between mb-10">
        <div><div className="text-2xl font-bold">{s.bedrijfsnaam}</div><div className="whitespace-pre-line text-gray-600">{s.adres}</div><div className="text-gray-600">KvK {s.kvk} · BTW {s.btw}</div></div>
        <div className="text-right"><div className="text-3xl font-bold">{isCredit ? "CREDITNOTA" : "FACTUUR"}</div><div className="mt-2">Nummer <strong>{inv.number}</strong></div><div>Datum {fmtDate(inv.date)}</div>{!isCredit && <div>Vervaldatum {fmtDate(inv.dueDate)}</div>}</div>
      </div>
      <div className="mb-8"><div className="text-gray-500 text-xs uppercase">Aan</div><div className="font-bold">{inv.customer.company ?? inv.customer.name}</div>{inv.customer.company && <div>{inv.customer.name}</div>}<div>{inv.customer.address}</div><div>{inv.customer.postalCode} {inv.customer.city}</div>{inv.customer.vatNumber && <div>BTW {inv.customer.vatNumber}</div>}</div>
      <table className="w-full border-collapse">
        <thead><tr className="border-b-2 border-black text-left"><th className="py-1">Omschrijving</th><th>Paard</th><th className="text-right">Aantal</th><th className="text-right">Prijs</th><th className="text-right">BTW</th><th className="text-right">Bedrag</th></tr></thead>
        <tbody>{inv.lines.map((l) => <tr key={l.id} className="border-b border-gray-200"><td className="py-1">{l.description}</td><td>{l.horseName ?? ""}</td><td className="text-right">{String(Number(l.quantity))}</td><td className="text-right">{fmtMoney(l.unitPrice)}</td><td className="text-right">{String(Number(l.vatRate))}%</td><td className="text-right">{fmtMoney(Number(l.quantity) * Number(l.unitPrice))}</td></tr>)}</tbody>
      </table>
      <div className="flex justify-end mt-4"><table className="text-right"><tbody>
        <tr><td className="pr-6">Netto</td><td>{fmtMoney(t.net)}</td></tr>
        {Object.entries(t.vat).map(([r, v]) => <tr key={r}><td className="pr-6">BTW {r}%</td><td>{fmtMoney(v)}</td></tr>)}
        <tr className="text-lg font-bold border-t-2 border-black"><td className="pr-6 pt-1">Totaal</td><td className="pt-1">{fmtMoney(t.total)}</td></tr>
      </tbody></table></div>
      {inv.notes && <p className="mt-6">{inv.notes}</p>}
      <p className="mt-10 text-gray-600">{isCredit ? "Dit bedrag wordt verrekend of teruggestort." : `Gelieve het totaalbedrag te voldoen voor ${fmtDate(inv.dueDate)} op ${s.iban} onder vermelding van ${inv.number}.`} {s.factuur_voettekst}</p>
    </div>
  );
}
