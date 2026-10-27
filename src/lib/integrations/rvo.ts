/**
 * RVO-koppeling: I&R paardachtigen (meldingen aanvoer/afvoer/geboorte/dood/import/export).
 *
 * RVO biedt voor bedrijfsmanagementsystemen een SOAP-webservice (zie "Berichtenboek I&R",
 * https://www.rvo.nl/onderwerpen/webservices). Voorwaarden:
 *  - je softwaresysteem is bij RVO aangemeld (e-mail naar dr.fab.edv@rvo.nl: welke webservice,
 *    testaccount), en
 *  - de verbinding loopt via een PKIoverheid-certificaat (mutual TLS).
 *
 * Omdat het Berichtenboek de exacte XML-velden per meldingstype voorschrijft (en RVO eerst een
 * testaccount geeft), is hieronder het raamwerk gebouwd: certificaat-TLS, SOAP-envelop, versturen,
 * antwoord parsen. De exacte elementnamen in `buildBody` moeten na ontvangst van het Berichtenboek
 * en het testaccount nog tegen RVO's WSDL worden gecontroleerd; de functie markeert de melding
 * daarom als FOUT met een duidelijke boodschap zolang RVO_ENDPOINT niet is ingesteld.
 */
import type { RvoNotification, Horse } from "@prisma/client";
import { getSettings } from "../settings";

type Input = RvoNotification & { horse: Horse };
type Result = { ok: true; ref: string } | { ok: false; error: string };

const TYPE_CODE: Record<string, string> = { AANVOER: "AANVOER", AFVOER: "AFVOER", GEBOORTE: "GEBOORTE", DOOD: "DOOD", IMPORT: "IMPORT", EXPORT: "EXPORT" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildBody(n: Input, ubn: string): string {
  const d = n.eventDate.toISOString().slice(0, 10);
  // Raamwerk: elementnamen volgens de opbouw in het Berichtenboek I&R (melding + dier + locatie).
  return `<ir:VastleggenMelding xmlns:ir="http://www.rvo.nl/ir/paardachtigen">
    <ir:Melding>
      <ir:Diersoort>PAARDACHTIGE</ir:Diersoort>
      <ir:Meldingtype>${TYPE_CODE[n.type]}</ir:Meldingtype>
      <ir:Meldingdatum>${d}</ir:Meldingdatum>
      <ir:UBN>${esc(ubn)}</ir:UBN>
      ${n.ubnOther ? `<ir:UBNTegenpartij>${esc(n.ubnOther)}</ir:UBNTegenpartij>` : ""}
      <ir:Dier>
        ${n.horse.ueln ? `<ir:Levensnummer>${esc(n.horse.ueln)}</ir:Levensnummer>` : ""}
        ${n.horse.chipNumber ? `<ir:Chipnummer>${esc(n.horse.chipNumber)}</ir:Chipnummer>` : ""}
      </ir:Dier>
    </ir:Melding>
  </ir:VastleggenMelding>`;
}

export async function submitToRvo(n: Input): Promise<Result> {
  const s = await getSettings(["rvo_ubn", "rvo_endpoint", "rvo_cert_path", "rvo_key_path"]);
  const ubn = s.rvo_ubn || process.env.RVO_UBN || "";
  const endpoint = s.rvo_endpoint || process.env.RVO_ENDPOINT || "";
  const certPath = s.rvo_cert_path || process.env.RVO_CERT_PATH || "";
  const keyPath = s.rvo_key_path || process.env.RVO_KEY_PATH || "";
  if (!ubn) return { ok: false, error: "UBN ontbreekt (Instellingen › Koppelingen › RVO)." };
  if (!n.horse.ueln && !n.horse.chipNumber) return { ok: false, error: "Paard heeft geen UELN of chipnummer." };
  if (!endpoint || !certPath || !keyPath) return { ok: false, error: "RVO-webservice nog niet geconfigureerd (endpoint + PKIoverheid-certificaat). Meld via Mijn RVO en vink af." };

  try {
    // Mutual TLS met het PKIoverheid-certificaat; Node's fetch ondersteunt geen client-certificaten,
    // daarom via https.request.
    const [{ readFile }, https] = await Promise.all([import("fs/promises"), import("https")]);
    const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)]);
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Header/><soapenv:Body>${buildBody(n, ubn)}</soapenv:Body></soapenv:Envelope>`;
    const url = new URL(endpoint);
    const body: string = await new Promise((resolve, reject) => {
      const req = https.request({ hostname: url.hostname, port: url.port || 443, path: url.pathname + url.search, method: "POST", cert, key, headers: { "Content-Type": "text/xml; charset=utf-8", "Content-Length": Buffer.byteLength(envelope), SOAPAction: "VastleggenMelding" } }, (res) => {
        let data = ""; res.setEncoding("utf8"); res.on("data", (c) => (data += c)); res.on("end", () => (res.statusCode && res.statusCode < 300 ? resolve(data) : reject(new Error(`RVO ${res.statusCode}: ${data.slice(0, 300)}`))));
      });
      req.on("error", reject); req.write(envelope); req.end();
    });
    const fault = body.match(/<faultstring>([\s\S]*?)<\/faultstring>/i)?.[1];
    if (fault) return { ok: false, error: fault.trim() };
    const ref = body.match(/<(?:\w+:)?Meldingnummer>([^<]+)</i)?.[1] ?? body.match(/<(?:\w+:)?Referentie>([^<]+)</i)?.[1] ?? "verzonden";
    return { ok: true, ref };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
