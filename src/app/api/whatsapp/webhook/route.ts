import { NextResponse } from "next/server";
import crypto from "crypto";
import { handleWhatsAppWebhook, whatsappVerifyToken, whatsappAppSecret } from "@/lib/integrations/whatsapp";

/** Meta controleert de webhook met een GET (hub.challenge). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const mode = u.searchParams.get("hub.mode");
  const token = u.searchParams.get("hub.verify_token");
  const challenge = u.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === (await whatsappVerifyToken())) return new NextResponse(challenge ?? "", { status: 200 });
  return new NextResponse("Verify token klopt niet", { status: 403 });
}

/**
 * Inkomende berichten. De handtekening (X-Hub-Signature-256, HMAC met het App Secret) wordt
 * gecontroleerd zodat alleen Meta berichten kan aanleveren. Altijd snel 200 teruggeven.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const appSecret = await whatsappAppSecret();
  if (!appSecret) return new NextResponse("WhatsApp App Secret niet ingesteld", { status: 503 });
  const header = req.headers.get("x-hub-signature-256") ?? "";
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(raw).digest("hex")}`;
  const a = Buffer.from(header), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return new NextResponse("Ongeldige handtekening", { status: 401 });

  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  await handleWhatsAppWebhook(payload);
  return NextResponse.json({ ok: true });
}
