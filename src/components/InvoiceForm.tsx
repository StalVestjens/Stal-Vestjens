"use client";
import { useState } from "react";
import Link from "next/link";
import { Field } from "./ui";

type Product = { id: string; name: string; unitPrice: string; vatRate: string; unit: string | null };
type Line = { description: string; quantity: string; unitPrice: string; vatRate: string; horseName: string };
type Props = {
  customers: { id: string; name: string }[];
  products: Product[];
  horses: { id: string; name: string; ownerId: string | null }[];
  initial?: { id: string; customerId: string; date: string; dueDate: string; notes: string; lines: Line[] };
  defaultCustomerId?: string;
  /** Vandaag als "YYYY-MM-DD" (door de server bepaald in NL-tijd). */
  today: string;
  action: (fd: FormData) => Promise<void>;
};

const empty = (): Line => ({ description: "", quantity: "1", unitPrice: "", vatRate: "21", horseName: "" });

export function InvoiceForm({ customers, products, horses, initial, defaultCustomerId, today, action }: Props) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? defaultCustomerId ?? customers[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>(initial?.lines.length ? initial.lines : [empty()]);
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const ownHorses = horses.filter((h) => h.ownerId === customerId);
  const net = lines.reduce((s, l) => s + (Number(l.quantity.replace(",", ".")) || 0) * (Number(l.unitPrice.replace(",", ".")) || 0), 0);
  const vat = lines.reduce((s, l) => s + (Number(l.quantity.replace(",", ".")) || 0) * (Number(l.unitPrice.replace(",", ".")) || 0) * ((Number(l.vatRate) || 0) / 100), 0);
  const eur = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

  return (
    <form action={action} className="space-y-4">
      <section className="card p-4 grid md:grid-cols-4 gap-3">
        <Field label="Klant *">
          <select name="customerId" className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Factuurdatum"><input name="date" type="date" className="input" defaultValue={initial?.date ?? today} /></Field>
        <Field label="Vervaldatum"><input name="dueDate" type="date" className="input" defaultValue={initial?.dueDate ?? ""} placeholder="standaard termijn" /></Field>
        <Field label="Opmerking op factuur"><input name="notes" className="input" defaultValue={initial?.notes ?? ""} /></Field>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Regels</h2>
          <div className="flex gap-2 items-center">
            <select className="select w-auto" onChange={(e) => { const p = products.find((x) => x.id === e.target.value); if (p) setLines((ls) => [...ls.filter((l) => l.description), { description: p.name, quantity: "1", unitPrice: p.unitPrice, vatRate: p.vatRate, horseName: "" }]); e.target.value = ""; }} defaultValue="">
              <option value="">+ Dienst uit lijst</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" className="btn btn-sm" onClick={() => setLines((ls) => [...ls, empty()])}>+ Lege regel</button>
          </div>
        </div>
        <table className="tbl">
          <thead><tr><th>Omschrijving</th><th>Paard</th><th className="w-20">Aantal</th><th className="w-28">Prijs</th><th className="w-20">BTW %</th><th className="w-28 text-right">Bedrag</th><th></th></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td><input name="desc" className="input" value={l.description} onChange={(e) => set(i, { description: e.target.value })} /></td>
                <td>
                  <input name="horse" className="input" list={`horses-${i}`} value={l.horseName} onChange={(e) => set(i, { horseName: e.target.value })} placeholder="optioneel" />
                  <datalist id={`horses-${i}`}>{(ownHorses.length ? ownHorses : horses).map((h) => <option key={h.id} value={h.name} />)}</datalist>
                </td>
                <td><input name="qty" className="input" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} /></td>
                <td><input name="price" className="input" value={l.unitPrice} onChange={(e) => set(i, { unitPrice: e.target.value })} /></td>
                <td><select name="vat" className="select" value={l.vatRate} onChange={(e) => set(i, { vatRate: e.target.value })}><option>21</option><option>9</option><option>0</option></select></td>
                <td className="text-right tabular-nums">{eur((Number(l.quantity.replace(",", ".")) || 0) * (Number(l.unitPrice.replace(",", ".")) || 0))}</td>
                <td><button type="button" className="btn btn-sm btn-danger" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end mt-3 text-sm">
          <div className="space-y-1 text-right">
            <div>Netto <strong className="inline-block w-28">{eur(net)}</strong></div>
            <div>BTW <strong className="inline-block w-28">{eur(vat)}</strong></div>
            <div className="text-base">Totaal <strong className="inline-block w-28">{eur(net + vat)}</strong></div>
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <button className="btn btn-primary">Opslaan als concept</button>
        <Link href={initial ? `/facturen/${initial.id}` : "/facturen"} className="btn">Annuleren</Link>
      </div>
    </form>
  );
}
