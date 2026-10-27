import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { HorseForm } from "@/components/HorseForm";
import { createHorse } from "../actions";

export default async function NewHorse() {
  await requireSession();
  const [customers, fields] = await Promise.all([
    db.customer.findMany({ orderBy: { name: "asc" } }),
    db.customField.findMany({ where: { entity: "HORSE" }, orderBy: { sort: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Nieuw paard" />
      <HorseForm customers={customers} fields={fields} action={createHorse} />
    </>
  );
}
