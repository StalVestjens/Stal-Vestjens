import { db } from "./db";
import { getSetting } from "./settings";
import { localDateStr } from "./format";

type Line = { quantity: unknown; unitPrice: unknown; vatRate: unknown };

/** Totalen van een factuur: netto, btw per tarief, totaal. */
export function invoiceTotals(lines: Line[]) {
  let net = 0;
  const vat: Record<string, number> = {};
  for (const l of lines) {
    const amount = Number(l.quantity) * Number(l.unitPrice);
    net += amount;
    const rate = String(Number(l.vatRate));
    vat[rate] = (vat[rate] ?? 0) + amount * (Number(l.vatRate) / 100);
  }
  const vatTotal = Object.values(vat).reduce((s, v) => s + v, 0);
  return { net: round(net), vat: Object.fromEntries(Object.entries(vat).map(([k, v]) => [k, round(v)])), vatTotal: round(vatTotal), total: round(net + vatTotal) };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Volgend factuurnummer, bv. 2026-0042. */
export async function nextInvoiceNumber(): Promise<string> {
  const prefix = (await getSetting("factuur_prefix")) || localDateStr().slice(0, 4);
  const last = await db.invoice.findFirst({ where: { number: { startsWith: `${prefix}-` } }, orderBy: { number: "desc" } });
  const n = last ? Number(last.number.slice(prefix.length + 1)) + 1 : 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}
