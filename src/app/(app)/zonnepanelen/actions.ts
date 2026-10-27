"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { str, num, date } from "@/lib/format";

const refresh = () => revalidatePath("/zonnepanelen");

export async function saveInstallation(fd: FormData) {
  await requireSession();
  const id = str(fd.get("id"));
  const data = { name: String(fd.get("name")).trim(), location: str(fd.get("location")), panels: num(fd.get("panels")) ? Math.round(num(fd.get("panels"))!) : null, peakPowerKwp: num(fd.get("peakPowerKwp")), inverter: str(fd.get("inverter")), installedAt: date(fd.get("installedAt")), feedInRate: num(fd.get("feedInRate")), notes: str(fd.get("notes")) };
  if (id) await db.solarInstallation.update({ where: { id }, data });
  else await db.solarInstallation.create({ data });
  refresh();
}

export async function deleteInstallation(fd: FormData) {
  await requireSession("EIGENAAR");
  await db.solarInstallation.delete({ where: { id: String(fd.get("id")) } });
  refresh();
}

export async function addReading(fd: FormData) {
  await requireSession();
  const installationId = String(fd.get("installationId"));
  const day = date(fd.get("date")) ?? new Date();
  const data = { producedKwh: num(fd.get("producedKwh")) ?? 0, feedInKwh: num(fd.get("feedInKwh")), notes: str(fd.get("notes")) };
  await db.solarReading.upsert({ where: { installationId_date: { installationId, date: day } }, update: data, create: { installationId, date: day, ...data } });
  refresh();
}

/** CSV-import: kolommen datum;opbrengst_kwh;teruglevering_kwh (export uit omvormer-app zoals SolarEdge, Enphase, Growatt). */
export async function importReadingsCsv(fd: FormData) {
  await requireSession();
  const installationId = String(fd.get("installationId"));
  const file = fd.get("file");
  if (!(file instanceof File)) return;
  const text = await file.text();
  const rows = text.split(/\r?\n/).map((l) => l.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, ""))).filter((r) => r.length >= 2);
  let n = 0;
  for (const r of rows) {
    const dstr = r[0].match(/^\d{4}-\d{2}-\d{2}/) ? r[0].slice(0, 10) : r[0].match(/^(\d{2})[-/](\d{2})[-/](\d{4})/) ? `${r[0].slice(6, 10)}-${r[0].slice(3, 5)}-${r[0].slice(0, 2)}` : null;
    const kwh = Number(r[1].replace(",", "."));
    if (!dstr || !isFinite(kwh)) continue;
    const feed = r[2] ? Number(r[2].replace(",", ".")) : null;
    const day = new Date(dstr);
    await db.solarReading.upsert({ where: { installationId_date: { installationId, date: day } }, update: { producedKwh: kwh, feedInKwh: feed }, create: { installationId, date: day, producedKwh: kwh, feedInKwh: feed } });
    n++;
  }
  refresh();
}

export async function deleteReading(fd: FormData) {
  await requireSession();
  await db.solarReading.delete({ where: { id: String(fd.get("id")) } });
  refresh();
}
