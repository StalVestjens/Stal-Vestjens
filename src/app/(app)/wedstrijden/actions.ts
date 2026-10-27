"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { saveFile } from "@/lib/storage";
import { str, num, date } from "@/lib/format";
import { syncEquipe } from "@/lib/integrations/equipe";
import { importKnhsCsv } from "@/lib/integrations/knhs";

export async function addResult(fd: FormData) {
  await requireSession();
  const horseId = String(fd.get("horseId"));
  const r = await db.competitionResult.create({
    data: {
      horseId,
      date: date(fd.get("date")) ?? new Date(),
      showName: String(fd.get("showName")).trim(),
      className: str(fd.get("className")),
      discipline: str(fd.get("discipline")),
      level: str(fd.get("level")),
      rider: str(fd.get("rider")),
      rank: num(fd.get("rank")) ? Math.round(num(fd.get("rank"))!) : null,
      score: str(fd.get("score")),
      points: num(fd.get("points")),
      prizeMoney: num(fd.get("prizeMoney")),
      location: str(fd.get("location")),
      notes: str(fd.get("notes")),
    },
  });
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    const key = await saveFile(Buffer.from(await file.arrayBuffer()), file.name);
    await db.mediaFile.create({ data: { horseId, resultId: r.id, kind: file.type.startsWith("video/") ? "VIDEO" : "FOTO", fileName: file.name, mimeType: file.type, size: file.size, storageKey: key, title: `${r.showName} ${r.className ?? ""}`.trim(), takenAt: r.date } });
  }
  revalidatePath(`/paarden/${horseId}`);
  revalidatePath("/wedstrijden");
}

export async function deleteResult(fd: FormData) {
  await requireSession();
  const r = await db.competitionResult.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath(`/paarden/${r.horseId}`);
  revalidatePath("/wedstrijden");
}

export async function runEquipeSync() {
  await requireSession();
  await syncEquipe();
  revalidatePath("/wedstrijden");
  revalidatePath("/instellingen/koppelingen");
}

export async function uploadKnhsCsv(fd: FormData) {
  await requireSession();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  await importKnhsCsv(await file.text());
  revalidatePath("/wedstrijden");
}
