"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { deleteStoredFile } from "@/lib/storage";
import type { MediaKind } from "@prisma/client";

export async function assignInboxFile(fd: FormData) {
  await requireSession();
  const horseId = String(fd.get("horseId"));
  await db.mediaFile.update({ where: { id: String(fd.get("id")) }, data: { horseId, kind: String(fd.get("kind")) as MediaKind } });
  revalidatePath("/postvak");
  revalidatePath(`/paarden/${horseId}`);
}

export async function deleteInboxFile(fd: FormData) {
  await requireSession();
  const f = await db.mediaFile.delete({ where: { id: String(fd.get("id")) } });
  await deleteStoredFile(f.storageKey);
  revalidatePath("/postvak");
}
