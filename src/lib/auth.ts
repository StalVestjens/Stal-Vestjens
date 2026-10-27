import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "./db";
import type { Role } from "@prisma/client";

const COOKIE = "stal_sessie";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET ontbreekt of is te kort (minimaal 16 tekens). Zet deze in .env.");
    return new TextEncoder().encode("alleen-voor-ontwikkeling-vervang-mij");
  }
  return new TextEncoder().encode(s);
}

export type Session = { id: string; name: string; email: string; role: Role };

export async function login(email: string, password: string): Promise<Session | null> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  const session: Session = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return session;
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

/** Sessie uit de cookie, gecontroleerd tegen de database (account kan intussen gedeactiveerd of van rol veranderd zijn). */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const s = payload as unknown as Session;
    const user = await db.user.findUnique({ where: { id: s.id }, select: { id: true, name: true, email: true, role: true, active: true } });
    if (!user || !user.active) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  } catch {
    return null;
  }
}

/** Gebruik in server components/actions: stuurt door naar login als er geen (geldige) sessie is. */
export async function requireSession(role?: Role): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (role === "EIGENAAR" && s.role !== "EIGENAAR") redirect("/");
  return s;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
