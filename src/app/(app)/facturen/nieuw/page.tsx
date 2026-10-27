import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/InvoiceForm";
import { isoDate } from "@/lib/format";
import { createInvoice } from "../actions";

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ klant?: string }> }) {
  await requireSession("EIGENAAR");
  const { klant } = await searchParams;
  const [customers, products, horses] = await Promise.all([
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.horse.findMany({ where: { status: "AANWEZIG" }, orderBy: { name: "asc" }, select: { id: true, name: true, ownerId: true } }),
  ]);
  return (
    <>
      <PageHeader title="Nieuwe factuur" />
      <InvoiceForm customers={customers} products={products.map((p) => ({ ...p, unitPrice: String(p.unitPrice), vatRate: String(Number(p.vatRate)) }))} horses={horses} defaultCustomerId={klant} today={isoDate()} action={createInvoice} />
    </>
  );
}
