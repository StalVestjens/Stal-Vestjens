import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { readStoredFile } from "@/lib/storage";

/** Bestandstypen die veilig in de browser getoond mogen worden; de rest wordt als download aangeboden. */
const INLINE_TYPES = /^(image\/(jpeg|png|gif|webp|heic|heif)|video\/(mp4|quicktime|webm|x-m4v)|audio\/(mpeg|mp4|ogg|wav)|application\/pdf)$/i;

/** Serveert een opgeslagen bestand (foto, video, röntgen, document) aan ingelogde gebruikers. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new NextResponse("Niet ingelogd", { status: 401 });
  const { id } = await params;
  const f = await db.mediaFile.findUnique({ where: { id } });
  if (!f) return new NextResponse("Niet gevonden", { status: 404 });
  try {
    const buf = await readStoredFile(f.storageKey);
    const inline = INLINE_TYPES.test(f.mimeType);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": inline ? f.mimeType : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.fileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Bestand ontbreekt op schijf", { status: 404 });
  }
}
