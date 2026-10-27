"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireSession, hashPassword } from "@/lib/auth";

export async function changeOwnPassword(fd: FormData) {
  const s = await requireSession();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const repeat = String(fd.get("repeat") ?? "");
  if (next.length < 8) redirect("/account?fout=kort");
  if (next !== repeat) redirect("/account?fout=herhaal");
  const user = await db.user.findUnique({ where: { id: s.id } });
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) redirect("/account?fout=huidig");
  await db.user.update({ where: { id: s.id }, data: { passwordHash: await hashPassword(next) } });
  redirect("/account?ok=wachtwoord");
}

export async function updateOwnProfile(fd: FormData) {
  const s = await requireSession();
  const name = String(fd.get("name") ?? "").trim() || s.name;
  const email = String(fd.get("email") ?? "").trim().toLowerCase() || s.email;
  const taken = await db.user.findFirst({ where: { email, NOT: { id: s.id } } });
  if (taken) redirect("/account?fout=email");
  await db.user.update({ where: { id: s.id }, data: { name, email } });
  redirect("/account?ok=profiel");
}
