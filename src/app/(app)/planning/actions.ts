"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { str, num, date, addDays, todayDate } from "@/lib/format";
import crypto from "crypto";

const refresh = () => { revalidatePath("/planning"); revalidatePath("/"); };

export async function createTask(fd: FormData) {
  await requireSession();
  const base = {
    title: String(fd.get("title")).trim(),
    startTime: str(fd.get("startTime")),
    durationMin: num(fd.get("durationMin")) ? Math.round(num(fd.get("durationMin"))!) : null,
    category: str(fd.get("category")),
    notes: str(fd.get("notes")),
    horseId: str(fd.get("horseId")),
    assigneeId: str(fd.get("assigneeId")),
  };
  const start = date(fd.get("date")) ?? todayDate();
  const repeat = String(fd.get("repeat") ?? "geen");
  const until = date(fd.get("until")) ?? addDays(start, 90);
  // Herhaling: meerdere paarden tegelijk mogelijk (horseIds[]), bv. "paddock" voor 6 paarden
  const horseIds = fd.getAll("horseIds").map(String).filter(Boolean);
  const targets = horseIds.length ? horseIds : [base.horseId];

  const dates: Date[] = [];
  if (repeat === "geen") dates.push(start);
  else {
    const weekdays = fd.getAll("weekdays").map(Number); // 0=zo..6=za
    for (let d = new Date(start); d <= until && dates.length < 400; d = addDays(d, 1)) {
      if (repeat === "dagelijks" || (repeat === "wekelijks" && (weekdays.length === 0 ? d.getUTCDay() === start.getUTCDay() : weekdays.includes(d.getUTCDay())))) dates.push(new Date(d));
    }
  }
  const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
  await db.task.createMany({
    data: targets.flatMap((horseId) => dates.map((date) => ({ ...base, horseId, date, seriesId }))),
  });
  refresh();
}

export async function toggleTask(id: string) {
  await requireSession();
  const t = await db.task.findUnique({ where: { id } });
  if (!t) return;
  const done = t.status !== "KLAAR";
  await db.task.update({ where: { id }, data: { status: done ? "KLAAR" : "OPEN", doneAt: done ? new Date() : null } });
  refresh();
}

export async function setTaskStatus(fd: FormData) {
  await requireSession();
  const status = String(fd.get("status")) as "OPEN" | "BEZIG" | "KLAAR";
  await db.task.update({ where: { id: String(fd.get("id")) }, data: { status, doneAt: status === "KLAAR" ? new Date() : null } });
  refresh();
}

export async function deleteTask(fd: FormData) {
  await requireSession();
  const id = String(fd.get("id"));
  const scope = String(fd.get("scope") ?? "een");
  const t = await db.task.findUnique({ where: { id } });
  if (!t) return;
  if (scope === "reeks" && t.seriesId) await db.task.deleteMany({ where: { seriesId: t.seriesId, date: { gte: t.date } } });
  else await db.task.delete({ where: { id } });
  refresh();
}

export async function copyDay(fd: FormData) {
  await requireSession();
  const from = date(fd.get("from")) ?? todayDate();
  const to = date(fd.get("to")) ?? addDays(from, 1);
  const tasks = await db.task.findMany({ where: { date: from } });
  await db.task.createMany({ data: tasks.map(({ id: _id, createdAt: _c, doneAt: _d, status: _s, seriesId: _q, ...rest }) => ({ ...rest, date: to })) });
  refresh();
}
