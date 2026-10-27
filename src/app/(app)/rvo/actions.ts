"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { str, date } from "@/lib/format";
import type { RvoType } from "@prisma/client";
import { submitToRvo } from "@/lib/integrations/rvo";

const refresh = (horseId?: string) => { revalidatePath("/rvo"); revalidatePath("/"); if (horseId) revalidatePath(`/paarden/${horseId}`); };

export async function addRvoNotification(fd: FormData) {
  await requireSession();
  const horseId = String(fd.get("horseId"));
  await db.rvoNotification.create({
    data: { horseId, type: String(fd.get("type")) as RvoType, eventDate: date(fd.get("eventDate")) ?? new Date(), ubnOther: str(fd.get("ubnOther")) },
  });
  refresh(horseId);
}

export async function markRvoReported(fd: FormData) {
  await requireSession();
  const n = await db.rvoNotification.update({ where: { id: String(fd.get("id")) }, data: { status: "GEMELD", reportedAt: new Date(), rvoRef: str(fd.get("rvoRef")), error: null } });
  refresh(n.horseId);
}

export async function sendRvoNotification(fd: FormData) {
  await requireSession("EIGENAAR");
  const id = String(fd.get("id"));
  const n = await db.rvoNotification.findUnique({ where: { id }, include: { horse: true } });
  if (!n) return;
  const res = await submitToRvo(n);
  await db.rvoNotification.update({ where: { id }, data: res.ok ? { status: "GEMELD", reportedAt: new Date(), rvoRef: res.ref, error: null } : { status: "FOUT", error: res.error } });
  refresh(n.horseId);
}

export async function deleteRvoNotification(fd: FormData) {
  await requireSession();
  const n = await db.rvoNotification.delete({ where: { id: String(fd.get("id")) } });
  refresh(n.horseId);
}
