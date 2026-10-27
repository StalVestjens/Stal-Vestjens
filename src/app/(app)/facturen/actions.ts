"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { nextInvoiceNumber } from "@/lib/invoice";
import { getSetting } from "@/lib/settings";
import { str, date, addDays, todayDate } from "@/lib/format";
import type { InvoiceStatus } from "@prisma/client";

const refresh = (id?: string) => { revalidatePath("/facturen"); revalidatePath("/"); if (id) revalidatePath(`/facturen/${id}`); };

function readLines(fd: FormData) {
  const desc = fd.getAll("desc").map(String);
  const qty = fd.getAll("qty").map(String);
  const price = fd.getAll("price").map(String);
  const vat = fd.getAll("vat").map(String);
  const horse = fd.getAll("horse").map(String);
  return desc.map((d, i) => ({ description: d.trim(), quantity: Number((qty[i] ?? "1").replace(",", ".")) || 0, unitPrice: Number((price[i] ?? "0").replace(",", ".")) || 0, vatRate: Number(vat[i] ?? 21) || 0, horseName: horse[i]?.trim() || null, sort: i }))
    .filter((l) => l.description !== "");
}

export async function createInvoice(fd: FormData) {
  await requireSession("EIGENAAR");
  const days = Number(await getSetting("betaaltermijn_dagen")) || 14;
  const d = date(fd.get("date")) ?? new Date();
  const inv = await db.invoice.create({
    data: {
      number: await nextInvoiceNumber(),
      customerId: String(fd.get("customerId")),
      date: d,
      dueDate: date(fd.get("dueDate")) ?? addDays(d, days),
      notes: str(fd.get("notes")),
      lines: { create: readLines(fd) },
    },
  });
  refresh();
  redirect(`/facturen/${inv.id}`);
}

export async function updateInvoice(id: string, fd: FormData) {
  await requireSession("EIGENAAR");
  const inv = await db.invoice.findUnique({ where: { id } });
  if (!inv || inv.status !== "CONCEPT") redirect(`/facturen/${id}`);
  await db.$transaction([
    db.invoiceLine.deleteMany({ where: { invoiceId: id } }),
    db.invoice.update({ where: { id }, data: { customerId: String(fd.get("customerId")), date: date(fd.get("date")) ?? inv.date, dueDate: date(fd.get("dueDate")) ?? inv.dueDate, notes: str(fd.get("notes")), lines: { create: readLines(fd) } } }),
  ]);
  refresh(id);
  redirect(`/facturen/${id}`);
}

export async function setInvoiceStatus(fd: FormData) {
  await requireSession("EIGENAAR");
  const id = String(fd.get("id"));
  const status = String(fd.get("status")) as InvoiceStatus;
  await db.invoice.update({ where: { id }, data: { status, ...(status === "VERZONDEN" ? { sentAt: new Date() } : {}), ...(status === "BETAALD" ? { paidAt: new Date() } : {}) } });
  refresh(id);
}

export async function deleteInvoice(fd: FormData) {
  await requireSession("EIGENAAR");
  const id = String(fd.get("id"));
  const inv = await db.invoice.findUnique({ where: { id } });
  if (inv?.status !== "CONCEPT") redirect(`/facturen/${id}`);
  await db.invoice.delete({ where: { id } });
  refresh();
  redirect("/facturen");
}

/** Creditnota: kopie met negatieve aantallen, gekoppeld aan de oorspronkelijke factuur. */
export async function createCreditNote(fd: FormData) {
  await requireSession("EIGENAAR");
  const id = String(fd.get("id"));
  const inv = await db.invoice.findUnique({ where: { id }, include: { lines: true, credits: true } });
  if (!inv || inv.status === "CONCEPT" || inv.status === "CREDIT" || inv.credits.length > 0) redirect(`/facturen/${id}`);
  const credit = await db.invoice.create({
    data: {
      number: await nextInvoiceNumber(),
      customerId: inv.customerId,
      date: new Date(),
      dueDate: new Date(),
      status: "CREDIT",
      creditOfId: inv.id,
      notes: `Creditnota voor factuur ${inv.number}`,
      lines: { create: inv.lines.map((l) => ({ description: l.description, quantity: -Number(l.quantity), unitPrice: l.unitPrice, vatRate: l.vatRate, horseName: l.horseName, sort: l.sort })) },
    },
  });
  // De oorspronkelijke factuur telt niet meer mee als openstaand (tenzij al betaald: dan blijft de betaling zichtbaar).
  if (inv.status !== "BETAALD") await db.invoice.update({ where: { id }, data: { status: "GECREDITEERD" } });
  refresh();
  redirect(`/facturen/${credit.id}`);
}

/** Herinneringen in bulk: alle verzonden en vervallen facturen op 'Herinnerd' zetten. */
export async function bulkRemind() {
  await requireSession("EIGENAAR");
  const r = await db.invoice.updateMany({ where: { status: "VERZONDEN", dueDate: { lt: todayDate() } }, data: { status: "HERINNERD" } });
  refresh();
  redirect(`/facturen?herinnerd=${r.count}`);
}

/** Maandfacturen: voor elke klant met paarden één conceptfactuur met de gekozen dienst per paard. */
export async function generateMonthly(fd: FormData) {
  await requireSession("EIGENAAR");
  const productId = String(fd.get("productId"));
  const month = String(fd.get("month") ?? ""); // YYYY-MM
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) redirect("/facturen?fout=maand");
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return;
  const customers = await db.customer.findMany({ include: { horses: { where: { status: "AANWEZIG" } } } });
  const label = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(new Date(`${month}-01`));
  const days = Number(await getSetting("betaaltermijn_dagen")) || 14;
  let count = 0;
  for (const c of customers) {
    if (c.horses.length === 0) continue;
    await db.invoice.create({
      data: {
        number: await nextInvoiceNumber(),
        customerId: c.id,
        date: new Date(),
        dueDate: addDays(new Date(), days),
        notes: `Periode: ${label}`,
        lines: { create: c.horses.map((h, i) => ({ description: `${product.name} – ${label}`, quantity: 1, unitPrice: product.unitPrice, vatRate: product.vatRate, horseName: h.name, sort: i })) },
      },
    });
    count++;
  }
  refresh();
  redirect(`/facturen?aangemaakt=${count}`);
}
