"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession, hashPassword } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { str, num } from "@/lib/format";
import type { FieldEntity, FieldType, Role } from "@prisma/client";
import { testFleetGo } from "@/lib/integrations/fleetgo";
import { testEquipe } from "@/lib/integrations/equipe";
import { testWhatsApp } from "@/lib/integrations/whatsapp";

export async function saveCompany(fd: FormData) {
  await requireSession("EIGENAAR");
  for (const k of ["bedrijfsnaam", "adres", "kvk", "btw", "iban", "factuur_prefix", "betaaltermijn_dagen", "factuur_voettekst"]) await setSetting(k, String(fd.get(k) ?? "").trim());
  revalidatePath("/instellingen");
}

export async function saveIntegrations(fd: FormData) {
  await requireSession("EIGENAAR");
  const keys = ["fleetgo_client_id", "fleetgo_client_secret", "fleetgo_username", "fleetgo_password", "equipe_token", "whatsapp_verify_token", "whatsapp_access_token", "whatsapp_phone_number_id", "whatsapp_app_secret", "rvo_ubn", "rvo_endpoint", "rvo_cert_path", "rvo_key_path"];
  for (const k of keys) {
    const v = String(fd.get(k) ?? "").trim();
    if (v === "••••••••") continue; // ongewijzigd geheim
    await setSetting(k, v);
  }
  revalidatePath("/instellingen/koppelingen");
}

export async function testIntegration(fd: FormData) {
  await requireSession("EIGENAAR");
  const which = String(fd.get("which"));
  const fn = which === "fleetgo" ? testFleetGo : which === "equipe" ? testEquipe : testWhatsApp;
  const r = await fn();
  redirect(`/instellingen/koppelingen?test=${which}&ok=${r.ok ? 1 : 0}&msg=${encodeURIComponent(r.message)}`);
}

export async function saveUser(fd: FormData) {
  await requireSession("EIGENAAR");
  const id = str(fd.get("id"));
  const password = str(fd.get("password"));
  const data = { name: String(fd.get("name")).trim(), email: String(fd.get("email")).trim().toLowerCase(), role: String(fd.get("role")) as Role, phone: str(fd.get("phone")), active: fd.get("active") === "on" };
  if (id) await db.user.update({ where: { id }, data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
  else await db.user.create({ data: { ...data, passwordHash: await hashPassword(password ?? "welkom123") } });
  revalidatePath("/instellingen/gebruikers");
}

export async function deleteUser(fd: FormData) {
  const s = await requireSession("EIGENAAR");
  const id = String(fd.get("id"));
  if (id === s.id) return;
  await db.user.delete({ where: { id } });
  revalidatePath("/instellingen/gebruikers");
}

export async function saveField(fd: FormData) {
  await requireSession("EIGENAAR");
  const label = String(fd.get("label")).trim();
  const key = (str(fd.get("key")) ?? label).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const entity = String(fd.get("entity")) as FieldEntity;
  const options = String(fd.get("options") ?? "").split(/[\n,]/).map((o) => o.trim()).filter(Boolean);
  await db.customField.upsert({
    where: { entity_key: { entity, key } },
    update: { label, type: String(fd.get("type")) as FieldType, options, sort: num(fd.get("sort")) ?? 0 },
    create: { entity, key, label, type: String(fd.get("type")) as FieldType, options, sort: num(fd.get("sort")) ?? 0 },
  });
  revalidatePath("/instellingen/velden");
}

export async function deleteField(fd: FormData) {
  await requireSession("EIGENAAR");
  await db.customField.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/instellingen/velden");
}

export async function saveProduct(fd: FormData) {
  await requireSession("EIGENAAR");
  const id = str(fd.get("id"));
  const data = { name: String(fd.get("name")).trim(), unitPrice: num(fd.get("unitPrice")) ?? 0, vatRate: num(fd.get("vatRate")) ?? 21, unit: str(fd.get("unit")), active: fd.get("active") !== "off" };
  if (id) await db.product.update({ where: { id }, data });
  else await db.product.create({ data });
  revalidatePath("/instellingen/diensten");
}

export async function deleteProduct(fd: FormData) {
  await requireSession("EIGENAAR");
  await db.product.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/instellingen/diensten");
}
