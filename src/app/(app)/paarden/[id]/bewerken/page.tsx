import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { HorseForm } from "@/components/HorseForm";
import { updateHorse } from "../../actions";

export default async function EditHorse({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const [horse, customers, fields] = await Promise.all([
    db.horse.findUnique({ where: { id } }),
    db.customer.findMany({ orderBy: { name: "asc" } }),
    db.customField.findMany({ where: { entity: "HORSE" }, orderBy: { sort: "asc" } }),
  ]);
  if (!horse) notFound();
  return (
    <>
      <PageHeader title={`${horse.name} bewerken`} />
      <HorseForm horse={horse} customers={customers} fields={fields} action={updateHorse.bind(null, id)} />
    </>
  );
}
