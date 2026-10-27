import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "@/components/CustomerForm";
import { createCustomer } from "../actions";

export default async function NewCustomer() {
  await requireSession();
  const fields = await db.customField.findMany({ where: { entity: "CUSTOMER" }, orderBy: { sort: "asc" } });
  return (<><PageHeader title="Nieuwe klant" /><CustomerForm fields={fields} action={createCustomer} /></>);
}
