"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { readCustomFields } from "@/components/CustomFields";
import { str, num, date as dateOf, fmtDate, fromLocalInput, addDays } from "@/lib/format";
import type { TransportStatus } from "@prisma/client";
import { syncFleetGo } from "@/lib/integrations/fleetgo";
import { nextInvoiceNumber } from "@/lib/invoice";
import { getSetting } from "@/lib/settings";

const refresh = () => { revalidatePath("/transport"); revalidatePath("/"); };

export async function saveVehicle(fd: FormData) {
  await requireSession();
  const id = str(fd.get("id"));
  const fields = await db.customField.findMany({ where: { entity: "VEHICLE" } });
  const data = {
    name: String(fd.get("name")).trim(),
    licensePlate: String(fd.get("licensePlate")).trim().toUpperCase(),
    type: str(fd.get("type")),
    capacityHorses: num(fd.get("capacityHorses")) ? Math.round(num(fd.get("capacityHorses"))!) : null,
    odometerKm: num(fd.get("odometerKm")) ? Math.round(num(fd.get("odometerKm"))!) : null,
    apkDate: dateOf(fd.get("apkDate")),
    tachoCalibration: dateOf(fd.get("tachoCalibration")),
    lastTachoDownload: dateOf(fd.get("lastTachoDownload")),
    lastCardDownload: dateOf(fd.get("lastCardDownload")),
    notes: str(fd.get("notes")),
    extra: readCustomFields(fd, fields),
  };
  if (id) await db.vehicle.update({ where: { id }, data });
  else await db.vehicle.create({ data });
  refresh();
}

export async function deleteVehicle(fd: FormData) {
  await requireSession("EIGENAAR");
  await db.vehicle.delete({ where: { id: String(fd.get("id")) } });
  refresh();
}

export async function saveTransport(fd: FormData) {
  await requireSession();
  const id = str(fd.get("id"));
  const horseIds = fd.getAll("horseIds").map(String).filter(Boolean);
  const data = {
    date: str(fd.get("date")) ? fromLocalInput(String(fd.get("date"))) : new Date(),
    fromAddress: String(fd.get("fromAddress")).trim(),
    toAddress: String(fd.get("toAddress")).trim(),
    distanceKm: num(fd.get("distanceKm")),
    price: num(fd.get("price")),
    driver: str(fd.get("driver")),
    status: (str(fd.get("status")) as TransportStatus | null) ?? "GEPLAND",
    notes: str(fd.get("notes")),
    vehicleId: str(fd.get("vehicleId")),
    customerId: str(fd.get("customerId")),
  };
  if (id) {
    await db.$transaction([
      db.transportHorse.deleteMany({ where: { transportId: id } }),
      db.transport.update({ where: { id }, data: { ...data, horses: { create: horseIds.map((horseId) => ({ horseId })) } } }),
    ]);
  } else {
    await db.transport.create({ data: { ...data, horses: { create: horseIds.map((horseId) => ({ horseId })) } } });
  }
  refresh();
}

export async function deleteTransport(fd: FormData) {
  await requireSession();
  await db.transport.delete({ where: { id: String(fd.get("id")) } });
  refresh();
}

/** Zet een afgerond transport om in een factuurregel-voorstel (conceptfactuur voor de klant). */
export async function invoiceTransport(fd: FormData) {
  await requireSession("EIGENAAR");
  const t = await db.transport.findUnique({ where: { id: String(fd.get("id")) }, include: { horses: { include: { horse: true } } } });
  if (!t?.customerId) return;
  const days = Number(await getSetting("betaaltermijn_dagen")) || 14;
  const kmProduct = await db.product.findFirst({ where: { name: { contains: "Transport", mode: "insensitive" } } });
  const perKm = t.price == null && t.distanceKm != null && kmProduct;
  await db.invoice.create({
    data: {
      number: await nextInvoiceNumber(), customerId: t.customerId, date: new Date(), dueDate: addDays(new Date(), days),
      lines: { create: [{ description: `Transport ${fmtDate(t.date)}: ${t.fromAddress} → ${t.toAddress}`, quantity: perKm ? Number(t.distanceKm) : 1, unitPrice: perKm ? kmProduct!.unitPrice : (t.price ?? 0), vatRate: 21, horseName: t.horses.map((h) => h.horse.name).join(", ") || null }] },
    },
  });
  await db.transport.update({ where: { id: t.id }, data: { invoiced: true } });
  refresh();
  revalidatePath("/facturen");
}

export async function runFleetGoSync() {
  await requireSession();
  await syncFleetGo();
  refresh();
  revalidatePath("/instellingen/koppelingen");
}
