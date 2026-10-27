import Link from "next/link";
import type { Customer, CustomField } from "@prisma/client";
import { Field } from "./ui";
import { CustomFieldsForm, extraOf } from "./CustomFields";

export function CustomerForm({ customer: c, fields, action }: { customer?: Customer; fields: CustomField[]; action: (fd: FormData) => Promise<void> }) {
  return (
    <form action={action} className="space-y-4">
      <section className="card p-4 grid md:grid-cols-3 gap-3">
        <Field label="Naam *"><input name="name" className="input" required defaultValue={c?.name} /></Field>
        <Field label="Bedrijf"><input name="company" className="input" defaultValue={c?.company ?? ""} /></Field>
        <Field label="BTW-nummer"><input name="vatNumber" className="input" defaultValue={c?.vatNumber ?? ""} /></Field>
        <Field label="E-mail"><input name="email" type="email" className="input" defaultValue={c?.email ?? ""} /></Field>
        <Field label="Telefoon"><input name="phone" className="input" defaultValue={c?.phone ?? ""} /></Field>
        <Field label="Land"><input name="country" className="input" defaultValue={c?.country ?? "NL"} /></Field>
        <Field label="Adres"><input name="address" className="input" defaultValue={c?.address ?? ""} /></Field>
        <Field label="Postcode"><input name="postalCode" className="input" defaultValue={c?.postalCode ?? ""} /></Field>
        <Field label="Plaats"><input name="city" className="input" defaultValue={c?.city ?? ""} /></Field>
        <Field label="Notities" className="md:col-span-3"><textarea name="notes" className="textarea" rows={3} defaultValue={c?.notes ?? ""} /></Field>
        <CustomFieldsForm fields={fields} values={extraOf(c?.extra)} />
      </section>
      <div className="flex gap-2">
        <button className="btn btn-primary">Opslaan</button>
        <Link href={c ? `/klanten/${c.id}` : "/klanten"} className="btn">Annuleren</Link>
      </div>
    </form>
  );
}
