import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/InvoiceForm";
import { isoDate } from "@/lib/format";
import { updateInvoice } from "../../actions";

export default async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  await requireSession("EIGENAAR");
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { lines: { orderBy: { sort: "asc" } } } });
  if (!inv) notFound();
  if (inv.status !== "CONCEPT") redirect(`/facturen/${id}`);
  const [customers, products, horses] = await Promise.all([
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.horse.findMany({ where: { status: "AANWEZIG" }, orderBy: { name: "asc" }, select: { id: true, name: true, ownerId: true } }),
  ]);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title={`Factuur ${inv.number} bewerken`} />
      <InvoiceForm customers={customers} products={products.map((p) => ({ ...p, unitPrice: String(p.unitPrice), vatRate: String(Number(p.vatRate)) }))} horses={horses} today={isoDate()}
        initial={{ id, customerId: inv.customerId, date: d(inv.date), dueDate: d(inv.dueDate), notes: inv.notes ?? "", lines: inv.lines.map((l) => ({ description: l.description, quantity: String(l.quantity), unitPrice: String(l.unitPrice), vatRate: String(Number(l.vatRate)), horseName: l.horseName ?? "" })) }}
        action={updateInvoice.bind(null, id)} />
    </>
  );
}
