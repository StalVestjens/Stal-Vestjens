/**
 * WhatsApp-koppeling (filmpjes en foto's per paard binnenhalen).
 *
 * WhatsApp staat niet toe dat software je privéchats uitleest. Wat wél kan: een eigen
 * WhatsApp Business-nummer voor de stal via de officiële WhatsApp Cloud API (Meta).
 * Iedereen (jij, medewerkers, klanten) stuurt een filmpje/foto naar dat nummer met de
 * naam van het paard in het bijschrift ("Dexter" of "Dexter – training 12 okt").
 * Deze module ontvangt het bericht via de webhook, haalt het bestand op bij Meta en
 * zet het in het dossier van het paard. Geen match? Dan komt het in het Postvak (/postvak)
 * en koppel je het daar met één klik.
 *
 * Instellen (Meta for Developers, https://developers.facebook.com):
 *  1. App aanmaken → product "WhatsApp" toevoegen → telefoonnummer koppelen.
 *  2. Webhook: URL = https://<jouw-domein>/api/whatsapp/webhook, verify token = wat je hier
 *     bij "whatsapp_verify_token" invult; abonneer op het veld "messages".
 *  3. Permanent access token (System User) + Phone Number ID + App Secret (App settings › Basic) hier invullen.
 */
import { db } from "../db";
import { getSettings, logSync } from "../settings";
import { saveFile } from "../storage";

const GRAPH = "https://graph.facebook.com/v21.0";

async function cfg() {
  const s = await getSettings(["whatsapp_verify_token", "whatsapp_access_token", "whatsapp_phone_number_id", "whatsapp_app_secret"]);
  return {
    verifyToken: s.whatsapp_verify_token || process.env.WHATSAPP_VERIFY_TOKEN || "",
    accessToken: s.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: s.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    appSecret: s.whatsapp_app_secret || process.env.WHATSAPP_APP_SECRET || "",
  };
}

export async function whatsappVerifyToken() { return (await cfg()).verifyToken; }
export async function whatsappAppSecret() { return (await cfg()).appSecret; }

export async function testWhatsApp(): Promise<{ ok: boolean; message: string }> {
  try {
    const c = await cfg();
    if (!c.accessToken || !c.phoneNumberId) return { ok: false, message: "Access token en Phone Number ID zijn nog niet ingevuld." };
    const r = await fetch(`${GRAPH}/${c.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${c.accessToken}` } });
    const j = await r.json();
    if (!r.ok) return { ok: false, message: j?.error?.message ?? `Meta antwoordde met ${r.status}` };
    return { ok: true, message: `Verbonden met ${j.verified_name ?? ""} (${j.display_phone_number ?? c.phoneNumberId}).` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Zoekt een paard op basis van tekst (bijschrift): langste naam die in de tekst voorkomt wint. */
export async function matchHorse(text: string): Promise<string | null> {
  const t = ` ${norm(text)} `;
  const horses = await db.horse.findMany({ where: { status: { in: ["AANWEZIG", "AFWEZIG"] } }, select: { id: true, name: true, nickname: true } });
  let best: { id: string; len: number } | null = null;
  for (const h of horses) {
    for (const n of [h.name, h.nickname].filter((x): x is string => !!x)) {
      const nn = norm(n);
      if (nn && t.includes(` ${nn} `) && (!best || nn.length > best.len)) best = { id: h.id, len: nn.length };
    }
  }
  return best?.id ?? null;
}

type WaMessage = { id: string; from: string; timestamp: string; type: string; text?: { body: string }; image?: { id: string; mime_type: string; caption?: string }; video?: { id: string; mime_type: string; caption?: string }; document?: { id: string; mime_type: string; caption?: string; filename?: string } };

/** Verwerkt de webhook-payload van Meta. Sla berichten zonder media over. */
export async function handleWhatsAppWebhook(payload: unknown): Promise<void> {
  const c = await cfg();
  const entries = (payload as { entry?: { changes?: { value?: { messages?: WaMessage[]; contacts?: { profile?: { name?: string }; wa_id?: string }[] } }[] }[] })?.entry ?? [];
  for (const e of entries) for (const ch of e.changes ?? []) {
    const v = ch.value;
    const sender = v?.contacts?.[0]?.profile?.name ?? v?.contacts?.[0]?.wa_id ?? "onbekend";
    for (const m of v?.messages ?? []) {
      const media = m.image ?? m.video ?? m.document;
      if (!media) continue;
      const externalId = `whatsapp:${m.id}`;
      // Meta herhaalt berichten als het antwoord te lang duurt; verwerk elk bericht één keer.
      if (await db.mediaFile.findUnique({ where: { externalId } })) continue;
      try {
        // 1) media-URL ophalen, 2) bestand downloaden (beide met het access token)
        const meta = await fetch(`${GRAPH}/${media.id}`, { headers: { Authorization: `Bearer ${c.accessToken}` } }).then((r) => r.json());
        if (!meta?.url) throw new Error(`Geen media-URL voor ${media.id}`);
        const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${c.accessToken}` } });
        if (!bin.ok) throw new Error(`Download mislukt (${bin.status})`);
        const buf = Buffer.from(await bin.arrayBuffer());
        const ext = media.mime_type.split("/")[1]?.split(";")[0] ?? "bin";
        const fileName = m.document?.filename ?? `whatsapp-${m.timestamp}.${ext}`;
        const key = await saveFile(buf, fileName);
        const caption = media.caption ?? "";
        const horseId = caption ? await matchHorse(caption) : null;
        await db.mediaFile.create({
          data: {
            horseId, kind: m.image ? "FOTO" : m.video ? "VIDEO" : "DOCUMENT", source: "WHATSAPP", externalId,
            fileName, mimeType: media.mime_type, size: buf.length, storageKey: key,
            title: caption || null, takenAt: new Date(Number(m.timestamp) * 1000),
            notes: `Via WhatsApp van ${sender}`,
          },
        });
        await logSync("whatsapp", true, horseId ? `Media van ${sender} gekoppeld aan paard.` : `Media van ${sender} in postvak (geen paardnaam herkend in "${caption}").`, 1);
      } catch (err) {
        await logSync("whatsapp", false, `Bericht ${m.id} van ${sender}: ${(err as Error).message}`);
      }
    }
  }
}
