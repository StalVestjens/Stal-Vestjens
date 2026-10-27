import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "@/components/CustomerForm";
import { updateCustomer } from "../../actions";

export default async function EditCustomer({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const [customer, fields] = await Promise.all([db.customer.findUnique({ where: { id } }), db.customField.findMany({ where: { entity: "CUSTOMER" }, orderBy: { sort: "asc" } })]);
  if (!customer) notFound();
  return (<><PageHeader title={`${customer.name} bewerken`} /><CustomerForm customer={customer} fields={fields} action={updateCustomer.bind(null, id)} /></>);
}
