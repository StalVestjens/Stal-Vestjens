import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getSettings } from "@/lib/settings";
import { readStoredFile } from "@/lib/storage";

/** Het bedrijfslogo: het geüploade logo (Instellingen › Bedrijf) of anders het standaardlogo uit de app. */
export async function GET() {
  const s = await getSettings(["logo_key", "logo_mime"]);
  try {
    if (s.logo_key) {
      const buf = await readStoredFile(s.logo_key);
      return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": s.logo_mime || "image/png", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
    }
  } catch { /* val terug op het standaardlogo */ }
  const buf = await readFile(path.join(process.cwd(), "public", "logo.jpg"));
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" } });
}
