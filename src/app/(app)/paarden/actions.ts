"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { readCustomFields } from "@/components/CustomFields";
import { saveFile, deleteStoredFile } from "@/lib/storage";
import { str, num, date } from "@/lib/format";
import type { HealthType, MediaKind, Sex, HorseStatus } from "@prisma/client";

async function horseData(fd: FormData) {
  const fields = await db.customField.findMany({ where: { entity: "HORSE" } });
  return {
    name: String(fd.get("name")).trim(),
    nickname: str(fd.get("nickname")),
    ueln: str(fd.get("ueln")),
    chipNumber: str(fd.get("chipNumber")),
    fei: str(fd.get("fei")),
    knhsNumber: str(fd.get("knhsNumber")),
    studbook: str(fd.get("studbook")),
    sex: (str(fd.get("sex")) as Sex | null) ?? null,
    color: str(fd.get("color")),
    birthDate: date(fd.get("birthDate")),
    sire: str(fd.get("sire")),
    dam: str(fd.get("dam")),
    damSire: str(fd.get("damSire")),
    breeder: str(fd.get("breeder")),
    heightCm: num(fd.get("heightCm")) ? Math.round(num(fd.get("heightCm"))!) : null,
    discipline: str(fd.get("discipline")),
    level: str(fd.get("level")),
    rider: str(fd.get("rider")),
    stall: str(fd.get("stall")),
    status: (str(fd.get("status")) as HorseStatus | null) ?? "AANWEZIG",
    ownerId: str(fd.get("ownerId")),
    notes: str(fd.get("notes")),
    extra: readCustomFields(fd, fields),
  };
}

export async function createHorse(fd: FormData) {
  await requireSession();
  const h = await db.horse.create({ data: await horseData(fd) });
  revalidatePath("/paarden");
  redirect(`/paarden/${h.id}`);
}

export async function updateHorse(id: string, fd: FormData) {
  await requireSession();
  await db.horse.update({ where: { id }, data: await horseData(fd) });
  revalidatePath(`/paarden/${id}`);
  redirect(`/paarden/${id}`);
}

export async function deleteHorse(fd: FormData) {
  await requireSession("EIGENAAR");
  const id = String(fd.get("id"));
  const files = await db.mediaFile.findMany({ where: { horseId: id } });
  await db.horse.delete({ where: { id } });
  await Promise.all(files.map((f) => deleteStoredFile(f.storageKey)));
  revalidatePath("/paarden");
  redirect("/paarden");
}

export async function addHealthRecord(fd: FormData) {
  await requireSession();
  const horseId = String(fd.get("horseId"));
  const rec = await db.healthRecord.create({
    data: {
      horseId,
      type: String(fd.get("type")) as HealthType,
      date: date(fd.get("date")) ?? new Date(),
      title: String(fd.get("title") ?? "").trim() || "Behandeling",
      product: str(fd.get("product")),
      batchNumber: str(fd.get("batchNumber")),
      provider: str(fd.get("provider")),
      cost: num(fd.get("cost")),
      nextDueDate: date(fd.get("nextDueDate")),
      notes: str(fd.get("notes")),
    },
  });
  // Eventuele bijlage (bijv. röntgenfoto of verslag)
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    const key = await saveFile(Buffer.from(await file.arrayBuffer()), file.name);
    const kind: MediaKind = rec.type === "ROENTGEN" ? "ROENTGEN" : file.type.startsWith("image/") ? "FOTO" : file.type.startsWith("video/") ? "VIDEO" : "DOCUMENT";
    await db.mediaFile.create({ data: { horseId, healthId: rec.id, kind, fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size, storageKey: key, title: rec.title, takenAt: rec.date } });
  }
  revalidatePath(`/paarden/${horseId}`);
  revalidatePath("/gezondheid");
  revalidatePath("/");
}

export async function deleteHealthRecord(fd: FormData) {
  await requireSession();
  const id = String(fd.get("id"));
  const rec = await db.healthRecord.delete({ where: { id } });
  revalidatePath(`/paarden/${rec.horseId}`);
  revalidatePath("/gezondheid");
}

export async function uploadMedia(fd: FormData) {
  await requireSession();
  const horseId = String(fd.get("horseId"));
  const kindIn = str(fd.get("kind")) as MediaKind | null;
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    const key = await saveFile(Buffer.from(await file.arrayBuffer()), file.name);
    const kind: MediaKind = kindIn ?? (file.type.startsWith("image/") ? "FOTO" : file.type.startsWith("video/") ? "VIDEO" : "DOCUMENT");
    await db.mediaFile.create({ data: { horseId, kind, fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size, storageKey: key, title: str(fd.get("title")), takenAt: date(fd.get("takenAt")) } });
  }
  revalidatePath(`/paarden/${horseId}`);
}

export async function deleteMedia(fd: FormData) {
  await requireSession();
  const id = String(fd.get("id"));
  const f = await db.mediaFile.delete({ where: { id } });
  await deleteStoredFile(f.storageKey);
  if (f.horseId) revalidatePath(`/paarden/${f.horseId}`);
}

export async function setHorsePhoto(fd: FormData) {
  await requireSession();
  const horseId = String(fd.get("horseId"));
  await db.horse.update({ where: { id: horseId }, data: { photoFileId: str(fd.get("fileId")) } });
  revalidatePath(`/paarden/${horseId}`);
}
