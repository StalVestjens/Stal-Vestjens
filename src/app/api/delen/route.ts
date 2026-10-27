import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { saveFile } from "@/lib/storage";
import { matchHorse } from "@/lib/integrations/whatsapp";

/**
 * Web Share Target: op Android (Chrome) kun je, na "Toevoegen aan startscherm", vanuit WhatsApp
 * een filmpje of foto delen naar "Stalbeheer". De bestanden komen hier binnen en gaan naar het
 * postvak (of direct naar het paard als de tekst een paardnaam bevat).
 * iPhone ondersteunt dit (nog) niet voor web-apps: gebruik daar het WhatsApp-stalnummer of upload via het dossier.
 */
export async function POST(req: Request) {
  if (!(await getSession())) return NextResponse.redirect(new URL("/login", req.url), 303);
  const fd = await req.formData();
  const text = [fd.get("title"), fd.get("text")].map((x) => String(x ?? "")).join(" ").trim();
  const horseId = text ? await matchHorse(text) : null;
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of files) {
    const key = await saveFile(Buffer.from(await f.arrayBuffer()), f.name || "gedeeld");
    await db.mediaFile.create({ data: { horseId, source: "DELEN", kind: f.type.startsWith("video/") ? "VIDEO" : f.type.startsWith("image/") ? "FOTO" : "DOCUMENT", fileName: f.name || "gedeeld", mimeType: f.type || "application/octet-stream", size: f.size, storageKey: key, title: text || null, takenAt: new Date() } });
  }
  return NextResponse.redirect(new URL(horseId ? `/paarden/${horseId}?tab=media` : "/postvak", req.url), 303);
}
