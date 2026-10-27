"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { readCustomFields } from "@/components/CustomFields";
import { str } from "@/lib/format";

async function data(fd: FormData) {
  const fields = await db.customField.findMany({ where: { entity: "CUSTOMER" } });
  return {
    name: String(fd.get("name")).trim(),
    company: str(fd.get("company")),
    email: str(fd.get("email")),
    phone: str(fd.get("phone")),
    address: str(fd.get("address")),
    postalCode: str(fd.get("postalCode")),
    city: str(fd.get("city")),
    country: str(fd.get("country")) ?? "NL",
    vatNumber: str(fd.get("vatNumber")),
    notes: str(fd.get("notes")),
    extra: readCustomFields(fd, fields),
  };
}

export async function createCustomer(fd: FormData) {
  await requireSession();
  const c = await db.customer.create({ data: await data(fd) });
  revalidatePath("/klanten");
  redirect(`/klanten/${c.id}`);
}

export async function updateCustomer(id: string, fd: FormData) {
  await requireSession();
  await db.customer.update({ where: { id }, data: await data(fd) });
  revalidatePath(`/klanten/${id}`);
  redirect(`/klanten/${id}`);
}

export async function deleteCustomer(fd: FormData) {
  await requireSession("EIGENAAR");
  const id = String(fd.get("id"));
  const invoices = await db.invoice.count({ where: { customerId: id } });
  if (invoices > 0) redirect(`/klanten/${id}?fout=facturen`);
  await db.customer.delete({ where: { id } });
  revalidatePath("/klanten");
  redirect("/klanten");
}
